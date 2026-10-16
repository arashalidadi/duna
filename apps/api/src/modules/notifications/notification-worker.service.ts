import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type NotificationEvent, type NotificationRule } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { NotificationEmailService } from './notification-email.service';
import { canReadSource, conditions, sourcePermission, storedRule,
  type Conditions, type Recipients, type RuleInput } from './notification.policy';

type Tx = Prisma.TransactionClient;
const SYSTEM = { actorId: 'system:notifications', actorEmail: 'system:notifications' };
const userAuthSelect = {
  id: true, email: true, isActive: true, isPrimaryAdmin: true,
  deletedAt: true, portalCustomerId: true, portalAgentId: true,
  roles: { select: { role: { select: {
    deletedAt: true, permissions: { select: { permission: { select: { code: true } } } },
  } } } },
} satisfies Prisma.UserSelect;
const minutes = (n: number) => n * 60 * 1000;
const plusMinutes = (d: Date, n: number) => new Date(d.getTime() + minutes(n));
const totalDue = (total: Prisma.Decimal, paid: Prisma.Decimal) => total.gt(paid) && total.gt(0);
const meetsPercent = (total: Prisma.Decimal, paid: Prisma.Decimal, min?: number) =>
  totalDue(total, paid) && (min === undefined || total.sub(paid).mul(100).gte(total.mul(min)));

/** DB-backed outbox: polling is bounded, deduped and safe across API replicas.
 * Only Job transitions enqueue in the business mutation; time-based sources
 * are discovered without mutating invoices, approvals, releases or cargo.
 */
