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
import { RELEASE_OVERRIDE_PERMISSION } from '../../common/auth/types';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuditContext } from '../../common/infrastructure/audit/audit.types';
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
  isPrimaryAdmin: true,
  deletedAt: true,
  lastLoginAt: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  passwordChangedAt: true,
  createdAt: true,
  updatedAt: true,
  portalCustomerId: true,
} satisfies Prisma.UserSelect;

const roleRelations = {
  roles: {
    select: {
      role: { select: { id: true, code: true, name: true } },
    },
  },
  portalCustomer: {
    select: { id: true, name: true, code: true },
  },
} satisfies Prisma.UserSelect;

type UserWithRoles = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  isPrimaryAdmin: boolean;
  lastLoginAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roles: { role: { id: string; code: string; name: string } }[];
  portalCustomerId?: string | null;
  portalCustomer?: { id: string; name: string; code: string } | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

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
    if (dto.portalCustomerId) {
      await this.assertValidPortalCustomer(dto.portalCustomerId);
    }

    // DEC-116 (T-F): a role set carrying release-exception authority may only be
    // assigned by the primary administrator. See assertCanGrantReleaseOverride.
    await this.assertCanGrantReleaseOverride(_actor, dto.roleIds);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        fullName: dto.fullName,
        passwordHash,
        passwordChangedAt: new Date(),
        ...(dto.portalCustomerId ? { portalCustomer: { connect: { id: dto.portalCustomerId } } } : {}),
        roles: {
          create: dto.roleIds.map((roleId) => ({ roleId })),
        },
      },
      select: { ...userSelect, ...roleRelations },
    });

    // DEC-044..048 / DEC-116 — user creation is a sensitive operation and is audited.
    await this.audit.record({
      action: 'user:create',
      entityType: 'User',
      entityId: user.id,
      actorId: _actor.id,
      actorEmail: _actor.email,
      afterData: { email: user.email, fullName: user.fullName, roleIds: dto.roleIds },
      metadata: { isPrimaryAdmin: user.isPrimaryAdmin === true },
    });

    return this.mapOne(user);
  }

  async update(id: string, dto: UpdateUserDto, _actor: AccountAccess) {
    const before = await this.findById(id);
    await this.assertPrimaryAdminUnchanged(id, dto as unknown as Record<string, unknown>);

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
    if (dto.portalCustomerId !== undefined) {
      if (dto.portalCustomerId) {
        await this.assertValidPortalCustomer(dto.portalCustomerId);
        data.portalCustomer = { connect: { id: dto.portalCustomerId } };
      } else {
        data.portalCustomer = { disconnect: true };
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: { ...userSelect, ...roleRelations },
    });

    // DEC-044..048 — user modification is audited with before/after state.
    await this.audit.record({
      action: 'user:update',
      entityType: 'User',
      entityId: id,
      actorId: _actor.id,
      actorEmail: _actor.email,
      beforeData: { email: before.email, fullName: before.fullName },
      afterData: { email: user.email, fullName: user.fullName },
    });

    return this.mapOne(user);
  }

  async setActive(id: string, dto: SetUserActiveDto, actor: AccountAccess) {
    await this.findById(id);

    // DEC-116 (T-I): the primary administrator must never be deactivated. Doing so
    // would remove the company owner's only route into the system.
    await this.assertNotDeactivatingPrimaryAdmin(id, dto.isActive);

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

    await this.audit.record({
      action: 'user:activate',
      entityType: 'User',
      entityId: id,
      actorId: actor.id,
      actorEmail: actor.email,
      beforeData: { isActive: !dto.isActive },
      afterData: { isActive: dto.isActive },
    });

    return this.mapOne(user);
  }

  async setRoles(id: string, dto: SetUserRolesDto, actor: AccountAccess) {
    const target = await this.findById(id);
    await this.validateRoleIds(dto.roleIds);

    // DEC-116 (T-F): a role set carrying release-exception authority may only be
    // assigned by the primary administrator.
    await this.assertCanGrantReleaseOverride(actor, dto.roleIds);

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

    // DEC-044..048 / DEC-116 — role assignment is a sensitive operation; the
    // before/after role sets and the actor are recorded so that any grant of
    // release-exception authority is traceable to the person who granted it.
    await this.audit.record({
      action: 'user:roles:set',
      entityType: 'User',
      entityId: id,
      actorId: actor.id,
      actorEmail: actor.email,
      beforeData: { roleIds: target.roles.map((r) => r.role.id) },
      afterData: { roleIds: dto.roleIds },
      metadata: { grantedByPrimaryAdmin: actor.isPrimaryAdmin === true },
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

    await this.audit.record({
      action: 'user:password:reset',
      entityType: 'User',
      entityId: id,
      actorId: _actor.id,
      actorEmail: _actor.email,
      metadata: { method: 'admin-reset', sessionsInvalidated: true },
    });

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

    await this.audit.record({
      action: 'user:password:self',
      entityType: 'User',
      entityId: actor.id,
      actorId: actor.id,
      actorEmail: actor.email,
      metadata: { method: 'self-service' },
    });
  }

  // ---------------------------------------------------------------------------
  // DEC-116 — Primary administrator (company owner)
  //
  // The owner holds full system authority implicitly. These guards protect that
  // authority against accidental destruction. They do NOT create any approval
  // step above the owner: the owner is never blocked from acting, and no other
  // user's approval is ever required.
  // ---------------------------------------------------------------------------

  /**
   * Blocks deactivation of the primary administrator. The owner's account must
   * always remain active — it is the only guaranteed route into the system.
   */
  private async assertNotDeactivatingPrimaryAdmin(
    userId: string,
    nextIsActive: boolean
  ): Promise<void> {
    if (nextIsActive) return;
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPrimaryAdmin: true },
    });
    if (target?.isPrimaryAdmin === true) {
      throw new ForbiddenException(
        'The primary administrator cannot be deactivated. Transfer the primary administrator role to another user first.'
      );
    }
  }

  /**
   * Blocks any update that would alter the isPrimaryAdmin flag.
   *
   * The public UpdateUserDto carries no such field, so TypeScript already prevents
   * this; the runtime check is defence in depth against a future DTO change
   * silently stripping or granting the owner's authority. Succession must go
   * through transferPrimaryAdmin, which moves the flag atomically and audits it.
   */
  private async assertPrimaryAdminUnchanged(
    userId: string,
    dto: Record<string, unknown>
  ): Promise<void> {
    if (!Object.prototype.hasOwnProperty.call(dto, 'isPrimaryAdmin')) return;
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPrimaryAdmin: true },
    });
    if (target?.isPrimaryAdmin === true) {
      throw new ForbiddenException(
        'The primary administrator designation cannot be changed here. Use the transfer operation.'
      );
    }
  }

  /**
   * DEC-116 (T-F) — release-exception authority may only be conferred by the
   * primary administrator.
   *
   * Possession of `release:override` is necessary but not sufficient for a manager
   * to exercise release authority: it must have been granted explicitly by the
   * owner. Enforcing that at write time (rather than inferring it at read time)
   * is what makes the grant's provenance auditable — and it introduces no
   * approval layer above the owner, who is exempt by implicit full authority.
   */
  private async assertCanGrantReleaseOverride(
    actor: AccountAccess,
    roleIds: string[]
  ): Promise<void> {
    if (actor.isPrimaryAdmin === true || roleIds.length === 0) return;

    const grant = await this.prisma.rolePermission.findFirst({
      where: {
        roleId: { in: roleIds },
        permission: { code: RELEASE_OVERRIDE_PERMISSION },
      },
      select: { id: true },
    });
    if (grant) {
      throw new ForbiddenException(
        `Only the primary administrator may grant '${RELEASE_OVERRIDE_PERMISSION}' (release-exception approval authority).`
      );
    }
  }

  /**
   * DEC-116 — move the primary administrator designation to another user.
   *
   * Atomic and audited. Both writes happen in one transaction, so the system can
   * never be left with zero primary administrators. The target must exist and be
   * active. Only the current primary administrator may perform a transfer.
   */
  async transferPrimaryAdmin(actor: AccountAccess, targetUserId: string) {
    if (actor.isPrimaryAdmin !== true) {
      throw new ForbiddenException('Only the primary administrator may transfer the designation');
    }
    if (actor.id === targetUserId) {
      throw new BadRequestException('The target user is already the primary administrator');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, isActive: true, deletedAt: true, isPrimaryAdmin: true },
    });
    if (!target || target.deletedAt) {
      throw new NotFoundException('User not found');
    }
    if (!target.isActive) {
      throw new BadRequestException('The target user must be active');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: actor.id },
        data: { isPrimaryAdmin: false },
      }),
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { isPrimaryAdmin: true },
      }),
    ]);

    await this.audit.record({
      action: 'user:primary-admin:transfer',
      entityType: 'User',
      entityId: targetUserId,
      actorId: actor.id,
      actorEmail: actor.email,
      beforeData: { primaryAdminId: actor.id, primaryAdminEmail: actor.email },
      afterData: { primaryAdminId: targetUserId, primaryAdminEmail: target.email },
      metadata: { reason: 'owner succession' },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { ...userSelect, ...roleRelations },
    });
    return this.mapOne(user!);
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

  /** A portal link must point at a live, non-deleted customer. */
  private async assertValidPortalCustomer(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException('Invalid portal customer');
    }
  }

  private mapOne(item: UserWithRoles & { portalCustomerId?: string | null; portalCustomer?: { id: string; name: string; code: string } | null }) {
    return {
      id: item.id,
      portalCustomerId: item.portalCustomerId ?? null,
      portalCustomer: item.portalCustomer
        ? { id: item.portalCustomer.id, name: item.portalCustomer.name, code: item.portalCustomer.code }
        : null,
      email: item.email,
      fullName: item.fullName,
      isActive: item.isActive,
      isPrimaryAdmin: item.isPrimaryAdmin === true,
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