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
import { AUDIT_EXPORT_PERMISSION, AUDIT_EXPORT_ROLE, RELEASE_OVERRIDE_PERMISSION } from '../../common/auth/types';
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
    const role = await this.prisma.$transaction(async (tx) => {
      const row = await tx.role.create({
        data: { code: dto.code, name: dto.name, description: dto.description, isSystem: false },
        select: { ...roleSelect, ...withCounts },
      });
      await this.audit.recordIn(tx, { action: 'role:create', entityType: 'Role', entityId: row.id,
        actorId: actor.id, actorEmail: actor.email, afterData: { code: row.code, name: row.name } });
      return row;
    });
    return this.mapOne(role);
  }

  async update(id: string, dto: UpdateRoleDto, actor: AccountAccess) {
    const role = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Role" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.role.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Role not found');
      if (before.isSystem && actor.isPrimaryAdmin !== true) {
        throw new ForbiddenException('Only the primary administrator may edit system roles');
      }
      await this.assertCanManageRole(tx, id, actor);
      const row = await tx.role.update({
        where: { id }, data: { name: dto.name, description: dto.description },
        select: { ...roleSelect, ...withCounts },
      });
      await this.audit.recordIn(tx, { action: 'role:update', entityType: 'Role', entityId: id,
        actorId: actor.id, actorEmail: actor.email,
        beforeData: { name: before.name, description: before.description },
        afterData: { name: row.name, description: row.description } });
      return row;
    });
    return this.mapOne(role);
  }

  /** Activate = clear deletedAt; deactivate = soft-delete (set deletedAt). */
  async setActive(id: string, isActive: boolean, actor: AccountAccess) {
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Role" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.role.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Role not found');
      if (before.isSystem) throw new ForbiddenException('System roles cannot be deactivated');
      // Reactivating a dormant role also reactivates every permission it holds
      // for its members. A delegated role editor must not resurrect an owner's
      // release-exception delegation (or any power beyond their own).
      await this.assertCanManageRole(tx, id, actor);
      const row = await tx.role.update({ where: { id },
        data: { deletedAt: isActive ? null : new Date() }, select: { ...roleSelect, ...withCounts } });
      await this.audit.recordIn(tx, { action: isActive ? 'role:reactivate' : 'role:deactivate',
        entityType: 'Role', entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { isActive: !before.deletedAt }, afterData: { isActive } });
      return row;
    });
    return this.mapOne(updated);
  }

  async setPermissions(id: string, dto: SetRolePermissionsDto, actor: AccountAccess) {
    // A row lock serializes competing grant editors; the before/after audit and
    // the grants must commit together (never post-commit best-effort logging).
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Role" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.role.findUnique({ where: { id },
        include: { permissions: { include: { permission: true } } } });
      if (!before) throw new NotFoundException('Role not found');
      if (before.isSystem && actor.isPrimaryAdmin !== true) {
        throw new ForbiddenException('Only the primary administrator may change system roles');
      }
      const permissionIds = dto.permissionIds;
      if (new Set(permissionIds).size !== permissionIds.length) {
        throw new BadRequestException('Duplicate permission ids');
      }
      const perms = await tx.permission.findMany({
        where: { id: { in: permissionIds } }, select: { id: true, code: true },
      });
      if (perms.length !== permissionIds.length) {
        throw new BadRequestException('One or more permissions do not exist');
      }
      const beforeCodes = before.permissions.map((p) => p.permission.code);
      const afterCodes = perms.map((p) => p.code);
      // A delegated editor cannot even change a more powerful target role:
      // revocation or no-op regrant would otherwise bypass owner delegation.
      this.assertCanManageRoleCodes(beforeCodes, actor);
      // A delegated role editor cannot mint capabilities they do not already
      // possess. In particular, editing their OWN role must not self-escalate.
      if (actor.isPrimaryAdmin !== true && afterCodes.some((code) =>
        !beforeCodes.includes(code) && !actor.permissions.includes(code))) {
        throw new ForbiddenException('Cannot grant permissions beyond your own authority');
      }
      this.assertCanChangePrivilegedPermissions(actor, beforeCodes, afterCodes);
      if (afterCodes.includes(AUDIT_EXPORT_PERMISSION) && before.code !== AUDIT_EXPORT_ROLE) {
        throw new ForbiddenException('Audit export may be granted only to the dedicated AUDIT_EXPORTER role');
      }
      if (before.code === AUDIT_EXPORT_ROLE &&
        (afterCodes.length !== 2 || !afterCodes.includes('audit:read') ||
          !afterCodes.includes(AUDIT_EXPORT_PERMISSION))) {
        throw new BadRequestException('The dedicated audit exporter role may hold only audit:read and audit:export');
      }

      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      });
      await this.audit.recordIn(tx, { action: 'role:permissions:set', entityType: 'Role',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { permissionCodes: beforeCodes }, afterData: { permissionCodes: afterCodes },
        metadata: { grantedByPrimaryAdmin: actor.isPrimaryAdmin === true,
          added: afterCodes.filter((code) => !beforeCodes.includes(code)),
          removed: beforeCodes.filter((code) => !afterCodes.includes(code)),
          releaseOverrideGranted: afterCodes.includes(RELEASE_OVERRIDE_PERMISSION) &&
            !beforeCodes.includes(RELEASE_OVERRIDE_PERMISSION),
          auditExportGranted: afterCodes.includes(AUDIT_EXPORT_PERMISSION) &&
            !beforeCodes.includes(AUDIT_EXPORT_PERMISSION) },
      });
    });
    return this.findById(id);
  }

  /** The caller locks the Role row before loading its grants. Mutations of a
   * powerful role, including reactivation and innocuous-looking edits, are
   * owner-only when the role holds special delegations or broader authority. */
  private async assertCanManageRole(tx: Prisma.TransactionClient, id: string, actor: AccountAccess) {
    if (actor.isPrimaryAdmin === true) return;
    const grants = await tx.rolePermission.findMany({ where: { roleId: id },
      select: { permission: { select: { code: true } } } });
    this.assertCanManageRoleCodes(grants.map((p) => p.permission.code), actor);
  }

  private assertCanManageRoleCodes(codes: string[], actor: AccountAccess) {
    if (actor.isPrimaryAdmin === true) return;
    if (codes.some((code) => code === RELEASE_OVERRIDE_PERMISSION ||
      code === AUDIT_EXPORT_PERMISSION || !actor.permissions.includes(code))) {
      throw new ForbiddenException('Cannot manage a role with authority beyond your own');
    }
  }

  /** Owner-only changes to release-exception and audit-export delegation.
   * Resubmitting the same complete permission set is not a new grant; both
   * additions and revocations are otherwise denied to an ordinary ADMIN. */
  private assertCanChangePrivilegedPermissions(
    actor: AccountAccess, beforeCodes: string[], afterCodes: string[]
  ): void {
    if (actor.isPrimaryAdmin === true) return;
    for (const code of [RELEASE_OVERRIDE_PERMISSION, AUDIT_EXPORT_PERMISSION]) {
      if (beforeCodes.includes(code) !== afterCodes.includes(code)) {
        throw new ForbiddenException(
          `Only the primary administrator may grant or revoke '${code}' (${code === RELEASE_OVERRIDE_PERMISSION
            ? 'release-exception approval authority' : 'audit export authority'}).`
        );
      }
    }
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