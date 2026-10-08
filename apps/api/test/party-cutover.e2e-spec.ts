import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaClient } from '@prisma/client';

/**
 * Phase 2 — B/L/Manifest party reference cutover e2e (party-cutover-plan.md §5).
 * Covers the NEW master-based wiring end to end:
 *  - manifest create with master refs -> 201 + echo of master-sourced parties
 *    (detail + list),
 *  - header update echo of master parties (DRAFT),
 *  - unknown master id -> 400 on create and update (shipper/consignee/agent),
 *  - soft-deleted master -> 400 on create and update,
 *  - B/L creation derives shipper/consignee from the manifest's master refs
 *    (201 + detail echo; consignee derivation had no assertion before —
 *    evidence pack §6.3).
 *
 * Own fixtures only (ports/vessel/voyages/masters/manifest/bill), hard cleanup
 * in afterAll. Admin login only — no createRoleToken (that helper is the
 * pre-existing failure root cause of the manifest/bill/delivery suites, so the
 * new tests live in this dedicated suite to keep "no new failures" literal).
 * B/L requires an APPROVED manifest; approval is set directly via Prisma for
 * the fixture — the same direct-Prisma fixture pattern portal.e2e uses
 * (the API submit/approve path needs a completed Actual Loading chain, which
 * is out of scope for this unit).
 */
