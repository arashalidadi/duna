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
import { AUDIT_EXPORT_PERMISSION, AUDIT_EXPORT_ROLE, RELEASE_OVERRIDE_PERMISSION } from '../../common/auth/types';
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

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.$transaction(async (tx) => {
      await this.lockRoles(tx, dto.roleIds);
      // Preflight above is for an early error only. A role may have been
      // deactivated between that read and this transaction: check activity
      // again under the locks before creating a membership.
      const active = await tx.role.count({ where: { id: { in: dto.roleIds }, deletedAt: null } });
      if (active !== dto.roleIds.length) {
        throw new BadRequestException('One or more roles do not exist or are inactive');
      }
      await this.assertCanGrantPrivilegedRoles(_actor, [], dto.roleIds, tx);
      const row = await tx.user.create({
        data: { email: dto.email.trim().toLowerCase(), fullName: dto.fullName,
          passwordHash, passwordChangedAt: new Date(),
          ...(dto.portalCustomerId ? { portalCustomer: { connect: { id: dto.portalCustomerId } } } : {}),
          roles: { create: dto.roleIds.map((roleId) => ({ roleId })) } },
        select: { ...userSelect, ...roleRelations },
      });
      // No password or hash is ever written to the audit trail.
      await this.audit.recordIn(tx, { action: 'user:create', entityType: 'User', entityId: row.id,
        actorId: _actor.id, actorEmail: _actor.email,
        afterData: { email: row.email, fullName: row.fullName, roleIds: dto.roleIds },
        metadata: { isPrimaryAdmin: row.isPrimaryAdmin === true } });
      return row;
    });
    return this.mapOne(user);
  }

  async update(id: string, dto: UpdateUserDto, _actor: AccountAccess) {
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

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.user.findUnique({ where: { id },
        select: { email: true, fullName: true, portalCustomerId: true,
          isPrimaryAdmin: true, roles: { select: { roleId: true } }, deletedAt: true } });
      if (!before || before.deletedAt) throw new NotFoundException('User not found');
      await this.lockRoles(tx, before.roles.map((role) => role.roleId));
      await this.assertCanManageTarget(tx, id, before.isPrimaryAdmin, _actor);
      const row = await tx.user.update({ where: { id }, data,
        select: { ...userSelect, ...roleRelations } });
      await this.audit.recordIn(tx, { action: 'user:update', entityType: 'User', entityId: id,
        actorId: _actor.id, actorEmail: _actor.email,
        beforeData: { email: before.email, fullName: before.fullName,
          portalCustomerId: before.portalCustomerId ?? null },
        afterData: { email: row.email, fullName: row.fullName,
          portalCustomerId: row.portalCustomerId ?? null } });
      return row;
    });
    return this.mapOne(user);
  }

  async setActive(id: string, dto: SetUserActiveDto, actor: AccountAccess) {
    // A user cannot deactivate their own account (would lock themselves out).
    if (actor.id === id && !dto.isActive) {
      throw new ForbiddenException('You cannot disable your own account');
    }
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.user.findUnique({ where: { id },
        select: { isActive: true, isPrimaryAdmin: true,
          roles: { select: { roleId: true } }, deletedAt: true } });
      if (!before || before.deletedAt) throw new NotFoundException('User not found');
      await this.lockRoles(tx, before.roles.map((role) => role.roleId));
      await this.assertCanManageTarget(tx, id, before.isPrimaryAdmin, actor);
      // Check after locking so a concurrent ownership transfer cannot hand the
      // designation to an account that is about to be disabled.
      if (!dto.isActive && before.isPrimaryAdmin) {
        throw new ForbiddenException(
          'The primary administrator cannot be deactivated. Transfer the primary administrator role to another user first.',
        );
      }
      const row = await tx.user.update({ where: { id },
        data: { isActive: dto.isActive,
          ...(dto.isActive ? { failedLoginAttempts: 0, lockedUntil: null } : {}) },
        select: { ...userSelect, ...roleRelations } });
      await this.audit.recordIn(tx, { action: dto.isActive ? 'user:reactivate' : 'user:deactivate',
        entityType: 'User', entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { isActive: before.isActive }, afterData: { isActive: dto.isActive } });
      return row;
    });
    return this.mapOne(user);
  }

  async setRoles(id: string, dto: SetUserRolesDto, actor: AccountAccess) {
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.user.findUnique({ where: { id },
        select: { deletedAt: true, isPrimaryAdmin: true, roles: { select: { roleId: true } } } });
      if (!before || before.deletedAt) throw new NotFoundException('User not found');
      if (before.isPrimaryAdmin && actor.isPrimaryAdmin !== true) {
        throw new ForbiddenException('Only the primary administrator may change their own role membership');
      }
      const priorIds = before.roles.map((role) => role.roleId);
      if (new Set(dto.roleIds).size !== dto.roleIds.length) throw new BadRequestException('Duplicate role ids');
      await this.lockRoles(tx, [...priorIds, ...dto.roleIds]);
      await this.assertCanManageTarget(tx, id, before.isPrimaryAdmin, actor);
      const active = await tx.role.count({ where: { id: { in: dto.roleIds }, deletedAt: null } });
      if (active !== dto.roleIds.length) throw new BadRequestException('One or more roles do not exist or are inactive');
      await this.assertCanGrantPrivilegedRoles(actor, priorIds, dto.roleIds, tx);
      // Prevent self-lockout of management, without restricting the owner's
      // implicit authority if their ordinary roles are intentionally changed.
      if (actor.id === id && !actor.isPrimaryAdmin && priorIds.length && !dto.roleIds.some((r) => priorIds.includes(r))) {
        throw new ForbiddenException('You cannot remove all of your own roles');
      }
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({ data: dto.roleIds.map((roleId) => ({ userId: id, roleId })) });
      await this.audit.recordIn(tx, { action: 'user:roles:set', entityType: 'User', entityId: id,
        actorId: actor.id, actorEmail: actor.email,
        beforeData: { roleIds: priorIds }, afterData: { roleIds: dto.roleIds },
        metadata: { grantedByPrimaryAdmin: actor.isPrimaryAdmin === true } });
      return tx.user.findUniqueOrThrow({ where: { id }, select: { ...userSelect, ...roleRelations } });
    });
    return this.mapOne(user);
  }

  async resetPassword(id: string, dto: ResetUserPasswordDto, _actor: AccountAccess) {
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;
      const target = await tx.user.findUnique({ where: { id },
        select: { isPrimaryAdmin: true, deletedAt: true, roles: { select: { roleId: true } } } });
      if (!target || target.deletedAt) throw new NotFoundException('User not found');
      await this.lockRoles(tx, target.roles.map((role) => role.roleId));
      await this.assertCanManageTarget(tx, id, target.isPrimaryAdmin, _actor);
      await tx.user.update({ where: { id }, data: {
        passwordHash, passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null } });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() } });
      await this.audit.recordIn(tx, { action: 'user:password:reset', entityType: 'User',
        entityId: id, actorId: _actor.id, actorEmail: _actor.email,
        metadata: { method: 'admin-reset', sessionsInvalidated: true } });
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
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: actor.id },
        data: { passwordHash, passwordChangedAt: new Date() } });
      await tx.refreshToken.updateMany({ where: { userId: actor.id, revokedAt: null },
        data: { revokedAt: new Date() } });
      await this.audit.recordIn(tx, { action: 'user:password:self', entityType: 'User',
        entityId: actor.id, actorId: actor.id, actorEmail: actor.email,
        metadata: { method: 'self-service', sessionsInvalidated: true } });
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

  /** User-management permissions cannot become a way to hijack the owner or a
   * more privileged account via password reset, profile edit or deactivation.
   * Caller holds the target User lock and the target's Role locks before this
   * read, so a simultaneous permission change cannot bypass the comparison. */
  private async assertCanManageTarget(tx: Prisma.TransactionClient, targetId: string,
    targetIsPrimaryAdmin: boolean, actor: AccountAccess): Promise<void> {
    if (actor.isPrimaryAdmin === true) return;
    if (targetIsPrimaryAdmin) {
      throw new ForbiddenException('Only the primary administrator may manage their own account');
    }
    // Include dormant memberships. Resetting an account's password (or editing
    // its profile) while its privileged role is inactive would let a delegated
    // manager take over that authority when the owner reactivates the role.
    const grants = await tx.rolePermission.findMany({
      where: { role: { users: { some: { userId: targetId } } } },
      select: { permission: { select: { code: true } } },
    });
    if (grants.some(({ permission }) =>
      permission.code === AUDIT_EXPORT_PERMISSION ||
      permission.code === RELEASE_OVERRIDE_PERMISSION ||
      !actor.permissions.includes(permission.code))) {
      throw new ForbiddenException('Cannot manage a more privileged account');
    }
  }

  /** DEC-116/P11: owner-only release-exception and audit-export delegation.
   * A resubmission that leaves authority unchanged is allowed; the lockRoles
   * caller prevents a concurrent role-grant edit from racing this comparison. */
  private async assertCanGrantPrivilegedRoles(
    actor: AccountAccess, beforeRoleIds: string[], afterRoleIds: string[],
    tx: Prisma.TransactionClient
  ): Promise<void> {
    if (actor.isPrimaryAdmin === true) return;
    for (const code of [RELEASE_OVERRIDE_PERMISSION, AUDIT_EXPORT_PERMISSION]) {
      const [heldBefore, heldAfter] = await Promise.all([
        this.rolesCarryPermission(tx, beforeRoleIds, code),
        this.rolesCarryPermission(tx, afterRoleIds, code),
      ]);
      if (heldBefore !== heldAfter) {
        throw new ForbiddenException(`Only the primary administrator may grant or revoke '${code}' (${code ===
          RELEASE_OVERRIDE_PERMISSION ? 'release-exception approval authority' : 'audit export authority'}).`);
      }
    }
    // A reserved export role cannot be assigned in a temporarily incomplete
    // seed state and then gain export later without a primary-admin decision.
    const exporter = await tx.role.findUnique({ where: { code: AUDIT_EXPORT_ROLE }, select: { id: true } });
    if (exporter && beforeRoleIds.includes(exporter.id) !== afterRoleIds.includes(exporter.id)) {
      throw new ForbiddenException('Only the primary administrator may assign or revoke the audit exporter role');
    }
    // A delegated user administrator cannot assign themselves (or create a
    // second account with) roles holding powers beyond their own. lockRoles()
    // holds SHARE locks while this check and the write commit, so a concurrent
    // role-permission edit cannot swap in stronger grants after the check.
    const added = afterRoleIds.filter((id) => !beforeRoleIds.includes(id));
    if (added.length) {
      const grants = await tx.rolePermission.findMany({ where: { roleId: { in: added } },
        select: { permission: { select: { code: true } } } });
      if (grants.some((grant) => !actor.permissions.includes(grant.permission.code))) {
        throw new ForbiddenException('Cannot assign roles beyond your own authority');
      }
    }
  }

  private async rolesCarryPermission(tx: Prisma.TransactionClient, roleIds: string[], code: string): Promise<boolean> {
    if (!roleIds.length) return false;
    // RolePermission has a composite primary key; select roleId, not a non-existent id.
    return (await tx.rolePermission.findFirst({ where: { roleId: { in: roleIds },
      permission: { code } }, select: { roleId: true } })) !== null;
  }

  /** Serialize assignments against role permission changes (locked FOR UPDATE). */
  private async lockRoles(tx: Prisma.TransactionClient, roleIds: string[]) {
    const ids = [...new Set(roleIds)].sort();
    if (ids.length) await tx.$queryRaw`SELECT "id" FROM "Role" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR SHARE`;
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

    await this.prisma.$transaction(async (tx) => {
      // Serialize succession against user deactivation and another transfer.
      // Deterministic lock order avoids a deadlock on two competing successors.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${Prisma.join(
        [actor.id, targetUserId].sort(),
      )}) ORDER BY "id" FOR UPDATE`;
      const current = await tx.user.findUnique({ where: { id: actor.id },
        select: { isPrimaryAdmin: true, isActive: true, deletedAt: true } });
      const successor = await tx.user.findUnique({ where: { id: targetUserId },
        select: { isActive: true, deletedAt: true, email: true } });
      if (!current?.isPrimaryAdmin || !current.isActive || current.deletedAt ||
        !successor?.isActive || successor.deletedAt) {
        throw new ForbiddenException('Primary-administrator transfer prerequisites changed');
      }
      await tx.user.update({ where: { id: actor.id }, data: { isPrimaryAdmin: false } });
      await tx.user.update({ where: { id: targetUserId }, data: { isPrimaryAdmin: true } });
      await this.audit.recordIn(tx, { action: 'user:primary-admin:transfer',
        entityType: 'User', entityId: targetUserId, actorId: actor.id, actorEmail: actor.email,
        beforeData: { primaryAdminId: actor.id, primaryAdminEmail: actor.email },
        afterData: { primaryAdminId: targetUserId, primaryAdminEmail: successor.email },
        metadata: { reason: 'owner succession' } });
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