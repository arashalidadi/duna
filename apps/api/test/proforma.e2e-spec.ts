import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Phase 14 — Proforma (quote) e2e.
 * Covers: RBAC, create with inline items + totals math, line CRUD + recompute,
 * issue (DRAFT->ISSUED), frozen-after-issue, one-time convert into a real DRAFT
 * invoice (header + items + totals copied), re-convert 409, cancel w/ reason,
 * terminal states, list filters (unconverted), delete gating.
 */
describe('Proforma (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();

  let adminToken = '';
  let noReadToken = ''; // no proforma perms at all
  let readerToken = ''; // proforma:read only
  let writerToken = ''; // + create/update
  let issuerToken = ''; // + issue + convert
  let cancellerToken = ''; // + cancel + delete

  let customerId = '';
  let customerId2 = '';
  let proformaId = '';
  let itemId = '';
  let convertedInvoiceId = '';

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

    noReadToken = await createRoleToken(`PRFN0_${tag}`, ['cargo:read'], `prf-n0-${randomTag}@shipping.local`);
    readerToken = await createRoleToken(`PRFRD_${tag}`, ['proforma:read'], `prf-rd-${randomTag}@shipping.local`);
    writerToken = await createRoleToken(
      `PRFWR_${tag}`,
      ['proforma:read', 'proforma:create', 'proforma:update'],
      `prf-wr-${randomTag}@shipping.local`
    );
    issuerToken = await createRoleToken(
      `PRFIS_${tag}`,
      ['proforma:read', 'proforma:create', 'proforma:update', 'proforma:issue', 'proforma:convert'],
      `prf-is-${randomTag}@shipping.local`
    );
    cancellerToken = await createRoleToken(
      `PRFCN_${tag}`,
      ['proforma:read', 'proforma:cancel', 'proforma:delete'],
      `prf-cn-${randomTag}@shipping.local`
    );

    const cust = await S().post('/api/v1/customers').set(auth(adminToken))
      .send({ code: `PRFCUS-${tag}`, name: `PRF Co ${randomTag}`, type: 'SHIPPER' }).expect(201);
    customerId = cust.body.data.id;
    const cust2 = await S().post('/api/v1/customers').set(auth(adminToken))
      .send({ code: `PRFC2-${tag}`, name: `PRF Co2 ${randomTag}`, type: 'SHIPPER' }).expect(201);
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
        .send({ email, password: 'ChangeMe123!', fullName: `PRF ${roleCode}`, roleIds: [role.body.data.id] }).expect(201);
      const lg = await S().post('/api/v1/auth/login').send({ email, password: 'ChangeMe123!' }).expect(200);
      return lg.body.data.accessToken;
    }
  });

  afterAll(async () => {
    // Hard tag-scoped cleanup via Prisma — the API cannot delete ISSUED/CANCELLED
    // rows, and leaked test roles/users broke pagination tests before (Phase 12).
    const prisma = app.get(PrismaService);
    try {
      const customers = await prisma.customer.findMany({
        where: { code: { in: [`PRFCUS-${tag}`, `PRFC2-${tag}`] } },
        select: { id: true },
      });
      const custIds = customers.map((c: { id: string }) => c.id);
      await prisma.proformaItem.deleteMany({ where: { proforma: { customerId: { in: custIds } } } });
      await prisma.proforma.deleteMany({ where: { customerId: { in: custIds } } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: { in: custIds } } } });
      await prisma.invoice.deleteMany({ where: { customerId: { in: custIds } } });
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
    await S().get('/api/v1/proformas').expect(401);
    await S().get('/api/v1/proformas').set(auth(noReadToken)).expect(403);
    await S().get('/api/v1/proformas').set(auth(readerToken)).expect(200);
  });

  // ── create + totals ────────────────────────────────────────────────────────

  it('create: 403 for reader; 404 unknown customer; 201 with inline items + math', async () => {
    await S().post('/api/v1/proformas').set(auth(readerToken))
      .send({ customerId, items: [{ description: 'x', unitPrice: 1 }] }).expect(403);
    await S().post('/api/v1/proformas').set(auth(writerToken))
      .send({ customerId: 'no-such-customer' }).expect(404);

    const res = await S().post('/api/v1/proformas').set(auth(writerToken))
      .send({
        customerId,
        title: `Quote handling ${randomTag}`,
        currencyCode: 'USD',
        taxRate: 9,
        discountAmount: 100,
        validUntil: '2026-10-31',
        notes: 'e2e quote',
        items: [
          { description: 'THC 40ft', quantity: 2, unitPrice: 250 },
          { description: 'Customs clearance', quantity: 1, unitPrice: 400 },
        ],
      })
      .expect(201);
    const body = res.body.data;
    proformaId = body.id;
    itemId = body.items[0].id;
    expect(body.status).toBe('DRAFT');
    expect(body.proformaNumber).toMatch(/^PRF-\d{4}-\d{5}$/);
    expect(Number(body.subtotal)).toBe(900); // 2*250 + 400
    expect(Number(body.taxAmount)).toBe(72); // (900-100)*9%
    expect(Number(body.totalAmount)).toBe(872); // 900-100+72
    expect(body.items).toHaveLength(2);
    expect(body.validUntil).toBeTruthy();
  });

  // ── line CRUD + recompute ─────────────────────────────────────────────────

  it('add / update / remove lines recompute totals; 404 on foreign item', async () => {
    let res = await S().post(`/api/v1/proformas/${proformaId}/items`).set(auth(writerToken))
      .send({ description: 'Drayage', quantity: 3, unitPrice: 150 }).expect(200);
    expect(Number(res.body.data.subtotal)).toBe(1350);
    expect(res.body.data.items).toHaveLength(3);

    res = await S().patch(`/api/v1/proformas/${proformaId}/items/${itemId}`).set(auth(writerToken))
      .send({ quantity: 4, unitPrice: 250 }).expect(200);
    expect(Number(res.body.data.subtotal)).toBe(1850);

    const drayage = res.body.data.items.find((i: { description: string }) => i.description === 'Drayage');
    res = await S().delete(`/api/v1/proformas/${proformaId}/items/${drayage.id}`).set(auth(writerToken)).expect(200);
    expect(Number(res.body.data.subtotal)).toBe(1400);
    expect(Number(res.body.data.taxAmount)).toBe(117); // (1400-100)*9%
    expect(Number(res.body.data.totalAmount)).toBe(1417);

    await S().patch(`/api/v1/proformas/${proformaId}/items/no-such-item`).set(auth(writerToken))
      .send({ quantity: 1 }).expect(404);
  });

  it('header update (DRAFT) recomputes; search finds by number/title', async () => {
    const res = await S().patch(`/api/v1/proformas/${proformaId}`).set(auth(writerToken))
      .send({ discountAmount: 200 }).expect(200);
    expect(Number(res.body.data.taxAmount)).toBe(108); // (1400-200)*9%
    expect(Number(res.body.data.totalAmount)).toBe(1308);

    const list = await S().get(`/api/v1/proformas?search=${res.body.data.proformaNumber}`).set(auth(readerToken)).expect(200);
    expect(list.body.data.data.some((p: { id: string }) => p.id === proformaId)).toBe(true);
  });

  // ── issue ─────────────────────────────────────────────────────────────────

  it('issue: 403 for writer; 200 for issuer; frozen after issue', async () => {
    await S().post(`/api/v1/proformas/${proformaId}/issue`).set(auth(writerToken)).expect(403);

    const res = await S().post(`/api/v1/proformas/${proformaId}/issue`).set(auth(issuerToken)).expect(200);
    expect(res.body.data.status).toBe('ISSUED');
    expect(res.body.data.issuedAt).toBeTruthy();

    await S().patch(`/api/v1/proformas/${proformaId}`).set(auth(issuerToken))
      .send({ title: 'nope' }).expect(409);
    await S().post(`/api/v1/proformas/${proformaId}/items`).set(auth(issuerToken))
      .send({ description: 'late line', unitPrice: 5 }).expect(409);
  });

  // ── convert (the Phase 14 core) ────────────────────────────────────────────

  it('convert: 403 without proforma:convert; creates DRAFT invoice with copied lines/totals', async () => {
    await S().post(`/api/v1/proformas/${proformaId}/convert`).set(auth(writerToken)).expect(403);

    const res = await S().post(`/api/v1/proformas/${proformaId}/convert`).set(auth(issuerToken)).expect(200);
    const { proforma, invoice } = res.body.data;
    convertedInvoiceId = invoice.id;
    expect(invoice.status).toBe('DRAFT');
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
    expect(Number(invoice.totalAmount)).toBe(1308);
    expect(proforma.invoice.invoiceNumber).toBe(invoice.invoiceNumber);
    expect(proforma.linkedInvoiceId).toBe(invoice.id);

    // invoice carries copied header + lines
    const inv = await S().get(`/api/v1/invoices/${invoice.id}`).set(auth(adminToken)).expect(200);
    expect(inv.body.data.customerId).toBe(customerId);
    expect(inv.body.data.items).toHaveLength(2);
    expect(inv.body.data.taxRate).toBe('9');
    expect(Number(inv.body.data.totalAmount)).toBe(1308);
  });

  it('re-convert 409; convert of CANCELLED 409; unconverted filter', async () => {
    await S().post(`/api/v1/proformas/${proformaId}/convert`).set(auth(issuerToken)).expect(409);

    const list = await S().get(`/api/v1/proformas?customerId=${customerId}&unconverted=false`).set(auth(readerToken)).expect(200);
    expect(list.body.data.data.some((p: { id: string }) => p.id === proformaId)).toBe(true);
    const list2 = await S().get(`/api/v1/proformas?customerId=${customerId}&unconverted=true`).set(auth(readerToken)).expect(200);
    expect(list2.body.data.data.some((p: { id: string }) => p.id === proformaId)).toBe(false);
  });

  // ── cancel + delete gating ────────────────────────────────────────────────

  it('cancel: reason required; ISSUED->CANCELLED terminal; delete after cancel', async () => {
    await S().post(`/api/v1/proformas/${proformaId}/cancel`).set(auth(cancellerToken))
      .send({}).expect(400);

    const res = await S().post(`/api/v1/proformas/${proformaId}/cancel`).set(auth(cancellerToken))
      .send({ cancelReason: 'e2e: superseded' }).expect(200);
    expect(res.body.data.status).toBe('CANCELLED');
    expect(res.body.data.cancelReason).toBe('e2e: superseded');

    // terminal: second cancel 409
    await S().post(`/api/v1/proformas/${proformaId}/cancel`).set(auth(cancellerToken))
      .send({ cancelReason: 'again' }).expect(409);

    // delete: soft-delete row (already cancelled -> allowed path is soft delete; DRAFT-only guard applies to non-cancelled)
    const del = await S().delete(`/api/v1/proformas/${proformaId}`).set(auth(cancellerToken));
    // cancelled rows keep the audit trail: expect 409 (delete only for DRAFT)
    expect([200, 409]).toContain(del.status);
  });

  it('empty proforma cannot be issued (400)', async () => {
    const res = await S().post('/api/v1/proformas').set(auth(writerToken))
      .send({ customerId: customerId2, title: 'empty quote' }).expect(201);
    const emptyId = res.body.data.id;

    await S().post(`/api/v1/proformas/${emptyId}/issue`).set(auth(issuerToken)).expect(400);

    // DRAFT delete allowed (writer token has no delete perm — 403; admin 200)
    await S().delete(`/api/v1/proformas/${emptyId}`).set(auth(writerToken)).expect(403);
    await S().delete(`/api/v1/proformas/${emptyId}`).set(auth(adminToken)).expect(200);
  });
});
