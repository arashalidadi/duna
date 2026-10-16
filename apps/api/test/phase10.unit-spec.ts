import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { parseRule, canReadSource, requireOffice } from '../src/modules/notifications/notification.policy';
import { NotificationWorkerService } from '../src/modules/notifications/notification-worker.service';
import { NotificationRulesService } from '../src/modules/notifications/notification-rules.service';
import { NotificationEmailService } from '../src/modules/notifications/notification-email.service';
import { CustomersService } from '../src/modules/customers/customers.service';
import { CargoService } from '../src/modules/cargo/cargo.service';
import type { NumberingService } from '../src/common/infrastructure/numbering';
import { PortsService, aliasKey } from '../src/modules/ports/ports.service';
import { VesselsService } from '../src/modules/vessels/vessels.service';
import { CreatePortDto } from '../src/modules/ports/dto/ports.dto';
import { IntakeDocumentDto } from '../src/modules/cargo/dto/cargo.dto';
import { seedPhase10Ports, referencePorts } from '../../../prisma/seed/phase10-ports';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuditService } from '../src/common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../src/common/auth/types';

type AnyDb = Record<string, any>; // Isolated service mocks; never a database URL or owner DB.
const castDb = (o: AnyDb) => o as unknown as PrismaService;
const castAudit = (o: AnyDb) => o as unknown as AuditService;
const office: AuthenticatedUser = { id: 'staff', email: 'staff@example.test',
  isPrimaryAdmin: false, roles: [], permissions: ['notification:read', 'invoice:read', 'port:update',
    'customer:update', 'vessel:activate'] };
const input = () => ({
  name: 'Configurable unpaid follow-up', trigger: 'OVERDUE_INVOICE',
  conditions: { minUnpaidPercent: 20 }, recipients: { userIds: ['staff'], roleIds: [] },
  channels: ['IN_APP', 'EMAIL'], delayMinutes: 30, repeatMinutes: 120,
  maxPerRecord: 2, maxPerDay: 4, escalateAfterMinutes: null,
  escalationRecipients: { userIds: [], roleIds: [] },
});

