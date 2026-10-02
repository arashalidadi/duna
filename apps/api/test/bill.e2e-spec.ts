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
 * Lifecycle under test:
 *   DRAFT -> ISSUED | CANCELLED ; DRAFT -> CANCELLED ; ISSUED -> CANCELLED
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

  let adminToken = '';
  let fixtureShipperId = ''; // Phase 2 cutover: Shipper-master ref (was Customer)
  let readerToken = ''; // bill:read only
  let writerToken = ''; // read + create + update
  let issuerToken = ''; // read + issue
  let cancellerToken = ''; // read + cancel
  let noReadToken = ''; // no bill permission

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
  let manifestItemId1 = ''; // line for cargo1
  let manifestItemId2 = ''; // line for cargo2

  let bill1Id = ''; // main flow: item -> issue -> cancel
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
            ],
          },
        },
      });
      await prisma.role.deleteMany({
        where: {
          code: {
            in: [`BLREAD_${tag}`, `BLWRITE_${tag}`, `BLISS_${tag}`, `BLCANC_${tag}`, `BLNOREAD_${tag}`],
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

  it('create + get + list as admin; BOL-YYMM-##### number, DRAFT, snapshot from manifest', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bills')
      .set(auth(writerToken))
      .send({ manifestId, billType: 'HOUSE', freightTerms: 'PREPAID', notes: 'Phase 10 init' })
      .expect(201);
    const created = res.body.data;
    expect(created.status).toBe('DRAFT');
    expect(created.billNumber).toMatch(/^BOL-\d{4}-\d{5}$/);
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

  it('issue requires bill:issue (403 for writer) and >=1 item (400 on empty); DRAFT->ISSUED stamps blNumber and locks editing', async () => {
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
    expect(issued.status).toBe('ISSUED');
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

  it('cancel requires bill:cancel + reason; ISSUED->CANCELLED releases the line and clears blNumber', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${bill1Id}/cancel`)
      .set(auth(cancellerToken))
      .send({ cancelReason: '' })
      .expect(400);

    const canc = await request(app.getHttpServer())
      .post(`/api/v1/bills/${bill1Id}/cancel`)
      .set(auth(cancellerToken))
      .send({ cancelReason: 'wrong consignee' })
      .expect(200);
    expect(canc.body.data.status).toBe('CANCELLED');
    expect(canc.body.data.cancelReason).toBe('wrong consignee');

    // blNumber cleared on the manifest line
    const mf = await request(app.getHttpServer())
      .get(`/api/v1/manifests/${manifestId}`)
      .set(auth(adminToken))
      .expect(200);
    const line = mf.body.data.items.find((i: { id: string }) => i.id === manifestItemId1);
    expect(line.blNumber).toBeNull();

    // line is eligible again (cancelled bill releases it)
    const el = await request(app.getHttpServer())
      .get(`/api/v1/bills/eligible-items?manifestId=${manifestId}`)
      .set(auth(readerToken))
      .expect(200);
    expect((el.body.data as Array<{ id: string }>).some((r) => r.id === manifestItemId1)).toBe(true);

    // terminal: cancel again -> 409; delete cancelled -> 409
    await request(app.getHttpServer())
      .post(`/api/v1/bills/${bill1Id}/cancel`)
      .set(auth(adminToken))
      .send({ cancelReason: 'again' })
      .expect(409);
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
    expect(cancelled.body.data.data.some((b: { id: string }) => b.id === bill1Id)).toBe(true);

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
});
