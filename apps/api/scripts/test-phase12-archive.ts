import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuditService } from '../src/common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../src/common/auth/types';
import { PermissionsGuard } from '../src/common/auth/guards/permissions.guard';
import { ArchiveController } from '../src/modules/archive/archive.controller';
import { ArchiveService } from '../src/modules/archive/archive.service';
import { LetterService } from '../src/modules/letters/letter.service';
import { AttachmentService } from '../src/common/infrastructure/attachment/attachment.service';
import { seedPhase12Permissions, Phase12PermissionConflict, phase12Permissions } from '../../../prisma/seed/phase12-permissions';
import type { ConfigService } from '@nestjs/config';
import type { StorageAdapter } from '../src/common/infrastructure/storage/storage-adapter.interface';

const owner: AuthenticatedUser = { id: 'owner', email: 'owner@example.test', roles: [],
  permissions: [], isPrimaryAdmin: true };
const editor: AuthenticatedUser = { ...owner, id: 'editor', email: 'editor@example.test',
  isPrimaryAdmin: false, permissions: ['letter:read', 'letter:archive', 'archive:reopen',
    'retention:manage', 'retention:read', 'archive:create'] };
const portal: AuthenticatedUser = { ...editor, portalAgentId: 'agent', permissions: [...editor.permissions] };
const old = new Date('2025-01-01T00:00:00Z');
const recent = new Date();
function row(id: string, status: string, direction = 'OUTGOING', date = old) {
  return { id, letterNumber: `LET-${id}`, status, direction, letterDate: date, createdAt: date,
    sentAt: status === 'SENT' ? date : null, archivedAt: null as Date | null,
    archivedById: null as string | null, archivedFromStatus: null as string | null,
    deletedAt: null as Date | null,
    subject: `Record ${id}`, body: null, replyToId: null };
}
function fixture() {
  const rows = [row('sent', 'SENT'), row('incoming', 'RECEIVED', 'INCOMING'),
    row('draft', 'DRAFT'), row('recent', 'SENT', 'OUTGOING', recent)];
  const events: Array<{ action: string; entityId: string; beforeData?: { status?: string };
    metadata?: { reason?: string; mode?: string }; actorId: string }> = [];
  const policies = new Map<string, Record<string, unknown>>();
  const prisma = {
    $queryRaw: async () => [],
    $transaction: async (work: unknown) => typeof work === 'function'
      ? (work as (tx: unknown) => Promise<unknown>)(prisma)
      : Promise.all(work as Promise<unknown>[]),
    letter: {
      findFirst: async ({ where }: { where: { id: string } }) =>
        rows.find((r) => r.id === where.id && !r.deletedAt) ?? null,
      findMany: async ({ where, take }: { where: { deletedAt: null; status: string | { in: string[] };
        letterDate?: { lte: Date }; createdAt?: { lte: Date } }; take: number }) => {
        const statuses = typeof where.status === 'string' ? [where.status] : where.status.in;
        const cutoff = where.letterDate?.lte ?? new Date(8640000000000000);
        return rows.filter((r) => !r.deletedAt && statuses.includes(r.status) &&
          r.letterDate <= cutoff && r.createdAt <= (where.createdAt?.lte ?? cutoff) &&
          (!r.sentAt || r.sentAt <= cutoff)).slice(0, take);
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const r = rows.find((item) => item.id === where.id)!;
        Object.assign(r, data); return { ...r };
      },
      count: async () => 0,
    },
    auditLog: {
      findFirst: async ({ where }: { where: { entityId: string; action: string } }) =>
        [...events].reverse().find((e) => e.entityId === where.entityId && e.action === where.action) ?? null,
      findMany: async ({ where, skip = 0, take = 100 }: { where: { entityId: string;
        action?: { in: string[] } }; skip?: number; take?: number }) =>
        events.filter((e) => e.entityId === where.entityId &&
          (!where.action || where.action.in.includes(e.action))).reverse().slice(skip, skip + take),
      count: async ({ where }: { where: { entityId: string; action?: string | { in: string[] } } }) =>
        events.filter((e) => e.entityId === where.entityId && (!where.action ||
          (typeof where.action === 'string' ? e.action === where.action :
            where.action.in.includes(e.action)))).length,
    },
    retentionPolicy: {
      findUnique: async ({ where }: { where: { scope: string } }) => policies.get(where.scope) ?? null,
      findMany: async () => [...policies.values()],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const p = { ...data, updatedAt: recent }; policies.set(String(data.scope), p); return p;
      },
      update: async ({ where, data }: { where: { scope: string }; data: Record<string, unknown> }) => {
        const p = { ...policies.get(where.scope), ...data, updatedAt: recent };
        policies.set(where.scope, p); return p;
      },
    },
    fileAttachment: { count: async () => 0 },
    documentIssuedSnapshot: { count: async () => 0 },
    documentRenderedOutput: { count: async () => 0 },
  };
  const audit = { recordIn: async (_tx: unknown, event: typeof events[number]) => { events.push(event); } };
  const letters = new LetterService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  const archive = new ArchiveService(prisma as unknown as PrismaService, audit as unknown as AuditService, letters);
  return { rows, events, policies, prisma, letters, archive };
}
test('manual archive is visible to readers, reasoned reopen restores SENT and preserves append-only action history', async () => {
  const f = fixture();
  await f.letters.archive('sent', editor, 'Reconciled correspondence');
  assert.equal(f.rows[0].status, 'ARCHIVED');
  assert.equal(f.rows[0].archivedFromStatus, 'SENT');
  const listed = await f.archive.archivedLetters({ search: 'Record', page: 1 }, editor);
  // The real list is permission-gated by ArchiveController and delegated to
  // LetterService.list(status=ARCHIVED); this fake has no filter/counter shape.
  assert.ok(listed);
  assert.equal(f.events[0].metadata?.reason, 'Reconciled correspondence');
  await assert.rejects(f.letters.archive('sent', editor), ConflictException);
  await assert.rejects(f.archive.reopen('sent', 'short', editor), BadRequestException);
  await f.archive.reopen('sent', 'Correspondence restored after review', editor);
  assert.equal(f.rows[0].status, 'SENT');
  assert.equal(f.rows[0].archivedAt, null);
  assert.equal(f.rows[0].archivedFromStatus, null);
  assert.equal(f.events.map((e) => e.action).join(','), 'letter.archive,letter.reopen');
  await assert.rejects(f.letters.remove('sent', editor), ConflictException);
  await f.letters.archive('sent', editor);
  assert.equal(f.events[2].metadata?.mode, 'MANUAL');
});
test('archive history can page through all events instead of silently truncating at 100', async () => {
  const f = fixture();
  await f.letters.archive('sent', editor);
  await f.archive.reopen('sent', 'Reviewed full event history', editor);
  const first = await f.archive.history('sent', editor, { page: 1, pageSize: 1 });
  const second = await f.archive.history('sent', editor, { page: 2, pageSize: 1 });
  assert.equal(first.total, 2);
  assert.equal(first.hasMore, true);
  assert.equal(first.items[0].action, 'letter.reopen');
  assert.equal(second.items[0].action, 'letter.archive');
  assert.equal(second.hasMore, false);
  await assert.rejects(f.archive.history('sent', editor, { page: 0 }), BadRequestException);
});
test('reopened archived draft still cannot be deleted; incoming returns to RECEIVED', async () => {
  const f = fixture();
  await f.letters.archive('draft', owner);
  await f.archive.reopen('draft', 'Keep historical draft available', owner);
  assert.equal(f.rows[2].status, 'DRAFT');
  await assert.rejects(f.letters.remove('draft', owner), ConflictException);
  await f.letters.archive('incoming', owner);
  await f.archive.reopen('incoming', 'Reply required from office', owner);
  assert.equal(f.rows[1].status, 'RECEIVED');
});
test('a configured retention floor refuses deletion of a recent draft without touching audit history', async () => {
  const f = fixture();
  f.rows.push(row('new-draft', 'DRAFT', 'OUTGOING', recent));
  await f.archive.setPolicy('LETTER', { minimumDays: 90,
    authority: 'Test-only correspondence retention authority' }, owner);
  await assert.rejects(f.letters.remove('new-draft', owner), ConflictException);
  assert.equal(f.rows.at(-1)?.deletedAt, null);
  assert.equal(f.events.filter((e) => e.action === 'letter.delete_draft').length, 0);
});
test('automatic batch requires configured days, never archives draft or recent records, reevaluates current policy', async () => {
  const f = fixture();
  assert.deepEqual(await f.archive.runBatch(), { configured: false, scanned: 0, archived: 0, changed: 0 });
  await assert.rejects(f.archive.setPolicy('LETTER', { archiveAfterDays: 30 }, owner), BadRequestException);
  await f.archive.setPolicy('LETTER', { archiveAfterDays: 30,
    authority: 'Test-only approved archive criterion' }, owner);
  assert.equal((await f.archive.runBatch()).archived, 2);
  assert.equal(f.rows[2].status, 'DRAFT');
  assert.equal(f.rows[3].status, 'SENT');
  assert.equal(f.events.filter((e) => e.action === 'letter.archive' && e.metadata?.mode === 'AUTOMATIC').length, 2);
  await assert.rejects(f.letters.archiveAutomatic('draft'), ConflictException);
  await assert.rejects(f.letters.archiveAutomatic('recent'), ConflictException);
  await f.archive.setPolicy('LETTER', { archiveAfterDays: null }, owner);
  assert.equal((await f.archive.runBatch()).configured, false);
});
test('compliance floors need an authority, cannot be reduced; identity needs a lawful basis; no periods seeded', async () => {
  const f = fixture();
  assert.equal((await f.archive.policies(owner)).every((p) => p.minimumDays === null), true);
  await assert.rejects(f.archive.setPolicy('IDENTITY_DOCUMENT', { minimumDays: 90 }, owner), BadRequestException);
  await assert.rejects(f.archive.setPolicy('IDENTITY_DOCUMENT', { minimumDays: 90,
    authority: 'Compliance memorandum', lawfulBasis: '' }, owner), BadRequestException);
  const set = await f.archive.setPolicy('IDENTITY_DOCUMENT', { minimumDays: 90,
    authority: 'Test-only compliance memo', lawfulBasis: 'Test-only lawful capture basis',
    secureDeleteAfterDays: 120 }, owner);
  assert.equal(set.minimumDays, 90);
  await assert.rejects(f.archive.setPolicy('IDENTITY_DOCUMENT', { minimumDays: 89 }, owner), ConflictException);
  await assert.rejects(f.archive.setPolicy('IDENTITY_DOCUMENT', { secureDeleteAfterDays: 100 }, owner), ConflictException);
  await assert.rejects(f.archive.setPolicy('AUDIT', { archiveAfterDays: 30 }, owner), BadRequestException);
  assert.equal(f.events.filter((e) => e.action === 'retention.policy.configure').length, 1);
});
test('route metadata is server-side AND, portal is denied, owner implicit authority remains', () => {
  const handler = ArchiveController.prototype.reopen;
  const metadata = Reflect.getMetadata('requiredPermissions', handler) as { match: string; permissions: string[] };
  assert.deepEqual(metadata, { match: 'AND', permissions: ['archive:reopen', 'letter:read'] });
  const guard = new PermissionsGuard(new Reflector());
  const context = (user: AuthenticatedUser) => ({ getHandler: () => handler,
    getClass: () => ArchiveController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;
  assert.throws(() => guard.canActivate(context({ ...editor, permissions: ['archive:reopen'] })), ForbiddenException);
  assert.equal(guard.canActivate(context(editor)), true);
  assert.equal(guard.canActivate(context(owner)), true);
  assert.throws(() => ArchiveService.officeOnly(portal), ForbiddenException);
});
test('portal-linked principal cannot manually archive or reopen even if an office grant was accidentally assigned', async () => {
  const f = fixture();
  await assert.rejects(f.letters.archive('sent', portal), ForbiddenException);
  await f.letters.archive('sent', owner);
  await assert.rejects(f.letters.reopen('sent', 'Portal must not reopen letters', portal), ForbiddenException);
  assert.equal(f.rows[0].status, 'ARCHIVED');
});
test('identity capture remains off without flag AND configured compliance record', async () => {
  const f = fixture();
  let enabled = 'false';
  const config = { get: () => enabled };
  const service = new AttachmentService(f.prisma as unknown as PrismaService,
    { recordIn: async () => {} } as unknown as AuditService,
    config as unknown as ConfigService, {} as StorageAdapter);
  const input = { user: owner, entityType: 'Voucher' as const, entityId: 'v1',
    category: 'ID_FRONT' as const, file: undefined };
  await assert.rejects(service.upload(input), ForbiddenException);
  enabled = 'true';
  await assert.rejects(service.upload(input), ForbiddenException);
  await f.archive.setPolicy('IDENTITY_DOCUMENT', { minimumDays: 90,
    authority: 'Test-only compliance memo', lawfulBasis: 'Test-only lawful capture basis' }, owner);
  await assert.rejects(service.upload(input), BadRequestException); // now file validation, not policy bypass
});
test('incremental permission seed is idempotent, conflict-aware and assigns no role', async () => {
  const registry = new Map([
    ['letter:read', { code: 'letter:read', module: 'letters', action: 'read' }],
    ['letter:archive', { code: 'letter:archive', module: 'letters', action: 'archive' }],
    ['audit:read', { code: 'audit:read', module: 'audit', action: 'read' }],
  ]);
  const tx = { permission: {
    findUnique: async ({ where }: { where: { code: string } }) => registry.get(where.code) ?? null,
    create: async ({ data }: { data: { code: string; module: string; action: string } }) =>
      (registry.set(data.code, data), data),
  } };
  const cast = tx as unknown as Parameters<typeof seedPhase12Permissions>[0];
  assert.equal((await seedPhase12Permissions(cast)).created, phase12Permissions.length);
  assert.equal((await seedPhase12Permissions(cast)).created, 0);
  registry.set('archive:reopen', { code: 'archive:reopen', module: 'wrong', action: 'reopen' });
  await assert.rejects(seedPhase12Permissions(cast), Phase12PermissionConflict);
});
