import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Phase 15 — Quotation e2e (front of the commercial chain, ADR-035).
 * Covers: RBAC, create with inline items + totals math, line CRUD + recompute,
 * send (DRAFT->SENT, empty 400, frozen), accept, reject w/ reason, cancel w/
 * reason, one-time convert into a real DRAFT proforma (header + items +
 * totals copied), re-convert 409, convertible filter, delete gating.
 */
describe('Quotation (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();

  let adminToken = '';
  let noReadToken = ''; // no quotation perms at all
  let readerToken = ''; // quotation:read only
  let writerToken = ''; // + create/update
  let opsToken = ''; // + send + accept + convert
  let cancellerToken = ''; // + cancel + delete

  let customerId = '';
  let customerId2 = '';
  let quotationId = '';
  let itemId = '';
  let convertedProformaId = '';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
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

    noReadToken = await createRoleToken(`QTN0_${tag}`, ['cargo:read'], `qt-n0-${randomTag}@shipping.local`);
    readerToken = await createRoleToken(`QTRD_${tag}`, ['quotation:read'], `qt-rd-${randomTag}@shipping.local`);
    writerToken = await createRoleToken(
      `QTWR_${tag}`,
      ['quotation:read', 'quotation:create', 'quotation:update'],
      `qt-wr-${randomTag}@shipping.local`
    );
    opsToken = await createRoleToken(
      `QTOP_${tag}`,
      ['quotation:read', 'quotation:create', 'quotation:update', 'quotation:send', 'quotation:accept', 'quotation:convert'],
      `qt-op-${randomTag}@shipping.local`
    );
    cancellerToken = await createRoleToken(
      `QTCN_${tag}`,
      ['quotation:read', 'quotation:reject', 'quotation:cancel', 'quotation:delete'],
      `qt-cn-${randomTag}@shipping.local`
    );

    const cust = await S().post('/api/v1/customers').set(auth(adminToken))
      .send({ code: `QTCUS-${tag}`, name: `QT Co ${randomTag}`, type: 'SHIPPER' }).expect(201);
    customerId = cust.body.data.id;
    const cust2 = await S().post('/api/v1/customers').set(auth(adminToken))
      .send({ code: `QTC2-${tag}`, name: `QT Co2 ${randomTag}`, type: 'SHIPPER' }).expect(201);
    customerId2 = cust2.body.data.id;

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
        .send({ email, password: 'ChangeMe123!', fullName: `QT ${roleCode}`, roleIds: [role.body.data.id] }).expect(201);
      const lg = await S().post('/api/v1/auth/login').send({ email, password: 'ChangeMe123!' }).expect(200);
      return lg.body.data.accessToken;
    }
  });

  afterAll(async () => {
    // Hard tag-scoped cleanup via Prisma — the API cannot delete SENT+ rows,
    // and leaked test roles/users broke pagination tests before (Phase 12).
    const prisma = app.get(PrismaService);
    try {
      const customers = await prisma.customer.findMany({
        where: { code: { in: [`QTCUS-${tag}`, `QTC2-${tag}`] } },
        select: { id: true },
      });
      const custIds = customers.map((c: { id: string }) => c.id);
      await prisma.quotationItem.deleteMany({ where: { quotation: { customerId: { in: custIds } } } });
      await prisma.quotation.deleteMany({ where: { customerId: { in: custIds } } });
      await prisma.proformaItem.deleteMany({ where: { proforma: { customerId: { in: custIds } } } });
      await prisma.proforma.deleteMany({ where: { customerId: { in: custIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: custIds } } });
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

  it('401 without token; 403 without permission', async () => {
    await S().get('/api/v1/quotations').expect(401);
    await S().get('/api/v1/quotations').set(auth(noReadToken)).expect(403);
    await S().get('/api/v1/quotations').set(auth(readerToken)).expect(200);
  });

  // ── create + totals ────────────────────────────────────────────────────────

  it('create: 403 for reader; 404 unknown customer; 201 with inline items + math', async () => {
    await S().post('/api/v1/quotations').set(auth(readerToken))
      .send({ customerId, items: [{ description: 'x', unitPrice: 1 }] }).expect(403);
    await S().post('/api/v1/quotations').set(auth(writerToken))
      .send({ customerId: 'no-such-customer' }).expect(404);

    const res = await S().post('/api/v1/quotations').set(auth(writerToken))
      .send({
        customerId,
        title: `Freight quote ${randomTag}`,
        currencyCode: 'USD',
        taxRate: 9,
        discountAmount: 100,
        validUntil: '2026-10-31',
        notes: 'e2e quote',
        items: [
          { description: 'Ocean freight 40ft', quantity: 2, unitPrice: 250 },
          { description: 'Customs clearance', quantity: 1, unitPrice: 400 },
        ],
      })
      .expect(201);
    const body = res.body.data;
    quotationId = body.id;
    itemId = body.items[0].id;
    expect(body.status).toBe('DRAFT');
    expect(body.quotationNumber).toMatch(/^QT-\d{4}-\d{5}$/);
    expect(Number(body.subtotal)).toBe(900); // 2*250 + 400
    expect(Number(body.taxAmount)).toBe(72); // (900-100)*9%
    expect(Number(body.totalAmount)).toBe(872); // 900-100+72
    expect(body.items).toHaveLength(2);
    expect(body.validUntil).toBeTruthy();
  });

  // ── line CRUD + recompute ─────────────────────────────────────────────────

  it('add / update / remove lines recompute totals; 404 on foreign item', async () => {
    let res = await S().post(`/api/v1/quotations/${quotationId}/items`).set(auth(writerToken))
      .send({ description: 'Drayage', quantity: 3, unitPrice: 150 }).expect(200);
    expect(Number(res.body.data.subtotal)).toBe(1350);
    expect(res.body.data.items).toHaveLength(3);

    res = await S().patch(`/api/v1/quotations/${quotationId}/items/${itemId}`).set(auth(writerToken))
      .send({ quantity: 4, unitPrice: 250 }).expect(200);
    expect(Number(res.body.data.subtotal)).toBe(1850);

    const drayage = res.body.data.items.find((i: { description: string }) => i.description === 'Drayage');
    res = await S().delete(`/api/v1/quotations/${quotationId}/items/${drayage.id}`).set(auth(writerToken)).expect(200);
    expect(Number(res.body.data.subtotal)).toBe(1400);
    expect(Number(res.body.data.taxAmount)).toBe(117); // (1400-100)*9%
    expect(Number(res.body.data.totalAmount)).toBe(1417);

    await S().patch(`/api/v1/quotations/${quotationId}/items/no-such-item`).set(auth(writerToken))
      .send({ quantity: 1 }).expect(404);
  });

  it('header update (DRAFT) recomputes; search finds by number/title', async () => {
    const res = await S().patch(`/api/v1/quotations/${quotationId}`).set(auth(writerToken))
      .send({ discountAmount: 200 }).expect(200);
    expect(Number(res.body.data.taxAmount)).toBe(108); // (1400-200)*9%
    expect(Number(res.body.data.totalAmount)).toBe(1308);

    const list = await S().get(`/api/v1/quotations?search=${res.body.data.quotationNumber}`).set(auth(readerToken)).expect(200);
    expect(list.body.data.data.some((q: { id: string }) => q.id === quotationId)).toBe(true);
  });

  // ── send ───────────────────────────────────────────────────────────────────

  it('send: 403 for writer; stamps sentAt/issueDate; freezes after send', async () => {
    await S().post(`/api/v1/quotations/${quotationId}/send`).set(auth(writerToken)).expect(403);

    const res = await S().post(`/api/v1/quotations/${quotationId}/send`).set(auth(opsToken)).expect(200);
    expect(res.body.data.status).toBe('SENT');
    expect(res.body.data.sentAt).toBeTruthy();
    expect(res.body.data.issueDate).toBeTruthy();

    // frozen: header edit + line add both 409
    await S().patch(`/api/v1/quotations/${quotationId}`).set(auth(opsToken))
      .send({ title: 'nope' }).expect(409);
    await S().post(`/api/v1/quotations/${quotationId}/items`).set(auth(opsToken))
      .send({ description: 'late line', unitPrice: 5 }).expect(409);

    // wrong-state transitions
    await S().post(`/api/v1/quotations/${quotationId}/send`).set(auth(opsToken)).expect(409); // SENT->SENT
  });

  it('empty quotation cannot be sent (400)', async () => {
    const res = await S().post('/api/v1/quotations').set(auth(writerToken))
      .send({ customerId: customerId2, title: 'empty quote' }).expect(201);
    const emptyId = res.body.data.id;

    await S().post(`/api/v1/quotations/${emptyId}/send`).set(auth(opsToken)).expect(400);

    // delete cleanup via DRAFT path: writer 403 (no delete perm), admin 200
    await S().delete(`/api/v1/quotations/${emptyId}`).set(auth(writerToken)).expect(403);
    await S().delete(`/api/v1/quotations/${emptyId}`).set(auth(adminToken)).expect(200);
  });

  // ── reject path (customer declined) ────────────────────────────────────────

  it('reject: reason required; SENT->REJECTED terminal; delete gate 409', async () => {
    const res = await S().post('/api/v1/quotations').set(auth(writerToken))
      .send({
        customerId: customerId2,
        title: 'quote to reject',
        items: [{ description: 'Line haul', quantity: 1, unitPrice: 999 }],
      })
      .expect(201);
    const rejId = res.body.data.id;
    await S().post(`/api/v1/quotations/${rejId}/send`).set(auth(opsToken)).expect(200);

    await S().post(`/api/v1/quotations/${rejId}/reject`).set(auth(cancellerToken))
      .send({}).expect(400);
    const rej = await S().post(`/api/v1/quotations/${rejId}/reject`).set(auth(cancellerToken))
      .send({ rejectReason: 'customer went with another forwarder' }).expect(200);
    expect(rej.body.data.status).toBe('REJECTED');
    expect(rej.body.data.rejectReason).toBe('customer went with another forwarder');
    expect(rej.body.data.rejectedAt).toBeTruthy();

    // terminal: reject again / send 409
    await S().post(`/api/v1/quotations/${rejId}/reject`).set(auth(cancellerToken))
      .send({ rejectReason: 'again' }).expect(409);
    await S().post(`/api/v1/quotations/${rejId}/send`).set(auth(opsToken)).expect(409);

    // delete only for DRAFT: 409
    await S().delete(`/api/v1/quotations/${rejId}`).set(auth(cancellerToken)).expect(409);
  });

  // ── accept + convert (the Phase 15 core) ──────────────────────────────────

  it('convert before accept 409; accept: 403 without quotation:accept', async () => {
    await S().post(`/api/v1/quotations/${quotationId}/convert`).set(auth(opsToken)).expect(409);
    await S().post(`/api/v1/quotations/${quotationId}/accept`).set(auth(writerToken)).expect(403);
  });

  it('accept then convert creates a DRAFT proforma with copied lines/totals', async () => {
    const acc = await S().post(`/api/v1/quotations/${quotationId}/accept`).set(auth(opsToken)).expect(200);
    expect(acc.body.data.status).toBe('ACCEPTED');
    expect(acc.body.data.acceptedAt).toBeTruthy();

    const res = await S().post(`/api/v1/quotations/${quotationId}/convert`).set(auth(opsToken)).expect(200);
    const { quotation, proforma } = res.body.data;
    convertedProformaId = proforma.id;
    expect(proforma.status).toBe('DRAFT');
    expect(proforma.proformaNumber).toMatch(/^PRF-\d{4}-\d{5}$/);
    expect(Number(proforma.totalAmount)).toBe(1308);
    expect(quotation.linkedProformaId).toBe(proforma.id);
    expect(quotation.proforma.proformaNumber).toBe(proforma.proformaNumber);

    // proforma carries copied header + lines + totals
    const pf = await S().get(`/api/v1/proformas/${proforma.id}`).set(auth(adminToken)).expect(200);
    expect(pf.body.data.customerId).toBe(customerId);
    expect(pf.body.data.items).toHaveLength(2);
    expect(Number(pf.body.data.taxRate)).toBe(9);
    expect(Number(pf.body.data.totalAmount)).toBe(1308);
    expect(pf.body.data.title).toBe(`Freight quote ${randomTag}`);
  });

  it('re-convert 409; convertible filter no longer lists it', async () => {
    await S().post(`/api/v1/quotations/${quotationId}/convert`).set(auth(opsToken)).expect(409);

    const list = await S().get(`/api/v1/quotations?customerId=${customerId}&convertible=true`).set(auth(readerToken)).expect(200);
    expect(list.body.data.data.some((q: { id: string }) => q.id === quotationId)).toBe(false);
    const list2 = await S().get(`/api/v1/quotations?customerId=${customerId}&convertible=false`).set(auth(readerToken)).expect(200);
    expect(list2.body.data.data.some((q: { id: string }) => q.id === quotationId)).toBe(true);

    // status filter sanity
    const list3 = await S().get(`/api/v1/quotations?customerId=${customerId}&status=ACCEPTED`).set(auth(readerToken)).expect(200);
    expect(list3.body.data.data.some((q: { id: string }) => q.id === quotationId)).toBe(true);
  });

  // ── cancel ─────────────────────────────────────────────────────────────────

  it('cancel: reason required; DRAFT->CANCELLED; delete-after-cancel keeps audit (409)', async () => {
    const res = await S().post('/api/v1/quotations').set(auth(writerToken))
      .send({ customerId: customerId2, title: 'to cancel', items: [{ description: 'x', quantity: 1, unitPrice: 50 }] })
      .expect(201);
    const cId = res.body.data.id;

    await S().post(`/api/v1/quotations/${cId}/cancel`).set(auth(cancellerToken))
      .send({}).expect(400);
    const cn = await S().post(`/api/v1/quotations/${cId}/cancel`).set(auth(cancellerToken))
      .send({ cancelReason: 'e2e: superseded' }).expect(200);
    expect(cn.body.data.status).toBe('CANCELLED');
    expect(cn.body.data.cancelReason).toBe('e2e: superseded');

    // terminal + audit: second cancel 409, delete 409 (not DRAFT anymore)
    await S().post(`/api/v1/quotations/${cId}/cancel`).set(auth(cancellerToken))
      .send({ cancelReason: 'again' }).expect(409);
    await S().delete(`/api/v1/quotations/${cId}`).set(auth(cancellerToken)).expect(409);
  });
});
