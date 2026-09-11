import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AccountAccess } from '../../common/auth/account-access';
import {
  CreateUserDto,
  ListUsersQueryDto,
  ResetUserPasswordDto,
  SetUserActiveDto,
  SetUserRolesDto,
  UpdateUserDto,
} from './dto/users.dto';

const BCRYPT_ROUNDS = 12;

// Sanitized output — NEVER returns passwordHash, hashes, or secrets.
const userSelect = {
  id: true,
  email: true,
  fullName: true,
  isActive: true,
  deletedAt: true,
  lastLoginAt: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  passwordChangedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const roleRelations = {
  roles: {
    select: {
      role: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.UserSelect;

type UserWithRoles = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roles: { role: { id: string; code: string; name: string } }[];
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListUsersQueryDto, _actor: AccountAccess) {
    const pagination = parsePagination(query);

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: { ...userSelect, ...roleRelations },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return buildPaginated(this.mapListItems(items), total, pagination);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...userSelect, ...roleRelations },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }
    return {
      ...user,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      lockedUntil: user.lockedUntil ? user.lockedUntil.toISOString() : null,
      passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
      roles: user.roles.map((r) => r.role),
    };
  }

  async create(dto: CreateUserDto, _actor: AccountAccess) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    await this.validateRoleIds(dto.roleIds);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        fullName: dto.fullName,
        passwordHash,
        passwordChangedAt: new Date(),
        roles: {
          create: dto.roleIds.map((roleId) => ({ roleId })),
        },
      },
      select: { ...userSelect, ...roleRelations },
    });

    return this.mapOne(user);
  }

  async update(id: string, dto: UpdateUserDto, _actor: AccountAccess) {
    await this.findById(id);

    const data: Prisma.UserUpdateInput = {};
    if (dto.email !== undefined) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email.trim().toLowerCase() },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('A user with this email already exists');
      }
      data.email = dto.email.trim().toLowerCase();
    }
    if (dto.fullName !== undefined) {
      data.fullName = dto.fullName;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: { ...userSelect, ...roleRelations },
    });
    return this.mapOne(user);
  }

  async setActive(id: string, dto: SetUserActiveDto, actor: AccountAccess) {
    await this.findById(id);
    // A user cannot deactivate their own account (would lock themselves out).
    if (actor.id === id && !dto.isActive) {
      throw new ForbiddenException('You cannot disable your own account');
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: dto.isActive,
        ...(dto.isActive
          ? { failedLoginAttempts: 0, lockedUntil: null }
          : {}),
      },
      select: { ...userSelect, ...roleRelations },
    });
    return this.mapOne(user);
  }

  async setRoles(id: string, dto: SetUserRolesDto, actor: AccountAccess) {
    const target = await this.findById(id);
    await this.validateRoleIds(dto.roleIds);

    // Prevent removing your own last/only roles (self-lockout of management).
    if (actor.id === id) {
      const existingRoleIds = target.roles.map((r) => r.id);
      const removed = existingRoleIds.filter((r) => !dto.roleIds.includes(r));
      const retained = dto.roleIds.filter((r) => existingRoleIds.includes(r));
      if (removed.length > 0 && retained.length === 0) {
        throw new ForbiddenException('You cannot remove all of your own roles');
      }
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
      }),
    ]);

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...userSelect, ...roleRelations },
    });
    return this.mapOne(user!);
  }

  async resetPassword(id: string, dto: ResetUserPasswordDto, _actor: AccountAccess) {
    await this.findById(id);
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
    await this.invalidateUserRefreshTokens(id);
    return { reset: true };
  }

  async setOwnPassword(
    actor: AccountAccess,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: actor.id } });
    if (!user) throw new NotFoundException('User not found');
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: actor.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    await this.invalidateUserRefreshTokens(actor.id);
  }

  private async validateRoleIds(roleIds: string[]): Promise<void> {
    const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds } } });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles do not exist');
    }
    const active = roles.filter((r) => !r.deletedAt);
    if (active.length !== roleIds.length) {
      throw new BadRequestException('Cannot assign an inactive role');
    }
  }

  private async invalidateUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private mapListItems(items: UserWithRoles[]) {
    return items.map((i) => this.mapOne(i));
  }

  private mapOne(item: UserWithRoles) {
    return {
      id: item.id,
      email: item.email,
      fullName: item.fullName,
      isActive: item.isActive,
      lastLoginAt: item.lastLoginAt ? item.lastLoginAt.toISOString() : null,
      lockedUntil: item.lockedUntil ? item.lockedUntil.toISOString() : null,
      passwordChangedAt: item.passwordChangedAt ? item.passwordChangedAt.toISOString() : null,
      failedLoginAttempts: item.failedLoginAttempts,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      roles: item.roles.map((r) => r.role),
    };
  }
}