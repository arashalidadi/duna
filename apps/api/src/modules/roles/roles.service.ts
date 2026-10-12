import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { CreateRoleDto, ListRolesQueryDto, SetRolePermissionsDto, UpdateRoleDto } from './dto/roles.dto';
import { AccountAccess } from '../../common/auth/account-access';
import { RELEASE_OVERRIDE_PERMISSION } from '../../common/auth/types';
import { AuditService } from '../../common/infrastructure/audit/audit.service';

const roleSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.RoleSelect;

const withCounts = {
  _count: { select: { users: true } },
  permissions: { select: { permission: { select: { id: true, code: true, module: true, action: true } } } },
} as const;

type RoleWithRelations = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  _count?: { users: number };
  permissions?: { permission: { id: string; code: string; module: string; action: string } }[];
};

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async list(query: ListRolesQueryDto) {
    const pagination = parsePagination(query);
    const where: Prisma.RoleWhereInput = {
      ...(query.isActive === true ? { deletedAt: null } : {}),
      ...(query.isActive === false ? { deletedAt: { not: null } } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.role.count({ where }),
      this.prisma.role.findMany({
        where,
        select: { ...roleSelect, ...withCounts },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { code: 'asc' },
      }),
    ]);
    return buildPaginated(this.mapItems(items), total, pagination);
  }

  async listActive() {
    const roles = await this.prisma.role.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    return roles;
  }

  async findById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: { ...roleSelect, ...withCounts },
    });
    if (!role) throw new NotFoundException('Role not found');
    return this.mapOne(role);
  }

  async create(dto: CreateRoleDto, actor: AccountAccess) {
    const existing = await this.prisma.role.findUnique({ where: { code: dto.code } });
    if (existing && !existing.deletedAt) {
      throw new BadRequestException('A role with this code already exists');
    }
    const role = await this.prisma.role.create({
      data: { code: dto.code, name: dto.name, description: dto.description, isSystem: false },
      select: { ...roleSelect, ...withCounts },
    });

    // DEC-044..048 / DEC-116 — role lifecycle changes are audited.
    await this.audit.record({
      action: 'role:create',
      entityType: 'Role',
      entityId: role.id,
      actorId: actor.id,
      actorEmail: actor.email,
      afterData: { code: role.code, name: role.name },
    });

    return this.mapOne(role);
  }

  async update(id: string, dto: UpdateRoleDto, actor: AccountAccess) {
    const before = await this.findById(id);
    const role = await this.prisma.role.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
      select: { ...roleSelect, ...withCounts },
    });

    await this.audit.record({
      action: 'role:update',
      entityType: 'Role',
      entityId: id,
      actorId: actor.id,
      actorEmail: actor.email,
      beforeData: { name: before.name, description: before.description },
      afterData: { name: role.name, description: role.description },
    });

    return this.mapOne(role);
  }

  /** Activate = clear deletedAt; deactivate = soft-delete (set deletedAt). */
  async setActive(id: string, isActive: boolean, actor: AccountAccess) {
    const role = await this.findById(id);
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deactivated');
    }
    const updated = await this.prisma.role.update({
      where: { id },
      data: { deletedAt: isActive ? null : new Date() },
      select: { ...roleSelect, ...withCounts },
    });

    await this.audit.record({
      action: 'role:activate',
      entityType: 'Role',
      entityId: id,
      actorId: actor.id,
      actorEmail: actor.email,
      beforeData: { isActive: !isActive },
      afterData: { isActive },
    });

    return this.mapOne(updated);
  }

  async setPermissions(id: string, dto: SetRolePermissionsDto, actor: AccountAccess) {
    const before = await this.findById(id);
    const permissionIds = dto.permissionIds;
    const perms = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true, code: true },
    });
    if (perms.length !== permissionIds.length) {
      throw new BadRequestException('One or more permissions do not exist');
    }

    // DEC-116 (T-F) — release-exception authority may only be granted by the
    // primary administrator. Ordinary ADMIN roles hold `role:permissions` and could
    // otherwise self-escalate; this closes that path at the server.
    await this.assertCanGrantReleaseOverride(
      actor,
      perms.map((p: { code: string }) => p.code)
    );

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      }),
    ]);

    // DEC-044..048 / DEC-116 — permission assignment is the most security-sensitive
    // role operation. The complete before/after code sets are recorded so that any
    // grant of release authority is traceable to the person who granted it.
    const beforeCodes = (before.permissions ?? []).map((p) => p.code);
    const afterCodes = perms.map((p: { code: string }) => p.code);
    await this.audit.record({
      action: 'role:permissions:set',
      entityType: 'Role',
      entityId: id,
      actorId: actor.id,
      actorEmail: actor.email,
      beforeData: { permissionCodes: beforeCodes },
      afterData: { permissionCodes: afterCodes },
      metadata: {
        grantedByPrimaryAdmin: actor.isPrimaryAdmin === true,
        added: afterCodes.filter((c: string) => !beforeCodes.includes(c)),
        removed: beforeCodes.filter((c: string) => !afterCodes.includes(c)),
        releaseOverrideGranted:
          afterCodes.includes(RELEASE_OVERRIDE_PERMISSION) &&
          !beforeCodes.includes(RELEASE_OVERRIDE_PERMISSION),
      },
    });

    return this.findById(id);
  }

  /**
   * DEC-116 (T-F) — only the primary administrator may grant or revoke
   * `release:override`.
   *
   * This is what makes "the primary administrator has explicitly granted the
   * permission" a real, server-enforced property rather than a convention: the
   * grant is refused at write time and recorded, so its provenance is auditable.
   * The primary administrator is exempt by implicit full authority — no approval
   * above them is created.
   */
  private async assertCanGrantReleaseOverride(
    actor: AccountAccess,
    permissionCodes: string[]
  ): Promise<void> {
    if (actor.isPrimaryAdmin === true) return;
    if (!permissionCodes.includes(RELEASE_OVERRIDE_PERMISSION)) return;
    throw new ForbiddenException(
      `Only the primary administrator may grant or revoke '${RELEASE_OVERRIDE_PERMISSION}' (release-exception approval authority).`
    );
  }

  private mapItems(items: RoleWithRelations[]) {
    return items.map((i) => this.mapOne(i));
  }

  private mapOne(item: RoleWithRelations) {
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      isSystem: item.isSystem,
      isActive: !item.deletedAt,
      userCount: item._count?.users ?? 0,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      permissions: (item.permissions ?? []).map((p) => p.permission),
    };
  }
}