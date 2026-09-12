import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

type Ref = { id: string };

/**
 * Phase 11 — Invoice end-to-end tests.
 * Runs against the live development database (documented limitation).
 * Self-cleaning: creates its own customer (+ optional B/L/manifest anchors via
 * the existing demo chain is NOT used — anchors tested against throwaway
 * customer + a real bill/manifest pair is intentionally omitted; anchor
 * validation covered via unknown-id 404s + cross-voyage consistency is unit
 * of resolveAnchors guarded by bill.e2e chain data).
 *
 * Lifecycle under test:
 *   DRAFT -> ISSUED | CANCELLED ; DRAFT -> CANCELLED ; ISSUED -> CANCELLED
 * Items editable in DRAFT only; money recomputed server-side
 * (subtotal = SUM(qty x unit), tax = (subtotal - discount) x rate, total).
 */
describe('Invoice (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();
  const emailSuffix = randomTag;

  const createdCustomers: Ref[] = [];

  let adminToken = '';
  let readerToken = ''; // invoice:read only
  let writerToken = ''; // read + create + update
  let issuerToken = ''; // read + issue
  let cancellerToken = ''; // read + cancel
  let noReadToken = ''; // no invoice permission

  let customerId = '';
  let customerId2 = '';

  let invoice1Id = ''; // main flow: items -> issue -> cancel
  let invoice2Id = ''; // empty invoice (issue 400 + delete flow)
  let invoice3Id = ''; // anchor/link edit flow
  let invoice1ItemId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      })
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: admin.password })
      .expect(200);
    adminToken = login.body.data.accessToken as string;
    expect(adminToken).toBeDefined();

    readerToken = await createRoleToken(`INVREAD_${tag}`, ['invoice:read'], `inv-read-${emailSuffix}@shipping.local`);
    writerToken = await createRoleToken(
      `INVWRITE_${tag}`,
      ['invoice:read', 'invoice:create', 'invoice:update'],
      `inv-writer-${emailSuffix}@shipping.local`
    );
    issuerToken = await createRoleToken(
      `INVISS_${tag}`,
      ['invoice:read', 'invoice:issue'],
      `inv-iss-${emailSuffix}@shipping.local`
    );
    cancellerToken = await createRoleToken(
      `INVCANC_${tag}`,
      ['invoice:read', 'invoice:cancel'],
      `inv-canc-${emailSuffix}@shipping.local`
    );
    noReadToken = await createRoleToken(`INVNOREAD_${tag}`, ['cargo:read'], `inv-noread-${emailSuffix}@shipping.local`);

    const cust = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set(auth(adminToken))
      .send({ code: `INVCUS-${tag}`, name: `INV Co ${randomTag}`, type: 'SHIPPER' })
      .expect(201);
    createdCustomers.push({ id: cust.body.data.id });
    customerId = cust.body.data.id;

    const cust2 = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set(auth(adminToken))
      .send({ code: `INVCU2-${tag}`, name: `INV Co2 ${randomTag}`, type: 'CONSIGNEE' })
      .expect(201);
    createdCustomers.push({ id: cust2.body.data.id });
    customerId2 = cust2.body.data.id;
  }, 120000);

  afterAll(async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      // Reverse dependency order.
      await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: { in: createdCustomers.map((c) => c.id) } } } });
      await prisma.invoice.deleteMany({ where: { customerId: { in: createdCustomers.map((c) => c.id) } } });
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomers.map((c) => c.id) } } });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              `inv-read-${emailSuffix}@shipping.local`,
              `inv-writer-${emailSuffix}@shipping.local`,
              `inv-iss-${emailSuffix}@shipping.local`,
              `inv-canc-${emailSuffix}@shipping.local`,
              `inv-noread-${emailSuffix}@shipping.local`,
            ],
          },
        },
      });
      await prisma.role.deleteMany({
        where: {
          code: {
            in: [`INVREAD_${tag}`, `INVWRITE_${tag}`, `INVISS_${tag}`, `INVCANC_${tag}`, `INVNOREAD_${tag}`],
          },
        },
      });
      await prisma.$disconnect();
    } catch {
      /* best-effort cleanup */
    }
    await app.close();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createRoleToken(roleCode: string, permissionCodes: string[], email: string): Promise<string> {
    const perms = await request(app.getHttpServer())
      .get('/api/v1/permissions/all')
      .set(auth(adminToken))
      .expect(200);
    const ids = permissionCodes.map((code) => {
      const perm = perms.body.data.find((p: { code: string }) => p.code === code);
      expect(perm).toBeDefined();
      return perm.id;
    });

    const role = await request(app.getHttpServer())
      .post('/api/v1/roles')
      .set(auth(adminToken))
      .send({ code: roleCode, name: roleCode })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/roles/${role.body.data.id}/permissions`)
      .set(auth(adminToken))
      .send({ permissionIds: ids })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({ email, password: 'ChangeMe123!', fullName: `INV ${roleCode}`, roleIds: [role.body.data.id] })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'ChangeMe123!' })
      .expect(200);
    return login.body.data.accessToken as string;
  }

  it('401 without a token; 403 without invoice permission', async () => {
    await request(app.getHttpServer()).get('/api/v1/invoices').expect(401);
    await request(app.getHttpServer()).get('/api/v1/invoices').set(auth(noReadToken)).expect(403);
  });

  it('create requires invoice:create (403 for reader); unknown customer 404', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set(auth(readerToken))
      .send({ customerId })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set(auth(adminToken))
      .send({ customerId: 'nonexistent' })
      .expect(404);
  });

  it('create + get + list; INV-YYMM-##### number, DRAFT, money zeroed', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set(auth(writerToken))
      .send({ customerId, title: 'Freight charges', description: 'To: INV Co' })
      .expect(201);
    const created = res.body.data;
    expect(created.status).toBe('DRAFT');
    expect(created.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
    expect(created.customerId).toBe(customerId);
    expect(Number(created.totalAmount)).toBe(0);
    expect(created.items).toEqual([]);
    invoice1Id = created.id;

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/invoices/${invoice1Id}`)
      .set(auth(readerToken))
      .expect(200);
    expect(detail.body.data.invoiceNumber).toBe(created.invoiceNumber);

    const list = await request(app.getHttpServer())
      .get(`/api/v1/invoices?customerId=${customerId}`)
      .set(auth(readerToken))
      .expect(200);
    expect(list.body.data.data.some((i: { id: string }) => i.id === invoice1Id)).toBe(true);
  });

  it('addItem requires invoice:update (403 for reader); server computes amount = qty x unitPrice; totals recompute', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoice1Id}/items`)
      .set(auth(readerToken))
      .send({ description: 'Ocean freight', unitPrice: 100 })
      .expect(403);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoice1Id}/items`)
      .set(auth(writerToken))
      .send({ description: 'Ocean freight', unitPrice: '125.50', quantity: 2 })
      .expect(201);
    const detail = res.body.data;
    expect(detail.items).toHaveLength(1);
    const item = detail.items[0];
    invoice1ItemId = item.id;
    expect(item.sequence).toBe(1);
    expect(item.quantity).toBe(2);
    expect(Number(item.unitPrice)).toBe(125.5);
    expect(Number(item.amount)).toBe(251);
    expect(Number(detail.subtotal)).toBe(251);

    // second line -> subtotal accumulates
    const res2 = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoice1Id}/items`)
      .set(auth(writerToken))
      .send({ description: 'THC', unitPrice: 49 })
      .expect(201);
    expect(Number(res2.body.data.subtotal)).toBe(300);
    expect(Number(res2.body.data.totalAmount)).toBe(300);
    invoice2Id = ''; // placeholder (empty invoice created later)
  });

  it('updateItem changes qty/price; amount recomputed; removeItem recalculates totals; unknown item 404', async () => {
    const upd = await request(app.getHttpServer())
      .patch(`/api/v1/invoices/${invoice1Id}/items/${invoice1ItemId}`)
      .set(auth(writerToken))
      .send({ quantity: 3, unitPrice: '100' })
      .expect(200);
    const item = upd.body.data.items[0];
    expect(item.quantity).toBe(3);
    expect(Number(item.unitPrice)).toBe(100);
    expect(Number(item.amount)).toBe(300);
    expect(Number(upd.body.data.subtotal)).toBe(349); // 300 + 49 (THC)

    await request(app.getHttpServer())
      .patch(`/api/v1/invoices/${invoice1Id}/items/${'wrongitem123456'}`)
      .set(auth(writerToken))
      .send({ quantity: 1 })
      .expect(404);

    const rem = await request(app.getHttpServer())
      .delete(`/api/v1/invoices/${invoice1Id}/items/${invoice1ItemId}`)
      .set(auth(writerToken))
      .expect(200);
    expect(rem.body.data.items).toHaveLength(1);
    expect(Number(rem.body.data.subtotal)).toBe(49);
    expect(Number(rem.body.data.totalAmount)).toBe(49);
    invoice1ItemId = rem.body.data.items[0].id; // keep the THC line for issue flow
  });

  it('header update: tax + discount math (subtotal 49, discount 9, tax 10% -> total 44); unknown 404', async () => {
    const upd = await request(app.getHttpServer())
      .patch(`/api/v1/invoices/${invoice1Id}`)
      .set(auth(writerToken))
      .send({ taxRate: '10', discountAmount: '9', currencyCode: 'AED', dueDate: '2026-10-01' })
      .expect(200);
    const d = upd.body.data;
    expect(Number(d.taxRate)).toBe(10);
    expect(Number(d.discountAmount)).toBe(9);
    expect(Number(d.taxAmount)).toBe(4); // (49-9) x 10%
    expect(Number(d.totalAmount)).toBe(44); // 49 - 9 + 4
    expect(d.currencyCode).toBe('AED');
    expect(d.dueDate).toBeTruthy();

    await request(app.getHttpServer())
      .patch(`/api/v1/invoices/${'nonexistentinv'}`)
      .set(auth(writerToken))
      .send({ notes: 'x' })
      .expect(404);
  });

  it('issue requires invoice:issue (403 writer) and >=1 line (400 empty); DRAFT->ISSUED locks editing', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoice1Id}/issue`)
      .set(auth(writerToken))
      .expect(403);

    // empty invoice -> 400
    const empty = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set(auth(adminToken))
      .send({ customerId })
      .expect(201);
    invoice2Id = empty.body.data.id;
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoice2Id}/issue`)
      .set(auth(issuerToken))
      .expect(400);

    const iss = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoice1Id}/issue`)
      .set(auth(issuerToken))
      .expect(200);
    const issued = iss.body.data;
    expect(issued.status).toBe('ISSUED');
    expect(issued.issuedAt).toBeTruthy();
    expect(issued.issueDate).toBeTruthy();

    // locked after issue
    await request(app.getHttpServer())
      .patch(`/api/v1/invoices/${invoice1Id}`)
      .set(auth(adminToken))
      .send({ notes: 'late' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoice1Id}/items`)
      .set(auth(adminToken))
      .send({ description: 'x', unitPrice: 1 })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoice1Id}/issue`)
      .set(auth(adminToken))
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/api/v1/invoices/${invoice1Id}`)
      .set(auth(adminToken))
      .expect(409);
  });

  it('cancel requires invoice:cancel + reason; ISSUED->CANCELLED terminal', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoice1Id}/cancel`)
      .set(auth(cancellerToken))
      .send({ cancelReason: '' })
      .expect(400);

    const canc = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoice1Id}/cancel`)
      .set(auth(cancellerToken))
      .send({ cancelReason: 'billing error' })
      .expect(200);
    expect(canc.body.data.status).toBe('CANCELLED');
    expect(canc.body.data.cancelReason).toBe('billing error');

    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoice1Id}/cancel`)
      .set(auth(adminToken))
      .send({ cancelReason: 'again' })
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/api/v1/invoices/${invoice1Id}`)
      .set(auth(adminToken))
      .expect(409);
  });

  it('delete requires invoice:delete; soft-deletes a DRAFT invoice (404 afterwards, out of list)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/invoices/${invoice2Id}`)
      .set(auth(writerToken))
      .expect(403);

    const del = await request(app.getHttpServer())
      .delete(`/api/v1/invoices/${invoice2Id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(del.body.data.deletedAt).toBeTruthy();

    await request(app.getHttpServer())
      .get(`/api/v1/invoices/${invoice2Id}`)
      .set(auth(adminToken))
      .expect(404);

    const list = await request(app.getHttpServer())
      .get(`/api/v1/invoices?customerId=${customerId}`)
      .set(auth(readerToken))
      .expect(200);
    expect(list.body.data.data.some((i: { id: string }) => i.id === invoice2Id)).toBe(false);
  });

  it('anchor validation: unknown B/L 404; unknown manifest 404; cross-voyage B/L+manifest 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set(auth(adminToken))
      .send({ customerId, billOfLadingId: 'nonexistent-bl' })
      .expect(404);

    await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set(auth(adminToken))
      .send({ customerId, manifestId: 'nonexistent-mani' })
      .expect(404);

    // cross-voyage: pick two APPROVED manifests from different voyages (demo data)
    const manifests = await request(app.getHttpServer())
      .get('/api/v1/manifests?status=APPROVED&pageSize=50')
      .set(auth(adminToken))
      .expect(200);
    const approved = manifests.body.data.data as Array<{ id: string; voyageId: string }>;
    const distinct = approved.find((m) => m.voyageId !== approved[0].voyageId);
    if (approved.length >= 2 && distinct) {
      // B/L of voyage A + manifest of voyage B -> 409
      const bls = await request(app.getHttpServer())
        .get(`/api/v1/bills?voyageId=${approved[0].voyageId}`)
        .set(auth(adminToken))
        .expect(200);
      const bl = (bls.body.data.data as Array<{ id: string }>)[0];
      if (bl) {
        await request(app.getHttpServer())
          .post('/api/v1/invoices')
          .set(auth(adminToken))
          .send({ customerId, billOfLadingId: bl.id, manifestId: distinct.id })
          .expect(409);
      }
    }
  });

  it('list filters: status, customer, search, unpaid derived flag', async () => {
    // one ISSUED unpaid invoice for customer2 with past due date -> overdue
    const m3 = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set(auth(adminToken))
      .send({ customerId: customerId2, dueDate: '2026-01-01' })
      .expect(201);
    invoice3Id = m3.body.data.id;
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoice3Id}/items`)
      .set(auth(adminToken))
      .send({ description: 'Storage', unitPrice: 75 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoice3Id}/issue`)
      .set(auth(adminToken))
      .expect(200);

    const unpaid = await request(app.getHttpServer())
      .get('/api/v1/invoices?unpaid=true')
      .set(auth(readerToken))
      .expect(200);
    const rows = unpaid.body.data.data as Array<{ id: string; status: string; paidAmount: string; totalAmount: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.status === 'ISSUED' && Number(r.paidAmount) < Number(r.totalAmount))).toBe(true);
    expect(rows.some((r) => r.id === invoice3Id)).toBe(true);

    const overdue = await request(app.getHttpServer())
      .get('/api/v1/invoices?overdue=true')
      .set(auth(readerToken))
      .expect(200);
    expect((overdue.body.data.data as Array<{ id: string }>).some((r) => r.id === invoice3Id)).toBe(true);

    const search = await request(app.getHttpServer())
      .get('/api/v1/invoices?search=' + encodeURIComponent('INV Co2'))
      .set(auth(readerToken))
      .expect(200);
    expect((search.body.data.data as Array<{ id: string }>).some((r) => r.id === invoice3Id)).toBe(true);

    const draft = await request(app.getHttpServer())
      .get('/api/v1/invoices?status=DRAFT&customerId=' + customerId)
      .set(auth(readerToken))
      .expect(200);
    expect(draft.body.data.data.every((i: { status: string }) => i.status === 'DRAFT')).toBe(true);
  });
});
