import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { UnauthorizedException, ValidationPipe, type CanActivate,
  type ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { PermissionsGuard } from '../src/common/auth/guards/permissions.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ArchiveController, ArchiveHistoryQueryDto } from '../src/modules/archive/archive.controller';
import { ArchiveService } from '../src/modules/archive/archive.service';
import { LetterController } from '../src/modules/letters/letter.controller';
import { LetterService } from '../src/modules/letters/letter.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../src/common/auth/types';

/** HTTP/DI/guards/validation integration without any DB, API service or credentials. */
test('protected archive HTTP lifecycle: configured auto + manual, history pages, portal denial and owner reopen', async () => {
  const old = new Date('2024-01-01T00:00:00Z');
  const row = { id: 'fixture-1', letterNumber: 'LET-TEST-1', direction: 'OUTGOING',
    subject: 'Phase 12 synthetic fixture', status: 'SENT', letterDate: old, createdAt: old,
    sentAt: old, archivedFromStatus: null as string | null, archivedAt: null as Date | null,
    archivedById: null as string | null, deletedAt: null as Date | null, body: null };
  const policies = new Map<string, Record<string, unknown>>();
  const events: Array<{ id: string; action: string; entityId: string; timestamp: Date;
    beforeData?: { status?: string }; metadata?: { reason?: string; mode?: string } }> = [];
  const db: Record<string, unknown> = {
    $queryRaw: async () => [],
    $transaction: async (work: unknown) => typeof work === 'function'
      ? (work as (tx: unknown) => Promise<unknown>)(db)
      : Promise.all(work as Promise<unknown>[]),
    letter: {
      findFirst: async ({ where }: { where: { id: string } }) => where.id === row.id && !row.deletedAt ? { ...row } : null,
      findMany: async ({ where, skip = 0, take = 25 }: { where: { status: string | { in: string[] };
        letterDate?: { lte: Date }; createdAt?: { lte: Date }; search?: string }; skip?: number; take?: number }) => {
        const wanted = typeof where.status === 'string' ? [where.status] : where.status.in;
        return wanted.includes(row.status) && !row.deletedAt &&
          (!where.letterDate || row.letterDate <= where.letterDate.lte) &&
          (!where.createdAt || row.createdAt <= where.createdAt.lte) ? [ { ...row } ].slice(skip, skip + take) : [];
      },
      count: async ({ where }: { where: { status: string } }) =>
        Number(row.status === where.status && !row.deletedAt),
      update: async ({ data }: { data: Record<string, unknown> }) =>
        (Object.assign(row, data), { ...row }),
    },
    retentionPolicy: {
      findUnique: async ({ where }: { where: { scope: string } }) => policies.get(where.scope) ?? null,
      findMany: async () => [...policies.values()],
      create: async ({ data }: { data: Record<string, unknown> }) =>
        (policies.set(String(data.scope), data), data),
      update: async ({ where, data }: { where: { scope: string }; data: Record<string, unknown> }) => {
        const result = { ...policies.get(where.scope), ...data };
        policies.set(where.scope, result); return result;
      },
    },
    auditLog: {
      findFirst: async ({ where }: { where: { entityId: string; action: string } }) =>
        [...events].reverse().find((e) => e.entityId === where.entityId && e.action === where.action) ?? null,
      findMany: async ({ where, skip, take }: { where: { entityId: string; action: { in: string[] } };
        skip: number; take: number }) => [...events].reverse().filter((e) => e.entityId === where.entityId &&
        where.action.in.includes(e.action)).slice(skip, skip + take),
      count: async ({ where }: { where: { entityId: string; action: string | { in: string[] } } }) =>
        events.filter((e) => e.entityId === where.entityId && (typeof where.action === 'string'
          ? e.action === where.action : where.action.in.includes(e.action))).length,
    },
    fileAttachment: { count: async () => 0 },
    documentIssuedSnapshot: { count: async () => 0 },
    documentRenderedOutput: { count: async () => 0 },
  };
  const audit = { recordIn: async (_tx: unknown, event: typeof events[number]) => {
    events.push({ ...event, id: `event-${events.length + 1}`, timestamp: new Date() });
  } };
  // tsx/esbuild does not emit Nest constructor metadata; supply only the
  // test-runner metadata explicitly while retaining production route decorators.
  Reflect.defineMetadata('design:paramtypes', [ArchiveService], ArchiveController);
  Reflect.defineMetadata('design:paramtypes', [LetterService], LetterController);
  Reflect.defineMetadata('design:paramtypes', [String, ArchiveHistoryQueryDto, Object],
    ArchiveController.prototype, 'history');
  const letters = new LetterService(db as unknown as PrismaService, audit as unknown as AuditService);
  const archive = new ArchiveService(db as unknown as PrismaService, audit as unknown as AuditService, letters);
  const module = await Test.createTestingModule({ controllers: [ArchiveController, LetterController],
    providers: [{ provide: ArchiveService, useValue: archive }, { provide: LetterService, useValue: letters }] })
    .compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  const actors: Record<string, AuthenticatedUser> = {
    owner: { id: 'owner', email: 'owner@example.test', roles: [], permissions: [], isPrimaryAdmin: true },
    reader: { id: 'reader', email: 'reader@example.test', roles: [],
      permissions: ['letter:read'], isPrimaryAdmin: false },
    portal: { id: 'portal', email: 'portal@example.test', roles: [],
      permissions: ['letter:read', 'letter:archive', 'archive:reopen'], portalAgentId: 'agent', isPrimaryAdmin: false },
  };
  const testAuth: CanActivate = { canActivate(context: ExecutionContext) {
    const http = context.switchToHttp().getRequest();
    const actor = actors[http.headers['x-test-role']];
    if (!actor) throw new UnauthorizedException();
    http.user = actor;
    return true;
  } };
  app.useGlobalGuards(testAuth, new PermissionsGuard(new Reflector()));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true,
    transformOptions: { enableImplicitConversion: true } }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.init();
  try {
    const api = () => request(app.getHttpServer());
    const url = '/api/v1/archive';
    await api().get(`${url}/letters`).expect(401);
    await api().get(`${url}/letters`).set('x-test-role', 'portal').expect(403);
    await api().post(`/api/v1/letters/${row.id}/archive`).set('x-test-role', 'portal')
      .send({ reason: 'Portal must not archive company letters' }).expect(403);
    await api().get(`${url}/policies`).set('x-test-role', 'reader').expect(403);
    await api().patch(`${url}/policies/LETTER`).set('x-test-role', 'owner')
      .send({ archiveAfterDays: 2 }).expect(400);
    await api().patch(`${url}/policies/LETTER`).set('x-test-role', 'owner')
      .send({ archiveAfterDays: 2, authority: 'Test-only approved compliance criterion' }).expect(200);
    await api().post(`${url}/letters/run`).set('x-test-role', 'reader').expect(403);
    const automatic = await api().post(`${url}/letters/run`).set('x-test-role', 'owner').expect(200);
    assert.equal(automatic.body.data.archived, 1);
    assert.equal(row.status, 'ARCHIVED');
    const listed = await api().get(`${url}/letters?search=LET-TEST-1`).set('x-test-role', 'reader').expect(200);
    assert.equal(listed.body.data.data[0].id, row.id);
    await api().post(`${url}/letters/${row.id}/reopen`).set('x-test-role', 'reader')
      .send({ reason: 'Must not reopen' }).expect(403);
    await api().post(`${url}/letters/${row.id}/reopen`).set('x-test-role', 'owner')
      .send({ reason: 'short' }).expect(400);
    const reopened = await api().post(`${url}/letters/${row.id}/reopen`).set('x-test-role', 'owner')
      .send({ reason: 'Approved test correspondence reopening' }).expect(200);
    assert.equal(reopened.body.data.status, 'SENT');
    await api().post(`/api/v1/letters/${row.id}/archive`).set('x-test-role', 'owner')
      .send({ reason: 'Manual test archive after automatic reopening' }).expect(200);
    const history = await api().get(`${url}/letters/${row.id}/history?page=2&pageSize=1`)
      .set('x-test-role', 'reader');
    assert.equal(history.status, 200, JSON.stringify(history.body));
    assert.equal(history.body.data.total, 3);
    assert.equal(history.body.data.items[0].action, 'letter.reopen');
    assert.equal(history.body.data.hasMore, true);
    await api().delete(`/api/v1/letters/${row.id}`).set('x-test-role', 'owner').expect(409);
    assert.equal(row.deletedAt, null);
    assert.equal(events.filter((e) => e.action === 'letter.archive').length, 2);
  } finally { await app.close(); }
});