describe('Party cutover: Manifest/B-L -> master refs (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();

  let adminToken = '';

  let originPortId = '';
  let destPortId = '';
  let vesselId = '';
  let voyageId = ''; // gets the DRAFT manifest (tests 1/2/3/5)
  let freeVoyageId = ''; // stays manifest-free for the 400 attempts

  let shipperId = '';
  let consigneeId = '';
  let agentId = '';
  let deletedShipperId = ''; // soft-deleted fixture master

  let manifestId = '';
  let manifestNumber = '';
  let billId = '';

  const createdPorts: { id: string }[] = [];
  const createdVoyages: { id: string }[] = [];
  const createdVessels: { id: string }[] = [];
  const createdMasters: { id: string; kind: 'shipper' | 'consignee' | 'agent' }[] = [];

  const auth = (token: string) => ({ Authorization: 'Bearer ' + token });
  const S = () => request(app.getHttpServer());

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
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    const login = await S()
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: admin.password })
      .expect(200);
    adminToken = login.body.data.accessToken as string;
    expect(adminToken).toBeDefined();

    // Self-contained master data: two ports + one vessel + two voyages.
    const portA = await S()
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `PCTA-${tag}`, name: `Cutover Port A ${randomTag}`, country: 'AE' })
      .expect(201);
    createdPorts.push({ id: portA.body.data.id });
    originPortId = portA.body.data.id;
    const portB = await S()
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `PCTB-${tag}`, name: `Cutover Port B ${randomTag}`, country: 'IN' })
      .expect(201);
    createdPorts.push({ id: portB.body.data.id });
    destPortId = portB.body.data.id;

    const ves = await S()
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ code: `PCTV-${tag}`, name: `MV Cutover ${randomTag}`, flag: 'PA', vesselType: 'CONTAINER' })
      .expect(201);
    createdVessels.push({ id: ves.body.data.id });
    vesselId = ves.body.data.id;

    for (const key of ['voyageId', 'freeVoyageId'] as const) {
      const voy = await S()
        .post('/api/v1/voyages')
        .set(auth(adminToken))
        .send({ vesselId, originPortId, destinationPortId: destPortId })
        .expect(201);
      createdVoyages.push({ id: voy.body.data.id });
      if (key === 'voyageId') voyageId = voy.body.data.id;
      else freeVoyageId = voy.body.data.id;
    }

    // Party masters via their live endpoints (the same ones the UI now uses).
    const shp = await S()
      .post('/api/v1/shippers')
      .set(auth(adminToken))
      .send({ code: `SPCT-${tag}`, name: `Cutover Shipper ${randomTag}` })
      .expect(201);
    shipperId = shp.body.data.id;
    createdMasters.push({ id: shipperId, kind: 'shipper' });

    const cns = await S()
      .post('/api/v1/consignees')
      .set(auth(adminToken))
      .send({ code: `CSCT-${tag}`, name: `Cutover Consignee ${randomTag}` })
      .expect(201);
    consigneeId = cns.body.data.id;
    createdMasters.push({ id: consigneeId, kind: 'consignee' });

    const agt = await S()
      .post('/api/v1/agents')
      .set(auth(adminToken))
      .send({ code: `AGCT-${tag}`, name: `Cutover Agent ${randomTag}` })
      .expect(201);
    agentId = agt.body.data.id;
    createdMasters.push({ id: agentId, kind: 'agent' });

    // Soft-deleted fixture shipper (rejection test target).
    const delShp = await S()
      .post('/api/v1/shippers')
      .set(auth(adminToken))
      .send({ code: `SPDX-${tag}`, name: `Cutover Deleted Shipper ${randomTag}` })
      .expect(201);
    deletedShipperId = delShp.body.data.id;
    createdMasters.push({ id: deletedShipperId, kind: 'shipper' });
    const fx = new PrismaClient();
    try {
      await fx.shipper.update({
        where: { id: deletedShipperId },
        data: { deletedAt: new Date() },
      });
    } finally {
      await fx.$disconnect();
    }
  }, 60000);

  afterAll(async () => {
    try {
      const prisma = new PrismaClient();
      await prisma.billOfLading.deleteMany({ where: { id: billId } });
      await prisma.manifest.deleteMany({ where: { id: manifestId } });
      await prisma.voyage.deleteMany({ where: { id: { in: createdVoyages.map((v) => v.id) } } });
      await prisma.vessel.deleteMany({ where: { id: { in: createdVessels.map((v) => v.id) } } });
      // follow-up (g): this suite's B/L creates allocate a per-destination BILL
      // sequence on its own fixture ports — sweep by EXACT scope ids (in: [] on an
      // empty list matches nothing, so it can never collapse into a wildcard)
      await prisma.numberingSequence.deleteMany({
        where: { documentType: 'BILL', scopeValue: { in: createdPorts.map((p) => p.id) } },
      });
      // P5-U4: this suite's POST /manifests allocates a per-destination MANIFEST
      // sequence (U4-introduced; the old generator never wrote NumberingSequence) —
      // sweep by EXACT scope ids. Not a bill/voyage sweep; those stay untouched.
      await prisma.numberingSequence.deleteMany({
        where: { documentType: 'MANIFEST', scopeValue: { in: createdPorts.map((p) => p.id) } },
      });
      await prisma.port.deleteMany({ where: { id: { in: createdPorts.map((p) => p.id) } } });
      await prisma.shipper.deleteMany({
        where: { id: { in: createdMasters.filter((m) => m.kind === 'shipper').map((m) => m.id) } },
      });
      await prisma.consignee.deleteMany({
        where: { id: { in: createdMasters.filter((m) => m.kind === 'consignee').map((m) => m.id) } },
      });
      await prisma.agent.deleteMany({
        where: { id: { in: createdMasters.filter((m) => m.kind === 'agent').map((m) => m.id) } },
      });
      await prisma.$disconnect();
    } catch {
      /* best-effort cleanup */
    }
    await app.close();
  });

  it('creates a manifest with master refs and echoes master-sourced parties (201, detail + list)', async () => {
    const res = await S()
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({
        voyageId,
        shipperId,
        consigneeId,
        agentId,
        notifyParty: 'Cutover Notify',
      })
      .expect(201);
    const created = res.body.data;
    manifestId = created.id;
    manifestNumber = created.manifestNumber;
    expect(created.shipperId).toBe(shipperId);
    expect(created.consigneeId).toBe(consigneeId);
    expect(created.agentId).toBe(agentId);
    expect(created.notifyParty).toBe('Cutover Notify');
    // Master-sourced objects echo id/code/name (no shortName on masters).
    expect(created.shipper).toMatchObject({ id: shipperId, code: `SPCT-${tag}` });
    expect(created.consignee).toMatchObject({ id: consigneeId, code: `CSCT-${tag}` });
    expect(created.agent).toMatchObject({ id: agentId, code: `AGCT-${tag}` });

    // List view carries the same master-sourced parties.
    const list = await S()
      .get(`/api/v1/manifests?search=${manifestNumber}`)
      .set(auth(adminToken))
      .expect(200);
    // List responses are double-wrapped: body.data = { data, meta }.
    const rows = list.body.data.data as { id: string; shipper?: { id: string; name: string } }[];
    const row = rows.find((r) => r.id === manifestId);
    expect(row).toBeDefined();
    expect(row!.shipper).toMatchObject({ id: shipperId, name: `Cutover Shipper ${randomTag}` });
  });

  it('updates header parties to masters and echoes them (DRAFT)', async () => {
    const res = await S()
      .patch(`/api/v1/manifests/${manifestId}`)
      .set(auth(adminToken))
      .send({ shipperId, consigneeId, agentId })
      .expect(200);
    expect(res.body.data.shipperId).toBe(shipperId);
    expect(res.body.data.consigneeId).toBe(consigneeId);
    expect(res.body.data.agentId).toBe(agentId);
    expect(res.body.data.shipper).toMatchObject({ id: shipperId });
    expect(res.body.data.consignee).toMatchObject({ id: consigneeId });
    expect(res.body.data.agent).toMatchObject({ id: agentId });
  });

  it('rejects unknown master ids with 400 (create + update, all three fields)', async () => {
    const createRes = await S()
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: freeVoyageId, shipperId: 'no-such-master-xyz' })
      .expect(400);
    expect(String(createRes.body.error?.message ?? '')).toContain('no live Shipper');

    const consRes = await S()
      .patch(`/api/v1/manifests/${manifestId}`)
      .set(auth(adminToken))
      .send({ consigneeId: 'nope-xyz' })
      .expect(400);
    expect(String(consRes.body.error?.message ?? '')).toContain('no live Consignee');

    const agtRes = await S()
      .patch(`/api/v1/manifests/${manifestId}`)
      .set(auth(adminToken))
      .send({ agentId: 'nope-xyz' })
      .expect(400);
    expect(String(agtRes.body.error?.message ?? '')).toContain('no live Agent');
  });

  it('rejects a soft-deleted master id with 400 (create + update)', async () => {
    const createRes = await S()
      .post('/api/v1/manifests')
      .set(auth(adminToken))
      .send({ voyageId: freeVoyageId, shipperId: deletedShipperId })
      .expect(400);
    expect(String(createRes.body.error?.message ?? '')).toContain('no live Shipper');

    const updRes = await S()
      .patch(`/api/v1/manifests/${manifestId}`)
      .set(auth(adminToken))
      .send({ shipperId: deletedShipperId })
      .expect(400);
    expect(String(updRes.body.error?.message ?? '')).toContain('no live Shipper');
  });

  it('B/L derives shipper/consignee from the manifest master refs (201 + detail echo)', async () => {
    // Fixture approval: same direct-Prisma pattern portal.e2e uses (documented
    // in the log) — the API path needs a completed Actual Loading chain.
    const fx = new PrismaClient();
    try {
      await fx.manifest.update({
        where: { id: manifestId },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });
    } finally {
      await fx.$disconnect();
    }

    const res = await S()
      .post('/api/v1/bills')
      .set(auth(adminToken))
      .send({ manifestId, billType: 'HOUSE' })
      .expect(201);
    const created = res.body.data;
    billId = created.id;
    expect(created.shipperId).toBe(shipperId);
    expect(created.consigneeId).toBe(consigneeId);
    expect(created.notifyParty).toBe('Cutover Notify');

    const detail = await S()
      .get(`/api/v1/bills/${billId}`)
      .set(auth(adminToken))
      .expect(200);
    expect(detail.body.data.shipper).toMatchObject({ id: shipperId, code: `SPCT-${tag}` });
    expect(detail.body.data.consignee).toMatchObject({ id: consigneeId, code: `CSCT-${tag}` });
  });
});