@Injectable()
export class NotificationWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationWorkerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private starting?: ReturnType<typeof setTimeout>;
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService,
    private readonly email: NotificationEmailService) {}

  onModuleInit() {
    if (process.env.NOTIFICATION_WORKER_ENABLED === 'false') return;
    // No business delay/threshold is inferred by this technical poll interval.
    this.timer = setInterval(() => { void this.backgroundTick(); }, minutes(1));
    this.timer.unref();
    this.starting = setTimeout(() => { void this.backgroundTick(); }, 3000);
    this.starting.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.starting) clearTimeout(this.starting);
  }
  private async backgroundTick() {
    try { await this.tick(); } catch {
      // Do not log Prisma errors: URLs can include credentials. Manual tick
      // and the delivery status endpoint expose safe operational information.
      this.logger.error('Notification poll failed; inspect server health and migration state');
    }
  }

  async tick() {
    if (this.running) return { busy: true };
    this.running = true;
    try {
      const now = new Date();
      let discovered = 0;
      // Traverse all enabled rules; a fixed take(200) would silently starve
      // later rules as the administrator grows the catalogue.
      let cursor: string | undefined;
      for (;;) {
        const rules = await this.prisma.notificationRule.findMany({
          where: { isActive: true }, orderBy: { id: 'asc' }, take: 100,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (!rules.length) break;
        cursor = rules[rules.length - 1].id;
        for (const rule of rules) {
          if (rule.trigger === 'JOB_STATUS_CHANGED') continue;
          try { storedRule(rule); } catch {
            this.logger.error('Invalid notification rule configuration; rule skipped');
            continue;
          }
          discovered += await this.discover(rule, now);
        }
        if (rules.length < 100) break;
      }
      const due = await this.prisma.notificationEvent.findMany({ where: {
        status: 'ACTIVE', nextRunAt: { lte: now }, rule: { isActive: true },
      }, select: { id: true }, orderBy: { nextRunAt: 'asc' }, take: 100 });
      let processed = 0;
      for (const event of due) if (await this.dispatch(event.id, now)) processed++;
      const emailed = await this.deliverEmails(now);
      return { busy: false, discovered, processed, emailed };
    } finally { this.running = false; }
  }

  /** An office Job status transition and its outbox event commit together. */
  async jobTransitionIn(tx: Tx, id: string, from: string, to: string, at: Date) {
    let cursor: string | undefined;
    for (;;) {
    const rules = await tx.notificationRule.findMany({ where: {
      trigger: 'JOB_STATUS_CHANGED', isActive: true }, orderBy: { id: 'asc' }, take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rules.length) break;
    cursor = rules[rules.length - 1].id;
    for (const rule of rules) {
      // A malicious/invalid rule cannot bypass a Job status guard or block the
      // operational transition; flag it and skip notification creation.
      let spec: RuleInput;
      try { spec = storedRule(rule); } catch { this.logger.error('Invalid Job notification rule skipped'); continue; }
      if (spec.conditions.toStatuses && !spec.conditions.toStatuses.includes(to as never)) continue;
      await tx.notificationEvent.create({ data: { ruleId: rule.id, eventKey: `job:${id}:${randomUUID()}`,
        sourceId: id, baseAt: at, nextRunAt: plusMinutes(at, rule.delayMinutes),
        fromStatus: from, toStatus: to } });
    }
    if (rules.length < 100) break;
    }
  }

  /** Find untracked sources only (NOT EXISTS), so high-volume old rows cannot
   * starve later ones. Each tick can discover another 250 per rule/source.
   */
  private async discover(rule: NotificationRule, now: Date): Promise<number> {
    const c = conditions(rule.trigger, rule.conditions);
    type Row = { id: string; baseAt: Date; scope?: string };
    let rows: Row[] = [];
    if (rule.trigger === 'OVERDUE_INVOICE') {
      rows = await this.prisma.$queryRaw<Row[]>`
        SELECT i."id", i."dueDate" AS "baseAt" FROM "invoices" i
        WHERE i."status" = 'ISSUED' AND i."deletedAt" IS NULL
          AND i."dueDate" < ${now} AND i."totalAmount" > i."paidAmount"
          -- Apply the OPTIONAL configured threshold before LIMIT; filtering a
          -- 250-row slice in JS can starve every eligible newer invoice.
          AND 100 * (i."totalAmount" - i."paidAmount") >= i."totalAmount" * ${c.minUnpaidPercent ?? 0}
          AND NOT EXISTS (SELECT 1 FROM "NotificationEvent" e
            WHERE e."ruleId" = ${rule.id} AND e."eventKey" = i."id")
        ORDER BY i."dueDate", i."id" LIMIT 250`;
    } else if (rule.trigger === 'PENDING_APPROVAL') {
      const scopes = c.approvalScopes;
      const scopeWhere = scopes && scopes.some((s) => s !== 'invoice-correction')
        ? Prisma.sql`AND a."scope" IN (${Prisma.join(scopes.filter((s) => s !== 'invoice-correction'))})`
        : scopes ? Prisma.sql`AND false` : Prisma.empty;
      const workflow = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
        SELECT a."id", a."requestedAt" AS "baseAt", a."scope" FROM "ConfigApproval" a
        WHERE a."status" = 'PENDING' AND a."consumedAt" IS NULL ${scopeWhere}
          AND NOT EXISTS (SELECT 1 FROM "NotificationEvent" e
            WHERE e."ruleId" = ${rule.id} AND e."eventKey" = ('approval:' || a."id"))
        ORDER BY a."requestedAt", a."id" LIMIT 250`);
      rows = workflow.map((r) => ({ ...r, id: `approval:${r.id}` }));
      if (!scopes || scopes.includes('invoice-correction')) {
        const corrections = await this.prisma.$queryRaw<Row[]>`
          SELECT c."id", c."requestedAt" AS "baseAt" FROM "invoice_corrections" c
          WHERE c."status" = 'PENDING_APPROVAL'
            AND NOT EXISTS (SELECT 1 FROM "NotificationEvent" e
              WHERE e."ruleId" = ${rule.id} AND e."eventKey" = ('correction:' || c."id"))
          ORDER BY c."requestedAt", c."id" LIMIT 250`;
        rows.push(...corrections.map((r) => ({ ...r, id: `correction:${r.id}` })));
      }
    } else if (rule.trigger === 'UNPAID_RELEASE') {
      rows = await this.prisma.$queryRaw<Row[]>`
        SELECT r."id", r."releaseDate" AS "baseAt" FROM "release_orders" r
        JOIN "bills_of_lading" b ON b."id" = r."billOfLadingId"
        WHERE r."status" = 'ISSUED' AND r."deletedAt" IS NULL
          AND r."paymentState" IN ('UNPAID', 'PARTIAL') AND b."status" <> 'DRAFT'
          AND NOT EXISTS (SELECT 1 FROM "NotificationEvent" e
            WHERE e."ruleId" = ${rule.id} AND e."eventKey" = r."id")
        ORDER BY r."releaseDate", r."id" LIMIT 250`;
    } else if (rule.trigger === 'CARGO_DOCUMENT_PENDING') {
      rows = await this.prisma.$queryRaw<Row[]>`
        SELECT c."id", COALESCE(c."arrivalDate", c."createdAt") AS "baseAt" FROM "Cargo" c
        WHERE c."documentStatus" IS NULL AND c."deletedAt" IS NULL
          AND c."status" <> 'CANCELLED'
          AND NOT EXISTS (SELECT 1 FROM "NotificationEvent" e
            WHERE e."ruleId" = ${rule.id} AND e."eventKey" = c."id")
        ORDER BY c."createdAt", c."id" LIMIT 250`;
    }
    if (!rows.length) return 0;
    const inserted = await this.prisma.notificationEvent.createMany({ skipDuplicates: true,
      data: rows.map((row) => ({ ruleId: rule.id, eventKey: row.id,
        sourceId: row.id.replace(/^(approval|correction):/, ''),
        baseAt: row.baseAt, nextRunAt: plusMinutes(row.baseAt, rule.delayMinutes) })) });
    return inserted.count;
  }

  private async sourceActive(tx: Tx, e: NotificationEvent, rule: NotificationRule,
    c: Conditions, now: Date): Promise<boolean> {
    switch (rule.trigger) {
      case 'OVERDUE_INVOICE': {
        const i = await tx.invoice.findUnique({ where: { id: e.sourceId },
          select: { status: true, deletedAt: true, dueDate: true, totalAmount: true, paidAmount: true } });
        return !!i && !i.deletedAt && i.status === 'ISSUED' && !!i.dueDate && i.dueDate < now &&
          meetsPercent(i.totalAmount, i.paidAmount, c.minUnpaidPercent);
      }
      case 'PENDING_APPROVAL': {
        if (e.eventKey.startsWith('correction:')) {
          if (c.approvalScopes && !c.approvalScopes.includes('invoice-correction')) return false;
          const correction = await tx.invoiceCorrection.findUnique({ where: { id: e.sourceId },
            select: { status: true } });
          return correction?.status === 'PENDING_APPROVAL';
        }
        if (!e.eventKey.startsWith('approval:')) return false;
        const approval = await tx.configApproval.findUnique({ where: { id: e.sourceId },
          select: { status: true, scope: true, consumedAt: true } });
        return !!approval && approval.status === 'PENDING' && !approval.consumedAt &&
          (!c.approvalScopes || c.approvalScopes.includes(approval.scope));
      }
      case 'JOB_STATUS_CHANGED': {
        if (c.toStatuses && !c.toStatuses.includes(e.toStatus as never)) return false;
        const j = await tx.job.findUnique({ where: { id: e.sourceId }, select: { status: true, deletedAt: true } });
        return !!j && !j.deletedAt && j.status === e.toStatus;
      }
      case 'UNPAID_RELEASE': {
        const release = await tx.releaseOrder.findUnique({ where: { id: e.sourceId }, select: {
          status: true, deletedAt: true, paymentState: true, billOfLadingId: true,
          billOfLading: { select: { status: true, deletedAt: true } } } });
        if (!release || release.status !== 'ISSUED' || release.deletedAt ||
            release.billOfLading.deletedAt || release.billOfLading.status === 'DRAFT' ||
            !release.paymentState || release.paymentState === 'PAID') return false;
        const invoices = await tx.invoice.findMany({ where: { status: 'ISSUED', deletedAt: null,
          OR: [{ billOfLadingId: release.billOfLadingId },
            { billLinks: { some: { billOfLadingId: release.billOfLadingId } } }] },
          select: { totalAmount: true, paidAmount: true } });
        // If no invoice is attached, the explicitly recorded UNPAID/PARTIAL
        // release state is all we know. A percentage condition needs money data.
        if (!invoices.length) return c.minUnpaidPercent === undefined;
        return invoices.some((i) => meetsPercent(i.totalAmount, i.paidAmount, c.minUnpaidPercent));
      }
      case 'CARGO_DOCUMENT_PENDING': {
        const cargo = await tx.cargo.findUnique({ where: { id: e.sourceId },
          select: { deletedAt: true, status: true, documentStatus: true } });
        return !!cargo && !cargo.deletedAt && cargo.status !== 'CANCELLED' && cargo.documentStatus === null;
      }
    }
  }

  private async users(tx: Tx, selected: Recipients, rule: NotificationRule,
    key: string) {
    const required = sourcePermission(rule.trigger, key);
    const eligible: Array<Prisma.UserGetPayload<{ select: typeof userAuthSelect }>> = [];
    let cursor: string | undefined;
    // A role can include more than 500 office users. A fixed take silently
    // excludes later recipients; page deterministically without dropping any.
    for (;;) {
      const candidates = await tx.user.findMany({ where: { isActive: true, deletedAt: null,
        portalAgentId: null, portalCustomerId: null,
        OR: [{ id: { in: selected.userIds } }, { roles: { some: { roleId: { in: selected.roleIds } } } }],
      }, select: userAuthSelect, orderBy: { id: 'asc' }, take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      eligible.push(...candidates.filter((u) => u.isPrimaryAdmin || u.roles.some((r) => !r.role.deletedAt &&
        r.role.permissions.some((p) => p.permission.code === required) &&
        u.roles.some((other) => !other.role.deletedAt && other.role.permissions.some((p) =>
          p.permission.code === 'notification:read')))));
      if (candidates.length < 500) break;
      cursor = candidates[candidates.length - 1].id;
    }
    return eligible;
  }

  private async sendIn(tx: Tx, e: NotificationEvent, rule: NotificationRule,
    spec: RuleInput, selected: Recipients, stage: number, cycle: number, now: Date) {
    let inserted = 0;
    for (const user of await this.users(tx, selected, rule, e.eventKey)) {
      if (await tx.notificationInbox.count({ where: { eventId: e.id, userId: user.id, stage } }) >=
          (stage === 0 ? spec.maxPerRecord : 1)) continue;
      if (spec.maxPerDay && await tx.notificationInbox.count({ where: { ruleId: rule.id, userId: user.id,
        createdAt: { gte: new Date(now.getTime() - minutes(1440)) } } }) >= spec.maxPerDay) continue;
      await tx.notificationInbox.create({ data: { ruleId: rule.id, eventId: e.id,
        userId: user.id, stage, cycle, deliveries: { create: spec.channels.map((channel) => ({
          channel, status: channel === 'IN_APP' ? 'DELIVERED' as const : 'PENDING' as const,
          deliveredAt: channel === 'IN_APP' ? now : null,
          nextAttemptAt: channel === 'EMAIL' ? now : null,
        })) } } });
      inserted++;
    }
    if (inserted) await this.audit.recordIn(tx, { action: 'notification.dispatch',
      entityType: 'NotificationEvent', entityId: e.id, ...SYSTEM,
      afterData: { ruleId: rule.id, stage, cycle, recipientCount: inserted, channels: spec.channels } });
    return inserted;
  }

  private async dispatch(id: string, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const locks = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "NotificationEvent" WHERE "id" = ${id} FOR UPDATE SKIP LOCKED`;
      if (!locks.length) return false;
      const event = await tx.notificationEvent.findUnique({ where: { id }, include: { rule: true } });
      if (!event || event.status !== 'ACTIVE' || !event.rule.isActive || event.nextRunAt > now) return false;
      const rule = event.rule;
      let spec: RuleInput;
      try { spec = storedRule(rule); } catch {
        await tx.notificationEvent.update({ where: { id }, data: { status: 'INVALID' } });
        await this.audit.recordIn(tx, { action: 'notification.event.invalid', entityType: 'NotificationEvent',
          entityId: id, ...SYSTEM, afterData: { ruleId: rule.id } });
        return true;
      }
      if (!await this.sourceActive(tx, event, rule, spec.conditions, now)) {
        await tx.notificationEvent.update({ where: { id }, data: { status: 'DONE' } });
        return true;
      }
      const escalationDue = spec.escalateAfterMinutes === null ? null
        : plusMinutes(plusMinutes(event.baseAt, spec.delayMinutes), spec.escalateAfterMinutes);
      let primary = 0;
      let escalated = event.escalated;
      if (event.cycle < spec.maxPerRecord) {
        primary = await this.sendIn(tx, event, rule, spec, spec.recipients, 0, event.cycle, now);
      }
      if (escalationDue && now >= escalationDue && !escalated) {
        const unread = await tx.notificationInbox.count({ where: { eventId: id, stage: 0,
          readAt: null, dismissedAt: null } });
        if (unread) {
          const sent = await this.sendIn(tx, event, rule, spec, spec.escalationRecipients, 1, 0, now);
          if (sent) escalated = true;
        } else if (primary || event.cycle >= spec.maxPerRecord) escalated = true;
      }
      const nextCycle = event.cycle + (primary ? 1 : 0);
      const nextPrimary = spec.repeatMinutes !== null && nextCycle < spec.maxPerRecord
        ? plusMinutes(now, spec.repeatMinutes) : null;
      const nextEscalation = escalationDue && !escalated ? (escalationDue > now ? escalationDue
        : plusMinutes(now, 60)) : null;
      // Frequency-capped recipients retry after a technical backoff, while
      // maxPerRecord and repeatMinutes remain the business frequency policy.
      const nextRetry = !primary && event.cycle < spec.maxPerRecord ? plusMinutes(now, 60) : null;
      const nextRuns = [nextPrimary, nextEscalation, nextRetry].filter((v): v is Date => !!v);
      await tx.notificationEvent.update({ where: { id }, data: {
        cycle: nextCycle, escalated, status: nextRuns.length ? 'ACTIVE' : 'DONE',
        nextRunAt: nextRuns.length ? new Date(Math.min(...nextRuns.map((d) => d.getTime()))) : now,
      } });
      return true;
    });
  }

  private async deliverEmails(now: Date): Promise<number> {
    const rows = await this.prisma.notificationDelivery.findMany({ where: {
      channel: 'EMAIL', status: { in: ['PENDING', 'FAILED', 'SENDING'] },
      nextAttemptAt: { lte: now }, attempts: { lt: 5 },
    }, select: { id: true }, take: 50, orderBy: { nextAttemptAt: 'asc' } });
    let attempted = 0;
    for (const row of rows) {
      const claim = await this.prisma.notificationDelivery.updateMany({ where: { id: row.id,
        channel: 'EMAIL', status: { in: ['PENDING', 'FAILED', 'SENDING'] },
        nextAttemptAt: { lte: now }, attempts: { lt: 5 } },
      data: { status: 'SENDING', attempts: { increment: 1 }, nextAttemptAt: plusMinutes(now, 5) } });
      if (!claim.count) continue;
      attempted++;
      const delivery = await this.prisma.notificationDelivery.findUnique({ where: { id: row.id },
        include: { inbox: { include: {
          user: { select: userAuthSelect },
          event: true,
          rule: true,
        } } } });
      if (!delivery) continue;
      const { user, rule, event } = delivery.inbox;
      const perms = user.roles.filter((r) => !r.role.deletedAt).flatMap((r) =>
        r.role.permissions.map((p) => p.permission.code));
      const actor: Pick<AuthenticatedUser, 'permissions' | 'isPrimaryAdmin'> = {
        permissions: perms, isPrimaryAdmin: user.isPrimaryAdmin };
      const allowed = rule.isActive && user.isActive && !user.deletedAt &&
        !user.portalCustomerId && !user.portalAgentId &&
        (user.isPrimaryAdmin || perms.includes('notification:read'));
      let suppression: 'ACCESS_REVOKED' | 'INVALID_RULE' | 'SOURCE_RESOLVED' | null =
        !allowed || !canReadSource(actor, rule.trigger, event.eventKey) ? 'ACCESS_REVOKED' : null;
      let spec: RuleInput | undefined;
      if (!suppression) {
        try { spec = storedRule(rule); } catch { suppression = 'INVALID_RULE'; }
      }
      if (!suppression && spec &&
          !await this.prisma.$transaction((tx) => this.sourceActive(tx, event, rule, spec.conditions, new Date()))) {
        suppression = 'SOURCE_RESOLVED';
      }
      if (suppression) {
        await this.prisma.$transaction(async (tx) => {
          await tx.notificationDelivery.update({ where: { id: row.id }, data: {
            status: 'SUPPRESSED', nextAttemptAt: null, lastErrorCode: suppression } });
          await this.audit.recordIn(tx, { action: 'notification.email.suppressed',
            entityType: 'NotificationDelivery', entityId: row.id, ...SYSTEM,
            afterData: { status: 'SUPPRESSED', errorCode: suppression } });
        });
        continue;
      }
      let errorCode: string | null = null;
      try { await this.email.send(user.email, delivery.inboxId); }
      catch (error) { errorCode = error instanceof Error &&
        ['SMTP_NOT_CONFIGURED', 'SMTP_INVALID_CONFIG', 'SMTP_SEND_FAILED'].includes(error.message)
          ? error.message : 'SMTP_SEND_FAILED'; }
      await this.prisma.$transaction(async (tx) => {
        const success = errorCode === null;
        await tx.notificationDelivery.update({ where: { id: row.id }, data: {
          status: success ? 'DELIVERED' : 'FAILED', deliveredAt: success ? new Date() : null,
          lastErrorCode: errorCode,
          nextAttemptAt: success || delivery.attempts >= 5 ? null
            : plusMinutes(new Date(), Math.min(60, 5 * 2 ** (delivery.attempts - 1))),
        } });
        await this.audit.recordIn(tx, { action: success ? 'notification.email.delivered' : 'notification.email.failed',
          entityType: 'NotificationDelivery', entityId: row.id, ...SYSTEM,
          afterData: { attempt: delivery.attempts, status: success ? 'DELIVERED' : 'FAILED',
            errorCode } });
      });
    }
    return attempted;
  }
}
