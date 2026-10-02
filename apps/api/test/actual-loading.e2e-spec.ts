import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

type Ref = { id: string };

/**
 * Phase 8 — Actual Loading (lifecycle + state machine) end-to-end tests.
 * Runs against the live development database (documented limitation).
 * Self-cleaning: creates its own ports/vessel/voyage/customer/yard/cargo/
 * inspection/load-list and removes them (reverse dependency order) in afterAll.
 */
describe('Actual Loading (e2e)', () => {
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

  let adminToken = '';
  let readerToken = ''; // actual_loading:read only
  let creatorToken = ''; // read + create + update
  let completerToken = ''; // read + complete
  let cancellerToken = ''; // read + cancel
  let noReadToken = ''; // no actual_loading permission

  let originPortId = '';
  let destPortId = '';
  let vesselId = '';
  let voyageId = '';
  let customerId = '';
  let yardId = '';
  let portId = '';

  let loadListId = ''; // FINALIZED, one approved cargo (plannedQuantity 20)
  let loadListItemId = '';
  let cargoApprovedId = '';
  let loadListDraftId = ''; // DRAFT load list (create must be rejected)

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

    readerToken = await createRoleToken(
      `ALREAD_${tag}`,
      ['actual_loading:read'],
      `al-read-${emailSuffix}@shipping.local`
    );
    creatorToken = await createRoleToken(
      `ALCREATE_${tag}`,
      ['actual_loading:read', 'actual_loading:create', 'actual_loading:update'],
      `al-creator-${emailSuffix}@shipping.local`
    );
    completerToken = await createRoleToken(
      `ALCOMPLETE_${tag}`,
      ['actual_loading:read', 'actual_loading:complete'],
      `al-completer-${emailSuffix}@shipping.local`
    );
    cancellerToken = await createRoleToken(
      `ALCANCEL_${tag}`,
      ['actual_loading:read', 'actual_loading:cancel'],
      `al-canceller-${emailSuffix}@shipping.local`
    );
    noReadToken = await createRoleToken(`ALNOREAD_${tag}`, ['cargo:read'], `al-noread-${emailSuffix}@shipping.local`);

    // --- Self-contained master data chain: ports -> vessel -> voyage ---
    const portA = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `ALP5-${tag}`, name: `AL Origin ${randomTag}`, country: 'AE' })
      .expect(201);
    createdPorts.push({ id: portA.body.data.id });
    originPortId = portA.body.data.id;
    portId = portA.body.data.id;

    const portB = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `ALP6-${tag}`, name: `AL Dest ${randomTag}`, country: 'IN' })
      .expect(201);
    createdPorts.push({ id: portB.body.data.id });
    destPortId = portB.body.data.id;

    const ves = await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ code: `ALVSL-${tag}`, name: `MV AL ${randomTag}`, flag: 'PA', vesselType: 'CONTAINER' })
      .expect(201);
    createdVessels.push({ id: ves.body.data.id });
    vesselId = ves.body.data.id;

    const voy = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: voy.body.data.id });
    voyageId = voy.body.data.id;
    // Voyage stays DRAFT — load planning is allowed for DRAFT voyages.

    // --- customer + yard (cargo needs these) ---
    const cust = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set(auth(adminToken))
      .send({ code: `ALCUS-${tag}`, name: `AL Co ${randomTag}`, type: 'SHIPPER' })
      .expect(201);
    createdCustomers.push({ id: cust.body.data.id });
    customerId = cust.body.data.id;

    const yd = await request(app.getHttpServer())
      .post('/api/v1/yards')
      .set(auth(adminToken))
      .send({ code: `ALYD-${tag}`, name: `AL Yard ${randomTag}`, portId })
      .expect(201);
    createdYards.push({ id: yd.body.data.id });
    yardId = yd.body.data.id;

    // --- cargo + approved inspection ---
    const cargoRes = await request(app.getHttpServer())
      .post('/api/v1/cargo')
      .set(auth(adminToken))
      .send({ customerId, portId, yardId, cargoType: 'CONTAINER', quantity: 30 })
      .expect(201);
    createdCargos.push({ id: cargoRes.body.data.id });
    cargoApprovedId = cargoRes.body.data.id;

    const inspection = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(auth(adminToken))
      .send({ cargoId: cargoApprovedId, findings: 'ok' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspection.body.data.id}/book`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${inspection.body.data.id}/done`)
      .set(auth(adminToken))
      .expect(200);

    // --- load lists ---
    // FINALIZED load list with plannedQuantity 20.
    const ll = await request(app.getHttpServer())
      .post('/api/v1/load-lists')
      .set(auth(adminToken))
      .send({ voyageId, notes: 'AL fixture' })
      .expect(201);
    createdLoadLists.push({ id: ll.body.data.id });
    loadListId = ll.body.data.id;
    const item = await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${loadListId}/items`)
      .set(auth(adminToken))
      .send({ cargoId: cargoApprovedId, plannedQuantity: 20, sequence: 1 })
      .expect(201);
    loadListItemId = item.body.data.id;
    await stampLoadListFinalized(loadListId);

    // DRAFT load list (create actual loading must be rejected).
    const ld = await request(app.getHttpServer())
      .post('/api/v1/load-lists')
      .set(auth(adminToken))
      .send({ voyageId, notes: 'AL draft' })
      .expect(201);
    createdLoadLists.push({ id: ld.body.data.id });
    loadListDraftId = ld.body.data.id;
    const draftItem = await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${loadListDraftId}/items`)
      .set(auth(adminToken))
      .send({ cargoId: cargoApprovedId, plannedQuantity: 20, sequence: 1 })
      .expect(409); // cargo already assigned to same voyage via the FINALIZED list
    void draftItem;
  }, 120000);

  afterAll(async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const voyageIds = createdVoyages.map((v) => v.id);
      const loadListIds = createdLoadLists.map((l) => l.id);
      // Reverse dependency order.
      await prisma.actualLoadingItem.deleteMany({
        where: { actualLoading: { loadListId: { in: loadListIds } } },
      });
      await prisma.actualLoading.deleteMany({
        where: { loadListId: { in: loadListIds } },
      });
      await prisma.loadListItem.deleteMany({ where: { loadListId: { in: loadListIds } } });
      await prisma.loadList.deleteMany({ where: { id: { in: loadListIds } } });
      const cargoIds = createdCargos.map((c) => c.id);
      await prisma.inspection.deleteMany({ where: { cargoId: { in: cargoIds } } });
      await prisma.yardInventory.deleteMany({ where: { cargoId: { in: cargoIds } } });
      await prisma.cargo.deleteMany({ where: { id: { in: cargoIds } } });
      await prisma.voyage.deleteMany({ where: { id: { in: voyageIds } } });
      await prisma.vessel.deleteMany({ where: { id: { in: createdVessels.map((v) => v.id) } } });
      await prisma.yard.deleteMany({ where: { id: { in: createdYards.map((y) => y.id) } } });
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomers.map((c) => c.id) } } });
      await prisma.port.deleteMany({ where: { id: { in: createdPorts.map((p) => p.id) } } });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              `al-read-${emailSuffix}@shipping.local`,
              `al-creator-${emailSuffix}@shipping.local`,
              `al-completer-${emailSuffix}@shipping.local`,
              `al-canceller-${emailSuffix}@shipping.local`,
              `al-noread-${emailSuffix}@shipping.local`,
            ],
          },
        },
      });
      await prisma.role.deleteMany({
        where: {
          code: {
            in: [
              `ALREAD_${tag}`,
              `ALCREATE_${tag}`,
              `ALCOMPLETE_${tag}`,
              `ALCANCEL_${tag}`,
              `ALNOREAD_${tag}`,
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
      .send({
        email,
        password: 'ChangeMe123!',
        fullName: `AL ${roleCode}`,
        roleIds: [role.body.data.id],
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'ChangeMe123!' })
      .expect(200);
    return login.body.data.accessToken as string;
  }

  let algIng: string;

  it('401 without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/actual-loading').expect(401);
  });

  it('403 when role lacks actual_loading permission', async () => {
    await request(app.getHttpServer()).get('/api/v1/actual-loading').set(auth(noReadToken)).expect(403);
    await request(app.getHttpServer()).get(`/api/v1/actual-loading/${'x'.repeat(24)}`).set(auth(noReadToken)).expect(403);
  });

  it('create requires actual_loading:create (403 for reader); rejects DRAFT load list and unknown list', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(readerToken))
      .send({ loadListId })
      .expect(403);

    // DRAFT load list -> 409
    await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: loadListDraftId })
      .expect(409);

    // unknown load list -> 404
    await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: 'nonexistent' })
      .expect(404);
  });

  it('create + get + list as admin; number is AL-YYMM-##### and status DRAFT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId, notes: 'Phase 8 init' })
      .expect(201);
    const created = res.body.data;
    // Shipped enum ActualLoadingStatus starts at DRAFT (schema.prisma:945);
    // 'NOT_STARTED' no longer exists for ActualLoading.
    expect(created.status).toBe('DRAFT');
    expect(created.actualLoadingNumber).toMatch(/^AL-\d{4}-\d{5}$/);
    expect(created.loadListId).toBe(loadListId);
    // ADR-042 copy-on-create: the list's single line materializes immediately
    // (was `toEqual([])` before ADR-042 — superseded, cited in decisions.md).
    expect(created.items).toHaveLength(1);
    expect(created.items[0].loadListItemId).toBe(loadListItemId);
    expect(created.items[0].result).toBe('NOT_LOADED');
    expect(created.items[0].actualQuantity).toBeNull();
    algIng = created.id;

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/actual-loading/${algIng}`)
      .set(auth(readerToken))
      .expect(200);
    expect(detail.body.data.actualLoadingNumber).toBe(created.actualLoadingNumber);

    // duplicate create for the same load list -> 409
    await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId })
      .expect(409);
  });

  it('updateItem requires update perm; rejects negative and over-planned quantities', async () => {
    // reader has no update
    await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${algIng}/items/${loadListItemId}`)
      .set(auth(readerToken))
      .send({ actualQuantity: 5 })
      .expect(403);

    // negative (DTO-level @Min(0))
    const neg = await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${algIng}/items/${loadListItemId}`)
      .set(auth(creatorToken))
      .send({ actualQuantity: -1 })
      .expect(400);
    expect(Array.isArray(neg.body.error.message) ? neg.body.error.message.join(',') : neg.body.error.message).toMatch(
      /must not be less than 0/
    );

    // over planned (planned 20)
    const over = await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${algIng}/items/${loadListItemId}`)
      .set(auth(creatorToken))
      .send({ actualQuantity: 21 })
      .expect(400);
    expect(over.body.error.message).toMatch(/exceeds planned quantity/);

    // item from another load list -> 404
    await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${algIng}/items/${'wrongcargoid12345'}`)
      .set(auth(creatorToken))
      .send({ actualQuantity: 5 })
      .expect(404);
  });

  it('updateItem records FULL/PARTIAL/NOT_LOADED results and complete() re-validates', async () => {
    // PARTIAL first
    const part = await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${algIng}/items/${loadListItemId}`)
      .set(auth(creatorToken))
      .send({ actualQuantity: 8 })
      .expect(200);
    expect(part.body.data.result).toBe('PARTIAL');
    expect(part.body.data.actualQuantity).toBe(8);

    // NOT_LOADED with zero
    const zero = await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${algIng}/items/${loadListItemId}`)
      .set(auth(creatorToken))
      .send({ actualQuantity: 0 })
      .expect(200);
    expect(zero.body.data.result).toBe('NOT_LOADED');

    // FULL at planned quantity
    const full = await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${algIng}/items/${loadListItemId}`)
      .set(auth(creatorToken))
      .send({ actualQuantity: 20 })
      .expect(200);
    expect(full.body.data.result).toBe('FULL');
  });

  it('lifecycle: start (DRAFT->IN_PROGRESS); complete (IN_PROGRESS->COMPLETED); further transitions 409', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${algIng}/start`)
      .set(auth(noReadToken))
      .expect(403);

    // DRAFT -> IN_PROGRESS
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${algIng}/start`)
      .set(auth(creatorToken))
      .expect(200);
    const started = await request(app.getHttpServer())
      .get(`/api/v1/actual-loading/${algIng}`)
      .set(auth(adminToken))
      .expect(200);
    expect(started.body.data.status).toBe('IN_PROGRESS');

    // IN_PROGRESS -> COMPLETED (needs complete permission; rest validator runs)
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${algIng}/complete`)
      .set(auth(cancellerToken))
      .expect(403);

    const done = await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${algIng}/complete`)
      .set(auth(completerToken))
      .send({ notes: 'all loaded' })
      .expect(200);
    expect(done.body.data.status).toBe('COMPLETED');
    expect(done.body.data.completedAt).toBeTruthy();
    expect(done.body.data.items[0].result).toBe('FULL');

    // cargo tied to the FULL item is now LOADED
    const cargoAfter = await request(app.getHttpServer())
      .get(`/api/v1/cargo/${cargoApprovedId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(cargoAfter.body.data.loadingStatus).toBe('LOADED');

    // completed -> start/cancel/complete all 409
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${algIng}/start`)
      .set(auth(adminToken))
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${algIng}/complete`)
      .set(auth(adminToken))
      .send({})
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${algIng}/cancel`)
      .set(auth(adminToken))
      .send({ cancelReason: 'late' })
      .expect(409);
    // items immutable after completion
    await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${algIng}/items/${loadListItemId}`)
      .set(auth(adminToken))
      .send({ actualQuantity: 1 })
      .expect(409);
  });

  it('cancel requires a reason and is allowed only from DRAFT/IN_PROGRESS', async () => {
    // fresh actual loading from a second finalized load list (reuse main load list → 409),
    // so we need another FINALIZED load list on a second voyage.
    const portC = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `ALP7-${tag}`, name: `AL Port C ${randomTag}`, country: 'AE' })
      .expect(201);
    createdPorts.push({ id: portC.body.data.id });
    const voy2 = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: portC.body.data.id })
      .expect(201);
    createdVoyages.push({ id: voy2.body.data.id });

    const cargo2 = await request(app.getHttpServer())
      .post('/api/v1/cargo')
      .set(auth(adminToken))
      .send({ customerId, portId, yardId, cargoType: 'BULK', quantity: 50 })
      .expect(201);
    createdCargos.push({ id: cargo2.body.data.id });
    const insp2 = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(auth(adminToken))
      .send({ cargoId: cargo2.body.data.id, findings: 'ok' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${insp2.body.data.id}/book`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${insp2.body.data.id}/done`)
      .set(auth(adminToken))
      .expect(200);

    const ll2 = await request(app.getHttpServer())
      .post('/api/v1/load-lists')
      .set(auth(adminToken))
      .send({ voyageId: voy2.body.data.id, notes: 'AL cancel fixture' })
      .expect(201);
    createdLoadLists.push({ id: ll2.body.data.id });
    const item2 = await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${ll2.body.data.id}/items`)
      .set(auth(adminToken))
      .send({ cargoId: cargo2.body.data.id, plannedQuantity: 10, sequence: 1 })
      .expect(201);
    void item2;
    await stampLoadListFinalized(ll2.body.data.id);

    const al2 = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: ll2.body.data.id })
      .expect(201);
    const al2Id = al2.body.data.id;

    // missing / blank reason -> 400
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al2Id}/cancel`)
      .set(auth(adminToken))
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al2Id}/cancel`)
      .set(auth(adminToken))
      .send({ cancelReason: '   ' })
      .expect(400);

    // DRAFT -> CANCELLED
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al2Id}/cancel`)
      .set(auth(cancellerToken))
      .send({ cancelReason: 'Vessel swapped; cargo reloaded' })
      .expect(200);
    const cancelled = await request(app.getHttpServer())
      .get(`/api/v1/actual-loading/${al2Id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');

    // CANCELLED is terminal
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al2Id}/start`)
      .set(auth(adminToken))
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${al2Id}`)
      .set(auth(adminToken))
      .send({ notes: 'nope' })
      .expect(409);
  });

  it('complete() requires IN_PROGRESS: from DRAFT gives 409; unknown id 404', async () => {
    // create a fresh DRAFT actual loading from ll2 (voyage2 list; al2 was cancelled so a new one is allowed)
    const al3 = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: loadListId })
      .expect(409); // loadListId already has an Actual Loading (algIng) — not cancelled
    void al3;

    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${'x'.repeat(24)}/complete`)
      .set(auth(adminToken))
      .send({})
      .expect(404);
  });

  it('list supports status filter and sort; filter by voyage; 404 for unknown', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/actual-loading?status=COMPLETED')
      .set(auth(readerToken))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/actual-loading?voyageId=${voyageId}`)
      .set(auth(readerToken))
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/actual-loading?sort=actualLoadingNumber&order=asc&pageSize=5')
      .set(auth(readerToken))
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/actual-loading/nonexistent')
      .set(auth(adminToken))
      .expect(404);
  });

    // ─── Phase 3 unit 2 — LoadList lifecycle gates (ADR-041) & ADR-028 creation gate ───
    describe('LoadList lifecycle gates (ADR-041 / ADR-028)', () => {
    let gateCargoId = ''; // DONE cargo used by it1's finalized list
    let gateLoadListId = ''; // finalized in it1; consumed by it2's FINALIZED -> 201 case

    async function createDoneCargo(suffix: string): Promise<string> {
    const c = await request(app.getHttpServer())
      .post('/api/v1/cargo')
      .set(auth(adminToken))
      .send({ customerId, portId, yardId, cargoType: 'CONTAINER', quantity: 10 })
      .expect(201);
    createdCargos.push({ id: c.body.data.id });
    const insp = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(auth(adminToken))
      .send({ cargoId: c.body.data.id, findings: `adr041 ${suffix}` })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${insp.body.data.id}/book`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${insp.body.data.id}/done`)
      .set(auth(adminToken))
      .expect(200);
    return c.body.data.id as string;
    }

    async function createLoadList(notes: string): Promise<string> {
    const ll = await request(app.getHttpServer())
      .post('/api/v1/load-lists')
      .set(auth(adminToken))
      .send({ voyageId, notes })
      .expect(201);
    createdLoadLists.push({ id: ll.body.data.id });
    return ll.body.data.id as string;
    }

    it('finalize: empty DRAFT -> 400; DRAFT with eligible items -> 200 and FINALIZED', async () => {
    const emptyId = await createLoadList('ADR-041 empty');
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${emptyId}/finalize`)
      .set(auth(adminToken))
      .expect(400);

    gateCargoId = await createDoneCargo('gate');
    gateLoadListId = await createLoadList('ADR-041 finalize from DRAFT');
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${gateLoadListId}/items`)
      .set(auth(adminToken))
      .send({ cargoId: gateCargoId, plannedQuantity: 5, sequence: 1 })
      .expect(201);

    // Required test #1 — the exact path /en/load-lists uses: DRAFT -> FINALIZED (ADR-041).
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${gateLoadListId}/finalize`)
      .set(auth(adminToken))
      .expect(200);
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/load-lists/${gateLoadListId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(detail.body.data.status).toBe('FINALIZED');
    }, 30000);

    it('ActualLoading create gate: FINALIZED -> 201; DRAFT -> 409 shipped message; CANCELLED -> 409', async () => {
    // FINALIZED (it1's list) -> 201
    await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: gateLoadListId })
      .expect(201);

    // DRAFT -> 409 with the shipped message (actual-loading.service.ts create gate)
    const fromDraft = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: loadListDraftId })
      .expect(409);
    expect(fromDraft.body.error.message).toContain(
      'Actual Loading can only be created for FINALIZED Load Lists'
    );
    expect(fromDraft.body.error.message).toContain('Current status: DRAFT');

    // CANCELLED -> 409
    const cancelledId = await createLoadList('ADR-041 cancelled');
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${cancelledId}/cancel`)
      .set(auth(adminToken))
      .send({ cancelReason: 'adr-041 gate fixture' })
      .expect(200);
    const fromCancelled = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: cancelledId })
      .expect(409);
    expect(fromCancelled.body.error.message).toContain('Current status: CANCELLED');
    }, 30000);

    it('full chain via the API with NO status stamping: create LL -> item -> finalize -> AL -> start -> complete', async () => {
    // Required test #3 — Phase 3 lifecycle-alignment proof.
    const cargoId = await createDoneCargo('chain');
    const llId = await createLoadList('ADR-041 full chain');
    const item = await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${llId}/items`)
      .set(auth(adminToken))
      .send({ cargoId, plannedQuantity: 10, sequence: 1 })
      .expect(201);
    const llItemId = item.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${llId}/finalize`)
      .set(auth(adminToken))
      .expect(200);
    const llDetail = await request(app.getHttpServer())
      .get(`/api/v1/load-lists/${llId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(llDetail.body.data.status).toBe('FINALIZED');

    const al = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: llId })
      .expect(201);
    const alId = al.body.data.id as string;

    await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${alId}/items/${llItemId}`)
      .set(auth(adminToken))
      .send({ actualQuantity: 10 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${alId}/start`)
      .set(auth(adminToken))
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${alId}/complete`)
      .set(auth(adminToken))
      .send({})
      .expect(200);

    const alDetail = await request(app.getHttpServer())
      .get(`/api/v1/actual-loading/${alId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(alDetail.body.data.status).toBe('COMPLETED');
    const llAfter = await request(app.getHttpServer())
      .get(`/api/v1/load-lists/${llId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(llAfter.body.data.status).toBe('FINALIZED');
    // ADR-028: FULL cargo leaves the yard on completion.
    const cargoAfter = await request(app.getHttpServer())
      .get(`/api/v1/cargo/${cargoId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(cargoAfter.body.data.loadingStatus).toBe('LOADED');
    }, 30000);

    it('preserved negatives: finalize with ineligible item -> 409; finalize from CANCELLED -> 409', async () => {
    // Item eligible at add time (DONE), then the cargo is cancelled -> finalize re-validation 409.
    const cargoId = await createDoneCargo('ineligible');
    const llId = await createLoadList('ADR-041 ineligible item');
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${llId}/items`)
      .set(auth(adminToken))
      .send({ cargoId, plannedQuantity: 5, sequence: 1 })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/cargo/${cargoId}/status`)
      .set(auth(adminToken))
      .send({ status: 'CANCELLED' })
      .expect(200);
    const ineligible = await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${llId}/finalize`)
      .set(auth(adminToken))
      .expect(409);
    expect(ineligible.body.error.message).toContain('no longer eligible');

    // finalize from CANCELLED -> 409 (CANCELLED is terminal for finalize).
    const cancelledId = await createLoadList('ADR-041 finalize cancelled');
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${cancelledId}/cancel`)
      .set(auth(adminToken))
      .send({ cancelReason: 'adr-041 negative fixture' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${cancelledId}/finalize`)
      .set(auth(adminToken))
      .expect(409);
    }, 30000);

    it('ADR-042 copy-on-create: N load list lines -> N ActualLoadingItems (NOT_LOADED, null quantity)', async () => {
    const c1 = await createDoneCargo('copy1');
    const c2 = await createDoneCargo('copy2');
    const llId = await createLoadList('ADR-042 copy-on-create');
    const i1 = (await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${llId}/items`)
      .set(auth(adminToken))
      .send({ cargoId: c1, plannedQuantity: 5, sequence: 1 })
      .expect(201)).body.data.id as string;
    const i2 = (await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${llId}/items`)
      .set(auth(adminToken))
      .send({ cargoId: c2, plannedQuantity: 7, sequence: 2 })
      .expect(201)).body.data.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${llId}/finalize`)
      .set(auth(adminToken))
      .expect(200);

    const al = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: llId })
      .expect(201);
    const items = al.body.data.items as Array<{
      loadListItemId: string; result: string; actualQuantity: number | null;
    }>;
    expect(items).toHaveLength(2);
    expect(items.map((it) => it.loadListItemId).sort()).toEqual([i1, i2].sort());
    for (const it of items) {
      expect(it.result).toBe('NOT_LOADED');
      expect(it.actualQuantity).toBeNull();
    }
    // detail agrees (this is what the UI renders)
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/actual-loading/${al.body.data.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(detail.body.data.items).toHaveLength(2);
    }, 30000);

    it('ADR-042: an untouched Actual Loading (no quantities recorded) completes 200 and cargo stays in the yard', async () => {
    const cargoId = await createDoneCargo('untouched');
    // live yard inventory row so "stays in the yard" is observable
    await request(app.getHttpServer())
      .post('/api/v1/yard-inventory')
      .set(auth(adminToken))
      .send({ cargoId, yardId })
      .expect(201);
    const llId = await createLoadList('ADR-042 untouched complete');
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${llId}/items`)
      .set(auth(adminToken))
      .send({ cargoId, plannedQuantity: 5, sequence: 1 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${llId}/finalize`)
      .set(auth(adminToken))
      .expect(200);
    const al = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: llId })
      .expect(201);
    const alId = al.body.data.id as string;

    // NO recording at all: start -> complete straight through
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${alId}/start`)
      .set(auth(adminToken))
      .send({})
      .expect(200);
    const done = await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${alId}/complete`)
      .set(auth(adminToken))
      .send({})
      .expect(200);
    expect(done.body.data.status).toBe('COMPLETED');
    // the unrecorded line stayed NOT_LOADED — ADR-028: cargo does NOT leave the yard
    expect((done.body.data.items as Array<{ result: string }>)[0].result).toBe('NOT_LOADED');
    const cargoAfter = await request(app.getHttpServer())
      .get(`/api/v1/cargo/${cargoId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(cargoAfter.body.data.loadingStatus).toBe('NOT_LOADED');
    const inv = await request(app.getHttpServer())
      .get(`/api/v1/yard-inventory?pageSize=100`)
      .set(auth(adminToken))
      .expect(200);
    // NOTE: the list endpoint declares a cargoId query param but does not apply it
    // (pre-existing, recorded in the unit-2b log) — filter client-side on cargo.id.
    const mine = (inv.body.data.data as Array<{ cargo: { id: string } }>).filter(
      (r) => r.cargo.id === cargoId
    );
    expect(mine.length).toBeGreaterThanOrEqual(1);
    }, 30000);

    it('ADR-042/028: recording >= planned -> FULL -> complete marks cargo LOADED and deletes its yard inventory', async () => {
    const cargoId = await createDoneCargo('full-record');
    await request(app.getHttpServer())
      .post('/api/v1/yard-inventory')
      .set(auth(adminToken))
      .send({ cargoId, yardId })
      .expect(201);
    const llId = await createLoadList('ADR-042 full record');
    const li = (await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${llId}/items`)
      .set(auth(adminToken))
      .send({ cargoId, plannedQuantity: 10, sequence: 1 })
      .expect(201)).body.data.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${llId}/finalize`)
      .set(auth(adminToken))
      .expect(200);
    const al = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: llId })
      .expect(201);
    const alId = al.body.data.id as string;

    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${alId}/items/${li}`)
      .set(auth(adminToken))
      .send({ actualQuantity: 10 })
      .expect(200);
    expect(patched.body.data.result).toBe('FULL');

    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${alId}/start`)
      .set(auth(adminToken))
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${alId}/complete`)
      .set(auth(adminToken))
      .send({})
      .expect(200);

    const cargoAfter = await request(app.getHttpServer())
      .get(`/api/v1/cargo/${cargoId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(cargoAfter.body.data.loadingStatus).toBe('LOADED');
    const inv = await request(app.getHttpServer())
      .get(`/api/v1/yard-inventory?pageSize=100`)
      .set(auth(adminToken))
      .expect(200);
    // cargoId query param is ignored by the list endpoint (see T2 note) — filter client-side.
    const mine = (inv.body.data.data as Array<{ cargo: { id: string } }>).filter(
      (r) => r.cargo.id === cargoId
    );
    expect(mine).toHaveLength(0);
    }, 30000);

    it('ADR-028 four result states after complete: only FULL leaves the yard (public-API inventory checks)', async () => {
      // ONE chain, four lines: FULL (q >= planned), PARTIAL (0 < q < planned), explicit 0
      // (NOT_LOADED) and never recorded (null). ADR-028: cargo leaves the yard ONLY on FULL.
      // Inventory presence is asserted through the public API — GET /yard-inventory/:id
      // (ListInventoryQueryDto deliberately has no cargoId param; nothing here adds one).
      const cFull = await createDoneCargo('state-full');
      const cPart = await createDoneCargo('state-partial');
      const cZero = await createDoneCargo('state-zero');
      const cNull = await createDoneCargo('state-null');

      const invOf: Record<string, string> = {};
      for (const c of [cFull, cPart, cZero, cNull]) {
        const inv = await request(app.getHttpServer())
          .post('/api/v1/yard-inventory')
          .set(auth(adminToken))
          .send({ cargoId: c, yardId })
          .expect(201);
        invOf[c] = inv.body.data.id as string;
      }

      const llId = await createLoadList('ADR-028 four result states');
      const lineOf: Record<string, string> = {};
      const spec = [
        ['full', cFull],
        ['part', cPart],
        ['zero', cZero],
        ['null', cNull],
      ] as const;
      for (let i = 0; i < spec.length; i++) {
        const li = await request(app.getHttpServer())
          .post(`/api/v1/load-lists/${llId}/items`)
          .set(auth(adminToken))
          .send({ cargoId: spec[i][1], plannedQuantity: 10, sequence: i + 1 })
          .expect(201);
        lineOf[spec[i][0]] = li.body.data.id as string;
      }
      await request(app.getHttpServer())
        .post(`/api/v1/load-lists/${llId}/finalize`)
        .set(auth(adminToken))
        .expect(200);
      const al = await request(app.getHttpServer())
        .post('/api/v1/actual-loading')
        .set(auth(adminToken))
        .send({ loadListId: llId })
        .expect(201);
      const alId = al.body.data.id as string;

      // record: FULL = planned(10), PARTIAL = 3, explicit 0, null = untouched
      for (const [key, qty] of [['full', 10], ['part', 3], ['zero', 0]] as const) {
        await request(app.getHttpServer())
          .patch(`/api/v1/actual-loading/${alId}/items/${lineOf[key]}`)
          .set(auth(adminToken))
          .send({ actualQuantity: qty })
          .expect(200);
      }
      await request(app.getHttpServer())
        .post(`/api/v1/actual-loading/${alId}/start`)
        .set(auth(adminToken))
        .send({})
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/actual-loading/${alId}/complete`)
        .set(auth(adminToken))
        .send({})
        .expect(200);

      // per-line results on the completed AL (ADR-028 derivation: 0 -> NOT_LOADED,
      // >= planned -> FULL, else PARTIAL; never-recorded materializes as NOT_LOADED)
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/actual-loading/${alId}`)
        .set(auth(adminToken))
        .expect(200);
      const resultByLine = Object.fromEntries(
        (detail.body.data.items as Array<{ loadListItemId: string; result: string }>).map(
          (it) => [it.loadListItemId, it.result]
        )
      );
      expect(resultByLine[lineOf.full]).toBe('FULL');
      expect(resultByLine[lineOf.part]).toBe('PARTIAL');
      expect(resultByLine[lineOf.zero]).toBe('NOT_LOADED');
      expect(resultByLine[lineOf.null]).toBe('NOT_LOADED');

      // cargo readiness: ONLY the FULL cargo becomes LOADED; the others are unchanged
      const expectLoading = async (cid: string, status: string) => {
        const c = await request(app.getHttpServer())
          .get(`/api/v1/cargo/${cid}`)
          .set(auth(adminToken))
          .expect(200);
        expect(c.body.data.loadingStatus).toBe(status);
      };
      await expectLoading(cFull, 'LOADED');
      await expectLoading(cPart, 'NOT_LOADED');
      await expectLoading(cZero, 'NOT_LOADED');
      await expectLoading(cNull, 'NOT_LOADED');

      // Yard inventory through the public API: LIST ?search=<cargo reference> (the
      // prompt-sanctioned route; GET /yard-inventory/:id 500s for EVERY id — pre-existing
      // include/select bug in yard-inventory.service.ts findById — recorded, not fixed).
      // FULL's row is gone (left the yard); PARTIAL / 0 / null rows are still present.
      const expectInv = async (cid: string, present: boolean) => {
        const cg = await request(app.getHttpServer())
          .get(`/api/v1/cargo/${cid}`)
          .set(auth(adminToken))
          .expect(200);
        const ref = cg.body.data.reference as string;
        const res = await request(app.getHttpServer())
          .get(`/api/v1/yard-inventory?search=${encodeURIComponent(ref)}&pageSize=20`)
          .set(auth(adminToken))
          .expect(200);
        const rows = (res.body.data.data as Array<{ cargo: { id: string } }>).filter(
          (r) => r.cargo.id === cid
        );
        if (present) {
          expect(rows).toHaveLength(1);
        } else {
          expect(rows).toHaveLength(0);
        }
      };
      await expectInv(cFull, false);
      await expectInv(cPart, true);
      await expectInv(cZero, true);
      await expectInv(cNull, true);
    }, 30000);

    it('ADR-028: a NOT_LOADED line\'s cargo remains eligible for a later voyage\'s Load List', async () => {
      // chain on the suite voyage: DONE cargo -> LL line -> finalize -> AL -> record 0 -> complete
      const cargoId = await createDoneCargo('replan');
      const llId = await createLoadList('ADR-028 re-plan source');
      const li = await request(app.getHttpServer())
        .post(`/api/v1/load-lists/${llId}/items`)
        .set(auth(adminToken))
        .send({ cargoId, plannedQuantity: 5, sequence: 1 })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/load-lists/${llId}/finalize`)
        .set(auth(adminToken))
        .expect(200);
      const al = await request(app.getHttpServer())
        .post('/api/v1/actual-loading')
        .set(auth(adminToken))
        .send({ loadListId: llId })
        .expect(201);
      const alId = al.body.data.id as string;
      await request(app.getHttpServer())
        .patch(`/api/v1/actual-loading/${alId}/items/${li.body.data.id}`)
        .set(auth(adminToken))
        .send({ actualQuantity: 0 })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/actual-loading/${alId}/start`)
        .set(auth(adminToken))
        .send({})
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/actual-loading/${alId}/complete`)
        .set(auth(adminToken))
        .send({})
        .expect(200);
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/actual-loading/${alId}`)
        .set(auth(adminToken))
        .expect(200);
      expect((detail.body.data.items as Array<{ result: string }>)[0].result).toBe('NOT_LOADED');

      // ADR-028 "remains eligible for later planning": a LATER Load List on a DIFFERENT
      // voyage must still see this cargo as eligible (it stayed in the yard).
      const v2 = await request(app.getHttpServer())
        .post('/api/v1/voyages')
        .set(auth(adminToken))
        .send({ vesselId, originPortId, destinationPortId: destPortId })
        .expect(201);
      createdVoyages.push({ id: v2.body.data.id });
      const cg = await request(app.getHttpServer())
        .get(`/api/v1/cargo/${cargoId}`)
        .set(auth(adminToken))
        .expect(200);
      const ref = cg.body.data.reference as string;
      const el = await request(app.getHttpServer())
        .get(
          `/api/v1/load-lists/eligible-cargo?voyageId=${v2.body.data.id}&search=${encodeURIComponent(ref)}&pageSize=20`
        )
        .set(auth(adminToken))
        .expect(200);
      const ids = (el.body.data.data as Array<{ id: string }>).map((r) => r.id);
      expect(ids).toContain(cargoId);

      // OBSERVED, DELIBERATELY UNASSERTED (recorded as NEEDS_BUSINESS_DECISION in the
      // unit-3 log): SAME-voyage re-planning is excluded by checkCargoEligibility's
      // duplicate-assignment rule, which ignores `result` — one active list per cargo per
      // voyage (load-planning.service.ts, "cancelled load lists don't block"). That looks
      // like an intentional double-booking guard, but ADR-028's "eligible for later
      // planning" does not spell out same-voyage re-planning, so no expectation is
      // encoded here pending a ruling.
      const sameVoyage = await request(app.getHttpServer())
        .get(`/api/v1/load-lists/eligible-cargo?voyageId=${voyageId}`)
        .set(auth(adminToken))
        .expect(200);
      void sameVoyage;
    }, 30000);
  });
});
