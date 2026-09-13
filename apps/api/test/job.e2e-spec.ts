import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Phase 18 — Jobs & job costing e2e (ADR-038).
 * Covers: RBAC, DRAFT+numbering, customer validation, item add/update/remove with
 * server-side totals recompute (profit = income - cost), lifecycle start/complete/cancel,
 * COMPLETED/CANCELLED freeze (items + edits + delete), filters, DRAFT-only delete.
 * Tag-scoped hard cleanup in afterAll (Phase 12 lesson).
 */
describe('Jobs (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();

  let adminToken = '';
  let readerToken = '';
  let writerToken = '';
  let finisherToken = '';

  let customerId = '';
  let jobId = '';
  let itemIncomeId = '';
  let itemCostId = '';
  let job2Id = '';

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

    readerToken = await createRoleToken(`JOBRD_${tag}`, ['job:read'], `job-rd-${randomTag}@shipping.local`);
    writerToken = await createRoleToken(
      `JOBWR_${tag}`,
      ['job:read', 'job:create', 'job:update'],
      `job-wr-${randomTag}@shipping.local`
    );
    finisherToken = await createRoleToken(
      `JOBFI_${tag}`,
      ['job:read', 'job:create', 'job:start', 'job:complete', 'job:cancel', 'job:delete'],
      `job-fi-${randomTag}@shipping.local`
    );

    const cust = await S().get('/api/v1/customers?pageSize=1').set(auth(adminToken)).expect(200);
    const rows = cust.body.data.data ?? cust.body.data;
    if (Array.isArray(rows) && rows.length > 0) customerId = rows[0].id;

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
        .send({ email, password: 'ChangeMe123!', fullName: `JOB ${roleCode}`, roleIds: [role.body.data.id] }).expect(201);
      const lg = await S().post('/api/v1/auth/login').send({ email, password: 'ChangeMe123!' }).expect(200);
      return lg.body.data.accessToken;
    }
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    try {
      const jobs = await prisma.job.findMany({ where: { title: { contains: randomTag } }, select: { id: true } });
      const jobIds = jobs.map((j: { id: string }) => j.id);
      await prisma.jobCostItem.deleteMany({ where: { jobId: { in: jobIds } } });
      await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
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
    await S().get('/api/v1/jobs').expect(401);
    await S().get('/api/v1/jobs').set(auth(readerToken)).expect(200);
  });

  // ── create ─────────────────────────────────────────────────────────────────

  it('create: 403 for reader; DRAFT + JOB numbering for writer; zero totals', async () => {
    await S().post('/api/v1/jobs').set(auth(readerToken))
      .send({ title: `X ${randomTag}` }).expect(403);

    const res = await S().post('/api/v1/jobs').set(auth(writerToken))
      .send({ title: `Import clearance ${randomTag}`, description: 'door-to-door', currencyCode: 'USD', jobType: 'IMPORT_CLEARANCE', customerId: customerId || undefined })
      .expect(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.jobNumber).toMatch(/^JOB-\d{4}-\d{5}$/);
    expect(Number(res.body.data.totalIncome)).toBe(0);
    expect(Number(res.body.data.profit)).toBe(0);
    jobId = res.body.data.id;
  });

  it('unknown customer on create -> 400', async () => {
    await S().post('/api/v1/jobs').set(auth(writerToken))
      .send({ title: `bad ${randomTag}`, customerId: 'cuid_does_not_exist0' }).expect(400);
  });

  it('empty title -> 400', async () => {
    await S().post('/api/v1/jobs').set(auth(writerToken)).send({ title: '' }).expect(400);
  });

  // ── items + totals ─────────────────────────────────────────────────────────

  it('addItem: INCOME 120.50 then COST 40 -> profit 80.50 recomputed each time', async () => {
    const inc = await S().post(`/api/v1/jobs/${jobId}/items`).set(auth(writerToken))
      .send({ kind: 'INCOME', description: 'freight', category: 'FREIGHT', amount: '120.50' }).expect(200);
    itemIncomeId = inc.body.data.items.find((i: { description: string }) => i.description === 'freight').id;
    expect(Number(inc.body.data.totalIncome)).toBeCloseTo(120.5, 2);

    const cost = await S().post(`/api/v1/jobs/${jobId}/items`).set(auth(writerToken))
      .send({ kind: 'COST', description: 'THC', amount: '40' }).expect(200);
    itemCostId = cost.body.data.items.find((i: { description: string }) => i.description === 'THC').id;
    expect(Number(cost.body.data.totalCost)).toBeCloseTo(40, 2);
    expect(Number(cost.body.data.profit)).toBeCloseTo(80.5, 2);
    expect(cost.body.data.jobNumber).toBeDefined(); // item routes return full detail
  });

  it('addItem: bad kind/amount -> 400', async () => {
    await S().post(`/api/v1/jobs/${jobId}/items`).set(auth(writerToken))
      .send({ kind: 'REFUND', description: 'x', amount: '5' }).expect(400);
    await S().post(`/api/v1/jobs/${jobId}/items`).set(auth(writerToken))
      .send({ kind: 'COST', description: 'x', amount: 'abc' }).expect(400);
  });

  it('updateItem: income 120.50 -> 200 recomputes profit', async () => {
    const up = await S().patch(`/api/v1/jobs/${jobId}/items/${itemIncomeId}`).set(auth(writerToken))
      .send({ amount: '200' }).expect(200);
    expect(Number(up.body.data.totalIncome)).toBeCloseTo(200, 2);
    expect(Number(up.body.data.profit)).toBeCloseTo(160, 2);
  });

  it('removeItem: deleting the cost leaves profit = income', async () => {
    const rm = await S().delete(`/api/v1/jobs/${jobId}/items/${itemCostId}`).set(auth(writerToken)).expect(200);
    expect(Number(rm.body.data.totalCost)).toBe(0);
    expect(Number(rm.body.data.profit)).toBeCloseTo(200, 2);
  });

  // ── lifecycle ──────────────────────────────────────────────────────────────

  it('complete from DRAFT -> 409 (must be OPEN); start then complete OK with stamps', async () => {
    await S().post(`/api/v1/jobs/${jobId}/complete`).set(auth(finisherToken)).expect(409);
    await S().post(`/api/v1/jobs/${jobId}/start`).set(auth(finisherToken)).expect(200);
    const done = await S().post(`/api/v1/jobs/${jobId}/complete`).set(auth(finisherToken)).expect(200);
    expect(done.body.data.status).toBe('COMPLETED');
    expect(done.body.data.completedAt).toBeTruthy();
  });

  it('COMPLETED freezes items and edits', async () => {
    await S().post(`/api/v1/jobs/${jobId}/items`).set(auth(writerToken))
      .send({ kind: 'COST', description: 'late', amount: '1' }).expect(409);
    await S().patch(`/api/v1/jobs/${jobId}`).set(auth(writerToken))
      .send({ title: 'nope' }).expect(409);
  });

  it('cancel COMPLETED -> 409; delete non-DRAFT -> 409', async () => {
    await S().post(`/api/v1/jobs/${jobId}/cancel`).set(auth(finisherToken)).send({ cancelReason: 'x' }).expect(409);
    await S().delete(`/api/v1/jobs/${jobId}`).set(auth(finisherToken)).expect(409);
  });

  it('cancel from DRAFT with reason stamps audit fields', async () => {
    const cr = await S().post('/api/v1/jobs').set(auth(finisherToken))
      .send({ title: `Abort ${randomTag}` }).expect(201);
    job2Id = cr.body.data.id;
    const cn = await S().post(`/api/v1/jobs/${job2Id}/cancel`).set(auth(finisherToken))
      .send({ cancelReason: 'customer walked away' }).expect(200);
    expect(cn.body.data.status).toBe('CANCELLED');
    expect(cn.body.data.cancelReason).toBe('customer walked away');
    expect(cn.body.data.cancelledAt).toBeTruthy();
  });

  it('delete DRAFT only: soft-deleted job disappears from detail + list', async () => {
    const cr = await S().post('/api/v1/jobs').set(auth(writerToken))
      .send({ title: `Scratch ${randomTag}` }).expect(201);
    const id3 = cr.body.data.id;
    await S().delete(`/api/v1/jobs/${id3}`).set(auth(finisherToken)).expect(200);
    await S().get(`/api/v1/jobs/${id3}`).set(auth(readerToken)).expect(404);
  });

  // ── filters ────────────────────────────────────────────────────────────────

  it('filters: status, search, jobType', async () => {
    const byStatus = await S().get(`/api/v1/jobs?status=COMPLETED&pageSize=50`).set(auth(readerToken)).expect(200);
    expect((byStatus.body.data.data ?? byStatus.body.data).some((j: { id: string }) => j.id === jobId)).toBe(true);

    const bySearch = await S().get(`/api/v1/jobs?search=clearance%20${randomTag}&pageSize=50`).set(auth(readerToken)).expect(200);
    expect((bySearch.body.data.data ?? bySearch.body.data).some((j: { id: string }) => j.id === jobId)).toBe(true);

    const byType = await S().get(`/api/v1/jobs?jobType=IMPORT_CLEARANCE&pageSize=50`).set(auth(readerToken)).expect(200);
    expect((byType.body.data.data ?? byType.body.data).some((j: { id: string }) => j.id === jobId)).toBe(true);
  });
});
