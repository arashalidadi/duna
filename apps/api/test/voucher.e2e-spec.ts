import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
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
      .send({ code: `VCHCUS-${tag}`, name: `VCH Co ${randomTag}`, personKind: 'LEGAL' })
      .expect(201);
    createdCustomers.push({ id: cust.body.data.id });
    customerId = cust.body.data.id;

    const cust2 = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set(auth(adminToken))
      .send({ code: `VCHCU2-${tag}`, name: `VCH Co2 ${randomTag}`, personKind: 'LEGAL' })
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
    await request(app.getHttpServer()).post(`/api/v1/invoices/${aedInvoiceId}/issue`).set(auth(adminToken))
      .send({ exchangeRate: '0.27', rateOverrideReason: `Isolated voucher E2E FX ${tag}` }).expect(200);
  }, 120000);

  afterAll(async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const custIds = createdCustomers.map((c) => c.id);
      // Remove ONLY this suite's own financial fixtures before their source rows.
      await prisma.voucherAmountAdjustment.deleteMany({ where: { voucher: { customerId: { in: custIds } } } });
      await prisma.voucherAllocation.deleteMany({ where: { voucher: { customerId: { in: custIds } } } });
      await prisma.customerPosting.deleteMany({ where: { customerId: { in: custIds } } });
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

  function expectInvoicePaidAmount(actual: unknown, expected: string) {
    // Invoice GET returns Prisma Decimal JSON as a string (e.g. "25", not
    // necessarily "25.00"). Check the exact amount and at most two decimals.
    expect(typeof actual).toBe('string');
    expect(actual).toMatch(/^\d+(?:\.\d{1,2})?$/);
    expect(new Prisma.Decimal(actual as string).equals(expected)).toBe(true);
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

  it('audits the posted voucher, its initial allocation and the invoice FX exception', async () => {
    const db = app.get(PrismaService);
    const voucherEvents = await db.auditLog.findMany({
      where: { entityType: 'Voucher', entityId: rcp1Id },
      orderBy: { timestamp: 'asc' },
    });
    const posted = voucherEvents.find((event) => event.action === 'voucher.post');
    expect(posted?.actorEmail).toBe(admin.email);
    expect(posted?.afterData).toMatchObject({ amount: '400.00', currencyCode: 'USD' });
    const allocation = voucherEvents.find((event) => event.action === 'voucher.allocate');
    expect(allocation?.actorEmail).toBe(admin.email);
    expect(allocation?.afterData).toEqual(expect.arrayContaining([
      expect.objectContaining({ invoiceId }),
    ]));
    const fx = await db.auditLog.findFirst({ where: {
      entityType: 'Invoice', entityId: aedInvoiceId, action: 'currency_rate.override',
    } });
    expect(fx?.actorEmail).toBe(admin.email);
    expect(fx?.metadata).toMatchObject({ reason: `Isolated voucher E2E FX ${tag}` });
    expect(fx?.afterData).toMatchObject({ currencyCode: 'AED', rate: '0.27' });
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
      // A deposit must stay unapplied even when company policy is automatic.
      .send({ type: 'RECEIPT', customerId, amount: 50, allocationMode: 'NONE', description: 'standalone deposit' })
      .expect(201);
    standaloneId = res.body.data.id;
    expect(res.body.data.voucherNumber).toMatch(/^RCP-\d{4}-\d{5}$/);
    expect(res.body.data.invoiceId).toBeNull();
    expect(res.body.data.allocatedAmount).toBe('0.00');
    expect(res.body.data.unallocatedAmount).toBe('50.00');
    const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    expectInvoicePaidAmount(inv.body.data.paidAmount, '400.00');
  });

  it('allocates one receipt to two invoices, keeps partial/unallocated credit, and audits reallocation', async () => {
    const makeIsolatedInvoice = async (amount: number) => {
      const res = await request(app.getHttpServer()).post('/api/v1/invoices').set(auth(adminToken))
        .send({ customerId: customer2Id, currencyCode: 'USD', taxRate: 0 }).expect(201);
      createdInvoices.push({ id: res.body.data.id });
      await request(app.getHttpServer()).post(`/api/v1/invoices/${res.body.data.id}/items`)
        .set(auth(adminToken)).send({ description: 'fixture', unitPrice: amount, quantity: 1 }).expect(201);
      await request(app.getHttpServer()).post(`/api/v1/invoices/${res.body.data.id}/issue`)
        .set(auth(adminToken)).send({}).expect(200);
      return res.body.data.id as string;
    };
    const first = await makeIsolatedInvoice(40);
    const second = await makeIsolatedInvoice(60);
    const posted = await request(app.getHttpServer()).post('/api/v1/vouchers').set(auth(adminToken))
      .send({ type: 'RECEIPT', customerId: customer2Id, amount: 100, currencyCode: 'USD',
        allocationMode: 'MANUAL', allocations: [
          { invoiceId: first, amount: 25 }, { invoiceId: second, amount: 30 },
        ] }).expect(201);
    expect(posted.body.data.allocatedAmount).toBe('55.00');
    expect(posted.body.data.unallocatedAmount).toBe('45.00');
    expectInvoicePaidAmount((await request(app.getHttpServer()).get(`/api/v1/invoices/${first}`)
      .set(auth(adminToken)).expect(200)).body.data.paidAmount, '25.00');
    const reallocated = await request(app.getHttpServer())
      .post(`/api/v1/vouchers/${posted.body.data.id}/allocations`).set(auth(adminToken))
      .send({ reason: 'Correct fixture split', allocations: [
        { invoiceId: first, amount: 20 }, { invoiceId: second, amount: 35 },
      ] }).expect(201);
    expect(reallocated.body.data.allocations.filter((a: { reversedAt: string | null }) => a.reversedAt)).toHaveLength(2);
    expect(reallocated.body.data.unallocatedAmount).toBe('45.00');
    expectInvoicePaidAmount((await request(app.getHttpServer()).get(`/api/v1/invoices/${second}`)
      .set(auth(adminToken)).expect(200)).body.data.paidAmount, '35.00');
    const unallocated = await request(app.getHttpServer()).post('/api/v1/vouchers').set(auth(adminToken))
      .send({ type: 'RECEIPT', customerId: customer2Id, amount: 15, currencyCode: 'USD', allocationMode: 'NONE' })
      .expect(201);
    expect(unallocated.body.data.unallocatedAmount).toBe('15.00');
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

  it('freezes posted financial fields; explicit adjustment and reallocation leave audited history', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/vouchers/${rcp1Id}`)
      .set(auth(readerToken))
      .send({ reference: 'nope' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/vouchers/${rcp1Id}`)
      .set(auth(adminToken))
      .send({ amount: 500 }).expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/vouchers/${rcp1Id}/adjust`)
      .set(auth(adminToken))
      .send({ amount: 500, reason: 'Correct bank amount' }).expect(201);
    const credit = await request(app.getHttpServer()).get(`/api/v1/vouchers/${rcp1Id}`).set(auth(adminToken)).expect(200);
    expect(credit.body.data.adjustments).toHaveLength(1);
    expect(credit.body.data.unallocatedAmount).toBe('100.00');
    await request(app.getHttpServer())
      .post(`/api/v1/vouchers/${rcp1Id}/allocations`)
      .set(auth(adminToken))
      .send({ allocations: [{ invoiceId, amount: 500 }], reason: 'Allocate corrected difference' }).expect(201);
    const after = await request(app.getHttpServer()).get(`/api/v1/vouchers/${rcp1Id}`).set(auth(adminToken)).expect(200);
    expect(after.body.data.allocations.filter((a: { reversedAt: string | null }) => !!a.reversedAt)).toHaveLength(1);
    expect(after.body.data.unallocatedAmount).toBe('0.00');
    const inv = await request(app.getHttpServer()).get(`/api/v1/invoices/${invoiceId}`).set(auth(adminToken)).expect(200);
    expect(Number(inv.body.data.paidAmount)).toBe(400); // 500 receipt - 100 refund
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

  it('delete: neither POSTED nor CANCELLED financial history may be erased', async () => {
    await request(app.getHttpServer()).delete(`/api/v1/vouchers/${rcp1Id}`).set(auth(adminToken)).expect(409);
    await request(app.getHttpServer()).delete(`/api/v1/vouchers/${pmt1Id}`).set(auth(adminToken)).expect(409);
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
    expect(summary.currencyCode).toBe('MIXED');
    expect(summary.currencyTotals.USD.closingBalance).toBe('950.00');
    expect(summary.currencyTotals.AED.closingBalance).toBe('700.00');

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
