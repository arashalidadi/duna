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

  let adminToken = '';
  let fixtureShipperId = ''; // Phase 2 cutover: Shipper-master ref (was Customer)
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
    await stampLoadListCompleted(ll.body.data.id);

    const al = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: ll.body.data.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${ll.body.data.id}/finalize`)
      .set(auth(adminToken))
      .expect(200);
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


  // Phase 3A shipped reality: nothing in apps/api/src can transition a LoadList out of
  // DRAFT (load-planning.service.ts:29-33 maps DRAFT -> IN_PROGRESS/CANCELLED but only
  // finalize/cancel ever write status), while ActualLoading.create requires the list to be
  // COMPLETED (actual-loading.service.ts:240-244). Fixture setup therefore stamps the
  // intermediate COMPLETED state directly — the same direct-Prisma fixture pattern used by
  // the portal/party-cutover suites. The missing DRAFT->COMPLETED driver is recorded as a
  // product gap in the implementation log (not fixed here).
  async function stampLoadListCompleted(loadListId: string) {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      await prisma.loadList.update({ where: { id: loadListId }, data: { status: 'COMPLETED' } });
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
});
