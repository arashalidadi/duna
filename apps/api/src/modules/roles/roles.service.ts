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
  constructor(private readonly prisma: PrismaService) {}

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

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { code: dto.code } });
    if (existing && !existing.deletedAt) {
      throw new BadRequestException('A role with this code already exists');
    }
    const role = await this.prisma.role.create({
      data: { code: dto.code, name: dto.name, description: dto.description, isSystem: false },
      select: { ...roleSelect, ...withCounts },
    });
    return this.mapOne(role);
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findById(id);
    const role = await this.prisma.role.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
      select: { ...roleSelect, ...withCounts },
    });
    return this.mapOne(role);
  }

  /** Activate = clear deletedAt; deactivate = soft-delete (set deletedAt). */
  async setActive(id: string, isActive: boolean) {
    const role = await this.findById(id);
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deactivated');
    }
    const updated = await this.prisma.role.update({
      where: { id },
      data: { deletedAt: isActive ? null : new Date() },
      select: { ...roleSelect, ...withCounts },
    });
    return this.mapOne(updated);
  }

  async setPermissions(id: string, dto: SetRolePermissionsDto) {
    await this.findById(id);
    const permissionIds = dto.permissionIds;
    const perms = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });
    if (perms.length !== permissionIds.length) {
      throw new BadRequestException('One or more permissions do not exist');
    }
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      }),
    ]);
    return this.findById(id);
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