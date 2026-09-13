import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Phase 17 — correspondence register e2e (ADR-037).
 * Covers: RBAC, OUTGOING DRAFT->SENT->ARCHIVED, INCOMING created as RECEIVED,
 * numbering LET-YYMM-#####, DRAFT-only edits + delete, content freeze after send,
 * one-click reply threading (Re: subject, mirrored contacts, repliesCount),
 * list filters (direction/status/replyToId/search).
 */
describe('Letters (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();

  let adminToken = '';
  let noReadToken = ''; // no letter perms at all
  let readerToken = ''; // letter:read
  let writerToken = ''; // + create/update
  let senderToken = ''; // + send
  let archiverToken = ''; // + archive + delete

  let draftId = '';
  let sentId = '';
  let incomingId = '';
  let replyId = '';

  const auth = (token: string) => ({ Authorization: 'Bearer ' + token });
  const S = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } })
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    const login = await S().post('/api/v1/auth/login').send({ email: admin.email, password: admin.password }).expect(200);
    adminToken = login.body.data.accessToken;

    noReadToken = await createRoleToken(`LETN0_${tag}`, ['cargo:read'], `let-n0-${randomTag}@shipping.local`);
    readerToken = await createRoleToken(
      `LETRD_${tag}`,
      ['letter:read'],
      `let-rd-${randomTag}@shipping.local`
    );
    writerToken = await createRoleToken(
      `LETRW_${tag}`,
      ['letter:read', 'letter:create', 'letter:update'],
      `let-rw-${randomTag}@shipping.local`
    );
    senderToken = await createRoleToken(
      `LETSN_${tag}`,
      ['letter:read', 'letter:create', 'letter:send'],
      `let-sn-${randomTag}@shipping.local`
    );
    archiverToken = await createRoleToken(
      `LETAR_${tag}`,
      ['letter:read', 'letter:create', 'letter:archive', 'letter:delete'],
      `let-ar-${randomTag}@shipping.local`
    );

    async function createRoleToken(roleCode: string, permissionCodes: string[], email: string): Promise<string> {
      const perms = await S().get('/api/v1/permissions/all').set(auth(adminToken)).expect(200);
      const ids = permissionCodes.map((code) => {
        const perm = perms.body.data.find((p: { code: string }) => p.code === code);
        expect(perm).toBeDefined();
        return perm.id;
      });
      const role = await S().post('/api/v1/roles').set(auth(adminToken)).send({ code: roleCode, name: roleCode }).expect(201);
      await S().patch(`/api/v1/roles/${role.body.data.id}/permissions`).set(auth(adminToken)).send({ permissionIds: ids }).expect(200);
      await S().post('/api/v1/users').set(auth(adminToken))
        .send({ email, password: 'ChangeMe123!', fullName: `LET ${roleCode}`, roleIds: [role.body.data.id] }).expect(201);
      const lg = await S().post('/api/v1/auth/login').send({ email, password: 'ChangeMe123!' }).expect(200);
      return lg.body.data.accessToken;
    }
  });

  afterAll(async () => {
    // Hard tag-scoped cleanup via Prisma (Phase 12 lesson: zero leaks).
    const prisma = app.get(PrismaService);
    try {
      await prisma.letter.deleteMany({ where: { subject: { contains: randomTag } } });
      const users = await prisma.user.findMany({
        where: { email: { contains: `-${randomTag}@shipping.local` } },
        select: { id: true },
      });
      const userIds = users.map((u: { id: string }) => u.id);
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.role.deleteMany({ where: { code: { endsWith: `_${tag}` } } });
    } finally {
      await app.close();
    }
  });

  // ── RBAC ───────────────────────────────────────────────────────────────────

  it('401 without token; 403 without permission; 200 with read', async () => {
    await S().get('/api/v1/letters').expect(401);
    await S().get('/api/v1/letters').set(auth(noReadToken)).expect(403);
    await S().get('/api/v1/letters').set(auth(readerToken)).expect(200);
  });

  // ── creation ───────────────────────────────────────────────────────────────

  it('outgoing create: 403 for reader; DRAFT + LET numbering for writer', async () => {
    await S().post('/api/v1/letters').set(auth(readerToken))
      .send({ direction: 'OUTGOING', subject: `nope ${randomTag}`, letterDate: '2026-09-01' })
      .expect(403);

    const res = await S().post('/api/v1/letters').set(auth(writerToken))
      .send({ direction: 'OUTGOING', subject: `Release request ${randomTag}`, letterDate: '2026-09-01', body: 'please release', refNumber: `REF-${tag}` })
      .expect(201);
    draftId = res.body.data.id;
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.letterNumber).toMatch(/^LET-\d{4}-\d{5}$/);
    expect(res.body.data.repliesCount).toBe(0);
  });

  it('incoming create: forced RECEIVED (a stray status field is whitelisted away)', async () => {
    const res = await S().post('/api/v1/letters').set(auth(writerToken))
      .send({ direction: 'INCOMING', subject: `Customs notice ${randomTag}`, letterDate: '2026-09-02', fromContact: `Customs ${randomTag}`, status: 'DRAFT' })
      .expect(201);
    incomingId = res.body.data.id;
    expect(res.body.data.status).toBe('RECEIVED');
  });

  it('missing required subject -> 400', async () => {
    await S().post('/api/v1/letters').set(auth(writerToken))
      .send({ direction: 'OUTGOING', letterDate: '2026-09-01' })
      .expect(400);
  });

  it('replyTo an unknown letter -> 400', async () => {
    await S().post('/api/v1/letters').set(auth(writerToken))
      .send({ direction: 'OUTGOING', subject: `bad thread ${randomTag}`, letterDate: '2026-09-01', replyToId: 'c00000000000000000000000' })
      .expect(400);
  });

  // ── DRAFT editing ──────────────────────────────────────────────────────────

  it('update DRAFT changes subject + date', async () => {
    const res = await S().patch(`/api/v1/letters/${draftId}`).set(auth(writerToken))
      .send({ subject: `Release request v2 ${randomTag}`, letterDate: '2026-09-03' })
      .expect(200);
    expect(res.body.data.subject).toBe(`Release request v2 ${randomTag}`);
    expect(res.body.data.letterDate.startsWith('2026-09-03')).toBe(true);
  });

  it('update non-existent letter -> 404', async () => {
    await S().patch('/api/v1/letters/c00000000000000000000000').set(auth(writerToken))
      .send({ subject: 'x' }).expect(404);
  });

  // ── send / freeze / archive ────────────────────────────────────────────────

  it('send: 403 without send perm; DRAFT->SENT with stamp', async () => {
    await S().post(`/api/v1/letters/${draftId}/send`).set(auth(writerToken)).expect(403);
    const res = await S().post(`/api/v1/letters/${draftId}/send`).set(auth(senderToken)).expect(200);
    sentId = draftId;
    expect(res.body.data.status).toBe('SENT');
    expect(res.body.data.sentAt).toBeTruthy();
  });

  it('SENT content is frozen: update -> 409', async () => {
    await S().patch(`/api/v1/letters/${sentId}`).set(auth(writerToken))
      .send({ subject: `tampered ${randomTag}` })
      .expect(409);
  });

  it('send again: 409 (transition map)', async () => {
    await S().post(`/api/v1/letters/${sentId}/send`).set(auth(senderToken)).expect(409);
  });

  it('archive: 403 for sender; SENT->ARCHIVED terminal with stamp', async () => {
    await S().post(`/api/v1/letters/${sentId}/archive`).set(auth(senderToken)).expect(403);
    const res = await S().post(`/api/v1/letters/${sentId}/archive`).set(auth(archiverToken)).expect(200);
    expect(res.body.data.status).toBe('ARCHIVED');
    expect(res.body.data.archivedAt).toBeTruthy();
    // terminal
    await S().post(`/api/v1/letters/${sentId}/archive`).set(auth(archiverToken)).expect(409);
  });

  it('RECEIVED incoming can be archived', async () => {
    const res = await S().post(`/api/v1/letters/${incomingId}/archive`).set(auth(archiverToken)).expect(200);
    expect(res.body.data.status).toBe('ARCHIVED');
  });

  // ── reply threading ────────────────────────────────────────────────────────

  it('reply: creates threaded OUTGOING DRAFT with Re: subject + mirrored contacts', async () => {
    const res = await S().post(`/api/v1/letters/${incomingId}/reply`).set(auth(writerToken))
      .send({ body: `we comply ${randomTag}` })
      .expect(200);
    replyId = res.body.data.id;
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.direction).toBe('OUTGOING');
    expect(res.body.data.subject).toBe(`Re: Customs notice ${randomTag}`);
    expect(res.body.data.replyToId).toBe(incomingId);
    expect(res.body.data.toContact).toBe(`Customs ${randomTag}`);

    const detail = await S().get(`/api/v1/letters/${incomingId}`).set(auth(readerToken)).expect(200);
    expect(detail.body.data.repliesCount).toBe(1);
    expect(detail.body.data.replyTo).toBeNull();

    const child = await S().get(`/api/v1/letters/${replyId}`).set(auth(readerToken)).expect(200);
    expect(child.body.data.replyTo.id).toBe(incomingId);

    const byThread = await S().get(`/api/v1/letters?replyToId=${incomingId}`).set(auth(readerToken)).expect(200);
    const rows = byThread.body.data.data.filter((l: { id: string }) => l.id === replyId);
    expect(rows.length).toBe(1);
  });

  // ── list filters ───────────────────────────────────────────────────────────

  it('filters: direction, status, search', async () => {
    const inc = await S().get(`/api/v1/letters?direction=INCOMING&search=${randomTag}`).set(auth(readerToken)).expect(200);
    expect(inc.body.data.data.every((l: { direction: string }) => l.direction === 'INCOMING')).toBe(true);
    expect(inc.body.data.data.length).toBeGreaterThanOrEqual(1);

    const arch = await S().get(`/api/v1/letters?status=ARCHIVED&search=${randomTag}`).set(auth(readerToken)).expect(200);
    expect(arch.body.data.data.every((l: { status: string }) => l.status === 'ARCHIVED')).toBe(true);
    expect(arch.body.data.data.some((l: { id: string }) => l.id === sentId)).toBe(true);

    const subj = await S().get(`/api/v1/letters?search=v2%20${randomTag}`).set(auth(readerToken)).expect(200);
    expect(subj.body.data.data.some((l: { id: string }) => l.id === sentId)).toBe(true);
  });

  // ── delete gating ──────────────────────────────────────────────────────────

  it('delete: DRAFT only (200 + gone), non-DRAFT 409', async () => {
    await S().delete(`/api/v1/letters/${sentId}`).set(auth(archiverToken)).expect(409);
    await S().delete(`/api/v1/letters/${replyId}`).set(auth(archiverToken)).expect(200);
    await S().get(`/api/v1/letters/${replyId}`).set(auth(readerToken)).expect(404);
  });
});
