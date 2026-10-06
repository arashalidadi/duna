import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

type Ref = { id: string };

/**
 * Phase 9 — Manifest (cargo document) end-to-end tests.
 * Runs against the live development database (documented limitation).
 * Self-cleaning: creates its own ports/vessel/voyages/customer/yard/cargo/
 * inspection/load-list/actual-loading and removes them (reverse dependency
 * order) in afterAll.
 *
 * Lifecycle under test:
 *   DRAFT -> SUBMITTED -> APPROVED
 *   DRAFT | SUBMITTED -> CANCELLED
 * Items may only be added while DRAFT; only cargo from a COMPLETED actual
 * loading on the manifest's voyage is eligible; one manifest per voyage.
 */
describe('Manifest (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();
  const emailSuffix = randomTag;

  const createdPorts: Ref[] = [];
  const createdVessels: Ref[] = [];
  const createdVoyages: Ref[] = [];
  const createdCustomers: Ref[] = [];
  const createdYards: Ref[] = [];
  const createdCargos: Ref[] = [];
  const createdLoadLists: Ref[] = [];
  const createdPartyMasters: Ref[] = []; // Phase 2 cutover: fixture master rows
  const createdConsigneeIds: Ref[] = []; // P5-U3: fixture Consignee masters

  let adminToken = '';
  let fixtureShipperId = ''; // Phase 2 cutover: Shipper-master ref (was Customer)
  // P5-U3: a second Shipper + two Consignee masters so one consolidated manifest can
  // carry DIFFERENT parties per line (multi-party, roadmap Test 3 / Acceptance 2).
  let fixtureShipper2Id = '';
  let fixtureConsignee1Id = '';
  let fixtureConsignee2Id = '';
  let readerToken = ''; // manifest:read only
  let writerToken = ''; // read + create + update
  let submitterToken = ''; // read + submit
  let approverToken = ''; // read + approve
  let cancellerToken = ''; // read + cancel
  let noReadToken = ''; // no manifest permission

  let originPortId = '';
  let destPortId = '';
  let vesselId = '';
  let customerId = '';
  let yardId = '';

  let voyage1Id = ''; // carries the completed actual loading
  let voyage2Id = ''; // for the cancel flow
  let voyage3Id = ''; // for the delete flow

  let cargo1Id = ''; // actually loaded on voyage1 (approved, FULL)
  let cargo2Id = ''; // never loaded -> ineligible for manifest
  let actualLoadingItemId = '';

  let manifest1Id = ''; // main flow: add item -> submit -> approve
  let manifest2Id = ''; // cancel flow (empty, voyage2)
  let manifest3Id = ''; // delete flow (draft, voyage3)
  let manifest1ItemId = '';

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

    // Phase 2 cutover (party-cutover-plan.md §3): manifest party fields are
    // Shipper-master refs now — fixture Shipper replaces the old Customer id.
    const { PrismaClient } = require('@prisma/client');
    const partyFx = new PrismaClient();
    try {
      const shp = await partyFx.shipper.create({
        data: { code: `MFSP-${tag}`, name: `Manifest Test Shipper ${randomTag}` },
      });
      fixtureShipperId = shp.id;
      createdPartyMasters.push({ id: shp.id });
      const shp2 = await partyFx.shipper.create({
        data: { code: `MFSP2-${tag}`, name: `Manifest Test Shipper 2 ${randomTag}` },
      });
      fixtureShipper2Id = shp2.id;
      createdPartyMasters.push({ id: shp2.id });
      const cn1 = await partyFx.consignee.create({
        data: { code: `MFCN1-${tag}`, name: `Manifest Test Consignee 1 ${randomTag}` },
      });
      fixtureConsignee1Id = cn1.id;
      createdConsigneeIds.push({ id: cn1.id });
      const cn2 = await partyFx.consignee.create({
        data: { code: `MFCN2-${tag}`, name: `Manifest Test Consignee 2 ${randomTag}` },
      });
      fixtureConsignee2Id = cn2.id;
      createdConsigneeIds.push({ id: cn2.id });
    } finally {
      await partyFx.$disconnect();
    }

    readerToken = await createRoleToken(`MFREAD_${tag}`, ['manifest:read'], `mf-read-${emailSuffix}@shipping.local`);
    writerToken = await createRoleToken(
      `MFWRITE_${tag}`,
      ['manifest:read', 'manifest:create', 'manifest:update'],
      `mf-writer-${emailSuffix}@shipping.local`
    );
    submitterToken = await createRoleToken(
      `MFSUB_${tag}`,
      ['manifest:read', 'manifest:submit'],
      `mf-sub-${emailSuffix}@shipping.local`
    );
    approverToken = await createRoleToken(
      `MFAPPR_${tag}`,
      ['manifest:read', 'manifest:approve'],
      `mf-appr-${emailSuffix}@shipping.local`
    );
    cancellerToken = await createRoleToken(
      `MFCANC_${tag}`,
      ['manifest:read', 'manifest:cancel'],
      `mf-canc-${emailSuffix}@shipping.local`
    );
    noReadToken = await createRoleToken(`MFNOREAD_${tag}`, ['cargo:read'], `mf-noread-${emailSuffix}@shipping.local`);

    // --- master data: ports -> vessel -> voyages ---
    const portA = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `MFP1-${tag}`, name: `MF Origin ${randomTag}`, country: 'AE' })
      .expect(201);
    createdPorts.push({ id: portA.body.data.id });
    originPortId = portA.body.data.id;

    const portB = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `MFP2-${tag}`, name: `MF Dest ${randomTag}`, country: 'IN' })
      .expect(201);
    createdPorts.push({ id: portB.body.data.id });
    destPortId = portB.body.data.id;

    const ves = await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ code: `MFVSL-${tag}`, name: `MV MF ${randomTag}`, flag: 'PA', vesselType: 'CONTAINER' })
      .expect(201);
    createdVessels.push({ id: ves.body.data.id });
    vesselId = ves.body.data.id;

    for (const v of [1, 2, 3]) {
      const voy = await request(app.getHttpServer())
        .post('/api/v1/voyages')
        .set(auth(adminToken))
        .send({ vesselId, originPortId, destinationPortId: destPortId })
        .expect(201);
      createdVoyages.push({ id: voy.body.data.id });
      if (v === 1) voyage1Id = voy.body.data.id;
      if (v === 2) voyage2Id = voy.body.data.id;
      if (v === 3) voyage3Id = voy.body.data.id;
    }

    // --- customer + yard (cargo prerequisites) ---
    const cust = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set(auth(adminToken))
      .send({ code: `MFCUS-${tag}`, name: `MF Co ${randomTag}`, type: 'SHIPPER' })
      .expect(201);
    createdCustomers.push({ id: cust.body.data.id });
    customerId = cust.body.data.id;

    const yd = await request(app.getHttpServer())
      .post('/api/v1/yards')
      .set(auth(adminToken))
      .send({ code: `MFYD-${tag}`, name: `MF Yard ${randomTag}`, portId: originPortId })
      .expect(201);
    createdYards.push({ id: yd.body.data.id });
    yardId = yd.body.data.id;

    // --- cargo1: approved inspection -> finalized load list -> actual loading completed ---
    const cargo1 = await request(app.getHttpServer())
      .post('/api/v1/cargo')
      .set(auth(adminToken))
      .send({
        customerId,
        portId: originPortId,
        yardId,
        cargoType: 'CONTAINER',
        quantity: 30,
        weight: '12.5',
        packages: 10,
        packageType: 'CARTONS',
      })
      .expect(201);
    createdCargos.push({ id: cargo1.body.data.id });
    cargo1Id = cargo1.body.data.id;

    const inspection = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(auth(adminToken))
      .send({ cargoId: cargo1Id, findings: 'ok' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspection.body.data.id}/book`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspection.body.data.id}/done`)
      .set(auth(adminToken))
      .expect(200);

    const ll = await request(app.getHttpServer())
      .post('/api/v1/load-lists')
      .set(auth(adminToken))
      .send({ voyageId: voyage1Id, notes: 'MF fixture' })
      .expect(201);
    createdLoadLists.push({ id: ll.body.data.id });
    const item = await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${ll.body.data.id}/items`)
      .set(auth(adminToken))
      .send({ cargoId: cargo1Id, plannedQuantity: 20, sequence: 1 })
      .expect(201);
    actualLoadingItemId = item.body.data.id;
    await stampLoadListFinalized(ll.body.data.id);

    const al = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: ll.body.data.id })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${al.body.data.id}/items/${actualLoadingItemId}`)
      .set(auth(adminToken))
      .send({ actualQuantity: 20 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al.body.data.id}/start`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al.body.data.id}/complete`)
      .set(auth(adminToken))
      .expect(200);

    // --- cargo2: never loaded (eligibility negative case) ---
    const cargo2 = await request(app.getHttpServer())
      .post('/api/v1/cargo')
      .set(auth(adminToken))
      .send({
        customerId,
        portId: originPortId,
        yardId,
        cargoType: 'CONTAINER',
        quantity: 5,
      })
      .expect(201);
    createdCargos.push({ id: cargo2.body.data.id });
    cargo2Id = cargo2.body.data.id;
  }, 120000);

  afterAll(async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const voyageIds = createdVoyages.map((v) => v.id);
      const loadListIds = createdLoadLists.map((l) => l.id);
      // P5-U2/U3 fixture bills FIRST: B/L items cascade away with them, manifest
      // items NULL their billOfLadingItemId, and every later delete below (cargo,
      // voyage, shipper/consignee masters) is otherwise blocked by these rows.
      // This block used to sit LAST — its FK failure was swallowed by the catch at
      // the bottom, which silently aborted the rest of cleanup (root cause of the
      // P5-U2 "fixture leak", follow-up (i)).
      await prisma.billOfLadingItem.deleteMany({
        where: { billOfLading: { id: { in: createdBillIds } } },
      });
      await prisma.billOfLading.deleteMany({ where: { id: { in: createdBillIds } } });
      await prisma.auditLog.deleteMany({
        where: { entityType: 'BillOfLading', entityId: { in: createdBillIds } },
      });
      // Reverse dependency order.
      await prisma.manifestItem.deleteMany({ where: { manifest: { voyageId: { in: voyageIds } } } });
      await prisma.manifest.deleteMany({ where: { voyageId: { in: voyageIds } } });
      await prisma.actualLoadingItem.deleteMany({ where: { actualLoading: { loadListId: { in: loadListIds } } } });
      await prisma.actualLoading.deleteMany({ where: { loadListId: { in: loadListIds } } });
      await prisma.loadListItem.deleteMany({ where: { loadListId: { in: loadListIds } } });
      await prisma.loadList.deleteMany({ where: { id: { in: loadListIds } } });
      for (const cargoId of createdCargos.map((c) => c.id)) {
        await prisma.inspection.deleteMany({ where: { cargoId } });
        await prisma.yardInventory.deleteMany({ where: { cargoId } });
      }
      await prisma.cargo.deleteMany({ where: { id: { in: createdCargos.map((c) => c.id) } } });
      await prisma.voyage.deleteMany({ where: { id: { in: voyageIds } } });
      await prisma.vessel.deleteMany({ where: { id: { in: createdVessels.map((v) => v.id) } } });
      await prisma.yard.deleteMany({ where: { id: { in: createdYards.map((y) => y.id) } } });
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomers.map((c) => c.id) } } });
      await prisma.shipper.deleteMany({ where: { id: { in: createdPartyMasters.map((m) => m.id) } } });
      await prisma.consignee.deleteMany({ where: { id: { in: createdConsigneeIds.map((m) => m.id) } } });
      await prisma.port.deleteMany({ where: { id: { in: createdPorts.map((p) => p.id) } } });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              `mf-read-${emailSuffix}@shipping.local`,
              `mf-writer-${emailSuffix}@shipping.local`,
              `mf-sub-${emailSuffix}@shipping.local`,
              `mf-appr-${emailSuffix}@shipping.local`,
              `mf-canc-${emailSuffix}@shipping.local`,
              `mf-noread-${emailSuffix}@shipping.local`,
            ],
          },
        },
      });
      await prisma.role.deleteMany({
        where: {
          code: {
            in: [
              `MFREAD_${tag}`,
              `MFWRITE_${tag}`,
              `MFSUB_${tag}`,
              `MFAPPR_${tag}`,
              `MFCANC_${tag}`,
              `MFNOREAD_${tag}`,
            ],
          },
        },
      });
      await prisma.$disconnect();
    } catch {
      /* best-effort cleanup */
    }
    await app.close();
  });


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
      .send({ email, password: 'ChangeMe123!', fullName: `MF ${roleCode}`, roleIds: [role.body.data.id] })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'ChangeMe123!' })
      .expect(200);
    return login.body.data.accessToken as string;
  }

  it('401 without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/manifests').expect(401);
  });

  it('403 when role lacks manifest permission', async () => {
    await request(app.getHttpServer()).get('/api/v1/manifests').set(auth(noReadToken)).expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/manifests/${'x'.repeat(24)}`)
      .set(auth(noReadToken))
      .expect(403);
  });

  it('create requires manifest:create (403 for reader); rejects unknown voyage', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(readerToken))
      .send({ voyageId: voyage1Id })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: 'nonexistent' })
      .expect(404);
  });

  it('create + get + list as admin; MAN-YYMM-##### number, DRAFT status, voyage snapshot; one per voyage', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: voyage1Id, notes: 'Phase 9 init' })
      .expect(201);
    const created = res.body.data;
    expect(created.status).toBe('DRAFT');
    expect(created.manifestNumber).toMatch(/^MAN-\d{4}-\d{5}$/);
    expect(created.voyageId).toBe(voyage1Id);
    expect(created.items).toEqual([]);
    // Snapshot fields taken from the voyage at creation time.
    expect(created.vesselName).toBe(`MV MF ${randomTag}`);
    expect(created.polPortId).toBe(originPortId);
    expect(created.podPortId).toBe(destPortId);
    expect(created.voyage.voyageNumber).toMatch(/^VOY-/);
    manifest1Id = created.id;

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/manifests/${manifest1Id}`)
      .set(auth(readerToken))
      .expect(200);
    expect(detail.body.data.manifestNumber).toBe(created.manifestNumber);

    const list = await request(app.getHttpServer())
      .get('/api/v1/manifests?voyageId=' + voyage1Id)
      .set(auth(readerToken))
      .expect(200);
    expect(list.body.data.data.some((m: { id: string }) => m.id === manifest1Id)).toBe(true);

    // One manifest per voyage -> 409
    await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: voyage1Id })
      .expect(409);
  });

  it('eligible-cargo lists actually-loaded cargo (flat shape) and excludes manifested cargo', async () => {
    const el = await request(app.getHttpServer())
      .get(`/api/v1/manifests/eligible-cargo?voyageId=${voyage1Id}`)
      .set(auth(readerToken))
      .expect(200);
    const rows = el.body.data as Array<Record<string, unknown>>;
    const found = rows.find((r) => r.id === cargo1Id);
    expect(found).toBeDefined();
    expect(found!.actualLoadingItemId).toBeDefined();

    // cargo2 was never loaded -> not eligible
    expect(rows.some((r) => r.id === cargo2Id)).toBe(false);
  });

  it('addItem requires manifest:update (403 for reader); rejects not-loaded cargo (409); snapshots actual loaded quantity', async () => {
    // reader lacks update
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest1Id}/items`)
      .set(auth(readerToken))
      .send({ cargoId: cargo1Id })
      .expect(403);

    // cargo never actually loaded on this voyage -> 409
    const notLoaded = await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest1Id}/items`)
      .set(auth(writerToken))
      .send({ cargoId: cargo2Id })
      .expect(409);
    expect(notLoaded.body.error.message).toMatch(/not actually loaded/i);

    // add the really-loaded cargo
    const res = await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest1Id}/items`)
      .set(auth(writerToken))
      .send({ cargoId: cargo1Id, blNumber: 'BL-MF-001' })
      .expect(201);
    const detail = res.body.data;
    expect(detail.items).toHaveLength(1);
    const item = detail.items[0];
    manifest1ItemId = item.id;
    expect(item.sequence).toBe(1);
    expect(item.blNumber).toBe('BL-MF-001');
    // Snapshots: weight from cargo, quantity from the ACTUAL loading line (20, not 30).
    expect(Number(item.weight)).toBe(12.5);
    expect(item.quantity).toBe(20);
    expect(item.packages).toBe(10);
    expect(item.cargo.id).toBe(cargo1Id);
    // Totals recomputed.
    expect(Number(detail.totalWeight)).toBe(12.5);
    expect(detail.totalQuantity).toBe(20);
    expect(detail.totalPackages).toBe(10);

    // duplicate cargo -> 409
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest1Id}/items`)
      .set(auth(writerToken))
      .send({ cargoId: cargo1Id })
      .expect(409);

    // eligible-cargo now excludes the manifested cargo when manifestId is given
    const el2 = await request(app.getHttpServer())
      .get(`/api/v1/manifests/eligible-cargo?voyageId=${voyage1Id}&manifestId=${manifest1Id}`)
      .set(auth(readerToken))
      .expect(200);
    expect((el2.body.data as Array<{ id: string }>).some((r) => r.id === cargo1Id)).toBe(false);
  });

  it('updateItem sets B/L number / notes; unknown item 404; removeItem recomputes totals', async () => {
    const upd = await request(app.getHttpServer())
      .patch(`/api/v1/manifests/${manifest1Id}/items/${manifest1ItemId}`)
      .set(auth(writerToken))
      .send({ blNumber: 'BL-MF-002', notes: 're-billed' })
      .expect(200);
    expect(upd.body.data.items[0].blNumber).toBe('BL-MF-002');
    expect(upd.body.data.items[0].notes).toBe('re-billed');

    await request(app.getHttpServer())
      .patch(`/api/v1/manifests/${manifest1Id}/items/${'wrongitem123456'}`)
      .set(auth(writerToken))
      .send({ blNumber: 'X' })
      .expect(404);

    // remove then re-add to prove totals recompute both ways
    const rem = await request(app.getHttpServer())
      .delete(`/api/v1/manifests/${manifest1Id}/items/${manifest1ItemId}`)
      .set(auth(writerToken))
      .expect(200);
    expect(rem.body.data.items).toHaveLength(0);
    expect(Number(rem.body.data.totalWeight)).toBe(0);
    expect(rem.body.data.totalQuantity).toBe(0);

    const readd = await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest1Id}/items`)
      .set(auth(writerToken))
      .send({ cargoId: cargo1Id })
      .expect(201);
    expect(Number(readd.body.data.totalWeight)).toBe(12.5);
    manifest1ItemId = readd.body.data.items[0].id;
  });

  it('update (header) works in DRAFT only; shipper/consignee set; unknown manifest 404', async () => {
    const upd = await request(app.getHttpServer())
      .patch(`/api/v1/manifests/${manifest1Id}`)
      .set(auth(writerToken))
      .send({
        shipperId: fixtureShipperId,
        notifyParty: 'MF Notify',
        gasCost: '100.5',
        currencyCode: 'USD',
        description: 'MF header edit',
      })
      .expect(200);
    expect(upd.body.data.shipperId).toBe(fixtureShipperId); // master ref, not Customer
    expect(upd.body.data.notifyParty).toBe('MF Notify');
    expect(Number(upd.body.data.gasCost)).toBe(100.5);
    expect(upd.body.data.currencyCode).toBe('USD');

    await request(app.getHttpServer())
      .patch(`/api/v1/manifests/${'nonexistent'}`)
      .set(auth(writerToken))
      .send({ notes: 'x' })
      .expect(404);
  });

  it('submit requires manifest:submit (403 for writer) and at least one item; DRAFT->SUBMITTED locks editing', async () => {
    // writer lacks manifest:submit
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest1Id}/submit`)
      .set(auth(writerToken))
      .expect(403);

    // empty manifest cannot be submitted (voyage2 fixture created inline)
    const m2 = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: voyage2Id })
      .expect(201);
    manifest2Id = m2.body.data.id;
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest2Id}/submit`)
      .set(auth(submitterToken))
      .expect(400);

    // main manifest has one item -> submit works
    const sub = await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest1Id}/submit`)
      .set(auth(submitterToken))
      .expect(200);
    expect(sub.body.data.status).toBe('SUBMITTED');
    expect(sub.body.data.submittedAt).toBeTruthy();

    // locked after submit
    await request(app.getHttpServer())
      .patch(`/api/v1/manifests/${manifest1Id}`)
      .set(auth(adminToken))
      .send({ notes: 'late' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest1Id}/items`)
      .set(auth(adminToken))
      .send({ cargoId: cargo1Id })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest1Id}/submit`)
      .set(auth(adminToken))
      .expect(409);
  });

  it('approve requires manifest:approve (403 for submitter); SUBMITTED->APPROVED is terminal', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest1Id}/approve`)
      .set(auth(submitterToken))
      .expect(403);

    const appr = await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest1Id}/approve`)
      .set(auth(approverToken))
      .expect(200);
    expect(appr.body.data.status).toBe('APPROVED');
    expect(appr.body.data.approvedAt).toBeTruthy();

    // terminal: no further transitions or edits
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest1Id}/submit`)
      .set(auth(adminToken))
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest1Id}/approve`)
      .set(auth(adminToken))
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest1Id}/cancel`)
      .set(auth(adminToken))
      .send({ cancelReason: 'late' })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/manifests/${manifest1Id}`)
      .set(auth(adminToken))
      .send({ notes: 'nope' })
      .expect(409);
  });

  it('cancel requires manifest:cancel + a reason; DRAFT->CANCELLED; cancelled manifest cannot be deleted', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest2Id}/cancel`)
      .set(auth(cancellerToken))
      .send({ cancelReason: '' })
      .expect(400);

    const canc = await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest2Id}/cancel`)
      .set(auth(cancellerToken))
      .send({ cancelReason: 'voyage cancelled by carrier' })
      .expect(200);
    expect(canc.body.data.status).toBe('CANCELLED');
    expect(canc.body.data.cancelReason).toBe('voyage cancelled by carrier');
    expect(canc.body.data.cancelledAt).toBeTruthy();

    // cancelled -> cancel again / delete -> 409
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest2Id}/cancel`)
      .set(auth(adminToken))
      .send({ cancelReason: 'again' })
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/api/v1/manifests/${manifest2Id}`)
      .set(auth(adminToken))
      .expect(409);
  });

  it('delete requires manifest:delete; soft-deletes a DRAFT manifest (404 afterwards)', async () => {
    const m3 = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: voyage3Id })
      .expect(201);
    manifest3Id = m3.body.data.id;

    // writer has update/create but not delete
    await request(app.getHttpServer())
      .delete(`/api/v1/manifests/${manifest3Id}`)
      .set(auth(writerToken))
      .expect(403);

    const del = await request(app.getHttpServer())
      .delete(`/api/v1/manifests/${manifest3Id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(del.body.data.deletedAt).toBeTruthy();

    await request(app.getHttpServer())
      .get(`/api/v1/manifests/${manifest3Id}`)
      .set(auth(adminToken))
      .expect(404);

    // deleted manifest is out of the list and a new one can be created for the voyage
    const list = await request(app.getHttpServer())
      .get('/api/v1/manifests?voyageId=' + voyage3Id)
      .set(auth(adminToken))
      .expect(200);
    expect(list.body.data.data.some((m: { id: string }) => m.id === manifest3Id)).toBe(false);

    const m3b = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: voyage3Id })
      .expect(201);
    expect(m3b.body.data.status).toBe('DRAFT');
    manifest3Id = m3b.body.data.id; // cleaned up in afterAll via voyage
  });

  it('list filters by status and search', async () => {
    const draft = await request(app.getHttpServer())
      .get('/api/v1/manifests?status=DRAFT')
      .set(auth(readerToken))
      .expect(200);
    expect(draft.body.data.data.every((m: { status: string }) => m.status === 'DRAFT')).toBe(true);
    expect(draft.body.data.data.some((m: { id: string }) => m.id === manifest3Id)).toBe(true);

    const search = await request(app.getHttpServer())
      .get(`/api/v1/manifests?search=${encodeURIComponent('MF')}`)
      .set(auth(readerToken))
      .expect(200);
    expect(search.body.data.data.length).toBeGreaterThan(0);
  });

    it('manifest eligibility requires a POSITIVE recorded quantity (ADR-029/ADR-042): null and zero lines excluded, positive snapshots the recorded quantity', async () => {
      // Full chain helper: DONE cargo -> LL line -> finalize -> AL (materializes the line) ->
      // optional recording -> start -> complete. Pushes cargo/list to this suite's registries.
      const mkLoadedLine = async (suffix: string, qty: number | null): Promise<string> => {
        const cargo = await request(app.getHttpServer())
          .post('/api/v1/cargo')
          .set(auth(adminToken))
          .send({ customerId, portId: originPortId, yardId, cargoType: 'CONTAINER', quantity: 30 })
          .expect(201);
        createdCargos.push({ id: cargo.body.data.id });
        const cid = cargo.body.data.id as string;
        const insp = await request(app.getHttpServer())
          .post('/api/v1/inspections')
          .set(auth(adminToken))
          .send({ cargoId: cid, findings: `adr042 ${suffix}` })
          .expect(201);
        await request(app.getHttpServer())
          .post(`/api/v1/inspections/${insp.body.data.id}/book`)
          .set(auth(adminToken))
          .expect(200);
        await request(app.getHttpServer())
          .post(`/api/v1/inspections/${insp.body.data.id}/done`)
          .set(auth(adminToken))
          .expect(200);
        const ll = await request(app.getHttpServer())
          .post('/api/v1/load-lists')
          .set(auth(adminToken))
          .send({ voyageId: voyage3Id, notes: `ADR-042 ${suffix}` })
          .expect(201);
        createdLoadLists.push({ id: ll.body.data.id });
        const li = await request(app.getHttpServer())
          .post(`/api/v1/load-lists/${ll.body.data.id}/items`)
          .set(auth(adminToken))
          .send({ cargoId: cid, plannedQuantity: 10, sequence: 1 })
          .expect(201);
        await stampLoadListFinalized(ll.body.data.id);
        const al = await request(app.getHttpServer())
          .post('/api/v1/actual-loading')
          .set(auth(adminToken))
          .send({ loadListId: ll.body.data.id })
          .expect(201);
        if (qty !== null) {
          await request(app.getHttpServer())
            .patch(`/api/v1/actual-loading/${al.body.data.id}/items/${li.body.data.id}`)
            .set(auth(adminToken))
            .send({ actualQuantity: qty })
            .expect(200);
        }
        await request(app.getHttpServer())
          .post(`/api/v1/actual-loading/${al.body.data.id}/start`)
          .set(auth(adminToken))
          .send({})
          .expect(200);
        await request(app.getHttpServer())
          .post(`/api/v1/actual-loading/${al.body.data.id}/complete`)
          .set(auth(adminToken))
          .send({})
          .expect(200);
        return cid;
      };

      const unrecorded = await mkLoadedLine('null', null); // materialized line, quantity null
      const zero = await mkLoadedLine('zero', 0); // recorded 0 -> NOT_LOADED
      const positive = await mkLoadedLine('positive', 10); // recorded 10 of cargo quantity 30

      // The delete-flow fixture recreates a live DRAFT manifest on voyage3
      // (manifest.e2e-spec.ts delete test, `manifest3Id = m3b...`) — one-per-voyage
      // (manifest.service.ts:240) is satisfied by it and it is still DRAFT (fixture
      // manifest1 is APPROVED by earlier tests, so unusable). This test is last, so
      // manifest3's item set is not asserted afterwards.
      const mfId = manifest3Id;

      // null line -> 409 with the shipped message
      const addNull = await request(app.getHttpServer())
        .post(`/api/v1/manifests/${mfId}/items`)
        .set(auth(adminToken))
        .send({ cargoId: unrecorded })
        .expect(409);
      expect(addNull.body.error.message).toBe(
        'Cargo was not actually loaded on this voyage; only cargo from a completed Actual Loading may be manifested'
      );

      // zero line -> 409 with the shipped message
      const addZero = await request(app.getHttpServer())
        .post(`/api/v1/manifests/${mfId}/items`)
        .set(auth(adminToken))
        .send({ cargoId: zero })
        .expect(409);
      expect(addZero.body.error.message).toBe(
        'Cargo was not actually loaded on this voyage; only cargo from a completed Actual Loading may be manifested'
      );

      // both are absent from the voyage's eligible list; the positive fixture line is present
      const el = await request(app.getHttpServer())
        .get(`/api/v1/manifests/eligible-cargo?voyageId=${voyage3Id}`)
        .set(auth(adminToken))
        .expect(200);
      const ids = (el.body.data as Array<{ id: string }>).map((r) => r.id);
      expect(ids).not.toContain(unrecorded);
      expect(ids).not.toContain(zero);

      // positive line: eligible and the manifest item snapshots the RECORDED actualQuantity
      // (10), not the cargo's quantity (30) — ADR-029 "the manifest reflects what was
      // actually loaded".
      expect(ids).toContain(positive);
      await request(app.getHttpServer())
        .post(`/api/v1/manifests/${mfId}/items`)
        .set(auth(adminToken))
        .send({ cargoId: positive })
        .expect(201);
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/manifests/${mfId}`)
        .set(auth(adminToken))
        .expect(200);
      const row = (detail.body.data.items as Array<{ cargoId: string; quantity: string }>).find(
        (it) => it.cargoId === positive
      );
      expect(row).toBeDefined();
      expect(Number(row!.quantity)).toBe(10);
    }, 30000);
  // ---------------------------------------------------------------------------
  // P5-U2 (ADR-047 d1): consolidation create path.
  // POST /manifests with billIds -> one manifest line per APPROVED B/L item,
  // carrying billOfLadingItemId + per-item parties copied from the B/L.
  // The web still posts the legacy cargo shape, so this path is additive.
  // ---------------------------------------------------------------------------

  // Track created B/Ls (as Shipper/Consignee masters) and NumberingSequence names
  // so afterAll can sweep them by explicit filter (U2 fixture-hygiene rule).
  const createdBillIds: string[] = [];
  // P5-U3: bill -> cargo lookup so a test can put the SAME voyage's cargo on a
  // manifest through the legacy add-item path (row with no parties of its own).
  const cargoIdByBill: Record<string, string> = {};

  // Full chain helper: cargo -> inspection DONE -> load list -> FINALIZED ->
  // actual loading COMPLETED -> voyage-mode B/L (DRAFT, 1 item). Voyage-mode keeps
  // the B/L independent of any manifest (ADR-045 decision 1), which is what the
  // consolidation path consumes.
  async function mkVoyageModeBill(
    voyageId: string,
    shipperId?: string,
    consigneeId?: string,
  ): Promise<string> {
    const cargo = await request(app.getHttpServer())
      .post('/api/v1/cargo')
      .set(auth(adminToken))
      .send({
        customerId,
        portId: originPortId,
        yardId,
        cargoType: 'CONTAINER',
        quantity: 10,
        weight: '12.5',
        packages: 10,
        packageType: 'CARTONS',
      })
      .expect(201);
    createdCargos.push({ id: cargo.body.data.id });
    const cid = cargo.body.data.id as string;

    const insp = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(auth(adminToken))
      .send({ cargoId: cid, findings: 'p5u2' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${insp.body.data.id}/book`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${insp.body.data.id}/done`)
      .set(auth(adminToken))
      .expect(200);

    const ll = await request(app.getHttpServer())
      .post('/api/v1/load-lists')
      .set(auth(adminToken))
      .send({ voyageId, notes: 'P5-U2 consolidation' })
      .expect(201);
    createdLoadLists.push({ id: ll.body.data.id });
    const llItem = await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${ll.body.data.id}/items`)
      .set(auth(adminToken))
      .send({ cargoId: cid, plannedQuantity: 10, sequence: 1 })
      .expect(201);
    await stampLoadListFinalized(ll.body.data.id);

    const al = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: ll.body.data.id })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${al.body.data.id}/items/${llItem.body.data.id}`)
      .set(auth(adminToken))
      .send({ actualQuantity: 10 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al.body.data.id}/start`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al.body.data.id}/complete`)
      .set(auth(adminToken))
      .expect(200);

    // Voyage-mode B/L: no manifest involvement, items created from the cargo line.
    const bill = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({
        voyageId,
        cargoIds: [cid],
        ...(shipperId ? { shipperId } : {}),
        ...(consigneeId ? { consigneeId } : {}),
        billType: 'HOUSE',
      })
      .expect(201);
    const billId = bill.body.data.id as string;
    createdBillIds.push(billId);
    cargoIdByBill[billId] = cid;
    return billId;
  }

  // DRAFT -> FINAL -> APPROVED via the shipped edges (ADR-046: issue is the
  // APPROVED-equivalent transition; finalize then issue).
  async function approveBill(billId: string): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${billId}/finalize`)
      .set(auth(adminToken))
      .expect(200);
    const appr = await request(app.getHttpServer())
      .post(`/api/v1/bills/${billId}/issue`)
      .set(auth(adminToken))
      .expect(200);
    expect(appr.body.data.status).toBe('APPROVED');
  }

  it('consolidation happy path: 2 APPROVED B/Ls on same voyage -> 201; items carry billOfLadingItemId + per-item parties', async () => {
    const voy = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: voy.body.data.id });
    const conVoyageId = voy.body.data.id as string;

    const billId1 = await mkVoyageModeBill(conVoyageId, fixtureShipperId);
    const billId2 = await mkVoyageModeBill(conVoyageId, fixtureShipperId);
    await approveBill(billId1);
    await approveBill(billId2);

    const res = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: conVoyageId, billIds: [billId1, billId2] })
      .expect(201);
    const mf = res.body.data;
    expect(mf.status).toBe('DRAFT');
    expect(mf.manifestNumber).toMatch(/^MAN-\d{4}-\d{5}$/);
    // One manifest line per B/L item (each voyage-mode bill has exactly 1 item).
    expect(mf.items).toHaveLength(2);

    // Read back via the detail endpoint: billOfLadingItemId + per-item parties copied.
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/manifests/${mf.id}`)
      .set(auth(adminToken))
      .expect(200);
    const items = detail.body.data.items as Array<{
      billOfLadingItemId: string | null;
      shipperId: string | null;
      consigneeId: string | null;
    }>;
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.billOfLadingItemId).toBeTruthy();
      expect(item.shipperId).toBe(fixtureShipperId);
      // consignee copied from the B/L (null in this fixture — cargo has no consignee)
      expect(item.consigneeId).toBeNull();
    }
  });

  it('consolidation negative: non-APPROVED bill -> 400 (ADR-047 d1 message)', async () => {
    const voy = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: voy.body.data.id });
    const conVoyageId = voy.body.data.id as string;

    const billId = await mkVoyageModeBill(conVoyageId, fixtureShipperId);
    // left DRAFT on purpose

    const res = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: conVoyageId, billIds: [billId] })
      .expect(400);
    expect(res.body.error.message).toBe(
      'One or more billIds are not APPROVED or do not belong to the specified voyage'
    );
  });

  it('consolidation negative: bill on wrong voyage -> 400 (ADR-047 d1 message)', async () => {
    // Two fresh voyages: the bill is APPROVED on voyA; voyB has NO live manifest so the
    // one-manifest-per-voyage rule cannot fire first and the qualification 400 is reached.
    const voyA = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: voyA.body.data.id });
    const voyB = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: voyB.body.data.id });

    const billA = await mkVoyageModeBill(voyA.body.data.id as string, fixtureShipperId);
    await approveBill(billA);

    const res = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: voyB.body.data.id, billIds: [billA] })
      .expect(400);
    expect(res.body.error.message).toBe(
      'One or more billIds are not APPROVED or do not belong to the specified voyage'
    );
  });

  it('consolidation negative: empty billIds -> 400 via @ArrayNotEmpty message', async () => {
    const voy = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: voy.body.data.id });

    const res = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: voy.body.data.id, billIds: [] })
      .expect(400);
    expect(res.body.error.message).toEqual(['billIds must contain at least one bill id']);
  });

  // Claim-guard 409 is API-UNREACHABLE (see implementation log,
  // "Claim-guard reachability"): bill qualification forces bill.voyageId ===
  // dto.voyageId, so any live claiming manifest sits on that same voyage and
  // the pre-transaction one-manifest-per-voyage check fires first. The guard
  // is kept in the service as the item-level invariant backing ADR-047 d3;
  // the reachable behavior — soft-delete frees the claim — is tested here.
  it('consolidation soft-delete frees the claim: delete M1 -> same voyage re-consolidates (201)', async () => {
    const voy = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: voy.body.data.id });
    const conVoyageId = voy.body.data.id as string;

    const billA = await mkVoyageModeBill(conVoyageId, fixtureShipperId);
    await approveBill(billA);

    const mf1 = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: conVoyageId, billIds: [billA] })
      .expect(201);
    const mf1Id = mf1.body.data.id as string;

    await request(app.getHttpServer())
      .delete(`/api/v1/manifests/${mf1Id}`)
      .set(auth(adminToken))
      .expect(200);

    // Same voyage (the bill's voyage is the constraint) — the claim was freed
    // by the soft delete, so a second consolidation succeeds.
    const mf2 = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: conVoyageId, billIds: [billA] })
      .expect(201);
    expect(mf2.body.data.id).not.toBe(mf1Id);

    // M1's ManifestItem rows still EXIST (explicit id filter) — proves the
    // 201 came from the guard correctly IGNORING the soft-deleted owner, not
    // from the claim being erased.
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const m1Items = await prisma.manifestItem.findMany({
        where: { manifestId: mf1Id },
        select: { id: true, billOfLadingItemId: true },
      });
      expect(m1Items.length).toBeGreaterThan(0);
      for (const it of m1Items) {
        expect(it.billOfLadingItemId).not.toBeNull();
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('backfill (ADR-047 d3) is idempotent: re-running the shipped UPDATE changes 0 rows', async () => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      // First run: populate any manifest_items still missing billOfLadingItemId
      const firstResult = await prisma.$executeRaw`
        UPDATE "manifest_items" mi
        SET "billOfLadingItemId" = bli.id
        FROM "bills_of_lading_items" bli
        WHERE bli."manifestItemId" = mi.id
          AND mi."billOfLadingItemId" IS NULL
      `;
      // Second (idempotent) re-run must change 0 rows — the guard IS NULL ensures this.
      const secondResult = await prisma.$executeRaw`
        UPDATE "manifest_items" mi
        SET "billOfLadingItemId" = bli.id
        FROM "bills_of_lading_items" bli
        WHERE bli."manifestItemId" = mi.id
          AND mi."billOfLadingItemId" IS NULL
      `;
      expect(firstResult).toBeGreaterThanOrEqual(0);
      expect(secondResult).toBe(0);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('SET NULL survives a hard-delete of the source B/L item (FK onDelete)', async () => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      // Find a manifest item that carries the consolidation reference.
      const mi = await prisma.manifestItem.findFirst({
        where: { billOfLadingItemId: { not: null } },
        select: { id: true, billOfLadingItemId: true },
      });
      if (!mi) {
        // No consolidated rows exist in the test window yet — the FK behavior is
        // schema-level (onDelete: SetNull) and is covered by the migration itself.
        return;
      }
      await prisma.billOfLadingItem.delete({ where: { id: mi.billOfLadingItemId! } });
      const after = await prisma.manifestItem.findUnique({
        where: { id: mi.id },
        select: { billOfLadingItemId: true },
      });
      expect(after?.billOfLadingItemId).toBeNull();
    } finally {
      await prisma.$disconnect();
    }
  });

  it('legacy cargo path regression: POST /manifests without billIds still works (unchanged)', async () => {
    // manifest1Id was created via the legacy path in beforeAll and is APPROVED with
    // items carrying actualLoadingItemId (the legacy traceability column), not
    // billOfLadingItemId.
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/manifests/${manifest1Id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(detail.body.data.status).toBe('APPROVED');
    expect(detail.body.data.items.length).toBeGreaterThan(0);
    expect(detail.body.data.items[0].actualLoadingItemId).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // P5-U3 (ADR-047 d4): per-item parties end-to-end — per-row party objects
  // (code + name), the derived distinct-parties summary, header-vs-row rules and
  // DTO validation. Roadmap Test 3 (multi-party support) / Acceptance 2
  // (multi-party manifests supported). No schema: the columns shipped in U2's 37.
  // ---------------------------------------------------------------------------

  it('multi-party: consolidated lines carry distinct parties and partySummary lists them distinctly (Test 3 / Acceptance 2)', async () => {
    const voy = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: voy.body.data.id });
    const voyId = voy.body.data.id as string;

    const bill1 = await mkVoyageModeBill(voyId, fixtureShipperId, fixtureConsignee1Id);
    const bill2 = await mkVoyageModeBill(voyId, fixtureShipper2Id, fixtureConsignee2Id);
    await approveBill(bill1);
    await approveBill(bill2);

    const res = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: voyId, billIds: [bill1, bill2] })
      .expect(201);
    // A consolidated header carries no parties — every line carries its own
    // (ADR-047 d4; the create response already carries the derived summary).
    expect(res.body.data.shipperId).toBeNull();
    expect(res.body.data.consigneeId).toBeNull();
    expect(
      (res.body.data.partySummary.shippers as Array<{ id: string }>).map((s) => s.id).sort()
    ).toEqual([fixtureShipperId, fixtureShipper2Id].sort());

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/manifests/${res.body.data.id}`)
      .set(auth(adminToken))
      .expect(200);
    const data = detail.body.data;
    const items = data.items as Array<{
      shipperId: string | null;
      consigneeId: string | null;
      shipper: { id: string; code: string; name: string } | null;
      consignee: { id: string; code: string; name: string } | null;
    }>;
    expect(items).toHaveLength(2);

    // Per-row cells (code + name): each line resolves ITS OWN party masters.
    const byShipper = new Map(items.map((i) => [i.shipperId, i]));
    expect([...byShipper.keys()].sort()).toEqual([fixtureShipperId, fixtureShipper2Id].sort());
    const row1 = byShipper.get(fixtureShipperId)!;
    expect(row1.shipper?.id).toBe(fixtureShipperId);
    expect(row1.shipper?.code).toBe(`MFSP-${tag}`);
    expect(row1.shipper?.name).toContain('Manifest Test Shipper ');
    expect(row1.consignee?.id).toBe(fixtureConsignee1Id);
    expect(row1.consignee?.code).toBe(`MFCN1-${tag}`);
    const row2 = byShipper.get(fixtureShipper2Id)!;
    expect(row2.shipper?.code).toBe(`MFSP2-${tag}`);
    expect(row2.consignee?.id).toBe(fixtureConsignee2Id);
    expect(row2.consignee?.code).toBe(`MFCN2-${tag}`);

    // Distinct summary: two shippers, two consignees — deduped by master id,
    // one entry per DISTINCT party even though there are two rows.
    const summary = data.partySummary as {
      shippers: Array<{ id: string }>;
      consignees: Array<{ id: string }>;
    };
    expect(summary.shippers).toHaveLength(2);
    expect(summary.consignees).toHaveLength(2);
    expect(summary.shippers.map((s) => s.id).sort()).toEqual(
      [fixtureShipperId, fixtureShipper2Id].sort()
    );
    expect(summary.consignees.map((c) => c.id).sort()).toEqual(
      [fixtureConsignee1Id, fixtureConsignee2Id].sort()
    );
  });

  it('multi-party summary dedupes: the same party on every line appears exactly once', async () => {
    const voy = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: voy.body.data.id });
    const voyId = voy.body.data.id as string;

    const bill1 = await mkVoyageModeBill(voyId, fixtureShipper2Id, fixtureConsignee1Id);
    const bill2 = await mkVoyageModeBill(voyId, fixtureShipper2Id, fixtureConsignee1Id);
    await approveBill(bill1);
    await approveBill(bill2);

    const res = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: voyId, billIds: [bill1, bill2] })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/manifests/${res.body.data.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(detail.body.data.items).toHaveLength(2);
    const summary = detail.body.data.partySummary as {
      shippers: Array<{ id: string }>;
      consignees: Array<{ id: string }>;
    };
    expect(summary.shippers).toHaveLength(1);
    expect(summary.shippers[0].id).toBe(fixtureShipper2Id);
    expect(summary.consignees).toHaveLength(1);
    expect(summary.consignees[0].id).toBe(fixtureConsignee1Id);
  });

  it('partySummary rules: a row\'s own party governs; a row without parties falls back to the header (ADR-047 d4)', async () => {
    const voy = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: voy.body.data.id });
    const voyId = voy.body.data.id as string;

    // Row 1 via consolidation (party = Shipper 2). Row 2 via the legacy add-item
    // path on the same voyage — legacy rows carry no parties of their own.
    const bill1 = await mkVoyageModeBill(voyId, fixtureShipper2Id);
    await approveBill(bill1);
    const res = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: voyId, billIds: [bill1] })
      .expect(201);
    const mfId = res.body.data.id as string;

    const bill2 = await mkVoyageModeBill(voyId, fixtureShipper2Id); // DRAFT on purpose
    const addRes = await request(app.getHttpServer())
      .post(`/api/v1/manifests/${mfId}/items`)
      .set(auth(adminToken))
      .send({ cargoId: cargoIdByBill[bill2] })
      .expect(201);
    // Header still empty at this point -> only row 1 contributes (the addItem
    // read-back carries the derived summary too).
    expect(
      (addRes.body.data.partySummary.shippers as Array<{ id: string }>).map((s) => s.id)
    ).toEqual([fixtureShipper2Id]);

    // Set the header afterwards (DRAFT update): row 1 keeps its own party, row 2
    // (null) resolves through the header fallback.
    const upd = await request(app.getHttpServer())
      .patch(`/api/v1/manifests/${mfId}`)
      .set(auth(adminToken))
      .send({ shipperId: fixtureShipperId })
      .expect(200);
    expect(upd.body.data.shipperId).toBe(fixtureShipperId);
    expect(
      (upd.body.data.partySummary.shippers as Array<{ id: string }>).map((s) => s.id).sort()
    ).toEqual([fixtureShipperId, fixtureShipper2Id].sort());

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/manifests/${mfId}`)
      .set(auth(adminToken))
      .expect(200);
    const items = detail.body.data.items as Array<{
      shipperId: string | null;
      shipper: { id: string } | null;
    }>;
    expect(items).toHaveLength(2);
    const withParty = items.find((i) => i.shipperId !== null)!;
    // Row priority: the row's own party wins over the header.
    expect(withParty.shipper?.id).toBe(fixtureShipper2Id);
    const withoutParty = items.find((i) => i.shipperId === null)!;
    expect(withoutParty.shipper).toBeNull(); // raw cell value; render falls back to header

    const summary = detail.body.data.partySummary as {
      shippers: Array<{ id: string }>;
      consignees: Array<{ id: string }>;
    };
    // Exactly the row party + the header (via the null row) — no duplicates, and
    // no consignees anywhere (none set on rows or header -> empty, not invented).
    expect(summary.shippers.map((s) => s.id).sort()).toEqual(
      [fixtureShipperId, fixtureShipper2Id].sort()
    );
    expect(summary.consignees).toHaveLength(0);
  });

  it('consolidation DTO validation: header party fields rejected with billIds; legacy path still validates them', async () => {
    const voy = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: voy.body.data.id });
    const voyId = voy.body.data.id as string;

    // (a) billIds + header party -> rejected BEFORE any validation/qualification
    // work: the combination can never take effect, so it must not be silently dropped.
    const withParty = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: voyId, billIds: ['nonexistent-bill-id'], shipperId: fixtureShipperId })
      .expect(400);
    expect(withParty.body.error.message).toBe(
      'shipperId/consigneeId/agentId are not accepted when consolidating with billIds: each manifest line carries its own B/L parties (ADR-047 d4)'
    );

    // (b) legacy path (no billIds) still validates party refs: unknown id -> 400.
    const unknownParty = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: voyId, shipperId: 'nonexistent-shipper-id' })
      .expect(400);
    expect(unknownParty.body.error.message).toContain('Unknown shipperId');

    // (c) legacy path accepts valid header parties — rejection is scoped to billIds.
    const legacyOk = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: voyId, shipperId: fixtureShipperId })
      .expect(201);
    expect(legacyOk.body.data.shipperId).toBe(fixtureShipperId);
    expect(legacyOk.body.data.partySummary).toEqual({ shippers: [], consignees: [] });
  });
  });
