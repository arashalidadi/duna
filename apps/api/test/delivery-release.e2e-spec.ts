import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

type Ref = { id: string };

/**
 * Phase 13 — Delivery Orders (D/O) & Release Orders (R/O).
 * Covers: RBAC, B/L must be APPROVED (issued-equivalent, P4-U4), one-active-per-B/L, update/cancel/delete
 * lifecycle, release eligibility, money rule (outstanding blocks release),
 * authorized override (permission + reason), override audit trail.
 */
describe('Delivery & Release Orders (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();
  const emailSuffix = randomTag;

  // cleanup registry
  const createdPorts: Ref[] = [];
  const createdVessels: Ref[] = [];
  const createdVoyages: Ref[] = [];
  const createdCustomers: Ref[] = [];
  const createdPartyMasters: Ref[] = []; // Phase 2 cutover: fixture master rows
  const createdYards: Ref[] = [];
  const createdCargos: Ref[] = [];
  const loadListIds: string[] = [];
  const manifestIds: string[] = [];
  const billIds: string[] = [];
  const invoiceIds: string[] = [];

  let adminToken = '';
  let readerToken = ''; // delivery:read + release:read
  let writerToken = ''; // + create/update
  let cancellerToken = ''; // + cancel
  let overriderToken = ''; // release:create + release:override
  let plainCreatorToken = ''; // release:create WITHOUT override
  let noReadToken = '';

  let customerId = '';
  let fixtureShipperId = ''; // Phase 2 cutover: Shipper-master ref (was Customer)
  let billId = ''; // APPROVED B/L (issued-equivalent after the P4-U4 issue alias)
  let draftBillId = ''; // DRAFT B/L (guard test)
  let invoiceId = ''; // ISSUED, unpaid USD invoice on billId
  let do1Id = '';
  let ro1Id = '';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const S = () => request(app.getHttpServer());

  // Fixture setup stamps the list FINALIZED directly (kept from the unit-1 workaround
  // pattern). ADR-041 now ships the DRAFT -> FINALIZED edge, so fixtures could equally
  // finalize via the API — that path is asserted by the dedicated lifecycle tests (ADR-041).
  async function stampLoadListFinalized(loadListId: string) {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      await prisma.loadList.update({ where: { id: loadListId }, data: { status: 'FINALIZED' } });
    } finally {
      await prisma.$disconnect();
    }
  }

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

    // Phase 2 cutover (party-cutover-plan.md §3): fixture Shipper master for the
    // D/O fixture manifest's party ref (was a Customer id).
    const { PrismaClient } = require('@prisma/client');
    const partyFx = new PrismaClient();
    try {
      const shp = await partyFx.shipper.create({
        data: { code: `DRSP-${tag}`, name: `Delivery Test Shipper ${randomTag}` },
      });
      fixtureShipperId = shp.id;
      createdPartyMasters.push({ id: shp.id });
    } finally {
      await partyFx.$disconnect();
    }

    readerToken = await createRoleToken(`DRREAD_${tag}`, ['delivery:read', 'release:read'], `dr-read-${emailSuffix}@shipping.local`);
    writerToken = await createRoleToken(
      `DRWRITE_${tag}`,
      ['delivery:read', 'delivery:create', 'delivery:update', 'release:read', 'release:create', 'release:update'],
      `dr-writer-${emailSuffix}@shipping.local`
    );
    cancellerToken = await createRoleToken(
      `DRCANC_${tag}`,
      ['delivery:read', 'delivery:cancel', 'delivery:delete', 'release:read', 'release:cancel', 'release:delete'],
      `dr-canc-${emailSuffix}@shipping.local`
    );
    overriderToken = await createRoleToken(
      `DROVR_${tag}`,
      ['release:read', 'release:create', 'release:override'],
      `dr-ovr-${emailSuffix}@shipping.local`
    );
    plainCreatorToken = await createRoleToken(
      `DRPLAIN_${tag}`,
      ['release:read', 'release:create'],
      `dr-plain-${emailSuffix}@shipping.local`
    );
    noReadToken = await createRoleToken(`DRNOREAD_${tag}`, ['cargo:read'], `dr-noread-${emailSuffix}@shipping.local`);

    // ── full ops chain → approved manifest → APPROVED bill (issue alias) ──
    const portA = await S().post('/api/v1/ports').set(auth(adminToken))
      .send({ code: `DRP1-${tag}`, name: `DR Origin ${randomTag}`, country: 'AE' }).expect(201);
    createdPorts.push({ id: portA.body.data.id });
    const portB = await S().post('/api/v1/ports').set(auth(adminToken))
      .send({ code: `DRP2-${tag}`, name: `DR Dest ${randomTag}`, country: 'IN' }).expect(201);
    createdPorts.push({ id: portB.body.data.id });

    const ves = await S().post('/api/v1/vessels').set(auth(adminToken))
      .send({ code: `DRVSL-${tag}`, name: `MV DR ${randomTag}`, flag: 'PA', vesselType: 'CONTAINER' }).expect(201);
    createdVessels.push({ id: ves.body.data.id });

    const voy = await S().post('/api/v1/voyages').set(auth(adminToken))
      .send({ vesselId: ves.body.data.id, originPortId: portA.body.data.id, destinationPortId: portB.body.data.id }).expect(201);
    createdVoyages.push({ id: voy.body.data.id });
    const voyageId = voy.body.data.id;

    const cust = await S().post('/api/v1/customers').set(auth(adminToken))
      .send({ code: `DRCUS-${tag}`, name: `DR Co ${randomTag}`, type: 'SHIPPER' }).expect(201);
    createdCustomers.push({ id: cust.body.data.id });
    customerId = cust.body.data.id;

    const yd = await S().post('/api/v1/yards').set(auth(adminToken))
      .send({ code: `DRYD-${tag}`, name: `DR Yard ${randomTag}`, portId: portA.body.data.id }).expect(201);
    createdYards.push({ id: yd.body.data.id });

    const mkCargoChain = async (suffix: string) => {
      const cargo = await S().post('/api/v1/cargo').set(auth(adminToken))
        .send({ customerId, portId: portA.body.data.id, yardId: yd.body.data.id, cargoType: 'CONTAINER', quantity: 10, weight: '5', packages: 2, packageType: 'CARTONS' })
        .expect(201);
      createdCargos.push({ id: cargo.body.data.id });
      const cargoId = cargo.body.data.id as string;

      const insp = await S().post('/api/v1/inspections').set(auth(adminToken))
        .send({ cargoId, findings: `ok ${suffix}` }).expect(201);
      await S().post(`/api/v1/inspections/${insp.body.data.id}/book`).set(auth(adminToken)).expect(200);
      await S().post(`/api/v1/inspections/${insp.body.data.id}/done`).set(auth(adminToken)).expect(200);

      const ll = await S().post('/api/v1/load-lists').set(auth(adminToken))
        .send({ voyageId, notes: `DR fixture ${suffix}` }).expect(201);
      loadListIds.push(ll.body.data.id);
      const li = await S().post(`/api/v1/load-lists/${ll.body.data.id}/items`).set(auth(adminToken))
        .send({ cargoId, plannedQuantity: 10, sequence: 1 }).expect(201);
      await stampLoadListFinalized(ll.body.data.id);

      const al = await S().post('/api/v1/actual-loading').set(auth(adminToken))
        .send({ loadListId: ll.body.data.id }).expect(201);
      await S().patch(`/api/v1/actual-loading/${al.body.data.id}/items/${li.body.data.id}`).set(auth(adminToken))
        .send({ actualQuantity: 10 }).expect(200);
      await S().post(`/api/v1/actual-loading/${al.body.data.id}/start`).set(auth(adminToken)).expect(200);
      await S().post(`/api/v1/actual-loading/${al.body.data.id}/complete`).set(auth(adminToken)).expect(200);
      return cargoId;
    };
    const cargoA = await mkCargoChain('a');
    const cargoB = await mkCargoChain('b');

    const mf = await S().post('/api/v1/manifests').set(auth(adminToken))
      .send({ voyageId, shipperId: fixtureShipperId, notes: 'DR fixture manifest' }).expect(201);
    manifestIds.push(mf.body.data.id);
    const manifestId = mf.body.data.id as string;
    for (const cid of [cargoA, cargoB]) {
      await S().post(`/api/v1/manifests/${manifestId}/items`).set(auth(adminToken)).send({ cargoId: cid }).expect(201);
    }
    await S().post(`/api/v1/manifests/${manifestId}/submit`).set(auth(adminToken)).expect(200);
    await S().post(`/api/v1/manifests/${manifestId}/approve`).set(auth(adminToken)).expect(200);

    // main bill: create -> item -> issue
    const bill = await S().post('/api/v1/bills').set(auth(adminToken))
      .send({ manifestId, billType: 'HOUSE', freightTerms: 'PREPAID' }).expect(201);
    billIds.push(bill.body.data.id);
    billId = bill.body.data.id;
    const eligible = await S().get(`/api/v1/bills/eligible-items?manifestId=${manifestId}`).set(auth(adminToken)).expect(200);
    const firstItem = eligible.body.data[0];
    await S().post(`/api/v1/bills/${billId}/items`).set(auth(adminToken))
      .send({ manifestItemId: firstItem.id, marksAndNumbers: 'DR-TEST' }).expect(201);
    await S().post(`/api/v1/bills/${billId}/issue`).set(auth(adminToken)).send({}).expect(200);

    // second bill left DRAFT (guard test)
    const draftBill = await S().post('/api/v1/bills').set(auth(adminToken))
      .send({ manifestId, billType: 'HOUSE', freightTerms: 'PREPAID' }).expect(201);
    billIds.push(draftBill.body.data.id);
    draftBillId = draftBill.body.data.id;

    // unpaid ISSUED invoice against the bill (blocks release)
    const inv = await S().post('/api/v1/invoices').set(auth(adminToken))
      .send({ customerId, billOfLadingId: billId, title: 'DR inv', currencyCode: 'USD', taxRate: 0 }).expect(201);
    invoiceIds.push(inv.body.data.id);
    invoiceId = inv.body.data.id;
    await S().post(`/api/v1/invoices/${invoiceId}/items`).set(auth(adminToken))
      .send({ description: 'freight', unitPrice: 800, quantity: 1 }).expect(201);
    await S().post(`/api/v1/invoices/${invoiceId}/issue`).set(auth(adminToken)).send({}).expect(200);
  }, 180000);

  afterAll(async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.deliveryOrder.deleteMany({ where: { billOfLadingId: { in: billIds } } });
      await prisma.releaseOrder.deleteMany({ where: { billOfLadingId: { in: billIds } } });
      await prisma.voucher.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
      await prisma.billOfLadingItem.deleteMany({ where: { billOfLadingId: { in: billIds } } });
      await prisma.billOfLading.deleteMany({ where: { id: { in: billIds } } });
      await prisma.manifestItem.deleteMany({ where: { manifestId: { in: manifestIds } } });
      await prisma.manifest.deleteMany({ where: { id: { in: manifestIds } } });
      await prisma.actualLoadingItem.deleteMany({ where: { actualLoading: { loadListId: { in: loadListIds } } } });
      await prisma.actualLoading.deleteMany({ where: { loadListId: { in: loadListIds } } });
      await prisma.loadListItem.deleteMany({ where: { loadListId: { in: loadListIds } } });
      await prisma.loadList.deleteMany({ where: { id: { in: loadListIds } } });
      for (const c of createdCargos) {
        await prisma.inspection.deleteMany({ where: { cargoId: c.id } });
        await prisma.yardInventory.deleteMany({ where: { cargoId: c.id } });
      }
      await prisma.cargo.deleteMany({ where: { id: { in: createdCargos.map((c) => c.id) } } });
      await prisma.voyage.deleteMany({ where: { id: { in: createdVoyages.map((v) => v.id) } } });
      await prisma.vessel.deleteMany({ where: { id: { in: createdVessels.map((v) => v.id) } } });
      await prisma.yard.deleteMany({ where: { id: { in: createdYards.map((y) => y.id) } } });
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomers.map((c) => c.id) } } });
      await prisma.shipper.deleteMany({ where: { id: { in: createdPartyMasters.map((m) => m.id) } } });
      // follow-up (g): this suite's bill creates allocate per-destination BILL
      // sequences on its own fixture ports — remove them by EXACT scope ids
      // (in: [] matches nothing, so an empty list can never collapse into a
      // wildcard — the unit-2 incident pattern)
      await prisma.numberingSequence.deleteMany({
        where: { documentType: 'BILL', scopeValue: { in: createdPorts.map((p) => p.id) } },
      });
      await prisma.port.deleteMany({ where: { id: { in: createdPorts.map((p) => p.id) } } });
      await prisma.user.deleteMany({
        where: { email: { in: ['dr-read', 'dr-writer', 'dr-canc', 'dr-ovr', 'dr-plain', 'dr-noread'].map((p) => `${p}-${emailSuffix}@shipping.local`) } },
      });
      await prisma.role.deleteMany({
        where: { code: { in: [`DRREAD_${tag}`, `DRWRITE_${tag}`, `DRCANC_${tag}`, `DROVR_${tag}`, `DRPLAIN_${tag}`, `DRNOREAD_${tag}`] } },
      });
      await prisma.$disconnect();
    } catch {
      /* best-effort cleanup */
    }
    await app.close();
  });

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
      .send({ email, password: 'ChangeMe123!', fullName: `DR ${roleCode}`, roleIds: [role.body.data.id] }).expect(201);
    const login = await S().post('/api/v1/auth/login').send({ email, password: 'ChangeMe123!' }).expect(200);
    return login.body.data.accessToken;
  }

  // ── RBAC ───────────────────────────────────────────────────────────────────

  it('401 without token; 403 without permission', async () => {
    await S().get('/api/v1/delivery-orders').expect(401);
    await S().get('/api/v1/delivery-orders').set(auth(noReadToken)).expect(403);
    await S().get('/api/v1/release-orders').set(auth(noReadToken)).expect(403);
    await S().get(`/api/v1/release-orders/eligibility?billOfLadingId=${billId}`).set(auth(noReadToken)).expect(403);
  });

  // ── Delivery Order ─────────────────────────────────────────────────────────

  it('DO create: 403 for reader; 404 unknown B/L; 409 against DRAFT bill', async () => {
    await S().post('/api/v1/delivery-orders').set(auth(readerToken))
      .send({ billOfLadingId: billId, recipient: 'X' }).expect(403);
    await S().post('/api/v1/delivery-orders').set(auth(writerToken))
      .send({ billOfLadingId: 'nonexistent-id', recipient: 'X' }).expect(404);
    await S().post('/api/v1/delivery-orders').set(auth(writerToken))
      .send({ billOfLadingId: draftBillId, recipient: 'X' }).expect(409);
  });

  it('DO create against APPROVED bill (issued-equivalent); DO-YYMM-##### number; list + detail', async () => {
    const res = await S().post('/api/v1/delivery-orders').set(auth(writerToken))
      .send({ billOfLadingId: billId, recipient: `Ali Reza ${randomTag}`, vehiclePlate: 'IR11-22B-33', notes: 'gate 4 pickup' })
      .expect(201);
    do1Id = res.body.data.id;
    expect(res.body.data.docNumber).toMatch(/^DO-\d{4}-\d{5}$/);
    expect(res.body.data.status).toBe('ISSUED');
    expect(res.body.data.billOfLading.billNumber).toMatch(/^BOL-/);

    const list = await S().get('/api/v1/delivery-orders?pageSize=100').set(auth(readerToken)).expect(200);
    expect(list.body.data.data.some((d: { id: string }) => d.id === do1Id)).toBe(true);
    const byBill = await S().get(`/api/v1/delivery-orders?billOfLadingId=${billId}`).set(auth(readerToken)).expect(200);
    expect(byBill.body.data.data.length).toBe(1);

    const detail = await S().get(`/api/v1/delivery-orders/${do1Id}`).set(auth(readerToken)).expect(200);
    expect(detail.body.data.recipient).toContain('Ali Reza');
  });

  it('DO one-active-per-B/L: second active 409', async () => {
    await S().post('/api/v1/delivery-orders').set(auth(writerToken))
      .send({ billOfLadingId: billId, recipient: 'Someone Else' }).expect(409);
  });

  it('DO update: recipient/plate editable; cancel with reason freezes; delete gated', async () => {
    await S().patch(`/api/v1/delivery-orders/${do1Id}`).set(auth(writerToken))
      .send({ vehiclePlate: 'IR99-99X-99' }).expect(200);

    await S().post(`/api/v1/delivery-orders/${do1Id}/cancel`).set(auth(cancellerToken))
      .send({ reason: 'driver license invalid' }).expect(200);

    // frozen after cancel
    await S().patch(`/api/v1/delivery-orders/${do1Id}`).set(auth(writerToken))
      .send({ vehiclePlate: 'X' }).expect(409);
    // delete only after cancel
    await S().delete(`/api/v1/delivery-orders/${do1Id}`).set(auth(cancellerToken)).expect(200);

    // now a new DO can be issued for the same bill
    const redo = await S().post('/api/v1/delivery-orders').set(auth(writerToken))
      .send({ billOfLadingId: billId, recipient: `Hossein ${randomTag}` }).expect(201);
    do1Id = redo.body.data.id;
    expect(redo.body.data.docNumber).toMatch(/^DO-/);
  });

  // ── Release Order + money rule ─────────────────────────────────────────────

  it('eligibility: unpaid invoice → needsOverride, cannot release', async () => {
    const res = await S().get(`/api/v1/release-orders/eligibility?billOfLadingId=${billId}`).set(auth(readerToken)).expect(200);
    const e = res.body.data;
    expect(e.billNumber).toMatch(/^BOL-/);
    expect(e.invoicesTotal).toBe('800.00');
    expect(e.outstanding).toBe('800.00');
    expect(e.fullyPaid).toBe(false);
    expect(e.needsOverride).toBe(true);
    expect(e.canRelease).toBe(false);
  });

  it('RO money rule: unpaid → 409 without force; 403 without release:override permission', async () => {
    await S().post('/api/v1/release-orders').set(auth(plainCreatorToken))
      .send({ billOfLadingId: billId }).expect(409);

    await S().post('/api/v1/release-orders').set(auth(plainCreatorToken))
      .send({ billOfLadingId: billId, force: true, overrideReason: 'trust this customer' }).expect(403);

    // authorized override works
    const res = await S().post('/api/v1/release-orders').set(auth(overriderToken))
      .send({ billOfLadingId: billId, force: true, overrideReason: 'long-standing customer, wire pending' })
      .expect(201);
    ro1Id = res.body.data.id;
    expect(res.body.data.docNumber).toMatch(/^RO-\d{4}-\d{5}$/);
    expect(res.body.data.financialOverride).toBe(true);
    expect(res.body.data.overrideReason).toContain('wire pending');
    expect(res.body.data.financials.fullyPaid).toBe(false);
  });

  it('RO one-active-per-B/L: second active 409', async () => {
    await S().post('/api/v1/release-orders').set(auth(overriderToken))
      .send({ billOfLadingId: billId, force: true, overrideReason: 'x' }).expect(409);
  });

  it('RO settle then release without override; cancel + delete gated', async () => {
    // pay the invoice in full with a receipt
    await S().post('/api/v1/vouchers').set(auth(adminToken))
      .send({ type: 'RECEIPT', customerId, invoiceId, amount: 800, method: 'CASH' }).expect(201);

    // still one-active RO — cancel it first
    await S().post(`/api/v1/release-orders/${ro1Id}/cancel`).set(auth(cancellerToken))
      .send({ reason: 're-issue after full settlement' }).expect(200);

    const elig = await S().get(`/api/v1/release-orders/eligibility?billOfLadingId=${billId}`).set(auth(readerToken)).expect(200);
    expect(elig.body.data.fullyPaid).toBe(true);
    expect(elig.body.data.canRelease).toBe(true);

    const res = await S().post('/api/v1/release-orders').set(auth(plainCreatorToken))
      .send({ billOfLadingId: billId, notes: 'settled release' }).expect(201);
    const ro2 = res.body.data;
    expect(ro2.financialOverride).toBe(false);
    expect(ro2.financials.fullyPaid).toBe(true);

    // ISSUED cannot be deleted; cancel then delete
    await S().delete(`/api/v1/release-orders/${ro2.id}`).set(auth(cancellerToken)).expect(409);
    await S().post(`/api/v1/release-orders/${ro2.id}/cancel`).set(auth(cancellerToken))
      .send({ reason: 'demo cleanup' }).expect(200);
    await S().delete(`/api/v1/release-orders/${ro2.id}`).set(auth(cancellerToken)).expect(200);
  });

  it('list + search + status filters on both modules', async () => {
    const ros = await S().get('/api/v1/release-orders?status=CANCELLED&pageSize=100').set(auth(readerToken)).expect(200);
    expect(ros.body.data.data.some((r: { id: string }) => r.id === ro1Id)).toBe(true);

    const dos = await S().get(`/api/v1/delivery-orders?search=${encodeURIComponent('Hossein')}&pageSize=100`).set(auth(readerToken)).expect(200);
    expect(dos.body.data.data.length).toBe(1);
    expect(dos.body.data.data[0].recipient).toContain('Hossein');
  });

  it('P4-U4 gate vocabulary: FINAL/CANCELLED/RELEASED bills rejected with the APPROVED issued-equivalent (DRAFT covered above)', async () => {
    // finalize the DRAFT guard bill (bill:issue permission — admin holds it)
    await S().post(`/api/v1/bills/${draftBillId}/finalize`).set(auth(adminToken)).expect(200);
    let r = await S().post('/api/v1/delivery-orders').set(auth(adminToken))
      .send({ billOfLadingId: draftBillId, recipient: 'X' });
    expect(r.status).toBe(409);
    expect(JSON.stringify(r.body)).toContain('APPROVED'); // new vocabulary, not ISSUED

    // FINAL -> CANCELLED (mandatory reason path), then the cancelled gate
    await S().post(`/api/v1/bills/${draftBillId}/cancel`).set(auth(adminToken))
      .send({ cancelReason: 'P4-U4 gate vocabulary test' }).expect(200);
    r = await S().post('/api/v1/delivery-orders').set(auth(adminToken))
      .send({ billOfLadingId: draftBillId, recipient: 'X' });
    expect(r.status).toBe(409);
    expect(JSON.stringify(r.body)).toContain('APPROVED');

    // RELEASED (forced via prisma — unreachable through the API until U6): both
    // the D-O and the R-O creation gates reject it with the same vocabulary
    const { PrismaClient } = require('@prisma/client');
    const fx = new PrismaClient();
    try {
      await fx.billOfLading.update({
        where: { id: draftBillId },
        data: { status: 'RELEASED' },
      });
      r = await S().post('/api/v1/delivery-orders').set(auth(adminToken))
        .send({ billOfLadingId: draftBillId, recipient: 'X' });
      expect(r.status).toBe(409);
      expect(JSON.stringify(r.body)).toContain('APPROVED');
      const ro = await S().post('/api/v1/release-orders').set(auth(adminToken))
        .send({ billOfLadingId: draftBillId });
      expect(ro.status).toBe(409);
      expect(JSON.stringify(ro.body)).toContain('APPROVED');
    } finally {
      await fx.$disconnect();
    }
  });
});
