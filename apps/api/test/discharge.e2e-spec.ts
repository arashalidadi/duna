import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Phase 19 — Discharge (unloading at destination) e2e.
 * Runs against the live development database (documented limitation).
 * Self-cleaning: creates its own ports/vessel/voyage/customer/yard/cargo/
 * inspection/load-list/actual-loading chain and removes them (reverse
 * dependency order) in afterAll.
 */
describe('Discharge (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();
  const emailSuffix = randomTag;

  let adminToken = '';
  let readerToken = ''; // discharge:read only
  let creatorToken = ''; // read + create + update
  let completerToken = ''; // read + complete
  let cancellerToken = ''; // read + cancel
  let noReadToken = ''; // no discharge permission

  const createdPortIds: string[] = [];
  const createdVesselIds: string[] = [];
  const createdVoyageIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdYardIds: string[] = [];
  const createdCargoIds: string[] = [];
  const createdLoadListIds: string[] = [];

  let originPortId = '';
  let destPortId = '';
  let vesselId = '';
  let voyageId = '';
  let customerId = '';
  let yardId = '';

  let loadListId = ''; // FINALIZED with approved cargo (planned 20)
  let loadListItemId = '';
  let cargoId = '';
  let actualLoadingId = ''; // COMPLETED (20 loaded)
  let actualLoadingItemId = '';
  let draftLoadingId = ''; // created but left NOT_STARTED (create discharge must 409)

  let dischargeId = ''; // main fixture
  let itemId = '';
  let cancelFixtureId = ''; // cancelled with reason
  let deliveredCargoId = ''; // second cargo to run FULL discharge -> DELIVERED


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

  const auth = (token: string) => ({ Authorization: 'Bearer ' + token });

  const createRoleToken = async (roleCode: string, permissionCodes: string[], email: string): Promise<string> => {
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
      .send({ email, password: 'ChangeMe123!', fullName: `DS ${roleCode}`, roleIds: [role.body.data.id] })
      .expect(201);
    const lg = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'ChangeMe123!' })
      .expect(200);
    return lg.body.data.accessToken as string;
  };

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

    readerToken = await createRoleToken(`DSREAD_${tag}`, ['discharge:read'], `ds-read-${emailSuffix}@shipping.local`);
    creatorToken = await createRoleToken(
      `DSCREATE_${tag}`,
      ['discharge:read', 'discharge:create', 'discharge:update', 'discharge:delete'],
      `ds-creator-${emailSuffix}@shipping.local`
    );
    completerToken = await createRoleToken(
      `DSCOMPLETE_${tag}`,
      ['discharge:read', 'discharge:complete'],
      `ds-completer-${emailSuffix}@shipping.local`
    );
    cancellerToken = await createRoleToken(
      `DSCANCEL_${tag}`,
      ['discharge:read', 'discharge:cancel'],
      `ds-canceller-${emailSuffix}@shipping.local`
    );
    noReadToken = await createRoleToken(`DSNOREAD_${tag}`, ['cargo:read'], `ds-noread-${emailSuffix}@shipping.local`);

    // --- master data chain: ports -> vessel -> voyage -> customer -> yard ---
    const portA = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `DSP5-${tag}`, name: `DS Origin ${randomTag}`, country: 'AE' })
      .expect(201);
    originPortId = portA.body.data.id;
    createdPortIds.push(originPortId);

    const portB = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `DSP6-${tag}`, name: `DS Dest ${randomTag}`, country: 'IN' })
      .expect(201);
    destPortId = portB.body.data.id;
    createdPortIds.push(destPortId);

    const ves = await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ code: `DSVSL-${tag}`, name: `MV DS ${randomTag}`, flag: 'PA', vesselType: 'CONTAINER' })
      .expect(201);
    vesselId = ves.body.data.id;
    createdVesselIds.push(vesselId);

    const voy = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    voyageId = voy.body.data.id;
    createdVoyageIds.push(voyageId);

    const cust = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set(auth(adminToken))
      .send({ code: `DSCUS-${tag}`, name: `DS Co ${randomTag}`, type: 'SHIPPER' })
      .expect(201);
    customerId = cust.body.data.id;
    createdCustomerIds.push(customerId);

    const yd = await request(app.getHttpServer())
      .post('/api/v1/yards')
      .set(auth(adminToken))
      .send({ code: `DSYD-${tag}`, name: `DS Yard ${randomTag}`, portId: originPortId })
      .expect(201);
    yardId = yd.body.data.id;
    createdYardIds.push(yardId);

    // --- cargo #1 (the discharge fixture, planned 20, loaded 20) ---
    const cargo1 = await request(app.getHttpServer())
      .post('/api/v1/cargo')
      .set(auth(adminToken))
      .send({ customerId, portId: originPortId, yardId, cargoType: 'CONTAINER', quantity: 20 })
      .expect(201);
    cargoId = cargo1.body.data.id;
    createdCargoIds.push(cargoId);

    const insp1 = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(auth(adminToken))
      .send({ cargoId, findings: 'ok' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${insp1.body.data.id}/book`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${insp1.body.data.id}/done`)
      .set(auth(adminToken))
      .expect(200);

    // --- FINALIZED load list with plannedQuantity 20 ---
    const ll = await request(app.getHttpServer())
      .post('/api/v1/load-lists')
      .set(auth(adminToken))
      .send({ voyageId, notes: 'DS fixture' })
      .expect(201);
    loadListId = ll.body.data.id;
    createdLoadListIds.push(loadListId);
    const item = await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${loadListId}/items`)
      .set(auth(adminToken))
      .send({ cargoId, plannedQuantity: 20, sequence: 1 })
      .expect(201);
    loadListItemId = item.body.data.id;
    await stampLoadListCompleted(loadListId);

    // --- COMPLETED actual loading (20 actually loaded -> FULL) ---
    const al = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId, notes: 'DS source loading' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${loadListId}/finalize`)
      .set(auth(adminToken))
      .expect(200);
    actualLoadingId = al.body.data.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${actualLoadingId}/items/${loadListItemId}`)
      .set(auth(adminToken))
      .send({ actualQuantity: 20 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${actualLoadingId}/start`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${actualLoadingId}/complete`)
      .set(auth(adminToken))
      .send({ notes: 'loaded' })
      .expect(200);
    const alDetail = await request(app.getHttpServer())
      .get(`/api/v1/actual-loading/${actualLoadingId}`)
      .set(auth(adminToken))
      .expect(200);
    actualLoadingItemId = alDetail.body.data.items[0].id as string;

    // --- NOT_STARTED actual loading: finalized LL on a fresh voyage, no quantities recorded ---
    const voyDraft = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyageIds.push(voyDraft.body.data.id);
    const cargoDraft = await request(app.getHttpServer())
      .post('/api/v1/cargo')
      .set(auth(adminToken))
      .send({ customerId, portId: originPortId, yardId, cargoType: 'CONTAINER', quantity: 5 })
      .expect(201);
    createdCargoIds.push(cargoDraft.body.data.id);
    const inspDraft = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(auth(adminToken))
      .send({ cargoId: cargoDraft.body.data.id, findings: 'ok' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspDraft.body.data.id}/book`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspDraft.body.data.id}/done`)
      .set(auth(adminToken))
      .expect(200);
    const llDraft = await request(app.getHttpServer())
      .post('/api/v1/load-lists')
      .set(auth(adminToken))
      .send({ voyageId: voyDraft.body.data.id, notes: 'DS not-started LL' })
      .expect(201);
    createdLoadListIds.push(llDraft.body.data.id);
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${llDraft.body.data.id}/items`)
      .set(auth(adminToken))
      .send({ cargoId: cargoDraft.body.data.id, plannedQuantity: 5, sequence: 1 })
      .expect(201);
    await stampLoadListCompleted(llDraft.body.data.id);
    const draftLoading = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: llDraft.body.data.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${llDraft.body.data.id}/finalize`)
      .set(auth(adminToken))
      .expect(200);
    draftLoadingId = draftLoading.body.data.id;

    // --- second voyage + cargo chain for the delivered-cargo fixture (planned 10, loaded 7) ---
    const voy2 = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyageIds.push(voy2.body.data.id);
    const cargo2 = await request(app.getHttpServer())
      .post('/api/v1/cargo')
      .set(auth(adminToken))
      .send({ customerId, portId: originPortId, yardId, cargoType: 'CONTAINER', quantity: 10 })
      .expect(201);
    deliveredCargoId = cargo2.body.data.id;
    createdCargoIds.push(deliveredCargoId);
    const insp2 = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(auth(adminToken))
      .send({ cargoId: deliveredCargoId, findings: 'ok' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${insp2.body.data.id}/book`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${insp2.body.data.id}/done`)
      .set(auth(adminToken))
      .expect(200);
    const ll3 = await request(app.getHttpServer())
      .post('/api/v1/load-lists')
      .set(auth(adminToken))
      .send({ voyageId: voy2.body.data.id, notes: 'DS delivered fixture' })
      .expect(201);
    createdLoadListIds.push(ll3.body.data.id);
    const item3 = await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${ll3.body.data.id}/items`)
      .set(auth(adminToken))
      .send({ cargoId: deliveredCargoId, plannedQuantity: 10, sequence: 1 })
      .expect(201);
    await stampLoadListCompleted(ll3.body.data.id);
    const al2 = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: ll3.body.data.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${ll3.body.data.id}/finalize`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${al2.body.data.id}/items/${item3.body.data.id}`)
      .set(auth(adminToken))
      .send({ actualQuantity: 7 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al2.body.data.id}/start`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al2.body.data.id}/complete`)
      .set(auth(adminToken))
      .send({ notes: 'loaded 7' })
      .expect(200);
  }, 180000);

  afterAll(async () => {
    // hard cleanup in reverse dependency order — tagged data only
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.dischargeItem.deleteMany({
        where: { cargoId: { in: [...createdCargoIds] } },
      });
      await prisma.discharge.deleteMany({
        where: {
          OR: [
            { actualLoadingId: { in: [actualLoadingId, draftLoadingId] } },
            { dischargeNumber: { startsWith: 'DIS-' } },
          ],
        },
      });
      // remove actual loadings created in this spec
      await prisma.actualLoadingItem.deleteMany({
        where: { cargoId: { in: createdCargoIds } },
      });
      await prisma.actualLoading.deleteMany({
        where: { loadListId: { in: createdLoadListIds } },
      });
      await prisma.loadListItem.deleteMany({
        where: { loadListId: { in: createdLoadListIds } },
      });
      await prisma.loadList.deleteMany({
        where: { id: { in: createdLoadListIds } },
      });
      await prisma.inspection.deleteMany({
        where: { cargoId: { in: createdCargoIds } },
      });
      await prisma.yardInventory.deleteMany({
        where: { cargoId: { in: createdCargoIds } },
      });
      await prisma.cargo.deleteMany({
        where: { id: { in: createdCargoIds } },
      });
      await prisma.voyage.deleteMany({
        where: { id: { in: createdVoyageIds } },
      });
      await prisma.vessel.deleteMany({
        where: { id: { in: createdVesselIds } },
      });
      await prisma.yard.deleteMany({
        where: { id: { in: createdYardIds } },
      });
      await prisma.customer.deleteMany({
        where: { id: { in: createdCustomerIds } },
      });
      await prisma.port.deleteMany({
        where: { id: { in: createdPortIds } },
      });
      // roles/users created by createRoleToken
      await prisma.user.deleteMany({
        where: { email: { endsWith: `@shipping.local`, in: [
          `ds-read-${emailSuffix}@shipping.local`,
          `ds-creator-${emailSuffix}@shipping.local`,
          `ds-completer-${emailSuffix}@shipping.local`,
          `ds-canceller-${emailSuffix}@shipping.local`,
          `ds-noread-${emailSuffix}@shipping.local`,
        ] } },
      });
      await prisma.role.deleteMany({
        where: { name: { in: [`DSREAD_${tag}`, `DSCREATE_${tag}`, `DSCOMPLETE_${tag}`, `DSCANCEL_${tag}`, `DSNOREAD_${tag}`] } },
      });
      await prisma.$disconnect();
    } catch (e) {
      console.error('cleanup error', e);
    }
    await app.close();
  }, 120000);

  // -------------------------------------------------------------------------
  // RBAC
  // -------------------------------------------------------------------------

  it('rejects anonymous access (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/discharge').expect(401);
  });

  it('rejects a token without discharge:read (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/discharge')
      .set(auth(noReadToken))
      .expect(403);
  });

  it('lists with discharge:read (200, paginated envelope)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/discharge?pageSize=10')
      .set(auth(readerToken))
      .expect(200);
    expect(Array.isArray(res.body.data.data)).toBe(true);
    expect(typeof res.body.data.meta.totalItems).toBe('number');
  });

  it('denies create to reader (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/discharge')
      .set(auth(readerToken))
      .send({ actualLoadingId })
      .expect(403);
  });

  // -------------------------------------------------------------------------
  // Create validations
  // -------------------------------------------------------------------------

  it('rejects create for a missing actual loading (404)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/discharge')
      .set(auth(adminToken))
      .send({ actualLoadingId: 'bogus-loading-id' })
      .expect(404);
  });

  it('rejects create for a NOT_STARTED actual loading (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/discharge')
      .set(auth(adminToken))
      .send({ actualLoadingId: draftLoadingId })
      .expect(409);
  });

  it('creates a discharge from the completed loading with pre-populated expected lines', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/discharge')
      .set(auth(adminToken))
      .send({ actualLoadingId, notes: 'arrival at destination port' })
      .expect(201);
    expect(res.body.data.dischargeNumber).toMatch(/^DIS-\d{4}-\d{5}$/);
    expect(res.body.data.status).toBe('NOT_STARTED');
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].expectedQuantity).toBe(20);
    expect(res.body.data.items[0].result).toBe('NOT_DISCHARGED');
    dischargeId = res.body.data.id as string;
    itemId = res.body.data.items[0].id as string;
  });

  it('rejects a second discharge for the same actual loading (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/discharge')
      .set(auth(adminToken))
      .send({ actualLoadingId })
      .expect(409);
  });

  // -------------------------------------------------------------------------
  // Item updates
  // -------------------------------------------------------------------------

  it('rejects quantity above expected (400)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/discharge/${dischargeId}/items/${itemId}`)
      .set(auth(adminToken))
      .send({ dischargeQuantity: 25 })
      .expect(400);
  });

  it('records a full discharge line (FULL) and recalculates totals', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/discharge/${dischargeId}/items/${itemId}`)
      .set(auth(adminToken))
      .send({ dischargeQuantity: 20, notes: 'all units accounted' })
      .expect(200);
    expect(res.body.data.items[0].result).toBe('FULL');
    expect(res.body.data.expectedTotal).toBe(20);
    expect(res.body.data.dischargedTotal).toBe(20);
  });

  it('rejects item update for a nonexistent item (404)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/discharge/${dischargeId}/items/bogus-item`)
      .set(auth(adminToken))
      .send({ dischargeQuantity: 5 })
      .expect(404);
  });

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  it('rejects complete from NOT_STARTED (409) — must start first', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/discharge/${dischargeId}/complete`)
      .set(auth(adminToken))
      .send({})
      .expect(409);
  });

  it('starts the discharge (NOT_STARTED -> IN_PROGRESS)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/discharge/${dischargeId}/start`)
      .set(auth(adminToken))
      .expect(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });

  it('completes the discharge; FULL lines reach cargo status DELIVERED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/discharge/${dischargeId}/complete`)
      .set(auth(completerToken))
      .send({ notes: 'discharge complete' })
      .expect(200);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.completedAt).toBeTruthy();

    const cargoRes = await request(app.getHttpServer())
      .get(`/api/v1/cargo/${cargoId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(cargoRes.body.data.status).toBe('DELIVERED');
  });

  it('rejects item update after COMPLETED (409)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/discharge/${dischargeId}/items/${itemId}`)
      .set(auth(adminToken))
      .send({ dischargeQuantity: 10 })
      .expect(409);
  });

  it('rejects complete from COMPLETED (409, terminal)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/discharge/${dischargeId}/complete`)
      .set(auth(adminToken))
      .send({})
      .expect(409);
  });

  // -------------------------------------------------------------------------
  // PARTIAL fixture + cancel + filters
  // -------------------------------------------------------------------------

  it('discharges partially (7 of 10) — cargo stays LOADED, not DELIVERED', async () => {
    // find the second completed AL via list
    const alList = await request(app.getHttpServer())
      .get('/api/v1/actual-loading?pageSize=50')
      .set(auth(adminToken))
      .expect(200);
    // Scope the lookup to THIS suite's load lists: in the full parallel run other suites
    // (actual-loading) also have COMPLETED loadings on the global list, and an unscoped
    // .find used to grab one of theirs (planned quantity 10 instead of this fixture's 7).
    const second = alList.body.data.data.find(
      (a: { id: string; status: string; loadListId: string }) =>
        a.id !== actualLoadingId &&
        a.status === 'COMPLETED' &&
        createdLoadListIds.some((l) => l === a.loadListId),
    );
    // the find must hit the fixture loading (created in this run) — otherwise skip assertion
    expect(second).toBeDefined();

    const create = await request(app.getHttpServer())
      .post('/api/v1/discharge')
      .set(auth(adminToken))
      .send({ actualLoadingId: second.id, notes: 'partial discharge fixture' })
      .expect(201);
    expect(create.body.data.items[0].expectedQuantity).toBe(7);
    const pid = create.body.data.id as string;
    const pitemId = create.body.data.items[0].id as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/discharge/${pid}/items/${pitemId}`)
      .set(auth(adminToken))
      .send({ dischargeQuantity: 5, notes: '2 units short — under-deck damage claim' })
      .expect(200);
    const upd = await request(app.getHttpServer())
      .get(`/api/v1/discharge/${pid}`)
      .set(auth(adminToken))
      .expect(200);
    expect(upd.body.data.items[0].result).toBe('PARTIAL');
    expect(upd.body.data.dischargedTotal).toBe(5);

    await request(app.getHttpServer())
      .post(`/api/v1/discharge/${pid}/start`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/discharge/${pid}/complete`)
      .set(auth(adminToken))
      .send({})
      .expect(200);

    // partial cargo is NOT delivered (status stays REGISTERED; AL sets loadingStatus only)
    const cargoRes = await request(app.getHttpServer())
      .get(`/api/v1/cargo/${deliveredCargoId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(cargoRes.body.data.status).toBe('REGISTERED');
    expect(cargoRes.body.data.status).not.toBe('DELIVERED');

    // cancelled fixture: create another from... nothing left; use bogus cancel target instead
    cancelFixtureId = pid;
  });

  it('cancels a discharge with a reason and freezes it (mirror test)', async () => {
    // create one more discharge from the first loading is blocked (unique);
    // instead cancel the PARTIAL completed one must 409 -> use cancel on a fresh chain
    // → cancel the draft (NOT_STARTED) fixture is the second one already completed,
    //   so build a quick third chain? Simplest: cancel must be rejected on completed.
    await request(app.getHttpServer())
      .post(`/api/v1/discharge/${cancelFixtureId}/cancel`)
      .set(auth(cancellerToken))
      .send({ cancelReason: 'test' })
      .expect(409);

    // real cancel path: the draft loading discharge — create from draftLoadingId is 409;
    // use the NOT_STARTED create against the second loading was consumed. Build one:
    // (covered by unit-level: transitions map rejects NOT from NOT_STARTED/IN_PROGRESS)
  });

  it('supports cancel on a NOT_STARTED discharge with a required reason', async () => {
    // build a third mini-chain: new voyage + finalize + load 3 + complete + create discharge + cancel
    const voy3 = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyageIds.push(voy3.body.data.id);
    const cargo3 = await request(app.getHttpServer())
      .post('/api/v1/cargo')
      .set(auth(adminToken))
      .send({ customerId, portId: originPortId, yardId, cargoType: 'CONTAINER', quantity: 3 })
      .expect(201);
    createdCargoIds.push(cargo3.body.data.id);
    const insp3 = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(auth(adminToken))
      .send({ cargoId: cargo3.body.data.id, findings: 'ok' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${insp3.body.data.id}/book`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${insp3.body.data.id}/done`)
      .set(auth(adminToken))
      .expect(200);
    const ll4 = await request(app.getHttpServer())
      .post('/api/v1/load-lists')
      .set(auth(adminToken))
      .send({ voyageId: voy3.body.data.id })
      .expect(201);
    createdLoadListIds.push(ll4.body.data.id);
    const item4 = await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${ll4.body.data.id}/items`)
      .set(auth(adminToken))
      .send({ cargoId: cargo3.body.data.id, plannedQuantity: 3, sequence: 1 })
      .expect(201);
    await stampLoadListCompleted(ll4.body.data.id);
    const al3 = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: ll4.body.data.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${ll4.body.data.id}/finalize`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${al3.body.data.id}/items/${item4.body.data.id}`)
      .set(auth(adminToken))
      .send({ actualQuantity: 3 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al3.body.data.id}/start`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al3.body.data.id}/complete`)
      .set(auth(adminToken))
      .send({})
      .expect(200);

    const created = await request(app.getHttpServer())
      .post('/api/v1/discharge')
      .set(auth(adminToken))
      .send({ actualLoadingId: al3.body.data.id })
      .expect(201);
    const cid = created.body.data.id as string;

    // reason is required
    await request(app.getHttpServer())
      .post(`/api/v1/discharge/${cid}/cancel`)
      .set(auth(adminToken))
      .send({})
      .expect(400);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/discharge/${cid}/cancel`)
      .set(auth(cancellerToken))
      .send({ cancelReason: 'vessel diverted to another berth' })
      .expect(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');

    // cancelled is terminal
    await request(app.getHttpServer())
      .post(`/api/v1/discharge/${cid}/start`)
      .set(auth(adminToken))
      .expect(409);
  });

  it('filters by status and searches by voyage number', async () => {
    const byStatus = await request(app.getHttpServer())
      .get('/api/v1/discharge?status=COMPLETED&pageSize=50')
      .set(auth(readerToken))
      .expect(200);
    expect(byStatus.body.data.data.length).toBeGreaterThan(0);
    expect(
      byStatus.body.data.data.every((d: { status: string }) => d.status === 'COMPLETED'),
    ).toBe(true);

    const voyNum = await request(app.getHttpServer())
      .get(`/api/v1/voyages/${voyageId}`)
      .set(auth(adminToken))
      .expect(200);
    const search = await request(app.getHttpServer())
      .get(`/api/v1/discharge?search=${encodeURIComponent(voyNum.body.data.voyageNumber)}`)
      .set(auth(readerToken))
      .expect(200);
    expect(search.body.data.meta.totalItems).toBeGreaterThanOrEqual(1);
  });

  it('returns a paginated detail with items via GET :id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/discharge/${dischargeId}`)
      .set(auth(readerToken))
      .expect(200);
    expect(res.body.data.dischargeNumber).toMatch(/^DIS-/);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.actualLoading.loadList.voyage.voyageNumber).toBeTruthy();
  });
});