describe('Phase 10 declarative notification controls (no database)', () => {
  it('does not seed a threshold; validates opt-in percentages, delays, repeats and escalation together', () => {
    const rule = parseRule(input());
    expect(rule.conditions.minUnpaidPercent).toBe(20);
    expect(parseRule({ ...input(), conditions: {} }).conditions).toEqual({});
    expect(() => parseRule({ ...input(), conditions: { minUnpaidPercent: 101 } })).toThrow(BadRequestException);
    expect(() => parseRule({ ...input(), conditions: { minUnpaidPercent: 20, rawSql: '1=1' } })).toThrow(BadRequestException);
    expect(() => parseRule({ ...input(), repeatMinutes: null })).toThrow('repeatMinutes');
    expect(() => parseRule({ ...input(), escalateAfterMinutes: 60 })).toThrow('Escalation delay');
    expect(() => parseRule({ ...input(), recipients: { userIds: [], roleIds: [] } })).toThrow('Choose at least one');
    expect(() => parseRule({ ...input(), trigger: 'PENDING_APPROVAL', conditions: { approvalScopes: ['DROP TABLE'] } })).toThrow('Invalid approval scope');
  });

  it('enforces source permission and excludes portal-linked principals even with office grants', () => {
    expect(canReadSource({ isPrimaryAdmin: false, permissions: ['invoice:read'] }, 'PENDING_APPROVAL', 'correction:x')).toBe(true);
    expect(canReadSource({ isPrimaryAdmin: false, permissions: ['workflow:read'] }, 'PENDING_APPROVAL', 'correction:x')).toBe(false);
    expect(() => requireOffice({ ...office, portalAgentId: 'agent' }, 'notification:read')).toThrow(ForbiddenException);
    expect(() => requireOffice({ ...office, portalCustomerId: 'customer' }, 'notification:read')).toThrow(ForbiddenException);
  });

  it('dispatches in-app and email atomically with per-record frequency and audit', async () => {
    const rule = { ...input(), id: 'rule', delayMinutes: 0, repeatMinutes: null,
      maxPerRecord: 1, maxPerDay: null, isActive: true };
    const event = { id: 'evt', eventKey: 'inv1', sourceId: 'inv1', ruleId: 'rule',
      status: 'ACTIVE', rule, cycle: 0, escalated: false,
      baseAt: new Date('2026-10-01'), nextRunAt: new Date('2026-10-01') };
    const inboxCreate = jest.fn().mockResolvedValue({ id: 'inbox' });
    const eventUpdate = jest.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'evt' }]),
      notificationEvent: { findUnique: jest.fn().mockResolvedValue(event), update: eventUpdate },
      invoice: { findUnique: jest.fn().mockResolvedValue({ status: 'ISSUED', deletedAt: null,
        dueDate: new Date('2026-10-01'), totalAmount: new Prisma.Decimal(100), paidAmount: new Prisma.Decimal(70) }) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'staff', email: office.email,
        isPrimaryAdmin: false, portalAgentId: null, portalCustomerId: null,
        roles: [{ role: { deletedAt: null,
          permissions: [{ permission: { code: 'notification:read' } }, { permission: { code: 'invoice:read' } }] } }] }]) },
      notificationInbox: { count: jest.fn().mockResolvedValue(0), create: inboxCreate },
    };
    const audit = { recordIn: jest.fn().mockResolvedValue(undefined) };
    const prisma = { $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
    const worker = new NotificationWorkerService(castDb(prisma), castAudit(audit),
      { send: jest.fn() } as unknown as NotificationEmailService);
    const dispatch = (worker as unknown as { dispatch: (id: string, now: Date) => Promise<boolean> }).dispatch.bind(worker);
    expect(await dispatch('evt', new Date('2026-10-16'))).toBe(true);
    expect(inboxCreate).toHaveBeenCalledTimes(1);
    expect(inboxCreate.mock.calls[0][0].data.deliveries.create).toEqual([
      expect.objectContaining({ channel: 'IN_APP', status: 'DELIVERED' }),
      expect.objectContaining({ channel: 'EMAIL', status: 'PENDING' }),
    ]);
    expect(eventUpdate).toHaveBeenCalledWith({ where: { id: 'evt' },
      data: expect.objectContaining({ cycle: 1, status: 'DONE' }) });
    expect(audit.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'notification.dispatch' }));
  });

  it('sanitizes SMTP failure codes, never persisting transport text', async () => {
    const update = jest.fn().mockResolvedValue({});
    const tx = { notificationDelivery: { update }, invoice: { findUnique: jest.fn().mockResolvedValue({
      status: 'ISSUED', deletedAt: null, dueDate: new Date('2026-10-01'),
      totalAmount: new Prisma.Decimal(100), paidAmount: new Prisma.Decimal(70),
    }) } };
    const audit = { recordIn: jest.fn().mockResolvedValue(undefined) };
    const row = { id: 'delivery', inboxId: 'inbox', attempts: 1, inbox: {
      user: { email: office.email, isActive: true, deletedAt: null, isPrimaryAdmin: false,
        portalCustomerId: null, portalAgentId: null,
        roles: [{ role: { deletedAt: null, permissions: [
          { permission: { code: 'notification:read' } }, { permission: { code: 'invoice:read' } },
        ] } }] }, rule: { ...input(), isActive: true, trigger: 'OVERDUE_INVOICE' },
      event: { eventKey: 'invoice', sourceId: 'invoice' },
    } };
    const prisma = { notificationDelivery: {
      findMany: jest.fn().mockResolvedValue([{ id: row.id }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(row),
    }, $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
    const worker = new NotificationWorkerService(castDb(prisma), castAudit(audit),
      { send: jest.fn().mockRejectedValue(new Error('PASSWORD=secret; private SMTP response')) } as unknown as NotificationEmailService);
    const deliver = (worker as unknown as { deliverEmails: (now: Date) => Promise<number> }).deliverEmails.bind(worker);
    expect(await deliver(new Date('2026-10-16'))).toBe(1);
    expect(update).toHaveBeenCalledWith({ where: { id: row.id },
      data: expect.objectContaining({ status: 'FAILED', lastErrorCode: 'SMTP_SEND_FAILED' }) });
    expect(JSON.stringify(update.mock.calls) + JSON.stringify(audit.recordIn.mock.calls)).not.toContain('secret');
  });

  it('enqueues a configured Job event for a matching transition, but not other statuses', async () => {
    const rule = { ...input(), id: 'rule-job', trigger: 'JOB_STATUS_CHANGED',
      conditions: { toStatuses: ['OPEN'] }, isActive: true };
    const create = jest.fn().mockResolvedValue({ id: 'evt' });
    const tx = { notificationRule: { findMany: jest.fn().mockResolvedValue([rule]) },
      notificationEvent: { create } };
    const worker = new NotificationWorkerService(castDb({}), castAudit({}),
      { send: jest.fn() } as unknown as NotificationEmailService);
    const at = new Date('2026-10-16');
    await worker.jobTransitionIn(tx as never, 'job', 'DRAFT', 'OPEN', at);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      ruleId: 'rule-job', sourceId: 'job', fromStatus: 'DRAFT', toStatus: 'OPEN',
      nextRunAt: new Date(at.getTime() + 30 * 60_000),
    }) });
    create.mockClear();
    await worker.jobTransitionIn(tx as never, 'job', 'OPEN', 'COMPLETED', at);
    expect(create).not.toHaveBeenCalled();
  });

  it('marks successful email delivery and writes a sanitized audit in the same transaction', async () => {
    const update = jest.fn().mockResolvedValue({});
    const tx = { notificationDelivery: { update }, invoice: { findUnique: jest.fn().mockResolvedValue({
      status: 'ISSUED', deletedAt: null, dueDate: new Date('2026-10-01'),
      totalAmount: new Prisma.Decimal(100), paidAmount: new Prisma.Decimal(70),
    }) } };
    const a = { recordIn: jest.fn().mockResolvedValue(undefined) };
    const send = jest.fn().mockResolvedValue(undefined);
    const row = { id: 'delivery', inboxId: 'inbox', attempts: 1, inbox: {
      user: { email: office.email, isActive: true, deletedAt: null, isPrimaryAdmin: false,
        portalAgentId: null, portalCustomerId: null, roles: [{ role: { deletedAt: null,
          permissions: [ { permission: { code: 'notification:read' } },
            { permission: { code: 'invoice:read' } } ] } }] },
      rule: { ...input(), isActive: true, trigger: 'OVERDUE_INVOICE' },
      event: { eventKey: 'invoice', sourceId: 'invoice' },
    } };
    const prisma = { notificationDelivery: { findMany: jest.fn().mockResolvedValue([{ id: row.id }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn().mockResolvedValue(row) },
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
    const worker = new NotificationWorkerService(castDb(prisma), castAudit(a),
      { send } as unknown as NotificationEmailService);
    const deliver = (worker as unknown as { deliverEmails: (now: Date) => Promise<number> }).deliverEmails.bind(worker);
    expect(await deliver(new Date('2026-10-16'))).toBe(1);
    expect(send).toHaveBeenCalledWith(office.email, 'inbox');
    expect(update).toHaveBeenCalledWith({ where: { id: 'delivery' }, data: expect.objectContaining({
      status: 'DELIVERED', lastErrorCode: null, nextAttemptAt: null,
    }) });
    expect(a.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'notification.email.delivered', afterData: expect.objectContaining({ status: 'DELIVERED' }),
    }));
  });

  it('suppresses queued email with an audit when the source is no longer actionable', async () => {
    const a = { recordIn: jest.fn().mockResolvedValue(undefined) };
    const tx = { notificationDelivery: { update: jest.fn().mockResolvedValue({}) },
      invoice: { findUnique: jest.fn().mockResolvedValue({ status: 'CANCELLED' }) } };
    const delivery = { id: 'd', attempts: 1, inbox: { user: {
      email: office.email, isActive: true, deletedAt: null, isPrimaryAdmin: false,
      portalAgentId: null, portalCustomerId: null,
      roles: [{ role: { deletedAt: null, permissions: [
        { permission: { code: 'notification:read' } }, { permission: { code: 'invoice:read' } },
      ] } }],
    }, rule: { ...input(), isActive: true }, event: { eventKey: 'invoice', sourceId: 'invoice' } } };
    const prisma = { notificationDelivery: { findMany: jest.fn().mockResolvedValue([{ id: 'd' }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(delivery) },
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
    const send = jest.fn();
    const worker = new NotificationWorkerService(castDb(prisma), castAudit(a),
      { send } as unknown as NotificationEmailService);
    const deliver = (worker as unknown as { deliverEmails: (now: Date) => Promise<number> }).deliverEmails.bind(worker);
    expect(await deliver(new Date('2026-10-16'))).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(tx.notificationDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'SUPPRESSED', lastErrorCode: 'SOURCE_RESOLVED' }),
    }));
    expect(a.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'notification.email.suppressed', afterData: expect.objectContaining({ errorCode: 'SOURCE_RESOLVED' }),
    }));
  });

  it('paginates role recipients past 500 and filters candidates by office scope and permissions', async () => {
    const role = { role: { deletedAt: null, permissions: [
      { permission: { code: 'invoice:read' } }, { permission: { code: 'notification:read' } },
    ] } };
    const first = Array.from({ length: 500 }, (_, i) => ({ id: `user-${String(i).padStart(3, '0')}`,
      isPrimaryAdmin: false, roles: [role] }));
    const findMany = jest.fn().mockResolvedValueOnce(first).mockResolvedValueOnce([
      { id: 'user-500', isPrimaryAdmin: false, roles: [role] },
      { id: 'reader', isPrimaryAdmin: false, roles: [] },
    ]);
    const worker = new NotificationWorkerService(castDb({}), castAudit({}),
      { send: jest.fn() } as unknown as NotificationEmailService);
    const users = (worker as unknown as { users: (tx: unknown, selected: unknown,
      rule: unknown, key: string) => Promise<Array<{ id: string }>> }).users.bind(worker);
    const chosen = await users({ user: { findMany } }, { userIds: [], roleIds: ['role'] },
      { trigger: 'OVERDUE_INVOICE' }, 'invoice');
    expect(chosen).toHaveLength(501);
    expect(chosen.at(-1)?.id).toBe('user-500');
    expect(findMany.mock.calls[0][0].where).toEqual(expect.objectContaining({
      portalAgentId: null, portalCustomerId: null, isActive: true,
    }));
    expect(findMany.mock.calls[1][0]).toEqual(expect.objectContaining({
      cursor: { id: 'user-499' }, skip: 1,
    }));
  });

  it('does not reset pending/in-flight emails; an access-revoked suppression is audited', async () => {
    const manager = { ...office, permissions: [...office.permissions, 'notification:manage'] };
    const record = { id: 'd', channel: 'EMAIL', status: 'SENDING', attempts: 1 };
    const tx = { $queryRaw: jest.fn(), notificationDelivery: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(record)),
      update: jest.fn().mockResolvedValue({ status: 'PENDING', attempts: 0 }),
    } };
    const a = { recordIn: jest.fn().mockResolvedValue(undefined) };
    const prisma = castDb({ $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) });
    const service = new NotificationRulesService(prisma, castAudit(a));
    await expect(service.retryDelivery('d', manager)).rejects.toThrow('Retryable email');
    expect(tx.notificationDelivery.update).not.toHaveBeenCalled();
    record.status = 'FAILED';
    await expect(service.retryDelivery('d', manager)).resolves.toEqual(expect.objectContaining({ status: 'PENDING' }));
    expect(a.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'notification.delivery.retry' }));
    const send = jest.fn();
    const delivery = { id: 'd', inbox: { user: { email: office.email, isActive: false,
      deletedAt: null, isPrimaryAdmin: false, portalAgentId: null, portalCustomerId: null, roles: [] },
      rule: { trigger: 'OVERDUE_INVOICE', isActive: true }, event: { eventKey: 'invoice' } } };
    const pending = castDb({ notificationDelivery: {
      findMany: jest.fn().mockResolvedValue([{ id: 'd' }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(delivery),
    }, $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) });
    const worker = new NotificationWorkerService(pending, castAudit(a),
      { send } as unknown as NotificationEmailService);
    const deliver = (worker as unknown as { deliverEmails: (now: Date) => Promise<number> }).deliverEmails.bind(worker);
    expect(await deliver(new Date('2026-10-16'))).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(tx.notificationDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'SUPPRESSED', lastErrorCode: 'ACCESS_REVOKED' }),
    }));
    expect(a.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'notification.email.suppressed' }));
  });

  it('enables and disables valid rules with transactional audit, not hard-coded defaults', async () => {
    const previous = { ...input(), id: 'r', isActive: false, createdById: office.id };
    const a = { recordIn: jest.fn().mockResolvedValue(undefined) };
    const tx = { $queryRaw: jest.fn(), notificationRule: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...previous })),
      update: jest.fn().mockImplementation(({ data }: { data: { isActive: boolean } }) =>
        Promise.resolve({ ...previous, isActive: data.isActive })),
    }, role: { count: jest.fn().mockResolvedValue(0) },
    user: { count: jest.fn().mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve(where.id.in.length)) } };
    const svc = new NotificationRulesService(castDb({ $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) }),
      castAudit(a));
    const manager = { ...office, permissions: [...office.permissions, 'notification:manage'] };
    expect((await svc.setActive('r', { isActive: true }, manager)).isActive).toBe(true);
    expect(a.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'notification.rule.enable' }));
    previous.isActive = true;
    expect((await svc.setActive('r', { isActive: false }, manager)).isActive).toBe(false);
    expect(a.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'notification.rule.disable' }));
  });

  it('schedules a second dispatch only after the configured repeat interval', async () => {
    const rule = { ...input(), id: 'r', isActive: true, conditions: {}, delayMinutes: 0,
      maxPerRecord: 2, maxPerDay: null };
    const base = new Date('2026-10-01T00:00:00Z');
    const first = new Date('2026-10-16T00:00:00Z');
    const event = { id: 'evt', eventKey: 'inv1', sourceId: 'inv1', ruleId: 'r',
      status: 'ACTIVE', rule, cycle: 0, escalated: false, baseAt: base, nextRunAt: base };
    const create = jest.fn().mockResolvedValue({ id: 'inbox' });
    const update = jest.fn().mockImplementation(({ data }: { data: Partial<typeof event> }) => {
      Object.assign(event, data); return Promise.resolve(event);
    });
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{ id: 'evt' }]), notificationEvent: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(event)), update,
    }, invoice: { findUnique: jest.fn().mockResolvedValue({ status: 'ISSUED', deletedAt: null,
      dueDate: base, totalAmount: new Prisma.Decimal(100), paidAmount: new Prisma.Decimal(60) }) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'staff', email: office.email, isPrimaryAdmin: false,
      portalAgentId: null, portalCustomerId: null, roles: [{ role: { deletedAt: null, permissions: [
        { permission: { code: 'notification:read' } }, { permission: { code: 'invoice:read' } },
      ] } }] }]) },
    notificationInbox: { count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1), create } };
    const worker = new NotificationWorkerService(castDb({ $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) }),
      castAudit({ recordIn: jest.fn() }), { send: jest.fn() } as unknown as NotificationEmailService);
    const dispatch = (worker as unknown as { dispatch: (id: string, now: Date) => Promise<boolean> }).dispatch.bind(worker);
    expect(await dispatch('evt', first)).toBe(true);
    expect(event.status).toBe('ACTIVE');
    expect(event.cycle).toBe(1);
    expect(event.nextRunAt).toEqual(new Date(first.getTime() + 120 * 60_000));
    expect(await dispatch('evt', new Date(first.getTime() + 119 * 60_000))).toBe(false);
    expect(await dispatch('evt', new Date(first.getTime() + 120 * 60_000))).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
    expect(event.status).toBe('DONE');
    expect(event.cycle).toBe(2);
  });

  it('escalates an unread primary notification to the configured recipient', async () => {
    const rule = { ...input(), id: 'r', isActive: true, conditions: {}, delayMinutes: 0,
      maxPerRecord: 1, maxPerDay: null, repeatMinutes: null, escalateAfterMinutes: 60,
      escalationRecipients: { userIds: ['supervisor'], roleIds: [] } };
    const base = new Date('2026-10-01T00:00:00Z');
    const event = { id: 'evt', eventKey: 'inv1', sourceId: 'inv1', ruleId: 'r',
      status: 'ACTIVE', rule, cycle: 0, escalated: false, baseAt: base, nextRunAt: base };
    const create = jest.fn().mockResolvedValue({ id: 'inbox' });
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{ id: 'evt' }]), notificationEvent: {
      findUnique: jest.fn().mockResolvedValue(event), update: jest.fn().mockResolvedValue({}),
    }, invoice: { findUnique: jest.fn().mockResolvedValue({ status: 'ISSUED', deletedAt: null,
      dueDate: base, totalAmount: new Prisma.Decimal(100), paidAmount: new Prisma.Decimal(60) }) },
    user: { findMany: jest.fn().mockImplementation(({ where }: { where: { OR: Array<{ id: { in: string[] } }> } }) =>
      Promise.resolve(where.OR[0].id.in.map((id) => ({ id, email: `${id}@example.test`, isPrimaryAdmin: false,
        portalAgentId: null, portalCustomerId: null, roles: [{ role: { deletedAt: null, permissions: [
          { permission: { code: 'notification:read' } }, { permission: { code: 'invoice:read' } },
        ] } }] })))) },
    notificationInbox: { count: jest.fn().mockImplementation(({ where }: { where: { readAt?: null } }) =>
      Promise.resolve('readAt' in where ? 1 : 0)), create } };
    const worker = new NotificationWorkerService(castDb({ $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) }),
      castAudit({ recordIn: jest.fn() }), { send: jest.fn() } as unknown as NotificationEmailService);
    const dispatch = (worker as unknown as { dispatch: (id: string, now: Date) => Promise<boolean> }).dispatch.bind(worker);
    expect(await dispatch('evt', new Date('2026-10-16'))).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls.map((call) => call[0].data)).toEqual([
      expect.objectContaining({ stage: 0, userId: 'staff' }),
      expect.objectContaining({ stage: 1, userId: 'supervisor' }),
    ]);
    expect(tx.notificationEvent.update).toHaveBeenCalledWith({ where: { id: 'evt' },
      data: expect.objectContaining({ status: 'DONE', escalated: true }),
    });
  });

  it('requires SMTP configuration without sending email when none is supplied', async () => {
    const previousUrl = process.env.NOTIFICATION_SMTP_URL;
    const previousFrom = process.env.NOTIFICATION_FROM_EMAIL;
    delete process.env.NOTIFICATION_SMTP_URL; delete process.env.NOTIFICATION_FROM_EMAIL;
    try { await expect(new NotificationEmailService().send('x@example.test', 'a')).rejects.toThrow('SMTP_NOT_CONFIGURED'); }
    finally {
      if (previousUrl === undefined) delete process.env.NOTIFICATION_SMTP_URL;
      else process.env.NOTIFICATION_SMTP_URL = previousUrl;
      if (previousFrom === undefined) delete process.env.NOTIFICATION_FROM_EMAIL;
      else process.env.NOTIFICATION_FROM_EMAIL = previousFrom;
    }
  });
});

