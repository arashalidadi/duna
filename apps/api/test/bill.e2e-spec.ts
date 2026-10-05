import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

type Ref = { id: string };

/**
 * Phase 10 — Bill of Lading end-to-end tests.
 * Runs against the live development database (documented limitation).
 * Self-cleaning fixture chain: ports -> vessel -> voyage -> customer/yard ->
 * cargo -> inspection -> load list -> actual loading -> manifest (APPROVED),
 * because a Bill of Lading is issued only against an approved manifest.
 *
 * Lifecycle under test (P4-U4, ADR-046 ruling 1):
 *   DRAFT -> FINAL -> APPROVED (the /issue endpoint is the recorded alias walking
 *   both edges); DRAFT|FINAL -> CANCELLED; APPROVED -> RELEASED exists in the table
 *   but is inert (no endpoint until U6) — no transition ever leaves RELEASED.
 * Items may only change while DRAFT; one LIVE (non-cancelled, non-deleted)
 * bill per manifest item; issuing stamps ManifestItem.blNumber, cancelling
 * releases it.
 */
describe('BillOfLading (e2e)', () => {
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
  const createdManifests: Ref[] = [];
  const createdPartyMasters: Ref[] = []; // Phase 2 cutover: fixture master rows
  const createdStandaloneBills: Ref[] = []; // P4-U2: voyage-mode bills (manifestId null)
  const createdSeqNames: string[] = []; // P4-U3: NumberingSequence rows created by tests (id = name)

  let adminToken = '';
  let fixtureShipperId = ''; // Phase 2 cutover: Shipper-master ref (was Customer)
  let readerToken = ''; // bill:read only
  let writerToken = ''; // read + create + update
  let issuerToken = ''; // read + issue
  let cancellerToken = ''; // read + cancel
  let noReadToken = '';
  let releaserToken = ''; // P4-U6: holds the dedicated bill:release permission // no bill permission

  let originPortId = '';
  let destPortId = '';
  let vesselId = '';
  let customerId = '';
  let yardId = '';

  let voyageId = ''; // carries the completed actual loading
  let voyage2Id = ''; // second voyage (foreign-manifest fixture)
  let cargo3Id = ''; // loaded on voyage2 (foreign manifest line)
  let manifest2Id = ''; // APPROVED manifest on voyage2
  let manifest2ItemId = ''; // cargo3 line (belongs to manifest2)
  let cargo1Id = ''; // loaded on the voyage
  let cargo2Id = ''; // loaded too (second manifest line for cancel-release test)
  let manifestId = ''; // APPROVED manifest
  let voyageModeBillId = ''; // P4-U2: voyage-mode bill used by the mode-mismatch test
  let manifestItemId1 = ''; // line for cargo1
  let manifestItemId2 = ''; // line for cargo2

  let bill1Id = '';
  let cancelledBillId = ''; // P4-U4: the FINAL->CANCELLED bill (list-filter assertion) // main flow: item -> issue -> cancel
  let bill2Id = ''; // delete-flow bill
  let bill1ItemId = '';

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

    // Phase 2 cutover (party-cutover-plan.md §3): B/L parties derive from the
    // manifest's master refs — fixture Shipper replaces the old Customer id.
    const { PrismaClient } = require('@prisma/client');
    const partyFx = new PrismaClient();
    try {
      const shp = await partyFx.shipper.create({
        data: { code: `BLSP-${tag}`, name: `Bill Test Shipper ${randomTag}` },
      });
      fixtureShipperId = shp.id;
      createdPartyMasters.push({ id: shp.id });
    } finally {
      await partyFx.$disconnect();
    }

    readerToken = await createRoleToken(`BLREAD_${tag}`, ['bill:read'], `bl-read-${emailSuffix}@shipping.local`);
    writerToken = await createRoleToken(
      `BLWRITE_${tag}`,
      ['bill:read', 'bill:create', 'bill:update'],
      `bl-writer-${emailSuffix}@shipping.local`
    );
    issuerToken = await createRoleToken(
      `BLISS_${tag}`,
      ['bill:read', 'bill:issue'],
      `bl-iss-${emailSuffix}@shipping.local`
    );
    cancellerToken = await createRoleToken(
      `BLCANC_${tag}`,
      ['bill:read', 'bill:cancel'],
      `bl-canc-${emailSuffix}@shipping.local`
    );
    noReadToken = await createRoleToken(`BLNOREAD_${tag}`, ['cargo:read'], `bl-noread-${emailSuffix}@shipping.local`);
    releaserToken = await createRoleToken(
      `BLREL_${tag}`,
      ['bill:read', 'bill:release'], // the dedicated permission (ADR-046 ruling 2)
      `bl-rel-${emailSuffix}@shipping.local`
    );

    // --- master data ---
    const portA = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `BLP1-${tag}`, name: `BL Origin ${randomTag}`, country: 'AE' })
      .expect(201);
    createdPorts.push({ id: portA.body.data.id });
    originPortId = portA.body.data.id;

    const portB = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `BLP2-${tag}`, name: `BL Dest ${randomTag}`, country: 'IN' })
      .expect(201);
    createdPorts.push({ id: portB.body.data.id });
    destPortId = portB.body.data.id;

    const ves = await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ code: `BLVSL-${tag}`, name: `MV BL ${randomTag}`, flag: 'PA', vesselType: 'CONTAINER' })
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

    const cust = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set(auth(adminToken))
      .send({ code: `BLCUS-${tag}`, name: `BL Co ${randomTag}`, type: 'SHIPPER' })
      .expect(201);
    createdCustomers.push({ id: cust.body.data.id });
    customerId = cust.body.data.id;

    const yd = await request(app.getHttpServer())
      .post('/api/v1/yards')
      .set(auth(adminToken))
      .send({ code: `BLYD-${tag}`, name: `BL Yard ${randomTag}`, portId: originPortId })
      .expect(201);
    createdYards.push({ id: yd.body.data.id });
    yardId = yd.body.data.id;

    // --- cargo1 + cargo2: approved inspection -> load list -> actual loading completed ---
    const mkCargo = async (qty: number, pkg: number, weight: string) => {
      const cargo = await request(app.getHttpServer())
        .post('/api/v1/cargo')
        .set(auth(adminToken))
        .send({
          customerId,
          portId: originPortId,
          yardId,
          cargoType: 'CONTAINER',
          quantity: qty,
          weight,
          packages: pkg,
          packageType: 'CARTONS',
        })
        .expect(201);
      createdCargos.push({ id: cargo.body.data.id });
      return cargo.body.data.id as string;
    };
    cargo1Id = await mkCargo(30, 10, '12.5');
    cargo2Id = await mkCargo(8, 4, '3.25');

    // --- voyage2 + cargo3 chain (gives us a REAL foreign manifest line) ---
    const voy2 = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: voy2.body.data.id });
    voyage2Id = voy2.body.data.id;
    cargo3Id = await mkCargo(15, 5, '6.75');
    const insp3 = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(auth(adminToken))
      .send({ cargoId: cargo3Id, findings: 'ok' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${insp3.body.data.id}/book`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/inspections/${insp3.body.data.id}/done`)
      .set(auth(adminToken))
      .expect(200);
    const ll2 = await request(app.getHttpServer())
      .post('/api/v1/load-lists')
      .set(auth(adminToken))
      .send({ voyageId: voyage2Id, notes: 'BL fixture 2' })
      .expect(201);
    createdLoadLists.push({ id: ll2.body.data.id });
    const ll2Item = await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${ll2.body.data.id}/items`)
      .set(auth(adminToken))
      .send({ cargoId: cargo3Id, plannedQuantity: 15, sequence: 1 })
      .expect(201);
    await stampLoadListFinalized(ll2.body.data.id);
    const al2 = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: ll2.body.data.id })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${al2.body.data.id}/items/${ll2Item.body.data.id}`)
      .set(auth(adminToken))
      .send({ actualQuantity: 15 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al2.body.data.id}/start`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al2.body.data.id}/complete`)
      .set(auth(adminToken))
      .expect(200);
    const mf2 = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: voyage2Id })
      .expect(201);
    manifest2Id = mf2.body.data.id;
    createdManifests.push({ id: manifest2Id });
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest2Id}/items`)
      .set(auth(adminToken))
      .send({ cargoId: cargo3Id })
      .expect(201);
    const mf2Detail = await request(app.getHttpServer())
      .get(`/api/v1/manifests/${manifest2Id}`)
      .set(auth(adminToken))
      .expect(200);
    manifest2ItemId = mf2Detail.body.data.items[0].id;
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest2Id}/submit`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifest2Id}/approve`)
      .set(auth(adminToken))
      .expect(200);

    for (const cargoId of [cargo1Id, cargo2Id]) {
      const inspection = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId, findings: 'ok' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${inspection.body.data.id}/book`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${inspection.body.data.id}/done`)
        .set(auth(adminToken))
        .expect(200);
    }

    const ll = await request(app.getHttpServer())
      .post('/api/v1/load-lists')
      .set(auth(adminToken))
      .send({ voyageId, notes: 'BL fixture' })
      .expect(201);
    createdLoadLists.push({ id: ll.body.data.id });
    const llItem1 = await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${ll.body.data.id}/items`)
      .set(auth(adminToken))
      .send({ cargoId: cargo1Id, plannedQuantity: 20, sequence: 1 })
      .expect(201);
    const llItem2 = await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${ll.body.data.id}/items`)
      .set(auth(adminToken))
      .send({ cargoId: cargo2Id, plannedQuantity: 8, sequence: 2 })
      .expect(201);
    await stampLoadListFinalized(ll.body.data.id);

    const al = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: ll.body.data.id })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${al.body.data.id}/items/${llItem1.body.data.id}`)
      .set(auth(adminToken))
      .send({ actualQuantity: 20 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${al.body.data.id}/items/${llItem2.body.data.id}`)
      .set(auth(adminToken))
      .send({ actualQuantity: 8 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al.body.data.id}/start`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al.body.data.id}/complete`)
      .set(auth(adminToken))
      .expect(200);

    // --- manifest: create -> 2 items -> submit -> approve ---
    const mf = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId, shipperId: fixtureShipperId, notes: 'BL fixture manifest' })
      .expect(201);
    manifestId = mf.body.data.id;
    createdManifests.push({ id: manifestId });
    for (const cargoId of [cargo1Id, cargo2Id]) {
      await request(app.getHttpServer())
        .post(`/api/v1/manifests/${manifestId}/items`)
        .set(auth(adminToken))
        .send({ cargoId })
        .expect(201);
    }
    const mfDetail = await request(app.getHttpServer())
      .get(`/api/v1/manifests/${manifestId}`)
      .set(auth(adminToken))
      .expect(200);
    manifestItemId1 = mfDetail.body.data.items.find((i: { cargoId: string }) => i.cargoId === cargo1Id).id;
    manifestItemId2 = mfDetail.body.data.items.find((i: { cargoId: string }) => i.cargoId === cargo2Id).id;
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifestId}/submit`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/manifests/${manifestId}/approve`)
      .set(auth(adminToken))
      .expect(200);
  }, 120000);

  afterAll(async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const voyageIds = createdVoyages.map((v) => v.id);
      const loadListIds = createdLoadLists.map((l) => l.id);
      const manifestIds = createdManifests.map((m) => m.id);
      // Reverse dependency order.
      await prisma.billOfLadingItem.deleteMany({
        where: { billOfLading: { manifestId: { in: manifestIds } } },
      });
      await prisma.billOfLading.deleteMany({ where: { manifestId: { in: manifestIds } } });
      await prisma.manifestItem.deleteMany({ where: { manifestId: { in: manifestIds } } });
      await prisma.manifest.deleteMany({ where: { id: { in: manifestIds } } });
      await prisma.shipper.deleteMany({ where: { id: { in: createdPartyMasters.map((m) => m.id) } } });
      await prisma.consignee.deleteMany({ where: { id: { in: createdPartyMasters.map((m) => m.id) } } });
      // P4-U3: remove test-created numbering sequences (explicit id/name filters only)
      await prisma.numberingSequence.deleteMany({ where: { name: { in: createdSeqNames } } });
      // follow-up (g) second bite: sweep ANY BILL sequence allocated on this suite's
      // fixture ports by exact scope ids (in: [] = no match, never a wildcard)
      await prisma.numberingSequence.deleteMany({
        where: { documentType: 'BILL', scopeValue: { in: createdPorts.map((p) => p.id) } },
      });
      // P4-U2: voyage-mode bills have manifestId null, so the manifestId clause above
      // misses them — delete by id (items first) so no soft/hard litter survives.
      const standaloneIds = createdStandaloneBills.map((b) => b.id);
      await prisma.billOfLadingItem.deleteMany({ where: { billOfLadingId: { in: standaloneIds } } });
      await prisma.billOfLading.deleteMany({ where: { id: { in: standaloneIds } } });
      // P4-U6: remove audit rows this suite wrote for its own fixture bills
      // (explicit id filter only — U2 discipline; append-only binds the application,
      // not test teardown, and these rows would dangle on deleted ids)
      await prisma.auditLog.deleteMany({
        where: { entityType: 'BillOfLading', entityId: { in: standaloneIds } },
      });
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
      await prisma.port.deleteMany({ where: { id: { in: createdPorts.map((p) => p.id) } } });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              `bl-read-${emailSuffix}@shipping.local`,
              `bl-writer-${emailSuffix}@shipping.local`,
              `bl-iss-${emailSuffix}@shipping.local`,
              `bl-canc-${emailSuffix}@shipping.local`,
              `bl-noread-${emailSuffix}@shipping.local`,
              `bl-rel-${emailSuffix}@shipping.local`,
            ],
          },
        },
      });
      await prisma.role.deleteMany({
        where: {
          code: {
            in: [`BLREAD_${tag}`, `BLWRITE_${tag}`, `BLISS_${tag}`, `BLCANC_${tag}`, `BLNOREAD_${tag}`, `BLREL_${tag}`],
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
      .send({ email, password: 'ChangeMe123!', fullName: `BL ${roleCode}`, roleIds: [role.body.data.id] })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'ChangeMe123!' })
      .expect(200);
    return login.body.data.accessToken as string;
  }

  it('401 without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/bills').expect(401);
  });

  it('403 when role lacks bill permission', async () => {
    await request(app.getHttpServer()).get('/api/v1/bills').set(auth(noReadToken)).expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/bills/${'x'.repeat(24)}`)
      .set(auth(noReadToken))
      .expect(403);
  });

  it('create requires bill:create (403 for reader); unknown manifest 404', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(readerToken))
      .send({ manifestId })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ manifestId: 'nonexistent' })
      .expect(404);
  });

  it('create is rejected for a non-APPROVED manifest (409)', async () => {
    const other = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: other.body.data.id });
    const draftManifest = await request(app.getHttpServer())
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: other.body.data.id })
      .expect(201);
    createdManifests.push({ id: draftManifest.body.data.id });

    await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ manifestId: draftManifest.body.data.id })
      .expect(409);
  });

  it('create + get + list as admin; BOL-{DEST}-YYMM-##### per-destination number, DRAFT, snapshot from manifest', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(writerToken))
      .send({ manifestId, billType: 'HOUSE', freightTerms: 'PREPAID', notes: 'Phase 10 init' })
      .expect(201);
    const created = res.body.data;
    expect(created.status).toBe('DRAFT');
    // P4-U3: per-destination format BOL-{DEST}-YYMM-##### (ADR-045 decision 5)
    expect(created.billNumber).toMatch(/^BOL-.+-\d{4}-\d{5}$/);
    expect(created.manifestId).toBe(manifestId);
    expect(created.voyageId).toBe(voyageId);
    expect(created.items).toEqual([]);
    expect(created.vesselName).toBe(`MV BL ${randomTag}`);
    // Parties default from the manifest (shipperId = Shipper MASTER id after the
    // cutover, not a Customer id) — see party-cutover-plan.md §3.
    expect(created.shipperId).toBe(fixtureShipperId);
    expect(created.manifest.manifestNumber).toMatch(/^MAN-/);
    bill1Id = created.id;

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/bills/${bill1Id}`)
      .set(auth(readerToken))
      .expect(200);
    expect(detail.body.data.billNumber).toBe(created.billNumber);

    const list = await request(app.getHttpServer())
      .get(`/api/v1/bills?manifestId=${manifestId}`)
      .set(auth(readerToken))
      .expect(200);
    expect(list.body.data.data.some((b: { id: string }) => b.id === bill1Id)).toBe(true);
  });

  it('eligible-items lists un-billed manifest lines (flat shape)', async () => {
    const el = await request(app.getHttpServer())
      .get(`/api/v1/bills/eligible-items?manifestId=${manifestId}`)
      .set(auth(readerToken))
      .expect(200);
    const rows = el.body.data as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const found = rows.find((r) => r.id === manifestItemId1);
    expect(found).toBeDefined();
    expect(found!.cargoId).toBe(cargo1Id);
    expect(found!.blNumber).toBeNull();
    expect(found!.cargo).toBeDefined();
  });

  it('addItem requires bill:update (403 for reader); foreign manifest item rejected (409); snapshots values', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${bill1Id}/items`)
      .set(auth(readerToken))
      .send({ manifestItemId: manifestItemId1 })
      .expect(403);

    // a manifest item that belongs to ANOTHER manifest -> 409
    const foreign = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bill1Id}/items`)
      .set(auth(writerToken))
      .send({ manifestItemId: manifest2ItemId })
      .expect(409);
    expect(foreign.body.error.message).toMatch(/does not belong/i);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bill1Id}/items`)
      .set(auth(writerToken))
      .send({
        manifestItemId: manifestItemId1,
        goodsDescription: 'Steel pipes',
        marksAndNumbers: 'MK-01',
        volume: '3.5',
      })
      .expect(201);
    const detail = res.body.data;
    expect(detail.items).toHaveLength(1);
    const item = detail.items[0];
    bill1ItemId = item.id;
    expect(item.sequence).toBe(1);
    expect(item.manifestItemId).toBe(manifestItemId1);
    expect(item.goodsDescription).toBe('Steel pipes');
    expect(item.marksAndNumbers).toBe('MK-01');
    // Snapshot defaults taken from the manifest line: weight 12.5, packages 10.
    expect(Number(item.grossWeight)).toBe(12.5);
    expect(item.packages).toBe(10);
    expect(item.packageType).toBe('CARTONS');
    expect(Number(item.volume)).toBe(3.5);
    // Totals recomputed.
    expect(Number(detail.totalGrossWeight)).toBe(12.5);
    expect(detail.totalPackages).toBe(10);
    expect(Number(detail.totalVolume)).toBe(3.5);

    // Same manifest item on a SECOND live bill -> 409 (one live bill per line).
    const bill2 = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(writerToken))
      .send({ manifestId, billType: 'HOUSE' })
      .expect(201);
    bill2Id = bill2.body.data.id;
    const dup = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bill2Id}/items`)
      .set(auth(writerToken))
      .send({ manifestItemId: manifestItemId1 })
      .expect(409);
    expect(dup.body.error.message).toMatch(/already assigned/i);

    // eligible-items now excludes the assigned line (manifestId + billId given)
    const el2 = await request(app.getHttpServer())
      .get(`/api/v1/bills/eligible-items?manifestId=${manifestId}&billId=${bill1Id}`)
      .set(auth(readerToken))
      .expect(200);
    expect((el2.body.data as Array<{ id: string }>).some((r) => r.id === manifestItemId1)).toBe(false);
    // ...and bill2 still sees only manifestItemId2 (item1 is taken by bill1)
    const el3 = await request(app.getHttpServer())
      .get(`/api/v1/bills/eligible-items?manifestId=${manifestId}&billId=${bill2Id}`)
      .set(auth(readerToken))
      .expect(200);
    const el3Ids = (el3.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(el3Ids).not.toContain(manifestItemId1);
    expect(el3Ids).toContain(manifestItemId2);
  });

  it('updateItem edits snapshots; removeItem recomputes totals; unknown item 404', async () => {
    const upd = await request(app.getHttpServer())
      .patch(`/api/v1/bills/${bill1Id}/items/${bill1ItemId}`)
      .set(auth(writerToken))
      .send({ goodsDescription: 'Steel pipes (re-counted)', packages: 9 })
      .expect(200);
    expect(upd.body.data.items[0].goodsDescription).toBe('Steel pipes (re-counted)');
    expect(upd.body.data.items[0].packages).toBe(9);
    expect(upd.body.data.totalPackages).toBe(9);

    await request(app.getHttpServer())
      .patch(`/api/v1/bills/${bill1Id}/items/${'wrongitem123456'}`)
      .set(auth(writerToken))
      .send({ packages: 1 })
      .expect(404);

    const rem = await request(app.getHttpServer())
      .delete(`/api/v1/bills/${bill1Id}/items/${bill1ItemId}`)
      .set(auth(writerToken))
      .expect(200);
    expect(rem.body.data.items).toHaveLength(0);
    expect(Number(rem.body.data.totalGrossWeight)).toBe(0);

    // re-add (this time plain defaults) for the issue flow
    const readd = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bill1Id}/items`)
      .set(auth(writerToken))
      .send({ manifestItemId: manifestItemId1 })
      .expect(201);
    expect(Number(readd.body.data.totalGrossWeight)).toBe(12.5);
    bill1ItemId = readd.body.data.items[0].id;
  });

  it('update (header) works in DRAFT only; string cost coercion; unknown bill 404', async () => {
    const upd = await request(app.getHttpServer())
      .patch(`/api/v1/bills/${bill1Id}`)
      .set(auth(writerToken))
      .send({
        carrierName: 'BL Carrier Ltd',
        placeOfIssue: 'Jebel Ali',
        originals: 3,
        freightAmount: '450.75',
        currencyCode: 'USD',
        notifyParty: 'BL Notify',
      })
      .expect(200);
    expect(upd.body.data.carrierName).toBe('BL Carrier Ltd');
    expect(Number(upd.body.data.freightAmount)).toBe(450.75);
    expect(upd.body.data.originals).toBe(3);
    expect(upd.body.data.placeOfIssue).toBe('Jebel Ali');

    await request(app.getHttpServer())
      .patch(`/api/v1/bills/${'nonexistentbill'}`)
      .set(auth(writerToken))
      .send({ notes: 'x' })
      .expect(404);
  });

  it('issue requires bill:issue (403 for writer) and >=1 item (400 on empty); DRAFT->APPROVED (issue alias) stamps blNumber and locks editing', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${bill1Id}/issue`)
      .set(auth(writerToken))
      .expect(403);

    // bill2 is empty -> cannot issue
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${bill2Id}/issue`)
      .set(auth(issuerToken))
      .expect(400);

    const iss = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bill1Id}/issue`)
      .set(auth(issuerToken))
      .expect(200);
    const issued = iss.body.data;
    const billNumber = issued.billNumber as string;
    expect(issued.status).toBe('APPROVED'); // ADR-046: issued-equivalent state
    expect(issued.issuedAt).toBeTruthy();
    expect(issued.dateOfIssue).toBeTruthy();

    // The manifest line now carries this B/L number.
    const mf = await request(app.getHttpServer())
      .get(`/api/v1/manifests/${manifestId}`)
      .set(auth(adminToken))
      .expect(200);
    const line = mf.body.data.items.find((i: { id: string }) => i.id === manifestItemId1);
    expect(line.blNumber).toBe(billNumber);

    // locked after issue
    await request(app.getHttpServer())
      .patch(`/api/v1/bills/${bill1Id}`)
      .set(auth(adminToken))
      .send({ notes: 'late' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${bill1Id}/items`)
      .set(auth(adminToken))
      .send({ manifestItemId: manifestItemId2 })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${bill1Id}/issue`)
      .set(auth(adminToken))
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/api/v1/bills/${bill1Id}`)
      .set(auth(adminToken))
      .expect(409);
  });

  it('cancel requires bill:cancel + reason; FINAL->CANCELLED releases the line (P4-U4 edge set); APPROVED cannot cancel', async () => {
    // P4-U4 re-point: ADR-046 ruling 1 allows cancellation only from DRAFT|FINAL, so the
    // flow now cancels a fresh finalized bill (bill1 reaches APPROVED and stays there).
    const b4 = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ manifestId })
      .expect(201);
    const b4Id = b4.body.data.id as string;
    expect(b4.body.data.status).toBe('DRAFT');
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${b4Id}/items`)
      .set(auth(adminToken))
      .send({ manifestItemId: manifestItemId2 })
      .expect(201);

    // reason is mandatory from any cancellable source state
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${b4Id}/cancel`)
      .set(auth(cancellerToken))
      .send({ cancelReason: '' })
      .expect(400);

    // DRAFT -> FINAL via the explicit finalize edge (bill:issue permission)
    const fin = await request(app.getHttpServer())
      .post(`/api/v1/bills/${b4Id}/finalize`)
      .set(auth(issuerToken))
      .expect(200);
    expect(fin.body.data.status).toBe('FINAL');

    const canc = await request(app.getHttpServer())
      .post(`/api/v1/bills/${b4Id}/cancel`)
      .set(auth(cancellerToken))
      .send({ cancelReason: 'wrong consignee' })
      .expect(200);
    expect(canc.body.data.status).toBe('CANCELLED');
    expect(canc.body.data.cancelReason).toBe('wrong consignee');

    // line has no stamp (cancel never leaves one — the stamp-clear branch is now
    // unreachable by design: APPROVED bills cannot be cancelled per ADR-046)
    const mf = await request(app.getHttpServer())
      .get(`/api/v1/manifests/${manifestId}`)
      .set(auth(adminToken))
      .expect(200);
    const line = mf.body.data.items.find((i: { id: string }) => i.id === manifestItemId2);
    expect(line.blNumber).toBeNull();

    // line is eligible again (cancelled bill releases its claim)
    const el = await request(app.getHttpServer())
      .get(`/api/v1/bills/eligible-items?manifestId=${manifestId}`)
      .set(auth(readerToken))
      .expect(200);
    expect((el.body.data as Array<{ id: string }>).some((r) => r.id === manifestItemId2)).toBe(true);
    cancelledBillId = b4Id; // consumed by the list-filter test below

    // CANCELLED is terminal: cancel again -> 409
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${cancelledBillId}/cancel`)
      .set(auth(adminToken))
      .send({ cancelReason: 'again' })
      .expect(409);
    // APPROVED (issued-equivalent) is not cancellable under the ADR-046 edge set
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${bill1Id}/cancel`)
      .set(auth(cancellerToken))
      .send({ cancelReason: 'surrender attempt' })
      .expect(409);
    // delete stays DRAFT-only (only DRAFT bills can be deleted)
    await request(app.getHttpServer())
      .delete(`/api/v1/bills/${bill1Id}`)
      .set(auth(adminToken))
      .expect(409);
  });

  it('delete requires bill:delete; soft-deletes a DRAFT bill (404 afterwards, line released)', async () => {
    // writer has create/update but not delete
    await request(app.getHttpServer())
      .delete(`/api/v1/bills/${bill2Id}`)
      .set(auth(writerToken))
      .expect(403);

    const del = await request(app.getHttpServer())
      .delete(`/api/v1/bills/${bill2Id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(del.body.data.deletedAt).toBeTruthy();

    await request(app.getHttpServer())
      .get(`/api/v1/bills/${bill2Id}`)
      .set(auth(adminToken))
      .expect(404);

    // deleted bill is out of the list
    const list = await request(app.getHttpServer())
      .get(`/api/v1/bills?manifestId=${manifestId}`)
      .set(auth(readerToken))
      .expect(200);
    expect(list.body.data.data.some((b: { id: string }) => b.id === bill2Id)).toBe(false);
    bill2Id = ''; // consumed

    // a fresh bill can be created for the same manifest
    const bill3 = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ manifestId, billType: 'MASTER' })
      .expect(201);
    expect(bill3.body.data.status).toBe('DRAFT');
    expect(bill3.body.data.billType).toBe('MASTER');
  });

  it('list filters by status, billType and search', async () => {
    const cancelled = await request(app.getHttpServer())
      .get('/api/v1/bills?status=CANCELLED')
      .set(auth(readerToken))
      .expect(200);
    expect(cancelled.body.data.data.every((b: { status: string }) => b.status === 'CANCELLED')).toBe(true);
    // P4-U4 re-point: bill1 is APPROVED (issue alias) and can no longer cancel — the
    // cancelled-bucket assertion moved to the fresh FINAL->CANCELLED bill, and the
    // issued-equivalent bucket is now asserted directly.
    expect(cancelled.body.data.data.some((b: { id: string }) => b.id === cancelledBillId)).toBe(true);
    const approved = await request(app.getHttpServer())
      .get('/api/v1/bills?status=APPROVED')
      .set(auth(readerToken))
      .expect(200);
    expect(approved.body.data.data.every((b: { status: string }) => b.status === 'APPROVED')).toBe(true);
    expect(approved.body.data.data.some((b: { id: string }) => b.id === bill1Id)).toBe(true);

    const masters = await request(app.getHttpServer())
      .get('/api/v1/bills?billType=MASTER')
      .set(auth(readerToken))
      .expect(200);
    expect(masters.body.data.data.every((b: { billType: string }) => b.billType === 'MASTER')).toBe(true);

    const search = await request(app.getHttpServer())
      .get('/api/v1/bills?search=' + encodeURIComponent('BL Carrier'))
      .set(auth(readerToken))
      .expect(200);
    expect(search.body.data.data.some((b: { id: string }) => b.id === bill1Id)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // P4-U2 — ADR-045 decision 1 (decoupling): roadmap Tests 1-2 — "B/L creation
  // without Manifest dependency" + "Party master usage"; Acceptance 1-2.
  // ---------------------------------------------------------------------------

  // Full actually-loaded chain (cargo -> inspection DONE -> load list -> finalize ->
  // Actual Loading -> record -> complete), mirroring the suite's own cargo3 fixture.
  // `recorded` = the quantity written on the line (0 = explicit NOT_LOADED, excluded
  // by the ADR-042 positive-quantity predicate).
  async function mkLoadedCargoOn(
    voyageForChain: string,
    qty: number,
    recorded: number,
    parties: { shipperId?: string; consigneeId?: string } = {},
  ): Promise<string> {
    const cargo = await request(app.getHttpServer())
      .post('/api/v1/cargo')
      .set(auth(adminToken))
      .send({
        customerId,
        portId: originPortId,
        yardId,
        cargoType: 'CONTAINER',
        quantity: qty,
        weight: '4.5',
        packages: 2,
        packageType: 'CARTONS',
        ...parties,
      })
      .expect(201);
    createdCargos.push({ id: cargo.body.data.id });
    const cid = cargo.body.data.id as string;
    const insp = await request(app.getHttpServer())
      .post('/api/v1/inspections')
      .set(auth(adminToken))
      .send({ cargoId: cid, findings: 'P4U2 chain' })
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
      .send({ voyageId: voyageForChain, notes: 'P4U2 decoupling chain' })
      .expect(201);
    createdLoadLists.push({ id: ll.body.data.id });
    const item = await request(app.getHttpServer())
      .post(`/api/v1/load-lists/${ll.body.data.id}/items`)
      .set(auth(adminToken))
      .send({ cargoId: cid, plannedQuantity: qty, sequence: 1 })
      .expect(201);
    await stampLoadListFinalized(ll.body.data.id);
    const al = await request(app.getHttpServer())
      .post('/api/v1/actual-loading')
      .set(auth(adminToken))
      .send({ loadListId: ll.body.data.id })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/actual-loading/${al.body.data.id}/items/${item.body.data.id}`)
      .set(auth(adminToken))
      .send({ actualQuantity: recorded })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al.body.data.id}/start`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/actual-loading/${al.body.data.id}/complete`)
      .set(auth(adminToken))
      .expect(200);
    return cid;
  }

  it('create WITHOUT a manifest: voyage + cargo lines; parties from masters/derived cargo, never a manifest (roadmap Tests 1-2, Acceptance 1-2)', async () => {
    const cons = await request(app.getHttpServer())
      .post('/api/v1/consignees')
      .set(auth(adminToken))
      .send({ code: `BLCON-${tag}`, name: `BL Test Consignee ${randomTag}` })
      .expect(201);
    createdPartyMasters.push({ id: cons.body.data.id });
    const shp2 = await request(app.getHttpServer())
      .post('/api/v1/shippers')
      .set(auth(adminToken))
      .send({ code: `BLSP2-${tag}`, name: `BL Override Shipper ${randomTag}` })
      .expect(201);
    createdPartyMasters.push({ id: shp2.body.data.id });

    const voy3 = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: voy3.body.data.id });

    const c1 = await mkLoadedCargoOn(voy3.body.data.id, 10, 10, {
      shipperId: fixtureShipperId,
      consigneeId: cons.body.data.id,
    });
    const c2 = await mkLoadedCargoOn(voy3.body.data.id, 5, 5, {
      shipperId: fixtureShipperId,
      consigneeId: cons.body.data.id,
    });

    // --- create with NO manifestId anywhere in the request ---
    const res = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId: voy3.body.data.id, cargoIds: [c1, c2] })
      .expect(201);
    const d = res.body.data;
    expect(d.manifestId).toBeNull(); // no Manifest dependency (Acceptance 1)
    expect(d.voyageId).toBe(voy3.body.data.id); // voyageId self-owned, not via manifest
    expect(d.destinationPortId).toBe(destPortId); // P4-U3 numbering scope key stored
    expect(d.vesselName).toBe(`MV BL ${randomTag}`); // vessel snapshot from the VOYAGE
    // parties derived from the cargo lines' masters — no manifest involved (Acceptance 2)
    expect(d.shipperId).toBe(fixtureShipperId);
    expect(d.consigneeId).toBe(cons.body.data.id);
    expect(d.status).toBe('DRAFT');
    expect(d.billNumber).toMatch(/^BOL-.+-\d{4}-\d{5}$/);
    expect(d.items).toHaveLength(2);
    const itemCargoIds = d.items.map((i: { cargoId: string }) => i.cargoId).sort();
    expect(itemCargoIds).toEqual([c1, c2].sort());
    for (const line of d.items) {
      expect(line.manifestItemId).toBeNull(); // keyed by cargo, not a manifest line
      expect(line.packages).toBe(2); // snapshot defaulted from the cargo
    }
    expect(d.totalPackages).toBe(4);
    createdStandaloneBills.push({ id: d.id });

    // explicit DTO master ids beat derivation (dto first, then cargo lines)
    const c3 = await mkLoadedCargoOn(voy3.body.data.id, 3, 3, {
      shipperId: fixtureShipperId,
      consigneeId: cons.body.data.id,
    });
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({
        voyageId: voy3.body.data.id,
        cargoIds: [c3],
        shipperId: shp2.body.data.id,
        consigneeId: cons.body.data.id,
      })
      .expect(201);
    expect(res2.body.data.shipperId).toBe(shp2.body.data.id); // explicit override wins
    expect(res2.body.data.consigneeId).toBe(cons.body.data.id);
    createdStandaloneBills.push({ id: res2.body.data.id });
  });

  it('voyage-mode eligibility: not-in-loading and zero-quantity rejected, one live bill per cargo, eligible-items = unclaimed positive cargo only (ADR-029/042)', async () => {
    const voy4 = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: destPortId })
      .expect(201);
    createdVoyages.push({ id: voy4.body.data.id });

    // cargo never loaded on any voyage -> rejected
    const w = await request(app.getHttpServer())
      .post('/api/v1/cargo')
      .set(auth(adminToken))
      .send({
        customerId,
        portId: originPortId,
        yardId,
        cargoType: 'CONTAINER',
        quantity: 6,
        weight: '2.5',
        packages: 1,
        packageType: 'CARTONS',
      })
      .expect(201);
    createdCargos.push({ id: w.body.data.id });
    const e1 = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId: voy4.body.data.id, cargoIds: [w.body.data.id] })
      .expect(409);
    expect(e1.body.error.message).toContain('COMPLETED Actual Loading');

    // loaded line recorded as explicit zero -> excluded by actualQuantity > 0
    const y = await mkLoadedCargoOn(voy4.body.data.id, 5, 0);
    const e2 = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId: voy4.body.data.id, cargoIds: [y] })
      .expect(409);
    expect(e2.body.error.message).toContain('COMPLETED Actual Loading');

    const z = await mkLoadedCargoOn(voy4.body.data.id, 7, 7);
    const q = await mkLoadedCargoOn(voy4.body.data.id, 4, 4);
    const b = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId: voy4.body.data.id, cargoIds: [z] })
      .expect(201);
    createdStandaloneBills.push({ id: b.body.data.id });
    voyageModeBillId = b.body.data.id;

    // one live bill per cargo per voyage (application level, ADR-030 rationale retargeted)
    const e3 = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId: voy4.body.data.id, cargoIds: [z] })
      .expect(409);
    expect(e3.body.error.message).toContain('already on live B/L');

    // target picker: only unclaimed, positive-quantity cargo -> exactly Q
    const el = await request(app.getHttpServer())
      .get(`/api/v1/bills/eligible-items?voyageId=${voy4.body.data.id}`)
      .set(auth(adminToken))
      .expect(200);
    const elIds = (el.body.data as Array<{ cargoId: string }>).map((r) => r.cargoId);
    expect(elIds).toContain(q);
    expect(elIds).toHaveLength(1); // W not loaded, Y zero, Z claimed

    // source-mode validation (transition contract A)
    const both = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ manifestId, voyageId: voy4.body.data.id })
      .expect(400);
    expect(both.body.error.message).toContain('not both');
    await request(app.getHttpServer()).post('/api/v1/bills').set(auth(adminToken)).send({}).expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ cargoIds: [q] })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/bills/eligible-items?manifestId=${manifestId}&voyageId=${voy4.body.data.id}`)
      .set(auth(adminToken))
      .expect(400);
    await request(app.getHttpServer()).get('/api/v1/bills/eligible-items').set(auth(adminToken)).expect(400);
  });

  it('addItem source modes are exclusive; both/neither rejected (transition contract A)', async () => {
    // legacy (manifest-linked) bill rejects cargoId
    const legacy = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ manifestId })
      .expect(201);
    const legacyId = legacy.body.data.id as string;
    expect(legacy.body.data.manifestId).toBe(manifestId);
    const m1 = await request(app.getHttpServer())
      .post(`/api/v1/bills/${legacyId}/items`)
      .set(auth(adminToken))
      .send({ cargoId: 'x'.repeat(24) })
      .expect(409);
    expect(m1.body.error.message).toContain('legacy');
    createdStandaloneBills.push({ id: legacyId }); // hard-cleaned by afterAll (also manifest-linked)

    // voyage-mode bill rejects manifestItemId (checked BEFORE loading the id)
    const m2 = await request(app.getHttpServer())
      .post(`/api/v1/bills/${voyageModeBillId}/items`)
      .set(auth(adminToken))
      .send({ manifestItemId: 'x'.repeat(24) })
      .expect(409);
    expect(m2.body.error.message).toContain('no manifest');

    // both / neither
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${voyageModeBillId}/items`)
      .set(auth(adminToken))
      .send({ manifestItemId: 'x'.repeat(24), cargoId: 'y'.repeat(24) })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${voyageModeBillId}/items`)
      .set(auth(adminToken))
      .send({})
      .expect(400);
  });

  // ---------------------------------------------------------------------------
  // P4-U3 — ADR-045 decision 5: per-destination numbering (roadmap Test 3,
  // Acceptance "Numbering is per destination"). Recorded decisions: format
  // BOL-{DEST}-YYMM-#####, {DEST} = Port.abbreviation ?? code, counter scope =
  // per destination per month (sequence name embeds dest id + YYYYMM), rows
  // lazily upserted by NumberingService (no seed/migration), null edge = 400
  // (defensive; inputs guaranteed non-null by NOT NULL source columns).
  // ---------------------------------------------------------------------------

  const yymmNow = () =>
    `${String(new Date().getUTCFullYear() % 100).padStart(2, '0')}${String(
      new Date().getUTCMonth() + 1,
    ).padStart(2, '0')}`;

  async function portSegment(portId: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/ports/${portId}`)
      .set(auth(adminToken))
      .expect(200);
    const p = res.body.data;
    return (p.abbreviation || p.code) as string;
  }

  it('format matches the recorded decision: BOL-{DEST}-YYMM-##### with the destination segment, destination key stored', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId }) // suite voyage, destination = destPortId
      .expect(201);
    const n = res.body.data.billNumber as string;
    createdStandaloneBills.push({ id: res.body.data.id });
    createdSeqNames.push(`bill-${destPortId}-${yymmNow()}`);

    expect(n).toMatch(/^BOL-.+-\d{4}-\d{5}$/);
    const seg = await portSegment(destPortId); // decision (b): abbreviation ?? code
    expect(n).toContain(`BOL-${seg}-`);
    expect(n).toContain(`-${yymmNow()}-`);
    // decision (c): destination scope key always stored on create (null edge inputs are
    // NOT NULL source columns; the defensive 400 branch is unreachable with legal data)
    expect(res.body.data.destinationPortId).toBe(destPortId);
  });

  it('two destinations number independently: a fresh destination starts at 00001', async () => {
    const p3 = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `BLNP3-${tag}`, name: `BL Numbering Dest ${randomTag}`, country: 'IN' })
      .expect(201);
    createdPorts.push({ id: p3.body.data.id });
    const v3 = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId, originPortId, destinationPortId: p3.body.data.id })
      .expect(201);
    createdVoyages.push({ id: v3.body.data.id });
    createdSeqNames.push(`bill-${p3.body.data.id}-${yymmNow()}`);

    const first = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId: v3.body.data.id })
      .expect(201);
    createdStandaloneBills.push({ id: first.body.data.id });
    const seg3 = await portSegment(p3.body.data.id);
    expect(first.body.data.billNumber).toBe(`BOL-${seg3}-${yymmNow()}-00001`); // fresh dest+month

    // a different destination numbers on its own counter (both can hold 00001-style
    // suffixes without colliding — the destination segment keeps @unique intact)
    const other = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId })
      .expect(201);
    createdStandaloneBills.push({ id: other.body.data.id });
    expect(other.body.data.billNumber).not.toBe(first.body.data.billNumber);
    expect(other.body.data.billNumber).not.toContain(`BOL-${seg3}-`);
  });

  it('same destination + same period: strictly increasing distinct numbers', async () => {
    const a = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId })
      .expect(201);
    const b = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId })
      .expect(201);
    createdStandaloneBills.push({ id: a.body.data.id }, { id: b.body.data.id });
    const na = a.body.data.billNumber as string;
    const nb = b.body.data.billNumber as string;
    expect(na).not.toBe(nb);
    expect(na.split('-').slice(0, -1).join('-')).toBe(nb.split('-').slice(0, -1).join('-')); // same dest+period prefix
    const sa = Number(na.slice(-5));
    const sb = Number(nb.slice(-5));
    expect(sb).toBeGreaterThan(sa); // strictly increasing
  });

  it('concurrent creates never collide (regression for the replaced read-then-write race)', async () => {
    const results = await Promise.all(
      [0, 1, 2, 3].map(() =>
        request(app.getHttpServer())
          .post('/api/v1/bills')
          .set(auth(adminToken))
          .send({ voyageId })
          .expect(201)
      ),
    );
    const numbers = results.map((r) => r.body.data.billNumber as string);
    for (const id of results.map((r) => r.body.data.id)) {
      createdStandaloneBills.push({ id });
    }
    expect(new Set(numbers).size).toBe(4); // FOR UPDATE allocation: no duplicates
    for (const n of numbers) {
      expect(n).toMatch(/^BOL-.+-\d{4}-\d{5}$/);
    }
  });

  it('legacy-format numbers are immutable and coexist with the new format under the global unique index', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/bills?pageSize=100')
      .set(auth(adminToken))
      .expect(200);
    const rows = list.body.data.data as Array<{ billNumber: string; destinationPortId: string | null }>;
    const legacy = rows.filter((r) => /^BOL-\d{4}-\d{5}$/.test(r.billNumber));
    const fresh = rows.filter((r) => /^BOL-.+-\d{4}-\d{5}$/.test(r.billNumber));
    expect(legacy.length).toBeGreaterThanOrEqual(1); // the shipped BOL-2609-* bills survive untouched
    expect(fresh.length).toBeGreaterThanOrEqual(1); // new-format numbers minted this suite
    // both formats live in the same table => the @unique index accepted both (no violation)
    // decision (c) evidence: every row carries its destination scope key
    for (const r of rows) {
      expect(r.destinationPortId).not.toBeNull();
    }
    // one more create alongside both formats
    const extra = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId })
      .expect(201);
    createdStandaloneBills.push({ id: extra.body.data.id });
    expect(extra.body.data.billNumber).toMatch(/^BOL-.+-\d{4}-\d{5}$/);
  });

  // ---------------------------------------------------------------------------
  // P4-U4 — lifecycle (roadmap Tests 4 part 1, Acceptance 4 part 1 lifecycle half):
  // backfill, the ADR-046 four-state edge set, the issue alias, and the inert
  // APPROVED -> RELEASED edge (no endpoint until U6: bill:release + AuditLog).
  // ---------------------------------------------------------------------------

  it('backfill: no ISSUED rows remain; the live legacy bills carry APPROVED (ADR-046 ruling 1)', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/bills?pageSize=100')
      .set(auth(adminToken))
      .expect(200);
    const rows = list.body.data.data as Array<{ billNumber: string; status: string }>;
    // the ISSUED -> APPROVED UPDATE ran with the migration and is idempotent
    expect(rows.filter((b) => b.status === 'ISSUED')).toHaveLength(0);
    const byNumber = (n: string) => rows.find((b) => b.billNumber === n);
    // the two shipped legacy-issued bills were backfilled...
    expect(byNumber('BOL-2609-00001')?.status).toBe('APPROVED');
    expect(byNumber('BOL-2609-00002')?.status).toBe('APPROVED');
    // ...while DRAFT is untouched (backfill touches ISSUED only)
    expect(byNumber('BOL-2609-00003')?.status).toBe('DRAFT');
    const statuses = new Set(rows.map((b) => b.status));
    for (const s of statuses) {
      expect(['DRAFT', 'FINAL', 'APPROVED', 'RELEASED', 'CANCELLED']).toContain(s);
    }
  });

  it('lifecycle edge set: finalize DRAFT->FINAL, approve FINAL->APPROVED, alias walks both, invalid edges 409, RELEASED terminal via the gated /release route', async () => {
    // explicit edge: DRAFT -> FINAL (b5 uses the second fixture manifest's free line;
    // approve/issue both require >= 1 line)
    const b5 = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ manifestId: manifest2Id, billType: 'MASTER' })
      .expect(201);
    const b5Id = b5.body.data.id as string;
    expect(b5.body.data.status).toBe('DRAFT');
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${b5Id}/items`)
      .set(auth(adminToken))
      .send({ manifestItemId: manifest2ItemId })
      .expect(201);
    const fin = await request(app.getHttpServer())
      .post(`/api/v1/bills/${b5Id}/finalize`)
      .set(auth(issuerToken)) // bill:issue guard (no new permission codes)
      .expect(200);
    expect(fin.body.data.status).toBe('FINAL');
    // FINAL -> FINAL is not an edge
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${b5Id}/finalize`)
      .set(auth(adminToken))
      .expect(409);

    // invalid edge: DRAFT -> APPROVED direct (approve requires FINAL)
    const b6 = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ manifestId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${b6.body.data.id}/approve`)
      .set(auth(adminToken))
      .expect(409);
    // b6 takes the line the cancelled bill released (issue from FINAL needs >= 1 line)
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${b6.body.data.id}/items`)
      .set(auth(adminToken))
      .send({ manifestItemId: manifestItemId2 })
      .expect(201);

    // explicit edge: FINAL -> APPROVED
    const appr = await request(app.getHttpServer())
      .post(`/api/v1/bills/${b5Id}/approve`)
      .set(auth(issuerToken))
      .expect(200);
    expect(appr.body.data.status).toBe('APPROVED');

    // alias-from-FINAL: issue on a FINAL bill lands APPROVED (single click from either
    // DRAFT or FINAL — the shipped page only ever shows the button on DRAFT/FINAL)
    const fin2 = await request(app.getHttpServer())
      .post(`/api/v1/bills/${b6.body.data.id}/finalize`)
      .set(auth(issuerToken))
      .expect(200);
    expect(fin2.body.data.status).toBe('FINAL');
    const iss = await request(app.getHttpServer())
      .post(`/api/v1/bills/${b6.body.data.id}/issue`)
      .set(auth(issuerToken))
      .expect(200);
    expect(iss.body.data.status).toBe('APPROVED');

    // invalid edges out of APPROVED: APPROVED->FINAL, re-issue, cancel
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${b5Id}/finalize`)
      .set(auth(adminToken))
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${b5Id}/issue`)
      .set(auth(adminToken))
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${b5Id}/cancel`)
      .set(auth(cancellerToken))
      .send({ cancelReason: 'attempt' })
      .expect(409);

    // RELEASED is terminal for every transition (forced via prisma — no endpoint
    // ever writes this state before U6)
    const { PrismaClient } = require('@prisma/client');
    const rxFx = new PrismaClient();
    try {
      await rxFx.billOfLading.update({
        where: { id: b5Id },
        data: { status: 'RELEASED' },
      });
      await request(app.getHttpServer())
        .post(`/api/v1/bills/${b5Id}/issue`)
        .set(auth(adminToken))
        .expect(409);
      await request(app.getHttpServer())
        .post(`/api/v1/bills/${b5Id}/finalize`)
        .set(auth(adminToken))
        .expect(409);
      await request(app.getHttpServer())
        .post(`/api/v1/bills/${b5Id}/approve`)
        .set(auth(adminToken))
        .expect(409);
      await request(app.getHttpServer())
        .post(`/api/v1/bills/${b5Id}/cancel`)
        .set(auth(cancellerToken))
        .send({ cancelReason: 'attempt' })
        .expect(409);
      // P4-U6 RE-POINT of U4's inert-guard assertion: the route now EXISTS, gated by
      // `bill:release` (admin holds it via seed) — RELEASED is still terminal, so the
      // release attempt is 409 from BILL_TRANSITIONS, not 404.
      await request(app.getHttpServer())
        .post(`/api/v1/bills/${b5Id}/release`)
        .set(auth(adminToken))
        .expect(409);
    } finally {
      await rxFx.$disconnect();
    }
  });

  // ---------------------------------------------------------------------------
  // P4-U5 — revisions (roadmap Tests 4 part 2, "Lifecycle and revisions"):
  // DRAFT-only source, 1->2->3 numbering, immutable snapshots, frozen billNumber,
  // list-only history (404 on PUT/DELETE), bill:update gate, restore read-back.
  // ---------------------------------------------------------------------------

  it('revisions: DRAFT-only source, revisionNumbers 1->2->3 (+parallel distinct), note + actor recorded, billNumber frozen, reader 403', async () => {
    createdSeqNames.push(`bill-${destPortId}-${yymmNow()}`); // follow-up (g): push what we allocate
    const b = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId })
      .expect(201);
    const bId = b.body.data.id as string;
    const originalNumber = b.body.data.billNumber as string;
    createdStandaloneBills.push({ id: bId });

    // recorded permission decision: bill:update writes, bill:read reads, no new codes
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/revisions`)
      .set(auth(readerToken))
      .send({ note: 'nope' })
      .expect(403);

    const rev1 = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/revisions`)
      .set(auth(writerToken)) // writer has bill:update — the recorded gate
      .send({ note: 'Customer review round 1' })
      .expect(201);
    expect(rev1.body.data.revisionNumber).toBe(1);
    expect(rev1.body.data.note).toBe('Customer review round 1');
    expect(rev1.body.data.createdById).toBeTruthy();
    expect(rev1.body.data.createdBy.email).toBe(`bl-writer-${emailSuffix}@shipping.local`);

    const rev2 = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/revisions`)
      .set(auth(writerToken))
      .send({ note: 'Customer review round 2' })
      .expect(201);
    expect(rev2.body.data.revisionNumber).toBe(2);
    const rev3 = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/revisions`)
      .set(auth(writerToken))
      .send({})
      .expect(201);
    expect(rev3.body.data.revisionNumber).toBe(3);
    expect(rev3.body.data.note).toBeNull(); // note is optional

    // number stability: the billNumber never changes across revisions (and the
    // @unique index accepted every freeze)
    const mid = await request(app.getHttpServer())
      .get(`/api/v1/bills/${bId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(mid.body.data.billNumber).toBe(originalNumber);
    expect(mid.body.data.revision).toBe(4); // label of the NEXT freeze

    // concurrency (recorded: row lock + @@unique backstop): parallel freezes never
    // collide — distinct, consecutive revision numbers
    const [pa, pb] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/bills/${bId}/revisions`)
        .set(auth(writerToken))
        .send({ note: 'parallel A' }),
      request(app.getHttpServer())
        .post(`/api/v1/bills/${bId}/revisions`)
        .set(auth(writerToken))
        .send({ note: 'parallel B' }),
    ]);
    expect(pa.status).toBe(201);
    expect(pb.status).toBe(201);
    const parallelNums = [pa.body.data.revisionNumber, pb.body.data.revisionNumber].sort(
      (x: number, y: number) => x - y
    );
    expect(parallelNums).toEqual([4, 5]);

    // history is ascending, list-readable with bill:read, and the billNumber is
    // still the original after all five freezes
    const hist = await request(app.getHttpServer())
      .get(`/api/v1/bills/${bId}/revisions`)
      .set(auth(readerToken))
      .expect(200);
    const rows = hist.body.data as Array<{ revisionNumber: number; note: string | null; createdBy: { email: string } }>;
    expect(rows.map((r) => r.revisionNumber)).toEqual([1, 2, 3, 4, 5]);
    // Sequential notes are ordered; the two PARALLEL freezes are serialized by the
    // row lock but WHO wins the race is nondeterministic — the guarantee is two
    // distinct consecutive revisions carrying exactly these notes (asserted as a set),
    // never which request took the lower number.
    expect(rows.slice(0, 3).map((r) => r.note)).toEqual([
      'Customer review round 1',
      'Customer review round 2',
      null,
    ]);
    expect(
      rows
        .slice(3)
        .map((r) => r.note)
        .sort()
    ).toEqual(['parallel A', 'parallel B']);
    for (const r of rows) {
      expect(r.createdBy.email).toBe(`bl-writer-${emailSuffix}@shipping.local`);
    }
    const after = await request(app.getHttpServer())
      .get(`/api/v1/bills/${bId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(after.body.data.billNumber).toBe(originalNumber);
  });

  it('snapshot immutability: live edits after rev 1 never change stored history (byte-for-byte); history is list-only (PUT/DELETE 404)', async () => {
    createdSeqNames.push(`bill-${destPortId}-${yymmNow()}`); // follow-up (g)
    const b = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({
        voyageId,
        carrierName: 'Revision Original Co',
        notes: 'original notes',
        goodsDescription: 'Frozen goods description',
      })
      .expect(201);
    const bId = b.body.data.id as string;
    createdStandaloneBills.push({ id: bId });
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/revisions`)
      .set(auth(adminToken))
      .send({ note: 'v1' })
      .expect(201);

    const readRev1 = async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/bills/${bId}/revisions`)
        .set(auth(adminToken))
        .expect(200);
      return (res.body.data as Array<{ revisionNumber: number; snapshot: unknown }>).find(
        (r) => r.revisionNumber === 1
      )!;
    };
    const before = JSON.stringify((await readRev1()).snapshot);

    // live edits after the freeze
    await request(app.getHttpServer())
      .patch(`/api/v1/bills/${bId}`)
      .set(auth(adminToken))
      .send({
        carrierName: 'Edited After Freeze',
        notes: 'edited notes',
        goodsDescription: 'Edited description',
      })
      .expect(200);

    const afterSnap = await readRev1();
    const after = JSON.stringify(afterSnap.snapshot);
    // byte-for-byte: the stored snapshot is untouched by the live edit...
    expect(after).toBe(before);
    // ...and it still carries the original values while the live document differs
    const snapObj = afterSnap.snapshot as { carrierName: string; notes: string; goodsDescription: string };
    expect(snapObj.carrierName).toBe('Revision Original Co');
    expect(snapObj.notes).toBe('original notes');
    expect(snapObj.goodsDescription).toBe('Frozen goods description');
    const live = await request(app.getHttpServer())
      .get(`/api/v1/bills/${bId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(live.body.data.carrierName).toBe('Edited After Freeze');
    expect(live.body.data.billNumber).toBe(b.body.data.billNumber);

    // list-only history: no PUT/DELETE route exists (404 by construction — decision 4
    // excludes revision editing and deletion outright)
    await request(app.getHttpServer())
      .put(`/api/v1/bills/${bId}/revisions/1`)
      .set(auth(adminToken))
      .send({ note: 'tamper' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/bills/${bId}/revisions/1`)
      .set(auth(adminToken))
      .expect(404);
    // unknown bill -> 404
    await request(app.getHttpServer())
      .get('/api/v1/bills/cmesxxxxxxxxxxxxxxxx/revisions')
      .set(auth(adminToken))
      .expect(404);
  });

  it('every non-DRAFT status is frozen: FINAL/APPROVED/RELEASED/CANCELLED/ISSUED revisions 409; restore also 409', async () => {
    createdSeqNames.push(`bill-${destPortId}-${yymmNow()}`); // follow-up (g)
    const b = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId })
      .expect(201);
    const bId = b.body.data.id as string;
    createdStandaloneBills.push({ id: bId });

    // DRAFT works (control) — no line needed for a freeze
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/revisions`)
      .set(auth(adminToken))
      .send({ note: 'draft control' })
      .expect(201);

    // FINAL
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/finalize`)
      .set(auth(adminToken))
      .expect(200);
    let res = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/revisions`)
      .set(auth(adminToken))
      .send({});
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toContain('DRAFT'); // recorded message

    // CANCELLED (from FINAL — mandatory reason path)
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/cancel`)
      .set(auth(adminToken))
      .send({ cancelReason: 'freeze proof' })
      .expect(200);
    res = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/revisions`)
      .set(auth(adminToken))
      .send({});
    expect(res.status).toBe(409);
    // restore into a non-DRAFT is rejected too (recorded restore decision)
    res = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/revisions/1/restore`)
      .set(auth(adminToken));
    expect(res.status).toBe(409);

    // APPROVED / RELEASED / legacy ISSUED — forced directly (the status gate is the
    // unit under test; every one of these states is unreachable-or-terminal through
    // the API for this bill, exactly as U4 established)
    const { PrismaClient } = require('@prisma/client');
    const fx = new PrismaClient();
    try {
      for (const forced of ['APPROVED', 'RELEASED', 'ISSUED'] as const) {
        await fx.billOfLading.update({ where: { id: bId }, data: { status: forced } });
        const r = await request(app.getHttpServer())
          .post(`/api/v1/bills/${bId}/revisions`)
          .set(auth(adminToken))
          .send({});
        expect(r.status).toBe(409);
        expect(JSON.stringify(r.body)).toContain(forced); // message names the state
      }
    } finally {
      await fx.$disconnect();
    }
  });

  it('restore = read-back into the draft: pre-restore capture keeps the edited state, header + items restored, billNumber never changes, unknown revision 404', async () => {
    createdSeqNames.push(`bill-${destPortId}-${yymmNow()}`); // follow-up (g)
    // two actually-loaded cargos -> a voyage-mode bill with two items (ADR-045/042
    // eligibility, same chain helper the suite already uses)
    const c1 = await mkLoadedCargoOn(voyageId, 9, 9);
    const c2 = await mkLoadedCargoOn(voyageId, 6, 6);
    const b = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId, cargoIds: [c1, c2], carrierName: 'Original Restore Co', notes: 'original note' })
      .expect(201);
    const bId = b.body.data.id as string;
    const originalNumber = b.body.data.billNumber as string;
    createdStandaloneBills.push({ id: bId });
    expect(b.body.data.items).toHaveLength(2);

    const r1 = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/revisions`)
      .set(auth(adminToken))
      .send({ note: 'v1 before corrections' })
      .expect(201);
    expect(r1.body.data.revisionNumber).toBe(1);

    // edit the draft: header change + drop one line
    await request(app.getHttpServer())
      .patch(`/api/v1/bills/${bId}`)
      .set(auth(adminToken))
      .send({ carrierName: 'Edited Restore Co', notes: 'edited note' })
      .expect(200);
    const liveDetail = await request(app.getHttpServer())
      .get(`/api/v1/bills/${bId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(liveDetail.body.data.items).toHaveLength(2);
    const itemId = liveDetail.body.data.items[0].id as string;
    await request(app.getHttpServer())
      .delete(`/api/v1/bills/${bId}/items/${itemId}`)
      .set(auth(adminToken))
      .expect(200);
    const edited = await request(app.getHttpServer())
      .get(`/api/v1/bills/${bId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(edited.body.data.items).toHaveLength(1);
    expect(edited.body.data.carrierName).toBe('Edited Restore Co');

    // restore rev 1 -> read-back into the SAME draft (no new bill, no new path)
    const restored = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/revisions/1/restore`)
      .set(auth(adminToken))
      .expect(200);
    expect(restored.body.data.carrierName).toBe('Original Restore Co');
    expect(restored.body.data.notes).toBe('original note');
    expect(restored.body.data.items).toHaveLength(2);
    expect(restored.body.data.billNumber).toBe(originalNumber); // number frozen
    // totals recomputed from the restored items (server rule, not snapshot copying):
    // item packages come from the cargo facts (mkLoadedCargoOn fixture = 2 each), so
    // the round-trip total equals the original create's total
    expect(restored.body.data.totalPackages).toBe(b.body.data.totalPackages);
    expect(restored.body.data.totalPackages).toBe(4); // 2 + 2
    const restoredCargos = (restored.body.data.items as Array<{ cargoId: string }>)
      .map((i) => i.cargoId)
      .sort();
    expect(restoredCargos).toEqual([c1, c2].sort());

    // history: rev 1 intact + the automatic pre-restore capture keeps the edited
    // state, so nothing was lost
    const hist = await request(app.getHttpServer())
      .get(`/api/v1/bills/${bId}/revisions`)
      .set(auth(adminToken))
      .expect(200);
    const rows = hist.body.data as Array<{
      revisionNumber: number;
      note: string | null;
      snapshot: { carrierName: string; items: unknown[] };
    }>;
    expect(rows.map((r) => r.revisionNumber)).toEqual([1, 2]);
    expect(rows[0].snapshot.carrierName).toBe('Original Restore Co');
    expect(rows[0].snapshot.items).toHaveLength(2);
    expect(rows[1].note).toBe('Pre-restore capture before restoring revision 1');
    expect(rows[1].snapshot.carrierName).toBe('Edited Restore Co');
    expect(rows[1].snapshot.items).toHaveLength(1); // the edited state survived

    // unknown revision -> 404 (after the capture? no: 404 fires BEFORE any capture —
    // a failed restore must not consume a revision number)
    const histLenBefore = rows.length;
    const miss = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/revisions/999/restore`)
      .set(auth(adminToken));
    expect(miss.status).toBe(404);
    const hist2 = await request(app.getHttpServer())
      .get(`/api/v1/bills/${bId}/revisions`)
      .set(auth(adminToken))
      .expect(200);
    expect((hist2.body.data as unknown[]).length).toBe(histLenBefore); // no capture on 404
    // non-integer revision param -> 400
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${bId}/revisions/abc/restore`)
      .set(auth(adminToken))
      .expect(400);
  });

  // ---------------------------------------------------------------------------
  // P4-U6 — release separation (roadmap Test 5): bill:release gate, in-txn
  // AuditLog row, non-APPROVED 409, the two axes stay independent.
  // ---------------------------------------------------------------------------

  it('release axis: bill:release gates APPROVED->RELEASED with an AuditLog row; other sources 409; approval never releases', async () => {
    createdSeqNames.push(`bill-${destPortId}-${yymmNow()}`); // follow-up (g): push what we allocate
    // a bill with a real line so the issue alias can land it APPROVED
    const c = await mkLoadedCargoOn(voyageId, 5, 5);
    const b = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ voyageId, cargoIds: [c] })
      .expect(201);
    const bId = b.body.data.id as string;
    const billNumber = b.body.data.billNumber as string;
    createdStandaloneBills.push({ id: bId });

    const { PrismaClient } = require('@prisma/client');
    const fx = new PrismaClient();
    const countReleaseRows = async (id: string) =>
      fx.auditLog.count({
        where: { entityType: 'BillOfLading', entityId: id, action: 'bill:release' },
      });
    try {
      // approval axis: the issue alias lands APPROVED and writes NO release audit row
      const iss = await request(app.getHttpServer())
        .post(`/api/v1/bills/${bId}/issue`)
        .set(auth(adminToken))
        .expect(200);
      expect(iss.body.data.status).toBe('APPROVED');
      expect(await countReleaseRows(bId)).toBe(0); // approval never releases

      // permission gate: bill:read only -> 403; bill:update (writer) without release -> 403
      await request(app.getHttpServer())
        .post(`/api/v1/bills/${bId}/release`)
        .set(auth(readerToken))
        .expect(403);
      await request(app.getHttpServer())
        .post(`/api/v1/bills/${bId}/release`)
        .set(auth(writerToken))
        .expect(403);
      expect(await countReleaseRows(bId)).toBe(0); // denied calls write nothing

      // the dedicated permission performs APPROVED -> RELEASED (200)
      const rel = await request(app.getHttpServer())
        .post(`/api/v1/bills/${bId}/release`)
        .set(auth(releaserToken))
        .expect(200);
      expect(rel.body.data.status).toBe('RELEASED');
      expect(rel.body.data.billNumber).toBe(billNumber);

      // assert THE AUDIT ROW (ADR-046 ruling 2), not the status alone
      const row = await fx.auditLog.findFirst({
        where: { entityType: 'BillOfLading', entityId: bId, action: 'bill:release' },
      });
      expect(row).not.toBeNull();
      expect(row!.actorEmail).toBe(`bl-rel-${emailSuffix}@shipping.local`);
      expect(row!.actorId).toBeTruthy();
      expect((row!.beforeData as { status: string }).status).toBe('APPROVED');
      expect((row!.afterData as { status: string }).status).toBe('RELEASED');
      expect((row!.metadata as { billNumber: string }).billNumber).toBe(billNumber);
      expect(await countReleaseRows(bId)).toBe(1); // exactly one row

      // non-APPROVED source -> 409 (recorded transition message), nothing audited
      const draft = await request(app.getHttpServer())
        .post('/api/v1/bills')
        .set(auth(adminToken))
        .send({ voyageId })
        .expect(201);
      const dId = draft.body.data.id as string;
      createdStandaloneBills.push({ id: dId });
      const denied = await request(app.getHttpServer())
        .post(`/api/v1/bills/${dId}/release`)
        .set(auth(releaserToken));
      expect(denied.status).toBe(409);
      expect(JSON.stringify(denied.body)).toContain('not allowed'); // recorded message
      expect(await countReleaseRows(dId)).toBe(0);

      // release never re-opens: every lifecycle path on a RELEASED bill 409s
      await request(app.getHttpServer())
        .post(`/api/v1/bills/${bId}/approve`)
        .set(auth(adminToken))
        .expect(409);
      await request(app.getHttpServer())
        .post(`/api/v1/bills/${bId}/finalize`)
        .set(auth(adminToken))
        .expect(409);
      await request(app.getHttpServer())
        .post(`/api/v1/bills/${bId}/issue`)
        .set(auth(adminToken))
        .expect(409);
      await request(app.getHttpServer())
        .post(`/api/v1/bills/${bId}/revisions`)
        .set(auth(adminToken))
        .send({})
        .expect(409);
      expect(await countReleaseRows(bId)).toBe(1); // still exactly one
    } finally {
      await fx.$disconnect();
    }
  });
});





