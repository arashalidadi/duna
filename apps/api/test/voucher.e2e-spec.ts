import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

type Ref = { id: string };

/**
 * Phase 12 — Vouchers (receipt/payment) + derived customer ledger.
 * Covers: numbering per type, invoice settlement & paidAmount recompute,
 * currency guard, settlement requires ISSUED, POSTED freeze, cancel-with-
 * reason, delete guard, ledger statement (opening/running/closing, filters).
 */
describe('Vouchers & Ledger (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();
  const emailSuffix = randomTag;

  const createdCustomers: Ref[] = [];
  const createdInvoices: Ref[] = [];

  let adminToken = '';
  let readerToken = ''; // voucher:read only
  let writerToken = ''; // read + create + update
  let cancellerToken = ''; // read + cancel
  let noReadToken = ''; // no voucher permission

  let customerId = '';
  let customer2Id = '';

  let invoiceId = ''; // ISSUED, USD 1000 — settlement flow
  let invoice2Id = ''; // ISSUED, USD 500 — ledger width
  let aedInvoiceId = ''; // ISSUED, AED 700 — currency guard
  let draftInvoiceId = ''; // DRAFT, USD 300 — settlement guard

  let rcp1Id = '';
  let standaloneId = '';
  let pmt1Id = '';

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

    readerToken = await createRoleToken(`VCHREAD_${tag}`, ['voucher:read'], `vch-read-${emailSuffix}@shipping.local`);
    writerToken = await createRoleToken(
      `VCHWRITE_${tag}`,
      ['voucher:read', 'voucher:create', 'voucher:update', 'invoice:read'],
      `vch-writer-${emailSuffix}@shipping.local`
    );
    cancellerToken = await createRoleToken(
      `VCHCANC_${tag}`,
      ['voucher:read', 'voucher:cancel', 'ledger:read', 'invoice:read'],
      `vch-canc-${emailSuffix}@shipping.local`
    );
    noReadToken = await createRoleToken(`VCHNOREAD_${tag}`, ['cargo:read'], `vch-noread-${emailSuffix}@shipping.local`);

    const cust = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set(auth(adminToken))
      .send({ code: `VCHCUS-${tag}`, name: `VCH Co ${randomTag}`, type: 'SHIPPER' })
      .expect(201);
    createdCustomers.push({ id: cust.body.data.id });
    customerId = cust.body.data.id;

    const cust2 = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set(auth(adminToken))
      .send({ code: `VCHCU2-${tag}`, name: `VCH Co2 ${randomTag}`, type: 'CONSIGNEE' })
      .expect(201);
    createdCustomers.push({ id: cust2.body.data.id });
    customer2Id = cust2.body.data.id;

    const mkInvoice = async (total: number, currency = 'USD'): Promise<string> => {
      const inv = await request(app.getHttpServer())
        .post('/api/v1/invoices')
        .set(auth(adminToken))
        .send({ customerId, title: `vch ${randomTag}`, currencyCode: currency, taxRate: 0 })
        .expect(201);
      const id = inv.body.data.id as string;
      createdInvoices.push({ id });
      await request(app.getHttpServer())
        .post(`/api/v1/invoices/${id}/items`)
        .set(auth(adminToken))
        .send({ description: 'line', unitPrice: total, quantity: 1 })
        .expect(201);
      return id;
    };
    invoiceId = await mkInvoice(1000);
    invoice2Id = await mkInvoice(500);
    aedInvoiceId = await mkInvoice(700, 'AED');
    draftInvoiceId = await mkInvoice(300);
    await request(app.getHttpServer()).post(`/api/v1/invoices/${invoiceId}/issue`).set(auth(adminToken)).send({}).expect(200);
    await request(app.getHttpServer()).post(`/api/v1/invoices/${invoice2Id}/issue`).set(auth(adminToken)).send({}).expect(200);
    await request(app.getHttpServer()).post(`/api/v1/invoices/${aedInvoiceId}/issue`).set(auth(adminToken)).send({}).expect(200);
  }, 120000);

  afterAll(async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const custIds = createdCustomers.map((c) => c.id);
      await prisma.voucher.deleteMany({ where: { customerId: { in: custIds } } });
      await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: { in: custIds } } } });
      await prisma.invoice.deleteMany({ where: { customerId: { in: custIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: custIds } } });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              `vch-read-${emailSuffix}@shipping.local`,
              `vch-writer-${emailSuffix}@shipping.local`,
              `vch-canc-${emailSuffix}@shipping.local`,
              `vch-noread-${emailSuffix}@shipping.local`,
            ],
          },
        },
      });
      await prisma.role.deleteMany({
        where: { code: { in: [`VCHREAD_${tag}`, `VCHWRITE_${tag}`, `VCHCANC_${tag}`, `VCHNOREAD_${tag}`] } },
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
      .send({ email, password: 'ChangeMe123!', fullName: `VCH ${roleCode}`, roleIds: [role.body.data.id] })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'ChangeMe123!' })
      .expect(200);
    return login.body.data.accessToken as string;
  }

  it('401 without a token; 403 without voucher permission', async () => {
    await request(app.getHttpServer()).get('/api/v1/vouchers').expect(401);
    await request(app.getHttpServer()).get('/api/v1/vouchers').set(auth(noReadToken)).expect(403);
    await request(app.getHttpServer()).get(`/api/v1/ledger/customers?customerId=${customerId}`).set(auth(noReadToken)).expect(403);
  });

  it('create requires voucher:create (403 for reader); unknown customer 404', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/vouchers')
      .set(auth(readerToken))
      .send({ type: 'RECEIPT', customerId, amount: 10 })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/vouchers')
      .set(auth(adminToken))
      .send({ type: 'RECEIPT', customerId: '00000000-0000-4000-8000-000000000000', amount: 10 })
      .expect(404);
  });

  it('creates a RECEIPT settling an ISSUED invoice; currency inherited; paidAmount updated', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/vouchers')
      .set(auth(adminToken))
      .send({ type: 'RECEIPT', customerId, invoiceId, amount: 400, method: 'BANK_TRANSFER', reference: `TRX-${tag}`, description: 'first receipt' })
      .expect(201);
    rcp1Id = res.body.data.id;
    expect(res.body.data.voucherNumber).toMatch(/^RCP-\d{4}-\d{5}$/);
    expect(res.body.data.status).toBe('POSTED');
    expect(res.body.data.currencyCode).toBe('USD');
    expect(res.body.data.invoice.invoiceNumber).toBeTruthy();

    const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    expect(Number(inv.body.data.paidAmount)).toBe(400);
  });

  it('rejects settlement of a DRAFT invoice (409)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/vouchers')
      .set(auth(adminToken))
      .send({ type: 'RECEIPT', customerId, invoiceId: draftInvoiceId, amount: 100 })
      .expect(409);
    expect(res.body.error?.message ?? res.body.message).toContain('ISSUED');
  });

  it('rejects voucher currency mismatch with invoice (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/vouchers')
      .set(auth(adminToken))
      .send({ type: 'RECEIPT', customerId, invoiceId: aedInvoiceId, amount: 100, currencyCode: 'USD' })
      .expect(409);
  });

  it('creates a standalone RECEIPT (no invoice) — deposit with own number', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/vouchers')
      .set(auth(adminToken))
      .send({ type: 'RECEIPT', customerId, amount: 50, description: 'standalone deposit' })
      .expect(201);
    standaloneId = res.body.data.id;
    expect(res.body.data.voucherNumber).toMatch(/^RCP-\d{4}-\d{5}$/);
    expect(res.body.data.invoiceId).toBeNull();
  });

  it('creates a PAYMENT (refund) decreasing paidAmount; PMT numbering', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/vouchers')
      .set(auth(adminToken))
      .send({ type: 'PAYMENT', customerId, invoiceId, amount: 100, description: 'refund' })
      .expect(201);
    pmt1Id = res.body.data.id;
    expect(res.body.data.voucherNumber).toMatch(/^PMT-\d{4}-\d{5}$/);

    const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    expect(Number(inv.body.data.paidAmount)).toBe(300);
  });

  it('lists with type & invoice filters; detail returns serialized rows', async () => {
    const all = await request(app.getHttpServer()).get('/api/v1/vouchers?pageSize=100').set(auth(adminToken)).expect(200);
    const ids = all.body.data.data.map((v: { id: string }) => v.id);
    expect(ids).toContain(rcp1Id);

    const receipts = await request(app.getHttpServer()).get('/api/v1/vouchers?type=RECEIPT&pageSize=100').set(auth(adminToken)).expect(200);
    expect(receipts.body.data.data.every((v: { type: string }) => v.type === 'RECEIPT')).toBe(true);

    const byInvoice = await request(app.getHttpServer()).get(`/api/v1/vouchers?invoiceId=${invoiceId}&pageSize=100`).set(auth(adminToken)).expect(200);
    const nums = byInvoice.body.data.data.map((v: { id: string }) => v.id).sort();
    expect(nums).toEqual([pmt1Id, rcp1Id].sort());

    const one = await request(app.getHttpServer()).get(`/api/v1/vouchers/${rcp1Id}`).set(auth(adminToken)).expect(200);
    expect(one.body.data.customer.name).toContain('VCH Co');
    expect(one.body.data.amount).toBe('400.00');
  });

  it('update requires voucher:update; amount edit recomputes paidAmount; CANCELLED frozen', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/vouchers/${rcp1Id}`)
      .set(auth(readerToken))
      .send({ reference: 'nope' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/vouchers/${rcp1Id}`)
      .set(auth(adminToken))
      .send({ amount: 500, reference: `TRX-${tag}-A` })
      .expect(200);
    const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    expect(Number(inv.body.data.paidAmount)).toBe(400); // 500 - 100 refund
  });

  it('cancels with reason (voucher:cancel); paidAmount recomputed; second cancel 409', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/vouchers/${pmt1Id}/cancel`)
      .set(auth(readerToken))
      .send({ reason: 'x' })
      .expect(403);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/vouchers/${pmt1Id}/cancel`)
      .set(auth(cancellerToken))
      .send({ reason: 'wrong refund' })
      .expect(200);
    expect(res.body.data.status).toBe('CANCELLED');
    expect(res.body.data.cancelReason).toBe('wrong refund');

    const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    expect(Number(inv.body.data.paidAmount)).toBe(500);

    await request(app.getHttpServer())
      .post(`/api/v1/vouchers/${pmt1Id}/cancel`)
      .set(auth(adminToken))
      .send({ reason: 'again' })
      .expect(409);
  });

  it('delete: POSTED forbidden (409), CANCELLED allowed (200)', async () => {
    await request(app.getHttpServer()).delete(`/api/v1/vouchers/${rcp1Id}`).set(auth(adminToken)).expect(409);
    await request(app.getHttpServer()).delete(`/api/v1/vouchers/${pmt1Id}`).set(auth(adminToken)).expect(200);
    const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    expect(Number(inv.body.data.paidAmount)).toBe(500);
  });

  it('ledger: statement with opening/running/closing balance (mixed currency summed)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/ledger/customers?customerId=${customerId}`)
      .set(auth(cancellerToken))
      .expect(200);
    const { summary, entries } = res.body.data;
    expect(summary.customerName).toContain('VCH Co');
    expect(summary.totalDebit).toBe('2200.00'); // 1000 + 500 + 700
    expect(summary.totalCredit).toBe('550.00'); // 500 receipt + 50 deposit
    expect(summary.closingBalance).toBe('1650.00');

    const invEntries = entries.filter((e: { kind: string }) => e.kind === 'invoice');
    expect(invEntries.length).toBe(3);
    const voucherEntries = entries.filter((e: { kind: string }) => e.kind === 'voucher');
    expect(voucherEntries.length).toBe(2);

    const last = entries[entries.length - 1];
    expect(Number(last.balance)).toBeCloseTo(Number(summary.closingBalance), 2);
  });

  it('ledger: currency + date-window filters; opening balance collapses history', async () => {
    const usd = await request(app.getHttpServer())
      .get(`/api/v1/ledger/customers?customerId=${customerId}&currencyCode=USD`)
      .set(auth(adminToken))
      .expect(200);
    expect(usd.body.data.summary.totalDebit).toBe('1500.00'); // 1000 + 500 (AED excluded)

    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const future = await request(app.getHttpServer())
      .get(`/api/v1/ledger/customers?customerId=${customerId}&fromDate=${tomorrow}`)
      .set(auth(adminToken))
      .expect(200);
    expect(future.body.data.entries.length).toBe(0);
    expect(future.body.data.summary.openingBalance).toBe('1650.00');

    const kindOnly = await request(app.getHttpServer())
      .get(`/api/v1/ledger/customers?customerId=${customerId}&kind=invoice`)
      .set(auth(adminToken))
      .expect(200);
    expect(kindOnly.body.data.entries.every((e: { kind: string }) => e.kind === 'invoice')).toBe(true);
  });
});
