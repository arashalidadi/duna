import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { canReadSource, parseRule, recipients, requireOffice, type Recipients,
  type RuleInput } from './notification.policy';

type Tx = Prisma.TransactionClient;
const json = (v: unknown) => v as Prisma.InputJsonValue;
function data(input: RuleInput) {
  return { name: input.name, trigger: input.trigger, conditions: json(input.conditions),
    recipients: json(input.recipients), escalationRecipients: json(input.escalationRecipients),
    channels: json(input.channels), delayMinutes: input.delayMinutes,
    repeatMinutes: input.repeatMinutes, maxPerRecord: input.maxPerRecord,
    maxPerDay: input.maxPerDay, escalateAfterMinutes: input.escalateAfterMinutes };
}

@Injectable()
export class NotificationRulesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async assertRecipients(tx: Tx, selected: Recipients): Promise<void> {
    const [roles, users] = await Promise.all([
      tx.role.count({ where: { id: { in: selected.roleIds }, deletedAt: null } }),
      tx.user.count({ where: { id: { in: selected.userIds }, deletedAt: null, isActive: true,
        portalCustomerId: null, portalAgentId: null } }),
    ]);
    if (roles !== selected.roleIds.length || users !== selected.userIds.length) {
      throw new BadRequestException('Recipients must be existing office users or active roles');
    }
  }
  async list(actor: AuthenticatedUser) {
    requireOffice(actor, 'notification:manage');
    return this.prisma.notificationRule.findMany({ orderBy: { createdAt: 'desc' },
      include: { _count: { select: { events: true, inbox: true } } } });
  }
  async detail(id: string, actor: AuthenticatedUser) {
    requireOffice(actor, 'notification:manage');
    const rule = await this.prisma.notificationRule.findUnique({ where: { id },
      include: { _count: { select: { events: true, inbox: true } } } });
    if (!rule) throw new NotFoundException('Notification rule not found');
    return rule;
  }
  async create(input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'notification:manage');
    const rule = parseRule(input);
    return this.prisma.$transaction(async (tx) => {
      await this.assertRecipients(tx, rule.recipients);
      await this.assertRecipients(tx, rule.escalationRecipients);
      const created = await tx.notificationRule.create({ data: {
        ...data(rule), isActive: false, createdById: actor.id, updatedById: actor.id } });
      await this.audit.recordIn(tx, { action: 'notification.rule.create', entityType: 'NotificationRule',
        entityId: created.id, actorId: actor.id, actorEmail: actor.email,
        afterData: { ...rule, isActive: false } });
      return created;
    });
  }
  async update(id: string, input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'notification:manage');
    const spec = parseRule(input);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "NotificationRule" WHERE "id" = ${id} FOR UPDATE`;
      const previous = await tx.notificationRule.findUnique({ where: { id } });
      if (!previous) throw new NotFoundException('Notification rule not found');
      if (previous.trigger !== spec.trigger) {
        throw new ConflictException('Trigger cannot change after creation; create another rule instead');
      }
      await this.assertRecipients(tx, spec.recipients);
      await this.assertRecipients(tx, spec.escalationRecipients);
      const result = await tx.notificationRule.update({ where: { id }, data: {
        ...data(spec), updatedById: actor.id } });
      await this.audit.recordIn(tx, { action: 'notification.rule.update', entityType: 'NotificationRule',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: previous, afterData: result });
      return result;
    });
  }
  async setActive(id: string, input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'notification:manage');
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).length !== 1 || typeof (input as { isActive?: unknown }).isActive !== 'boolean') {
      throw new BadRequestException('Provide isActive as a boolean');
    }
    const isActive = (input as { isActive: boolean }).isActive;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "NotificationRule" WHERE "id" = ${id} FOR UPDATE`;
      const previous = await tx.notificationRule.findUnique({ where: { id } });
      if (!previous) throw new NotFoundException('Notification rule not found');
      if (isActive) {
        parseRule({ name: previous.name, trigger: previous.trigger, conditions: previous.conditions,
          recipients: previous.recipients, escalationRecipients: previous.escalationRecipients,
          channels: previous.channels, delayMinutes: previous.delayMinutes,
          repeatMinutes: previous.repeatMinutes, maxPerRecord: previous.maxPerRecord,
          maxPerDay: previous.maxPerDay, escalateAfterMinutes: previous.escalateAfterMinutes });
        await this.assertRecipients(tx, recipients(previous.recipients));
        await this.assertRecipients(tx, recipients(previous.escalationRecipients, true));
      }
      if (previous.isActive === isActive) return previous;
      const result = await tx.notificationRule.update({ where: { id }, data: { isActive, updatedById: actor.id } });
      await this.audit.recordIn(tx, { action: isActive ? 'notification.rule.enable' : 'notification.rule.disable',
        entityType: 'NotificationRule', entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { isActive: previous.isActive }, afterData: { isActive } });
      return result;
    });
  }
  async recipients(actor: AuthenticatedUser) {
    requireOffice(actor, 'notification:manage', 'user:read', 'role:read');
    const [users, roles] = await Promise.all([
      this.prisma.user.findMany({ where: { isActive: true, deletedAt: null, portalCustomerId: null,
        portalAgentId: null }, select: { id: true, email: true, fullName: true },
        orderBy: { email: 'asc' }, take: 500 }),
      this.prisma.role.findMany({ where: { deletedAt: null },
        select: { id: true, code: true, name: true }, orderBy: { code: 'asc' }, take: 200 }),
    ]);
    return { users, roles };
  }
  async deliveries(id: string, actor: AuthenticatedUser, page = 1) {
    requireOffice(actor, 'notification:manage');
    if (!Number.isInteger(page) || page < 1 || page > 100000) throw new BadRequestException('Invalid page');
    await this.detail(id, actor);
    return this.prisma.notificationDelivery.findMany({
      where: { inbox: { ruleId: id } },
      select: { id: true, channel: true, status: true, attempts: true, lastErrorCode: true,
        deliveredAt: true, createdAt: true, inbox: { select: { userId: true, eventId: true,
          stage: true, cycle: true } } },
      orderBy: { createdAt: 'desc' }, take: 50, skip: (page - 1) * 50,
    });
  }
  async inbox(actor: AuthenticatedUser) {
    requireOffice(actor, 'notification:read');
    const items = await this.prisma.notificationInbox.findMany({
      where: { userId: actor.id, dismissedAt: null,
        deliveries: { some: { channel: 'IN_APP', status: 'DELIVERED' } } },
      select: { id: true, stage: true, cycle: true, readAt: true, createdAt: true,
        rule: { select: { name: true, trigger: true } },
        event: { select: { sourceId: true, eventKey: true } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    return items.filter((item) => canReadSource(actor, item.rule.trigger, item.event.eventKey));
  }
  async mark(id: string, dismissed: boolean, actor: AuthenticatedUser) {
    requireOffice(actor, 'notification:read');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.notificationInbox.findFirst({ where: { id, userId: actor.id,
        deliveries: { some: { channel: 'IN_APP', status: 'DELIVERED' } } },
        include: { rule: { select: { trigger: true } }, event: { select: { eventKey: true } } } });
      if (!row || !canReadSource(actor, row.rule.trigger, row.event.eventKey)) {
        throw new NotFoundException('Notification not found');
      }
      const result = await tx.notificationInbox.update({ where: { id }, data: dismissed
        ? { dismissedAt: row.dismissedAt ?? new Date() } : { readAt: row.readAt ?? new Date() } });
      await this.audit.recordIn(tx, { action: dismissed ? 'notification.dismiss' : 'notification.read',
        entityType: 'NotificationInbox', entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { readAt: row.readAt, dismissedAt: row.dismissedAt },
        afterData: { readAt: result.readAt, dismissedAt: result.dismissedAt } });
      return result;
    });
  }
  async retryDelivery(id: string, actor: AuthenticatedUser) {
    requireOffice(actor, 'notification:manage');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "NotificationDelivery" WHERE "id" = ${id} FOR UPDATE`;
      const row = await tx.notificationDelivery.findUnique({ where: { id } });
      // Never reset a pending/in-flight delivery: doing so races the worker
      // and can result in duplicate email or a stale status overwrite.
      if (!row || row.channel !== 'EMAIL' || !['FAILED', 'SUPPRESSED'].includes(row.status)) {
        throw new NotFoundException('Retryable email delivery not found');
      }
      const result = await tx.notificationDelivery.update({ where: { id }, data: {
        status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), lastErrorCode: null } });
      await this.audit.recordIn(tx, { action: 'notification.delivery.retry', entityType: 'NotificationDelivery',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { status: row.status, attempts: row.attempts },
        afterData: { status: result.status, attempts: result.attempts } });
      return result;
    });
  }
}