describe('Phase 10 master data safety (no database)', () => {
  it('rejects new ports missing mandatory city/abbreviation and normalizes aliases', () => {
    const errors = validateSync(plainToInstance(CreatePortDto, { code: 'P', name: 'P', country: 'AE' }));
    expect(errors.map((e) => e.property)).toEqual(expect.arrayContaining(['city', 'abbreviation']));
    expect(aliasKey(' Rajaee  ')).toBe('RAJAEE');
    expect(referencePorts).toHaveLength(7);
    expect(referencePorts.filter((p) => p.abbreviation !== null).map((p) => p.abbreviation)).toEqual(['HAM', 'KHS', 'RJS']);
  });

  it('accepts only evidenced Cargo intake document names on all write routes', () => {
    expect(validateSync(plainToInstance(IntakeDocumentDto, { name: 'Export Paper' }))).toHaveLength(0);
    expect(validateSync(plainToInstance(IntakeDocumentDto, { name: 'Unverified Certificate' }))
      .map((e) => e.property)).toContain('name');
  });

  it('refuses to merge an owner Rajaee port during the reference seed', async () => {
    const create = jest.fn();
    const tx = { port: { findMany: jest.fn().mockResolvedValue([
      { id: 'owner', code: 'OWNER', name: 'Rajaee', city: null, country: 'Iran', abbreviation: null, deletedAt: null },
    ]), create } };
    const prisma = { $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
    await expect(seedPhase10Ports(prisma as never)).rejects.toThrow('do not merge/delete');
    expect(create).not.toHaveBeenCalled();
  });

  it('explicit seven-port seed creates only missing canonical rows, backfills verified blanks and retains operator data', async () => {
    type Row = { id: string; code: string; name: string; country: string;
      city: string | null; abbreviation: string | null; deletedAt: null; isActive: boolean };
    const existing: Row[] = [
      { id: 'old-ham', code: 'HAMRIYAH', name: 'Hamriyah', country: 'UAE',
        city: null, abbreviation: null, deletedAt: null, isActive: false },
      { id: 'old-jeb', code: 'JEBALI', name: 'Jebel Ali', country: 'UAE',
        city: 'Operator city', abbreviation: null, deletedAt: null, isActive: true },
    ];
    const rows = [...existing];
    const create = jest.fn().mockImplementation(({ data }: { data: { code: string;
      name: string; country: string; city: string | null; abbreviation: string | null; isActive: boolean } }) => {
        const row = { ...data, id: `new-${data.code}`, deletedAt: null };
        rows.push(row); return Promise.resolve(row);
      });
    const update = jest.fn().mockImplementation(({ where, data }: { where: { id: string };
      data: { city?: string; abbreviation?: string } }) => {
        const target = rows.find((r) => r.id === where.id);
        if (!target) throw new Error('Fixture row missing');
        Object.assign(target, data); return Promise.resolve({});
      });
    const tx = { port: { findMany: jest.fn().mockImplementation(({ where }: { where?: { id: { in: string[] } } }) =>
      Promise.resolve(where ? rows.filter((r) => where.id.in.includes(r.id) && (!r.city || !r.abbreviation)) : [...rows])),
      create, update }, portAlias: { findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}) }, auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const prisma = { $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
    const result = await seedPhase10Ports(prisma as never);
    expect(result).toEqual(expect.objectContaining({ canonical: 7, created: 5,
      backfilled: 1, aliasCreated: true }));
    expect(rows.find((r) => r.id === 'old-ham')).toEqual(expect.objectContaining({
      city: 'Dubai', abbreviation: 'HAM', isActive: false,
    }));
    expect(rows.find((r) => r.id === 'old-jeb')).toEqual(expect.objectContaining({
      city: 'Operator city', abbreviation: null, isActive: true,
    }));
    expect(create.mock.calls.filter((call) => call[0].data.isActive).map((call) => call[0].data.code))
      .toEqual(['KHORRAMSHAHR', 'BANDAR_ABBAS']);
    expect(tx.portAlias.create).toHaveBeenCalledWith({ data: {
      portId: 'new-BANDAR_ABBAS', label: 'Rajaee', key: 'RAJAEE',
    } });
    expect(result.incomplete.map((r) => r.code)).toEqual(['JEBALI', 'BUSHEHR', 'SOHAR', 'DUBAI']);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(7); // 5 creates, 1 verified backfill, 1 alias
  });

  it('rejects archiving a customer with even one dependent Job', async () => {
    const update = jest.fn();
    const tx = { $queryRaw: jest.fn(), customer: { findFirst: jest.fn().mockResolvedValue({
      id: 'customer', code: 'CUS', name: 'Customer', personKind: null, isActive: true,
      _count: { jobs: 1 },
    }), update }, customerPosting: { count: jest.fn().mockResolvedValue(0) },
    journalLine: { count: jest.fn().mockResolvedValue(0) },
    fileAttachment: { count: jest.fn().mockResolvedValue(0) },
    customerLegacyAttribute: { count: jest.fn().mockResolvedValue(0) },
    configFieldValue: { count: jest.fn().mockResolvedValue(0) },
    documentIssuedSnapshot: { count: jest.fn().mockResolvedValue(0) },
    documentRenderedOutput: { count: jest.fn().mockResolvedValue(0) } };
    const prisma = { $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
    const audit = { recordIn: jest.fn() };
    const svc = new CustomersService(castDb(prisma), castAudit(audit));
    await expect(svc.remove('customer', office)).rejects.toThrow(ConflictException);
    expect(update).not.toHaveBeenCalled(); expect(audit.recordIn).not.toHaveBeenCalled();
  });

  it('retains Phase 9 sidecar values and frozen output by refusing Customer/Cargo archival', async () => {
    const customerTx = { $queryRaw: jest.fn(), customer: {
      findFirst: jest.fn().mockResolvedValue({ id: 'c', code: 'CUS', name: 'Customer',
        personKind: null, isActive: true, _count: { jobs: 0 } }), update: jest.fn(),
    }, customerPosting: { count: jest.fn().mockResolvedValue(0) },
    journalLine: { count: jest.fn().mockResolvedValue(0) },
    fileAttachment: { count: jest.fn().mockResolvedValue(0) },
    customerLegacyAttribute: { count: jest.fn().mockResolvedValue(0) },
    configFieldValue: { count: jest.fn().mockResolvedValue(1) },
    documentIssuedSnapshot: { count: jest.fn().mockResolvedValue(0) },
    documentRenderedOutput: { count: jest.fn().mockResolvedValue(0) } };
    const a = { recordIn: jest.fn() };
    const customer = new CustomersService(castDb({ $transaction: (fn: (t: typeof customerTx) => Promise<unknown>) => fn(customerTx) }),
      castAudit(a));
    await expect(customer.remove('c', office)).rejects.toThrow(ConflictException);
    expect(customerTx.configFieldValue.count).toHaveBeenCalledWith({ where: { scope: 'Customer', recordId: 'c' } });
    expect(customerTx.customer.update).not.toHaveBeenCalled();

    const cargoTx = { $queryRaw: jest.fn(), cargo: {
      findFirst: jest.fn().mockResolvedValue({ id: 'g', reference: 'G', inventory: null,
        legacyAttributes: null, jobId: null, cargoValue: null, status: 'REGISTERED',
        _count: { inspections: 0, dischargeItems: 0, loadListItems: 0, actualLoadingItems: 0,
          manifestItems: 0, billsOfLadingItems: 0, intakeDocuments: 0 } }), update: jest.fn(),
    }, fileAttachment: { count: jest.fn().mockResolvedValue(0) },
    configFieldValue: { count: jest.fn().mockResolvedValue(0) },
    documentIssuedSnapshot: { count: jest.fn().mockResolvedValue(1) },
    documentRenderedOutput: { count: jest.fn().mockResolvedValue(0) } };
    const cargo = new CargoService(castDb({ $transaction: (fn: (t: typeof cargoTx) => Promise<unknown>) => fn(cargoTx) }),
      {} as NumberingService, castAudit(a));
    await expect(cargo.remove('g', office)).rejects.toThrow(ConflictException);
    expect(cargoTx.documentIssuedSnapshot.count).toHaveBeenCalledWith({ where: { documentType: 'Cargo', recordId: 'g' } });
    expect(cargoTx.cargo.update).not.toHaveBeenCalled();
    expect(a.recordIn).not.toHaveBeenCalled();
  });

  it('rejects archiving a port with an alias and deactivating a vessel on an unfinished tug voyage', async () => {
    const update = jest.fn();
    const portTx = { $queryRaw: jest.fn(), port: { findFirst: jest.fn().mockResolvedValue({ id: 'port', _count: { aliases: 1 } }), update },
      fileAttachment: { count: jest.fn().mockResolvedValue(0) } };
    const port = new PortsService(castDb({ $transaction: (fn: (t: typeof portTx) => Promise<unknown>) => fn(portTx) }),
      castAudit({ recordIn: jest.fn() }));
    await expect(port.remove('port', office)).rejects.toThrow(ConflictException);
    expect(update).not.toHaveBeenCalled();
    const vesselTx = { $queryRaw: jest.fn(), vessel: { findFirst: jest.fn().mockResolvedValue({ id: 'v', isActive: true }), update },
      voyage: { count: jest.fn().mockResolvedValue(1) } };
    const vessel = new VesselsService(castDb({ $transaction: (fn: (t: typeof vesselTx) => Promise<unknown>) => fn(vesselTx) }),
      castAudit({ recordIn: jest.fn() }));
    await expect(vessel.setActive('v', false, office)).rejects.toThrow(ConflictException);
    expect(vesselTx.voyage.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [{ vesselId: 'v' }, { tugVesselId: 'v' }, { bargeVesselId: 'v' }] }),
    }));
    expect(update).not.toHaveBeenCalled();
  });
});
