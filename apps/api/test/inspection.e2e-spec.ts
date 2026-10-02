import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

type Ref = { id: string };

/**
 * Phase 5 — Inspection end-to-end tests.
 * Runs against the live development database (documented limitation).
 * Self-cleaning: creates its own customer/port/yard/cargo and removes them in
 * afterAll (inspections are cleaned first).
 */
describe('Inspection (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();
  const emailSuffix = randomTag;

  const createdCustomers: Ref[] = [];
  const createdPorts: Ref[] = [];
  const createdYards: Ref[] = [];
  const createdCargos: Ref[] = [];
  const createdVessels: Ref[] = [];
  const createdVoyages: Ref[] = [];
  const createdLoadLists: Ref[] = [];
  let loadPlanningVoyageId = ''; // Part C: one voyage for the load-list acceptance tests

  let adminToken = '';
  let inspectorCreatorToken = ''; // inspection:create + read only
  let inspectionReaderToken = ''; // inspection:read only
  let inspectionApproverToken = ''; // inspection:read + approve
  let inspectionRejecterToken = ''; // inspection:read + reject
  let cargoReaderToken = ''; // cargo:read only — no inspection permissions

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

    // Isolated roles/users to prove each inspection permission is independently
    // gated and that knowing an id is not enough (IDOR).
    inspectionReaderToken = await createReaderToken(
      `INSPREAD_${tag}`,
      ['inspection:read'],
      `ins-reader-${emailSuffix}@shipping.local`
    );
    inspectorCreatorToken = await createReaderToken(
      `INSPCREATE_${tag}`,
      ['inspection:read', 'inspection:create'],
      `ins-creator-${emailSuffix}@shipping.local`
    );
    inspectionApproverToken = await createReaderToken(
      `INSPAPPROVE_${tag}`,
      ['inspection:read', 'inspection:approve'],
      `ins-approver-${emailSuffix}@shipping.local`
    );
    inspectionRejecterToken = await createReaderToken(
      `INSPREJECT_${tag}`,
      ['inspection:read', 'inspection:reject'],
      `ins-rejecter-${emailSuffix}@shipping.local`
    );
    cargoReaderToken = await createReaderToken(
      `INSPNOREAD_${tag}`,
      ['cargo:read'],
      `ins-noread-${emailSuffix}@shipping.local`
    );

    // Self-contained master data for this suite.
    const cust = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set(auth(adminToken))
      .send({ code: `ICUS-${tag}`, name: `Insp Co ${randomTag}`, type: 'SHIPPER' })
      .expect(201);
    createdCustomers.push({ id: cust.body.data.id });

    const port = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `IPT-${tag}`, name: `Insp Port ${randomTag}`, country: 'AE' })
      .expect(201);
    createdPorts.push({ id: port.body.data.id });

    const yd = await request(app.getHttpServer())
      .post('/api/v1/yards')
      .set(auth(adminToken))
      .send({ code: `IYD-${tag}`, name: `Insp Yard ${randomTag}`, portId: port.body.data.id })
      .expect(201);
    createdYards.push({ id: yd.body.data.id });

    // Part C fixtures: one vessel + voyage for the "Inspection Done gates Load List"
    // acceptance tests (load lists require a DRAFT/SCHEDULED voyage).
    // destination needs its own port row: the voyage service counts origin/destination
    // lookups and the same id twice fails its existence check.
    const portB = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `IPT2-${tag}`, name: `Insp Port 2 ${randomTag}`, country: 'AE' })
      .expect(201);
    createdPorts.push({ id: portB.body.data.id });
    const ves = await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ code: `IVES-${tag}`, name: `Insp Vessel ${randomTag}`, flag: 'PA', vesselType: 'CONTAINER' })
      .expect(201);
    createdVessels.push({ id: ves.body.data.id });
    const voy = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ vesselId: ves.body.data.id, originPortId: port.body.data.id, destinationPortId: portB.body.data.id })
      .expect(201);
    createdVoyages.push({ id: voy.body.data.id });
    loadPlanningVoyageId = voy.body.data.id;
  }, 60000);

  afterAll(async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const cargoIds = createdCargos.map((c) => c.id);
      const loadListIds = createdLoadLists.map((l) => l.id);
      await prisma.loadListItem.deleteMany({ where: { loadListId: { in: loadListIds } } });
      await prisma.loadList.deleteMany({ where: { id: { in: loadListIds } } });
      await prisma.voyage.deleteMany({ where: { id: { in: createdVoyages.map((v) => v.id) } } });
      await prisma.vessel.deleteMany({ where: { id: { in: createdVessels.map((v) => v.id) } } });
      await prisma.inspection.deleteMany({ where: { cargoId: { in: cargoIds } } });
      await prisma.yardInventory.deleteMany({ where: { cargoId: { in: cargoIds } } });
      await prisma.cargo.deleteMany({ where: { id: { in: cargoIds } } });
      await prisma.yard.deleteMany({ where: { id: { in: createdYards.map((y) => y.id) } } });
      await prisma.port.deleteMany({ where: { id: { in: createdPorts.map((p) => p.id) } } });
      await prisma.customer.deleteMany({
        where: { id: { in: createdCustomers.map((c) => c.id) } },
      });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              `ins-reader-${emailSuffix}@shipping.local`,
              `ins-creator-${emailSuffix}@shipping.local`,
              `ins-approver-${emailSuffix}@shipping.local`,
              `ins-rejecter-${emailSuffix}@shipping.local`,
              `ins-noread-${emailSuffix}@shipping.local`,
            ],
          },
        },
      });
      await prisma.role.deleteMany({
        where: {
          code: {
            in: [
              `INSPREAD_${tag}`,
              `INSPCREATE_${tag}`,
              `INSPAPPROVE_${tag}`,
              `INSPREJECT_${tag}`,
              `INSPNOREAD_${tag}`,
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

  const cargoBase = () => ({
    customerId: createdCustomers[0].id,
    portId: createdPorts[0].id,
    cargoType: 'GENERAL',
  });

  async function createReaderToken(
    roleCode: string,
    permissionCodes: string[],
    email: string
  ): Promise<string> {
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
      .send({ email, password: 'Phase5!2345', fullName: roleCode, roleIds: [role.body.data.id] })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Phase5!2345' })
      .expect(200);
    return login.body.data.accessToken as string;
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  describe('RBAC & auth boundaries', () => {
    it('unauthenticated GET/POST is 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/inspections').expect(401);
      await request(app.getHttpServer()).post('/api/v1/inspections').send({}).expect(401);
    });

    it('a user without inspection:read gets 403 on list/detail/history', async () => {
      // cargoReader has cargo:read only — no inspection:read.
      await request(app.getHttpServer())
        .get('/api/v1/inspections')
        .set(auth(cargoReaderToken))
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/inspections/no-such')
        .set(auth(cargoReaderToken))
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/inspections/cargo/no-such/history')
        .set(auth(cargoReaderToken))
        .expect(403);
      // An inspection reader (with :read) can list.
      await request(app.getHttpServer())
        .get('/api/v1/inspections')
        .set(auth(inspectionReaderToken))
        .expect(200);
    });

    it('creator can create but not approve/reject; approver/rejecter cannot create', async () => {
      const cargo = await createCargo();
      const created = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(inspectorCreatorToken))
        .send({ cargoId: cargo.id, findings: 'needs approval' })
        .expect(201);
      const insId = created.body.data.id;

      // creator cannot complete (POST /done -> inspection:approve) or fail
      // (POST /fail -> inspection:reject) — shipped permission map (inspection.controller.ts:66,77).
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${insId}/done`)
        .set(auth(inspectorCreatorToken))
        .expect(403);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${insId}/fail`)
        .set(auth(inspectorCreatorToken))
        .send({ rejectionReason: 'x' })
        .expect(403);

      // approver cannot create; but can complete: done() requires BOOKED first
      // (assertTransition, inspection.service.ts:280 — PENDING cannot go straight
      // to DONE), and /book needs inspection:update which the approver lacks, so
      // admin books, then the approver-only token proves /done is gated by
      // inspection:approve alone.
      await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(inspectionApproverToken))
        .send({ cargoId: cargo.id })
        .expect(403);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${insId}/book`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${insId}/done`)
        .set(auth(inspectionApproverToken))
        .expect(200);

      // rejecter cannot create or approve
      await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(inspectionRejecterToken))
        .send({ cargoId: cargo.id })
        .expect(403);
    });

    it('IDOR: a reader cannot PATCH an inspection (403) even knowing its id', async () => {
      const cargo = await createCargo();
      const created = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/inspections/${created.body.data.id}`)
        .set(auth(inspectionReaderToken))
        .send({ findings: 'tampered' })
        .expect(403);
      // And a non-existent id is 404 for an authorized reader.
      await request(app.getHttpServer())
        .get('/api/v1/inspections/no-such-inspection')
        .set(auth(inspectionReaderToken))
        .expect(404);
    });

    it('approve/reject require the dedicated permission (403 for reader)', async () => {
      const cargo = await createCargo();
      const created = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/done`)
        .set(auth(inspectionReaderToken))
        .expect(403);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/fail`)
        .set(auth(inspectionReaderToken))
        .send({ rejectionReason: 'x' })
        .expect(403);
    });
  });

  describe('Create & update', () => {
    it('creates an inspection with auto reference and PENDING status, cargo becomes PENDING', async () => {
      const cargo = await createCargo();
      const res = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({
          cargoId: cargo.id,
          inspectionDate: '2026-09-03T10:00:00.000Z',
          inspectorName: 'A. Inspector',
          findings: 'Chassis and VIN match documents',
        })
        .expect(201);
      const d = res.body.data;
      expect(d.inspectionNumber).toMatch(/^INS-\d{4}-\d{5}$/);
      expect(d.status).toBe('PENDING');
      expect(d.inspectorName).toBe('A. Inspector');
      expect(d.cargo.inspectionStatus).toBe('PENDING');
      expect(d.cargo.reference).toMatch(/^CRG-/);

      const cargoAfter = await request(app.getHttpServer())
        .get(`/api/v1/cargo/${cargo.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(cargoAfter.body.data.inspectionStatus).toBe('PENDING');
    });

    it('rejects an unknown cargo (404)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: 'no-such-cargo' })
        .expect(404);
    });

    it('rejects invalid payload (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: 'x'.repeat(50) })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({})
        .expect(400);
    });

    it('prevents a duplicate pending inspection for the same cargo (409)', async () => {
      const cargo = await createCargo();
      await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(409);
    });

    it('rejects inspecting a cancelled cargo (409)', async () => {
      const cargo = await createCargo();
      await request(app.getHttpServer())
        .patch(`/api/v1/cargo/${cargo.id}/status`)
        .set(auth(adminToken))
        .send({ status: 'CANCELLED' })
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(409);
    });

    it('edits a pending inspection', async () => {
      const cargo = await createCargo();
      const created = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(201);
      const upd = await request(app.getHttpServer())
        .patch(`/api/v1/inspections/${created.body.data.id}`)
        .set(auth(adminToken))
        .send({ findings: 'Updated findings' })
        .expect(200);
      expect(upd.body.data.findings).toBe('Updated findings');
      expect(upd.body.data.status).toBe('PENDING');
    });

    it('cannot edit a finalized inspection (409)', async () => {
      const cargo = await createCargo();
      const created = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(201);
      // Finalize = book then done (done() rejects PENDING: assertTransition).
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/book`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/done`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/v1/inspections/${created.body.data.id}`)
        .set(auth(adminToken))
        .send({ findings: 'nope' })
        .expect(409);
    });
  });

  describe('Book -> Done / Fail workflow', () => {
    it('done() sets cargo.inspectionStatus to DONE (authoritative load-planning gate)', async () => {
      const cargo = await createCargo();
      // Place in a yard so the cargo is AT_YARD, which is a valid READY source state.
      await request(app.getHttpServer())
        .post('/api/v1/yard-inventory')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id, yardId: createdYards[0].id })
        .expect(201);
      const created = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(201);
      // done() sets inspection DONE (terminal success, inspection.service.ts:18-29)
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/book`)
        .set(auth(adminToken))
        .expect(200);
      const doneRes = await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/done`)
        .set(auth(adminToken))
        .expect(200);
      expect(doneRes.body.data.status).toBe('DONE');
      expect(doneRes.body.data.approvedAt).toBeDefined();

      const cargoAfter = await request(app.getHttpServer())
        .get(`/api/v1/cargo/${cargo.id}`)
        .set(auth(adminToken))
        .expect(200);
      // done() writes cargo.inspectionStatus = 'DONE' — the authoritative rule
      // for load-list eligibility (inspection.service.ts:265-296).
      expect(cargoAfter.body.data.inspectionStatus).toBe('DONE');
      // The cargo can now move AT_YARD -> READY_FOR_LOADING: cargo.service.ts:271
      // requires inspectionStatus === 'DONE' (shipped name; 'READY' no longer exists).
      const ready = await request(app.getHttpServer())
        .patch(`/api/v1/cargo/${cargo.id}/status`)
        .set(auth(adminToken))
        .send({ status: 'READY_FOR_LOADING' })
        .expect(200);
      expect(ready.body.data.status).toBe('READY_FOR_LOADING');
    });

    it('rejecting requires a reason (400 without, 200 with) and makes cargo ineligible', async () => {
      const cargo = await createCargo();
      const created = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(201);

      // no reason -> 400 (fail() requires a rejection reason, inspection.service.ts:317)
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/fail`)
        .set(auth(adminToken))
        .send({})
        .expect(400);

      const failed = await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/fail`)
        .set(auth(adminToken))
        .send({ rejectionReason: 'Chassis damage found' })
        .expect(200);
      // Shipped enum: fail() sets inspection FAILED (never 'REJECTED').
      expect(failed.body.data.status).toBe('FAILED');
      expect(failed.body.data.rejectionReason).toBe('Chassis damage found');
      expect(failed.body.data.rejectedAt).toBeDefined();

      const cargoAfter = await request(app.getHttpServer())
        .get(`/api/v1/cargo/${cargo.id}`)
        .set(auth(adminToken))
        .expect(200);
      // fail() also writes cargo.inspectionStatus = 'FAILED' (inspection.service.ts:333).
      expect(cargoAfter.body.data.inspectionStatus).toBe('FAILED');

      // Put it AT_YARD so the AT_YARD -> READY_FOR_LOADING transition is legal and
      // the attempt reaches the inspection gate: cargo.service.ts:271 rejects
      // inspectionStatus !== 'DONE' with a 409.
      await request(app.getHttpServer())
        .post('/api/v1/yard-inventory')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id, yardId: createdYards[0].id })
        .expect(201);
      const notReady = await request(app.getHttpServer())
        .patch(`/api/v1/cargo/${cargo.id}/status`)
        .set(auth(adminToken))
        .send({ status: 'READY_FOR_LOADING' })
        .expect(409);
      expect(notReady.body.error.message).toContain('inspection status is DONE');
    });

    it('double actions are rejected (done after done, fail after done) (409)', async () => {
      const cargo = await createCargo();
      const created = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/book`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/done`)
        .set(auth(adminToken))
        .expect(200);
      // DONE is terminal: done->done is rejected by assertTransition
      // ("Inspection is already DONE", inspection.service.ts:405).
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/done`)
        .set(auth(adminToken))
        .expect(409);
      // DONE -> FAILED is not a shipped transition (inspection.service.ts:18-29).
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/fail`)
        .set(auth(adminToken))
        .send({ rejectionReason: 'x' })
        .expect(409);
    });

    it('a DONE inspection cannot later be failed (state machine) (409)', async () => {
      const cargo = await createCargo();
      const created = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/book`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/done`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/fail`)
        .set(auth(adminToken))
        .send({ rejectionReason: 'x' })
        .expect(409);
    });
  });

  describe('History, list, search, filters', () => {
    it('failed then done shows full history (newest first)', async () => {
      const cargo = await createCargo();
      const one = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id, findings: 'first pass' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${one.body.data.id}/fail`)
        .set(auth(adminToken))
        .send({ rejectionReason: 'needs repair' })
        .expect(200);

      // FAILED allows a fresh inspection (create blocks only an open PENDING one).
      const two = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id, findings: 'repaired' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${two.body.data.id}/book`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${two.body.data.id}/done`)
        .set(auth(adminToken))
        .expect(200);

      // Cargo readiness is DONE after the successful cycle.
      const cargoAfter = await request(app.getHttpServer())
        .get(`/api/v1/cargo/${cargo.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(cargoAfter.body.data.inspectionStatus).toBe('DONE');

      const hist = await request(app.getHttpServer())
        .get(`/api/v1/inspections/cargo/${cargo.id}/history`)
        .set(auth(adminToken))
        .expect(200);
      expect(hist.body.data.length).toBe(2);
      expect(hist.body.data[0].status).toBe('DONE'); // newest first
      expect(hist.body.data[1].status).toBe('FAILED');
    });

    it('lists with pagination meta', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/inspections?page=1&pageSize=25')
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.meta).toMatchObject({
        page: 1,
        pageSize: 25,
        totalItems: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('filters by status and cargoId and searches by cargo reference', async () => {
      const cargo = await createCargo();
      const created = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(201);

      // cargoId filter
      const byCargo = await request(app.getHttpServer())
        .get(`/api/v1/inspections?cargoId=${cargo.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(byCargo.body.data.data.some((i: { id: string }) => i.id === created.body.data.id)).toBe(
        true
      );

      // status filter
      const pending = await request(app.getHttpServer())
        .get('/api/v1/inspections?status=PENDING')
        .set(auth(adminToken))
        .expect(200);
      expect(
        pending.body.data.data.some((i: { id: string }) => i.id === created.body.data.id)
      ).toBe(true);

      // search by cargo reference
      const ref = cargo.reference;
      const bySearch = await request(app.getHttpServer())
        .get(`/api/v1/inspections?search=${ref}`)
        .set(auth(adminToken))
        .expect(200);
      expect(bySearch.body.data.data.some((i: { id: string }) => i.id === created.body.data.id)).toBe(
        true
      );
      expect(bySearch.body.data.data.every((i: { inspectionNumber: string }) =>
        i.inspectionNumber.startsWith('INS-')
      )).toBe(true);
    });

    it('customer and yard filters are supported', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/api/v1/inspections?customerId=${createdCustomers[0].id}&yardId=${createdYards[0].id}`
        )
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data).toBeDefined();
    });

    it('rejects an invalid sort field (400)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/inspections?sort=inspectionNumber;DROP TABLE')
        .set(auth(adminToken))
        .expect(400);
    });
  });

  // ───────── Phase 3 acceptance: Inspection Done gates Load List ─────────
  // Roadmap 09-final §3 acceptance: "Inspection Done gates Load List." The shipped gates are
  // load-planning.service.ts:361-367 (eligible-cargo: only inspectionStatus DONE) and
  // :536-542 (addItem: 409 `has inspection status X; only DONE cargo may be added`).
  describe('Phase 3 acceptance: Inspection Done gates Load List', () => {
    // Fixture-setup stamp kept from the unit-1 pattern, now stamping FINALIZED per ADR-041's
    // 3-state lifecycle. (C6 no longer needs it — ADR-041 ships the DRAFT -> FINALIZED edge —
    // the helper is renamed per the unit-2 instructions and remains for fixture use.)
    async function stampLoadListFinalized(id: string) {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      try {
        await prisma.loadList.update({ where: { id }, data: { status: 'FINALIZED' } });
      } finally {
        await prisma.$disconnect();
      }
    }

    async function eligibleCargoIds(): Promise<string[]> {
      // customerId-scoped so parallel suites' cargo cannot crowd this fixture's rows out of the page
      const res = await request(app.getHttpServer())
        .get(
          `/api/v1/load-lists/eligible-cargo?voyageId=${loadPlanningVoyageId}&customerId=${createdCustomers[0].id}&pageSize=100`
        )
        .set(auth(adminToken))
        .expect(200);
      return (res.body.data.data as { id: string }[]).map((c) => c.id);
    }

    async function createInspectedCargo(suffix: string) {
      const cargo = await createCargo();
      const insp = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id, findings: `gate ${suffix}` })
        .expect(201);
      return { cargo, inspId: insp.body.data.id as string };
    }

    it('C1: PENDING cargo is not eligible and cannot be added to a load list', async () => {
      const { cargo, inspId } = await createInspectedCargo('pending');
      const ll = await request(app.getHttpServer())
        .post('/api/v1/load-lists')
        .set(auth(adminToken))
        .send({ voyageId: loadPlanningVoyageId, notes: 'Part C gating' })
        .expect(201);
      createdLoadLists.push({ id: ll.body.data.id });

      expect(await eligibleCargoIds()).not.toContain(cargo.id);
      const add = await request(app.getHttpServer())
        .post(`/api/v1/load-lists/${ll.body.data.id}/items`)
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(409);
      expect(add.body.error.message).toContain('has inspection status PENDING');
      expect(inspId).toBeTruthy();
    }, 30000);

    it('C2: cargo with a BOOKED inspection is still not eligible and cannot be added', async () => {
      const { cargo, inspId } = await createInspectedCargo('booked');
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${inspId}/book`)
        .set(auth(adminToken))
        .expect(200);

      // Shipped semantics: book() transitions the INSPECTION to BOOKED but does not touch
      // cargo.inspectionStatus — only done()/fail()/needsReInspection() write cargo readiness,
      // so it stays PENDING until an outcome (inspection.service.ts:243-267 vs :265-296,
      // :305-340, :343-370). Prove both fields explicitly.
      const insp = await request(app.getHttpServer())
        .get(`/api/v1/inspections/${inspId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(insp.body.data.status).toBe('BOOKED');
      const cargoMid = await request(app.getHttpServer())
        .get(`/api/v1/cargo/${cargo.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(cargoMid.body.data.inspectionStatus).toBe('PENDING');

      expect(await eligibleCargoIds()).not.toContain(cargo.id);
      const add = await request(app.getHttpServer())
        .post(`/api/v1/load-lists/${createdLoadLists[0].id}/items`)
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(409);
      expect(add.body.error.message).toContain('has inspection status PENDING');
    }, 30000);

    it('C3: after /book + /done the cargo is DONE (source of truth), eligible and addable', async () => {
      const { cargo, inspId } = await createInspectedCargo('done');
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${inspId}/book`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${inspId}/done`)
        .set(auth(adminToken))
        .expect(200);

      // eligibility source of truth: cargo.inspectionStatus === 'DONE' (inspection.service.ts:265-296)
      const cargoAfter = await request(app.getHttpServer())
        .get(`/api/v1/cargo/${cargo.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(cargoAfter.body.data.inspectionStatus).toBe('DONE');

      expect(await eligibleCargoIds()).toContain(cargo.id);
      await request(app.getHttpServer())
        .post(`/api/v1/load-lists/${createdLoadLists[0].id}/items`)
        .set(auth(adminToken))
        .send({ cargoId: cargo.id, plannedQuantity: 5 })
        .expect(201);
    }, 30000);

    it('C4: FAILED cargo is not eligible and cannot be added', async () => {
      const { cargo, inspId } = await createInspectedCargo('failed');
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${inspId}/fail`)
        .set(auth(adminToken))
        .send({ rejectionReason: 'gate test failure' })
        .expect(200);

      expect(await eligibleCargoIds()).not.toContain(cargo.id);
      const add = await request(app.getHttpServer())
        .post(`/api/v1/load-lists/${createdLoadLists[0].id}/items`)
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(409);
      expect(add.body.error.message).toContain('has inspection status FAILED');
    }, 30000);

    it('C5: cargo whose inspection is NEEDS_REINSPECTION is not eligible', async () => {
      const { cargo, inspId } = await createInspectedCargo('reinspect');
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${inspId}/fail`)
        .set(auth(adminToken))
        .send({ rejectionReason: 'needs another pass' })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${inspId}/needs-re-inspection`)
        .set(auth(adminToken))
        .expect(200);
      // shipped rule: the inspection is NEEDS_REINSPECTION while cargo readiness resets to
      // PENDING (inspection.service.ts:364-368) — still not DONE, therefore still gated.
      const inspAfter = await request(app.getHttpServer())
        .get(`/api/v1/inspections/${inspId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(inspAfter.body.data.status).toBe('NEEDS_REINSPECTION');

      expect(await eligibleCargoIds()).not.toContain(cargo.id);
      const add = await request(app.getHttpServer())
        .post(`/api/v1/load-lists/${createdLoadLists[0].id}/items`)
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(409);
      expect(add.body.error.message).toContain('has inspection status PENDING');
    }, 30000);

    it('C6: finalize follows ADR-041 (empty DRAFT -> 400; DRAFT + items -> 200 FINALIZED)', async () => {
      const ll = await request(app.getHttpServer())
        .post('/api/v1/load-lists')
        .set(auth(adminToken))
        .send({ voyageId: loadPlanningVoyageId, notes: 'Part C finalize transitions' })
        .expect(201);
      createdLoadLists.push({ id: ll.body.data.id });

      // Emptiness rule still applies from DRAFT (transition now legal, so the 400 fires):
      // "Cannot finalize an empty Load List" (load-planning.service.ts finalize()).
      await request(app.getHttpServer())
        .post(`/api/v1/load-lists/${ll.body.data.id}/finalize`)
        .set(auth(adminToken))
        .expect(400);

      // One eligible (DONE) item, then finalize straight from DRAFT.
      const { cargo, inspId } = await createInspectedCargo('finalize');
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${inspId}/book`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${inspId}/done`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/load-lists/${ll.body.data.id}/items`)
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(201);

      // ADR-041: DRAFT -> FINALIZED is the shipped edge. This assertion was pinned to 409 by
      // unit 1 (pre-ADR-041 backend) and is REWRITTEN here under the decision-maker's explicit
      // authorization — supersession recorded in ADR-041 and the unit-2 log mapping table.
      await request(app.getHttpServer())
        .post(`/api/v1/load-lists/${ll.body.data.id}/finalize`)
        .set(auth(adminToken))
        .expect(200);
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/load-lists/${ll.body.data.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(detail.body.data.status).toBe('FINALIZED');
    }, 30000);
  });

  // Helpers
  async function createCargo() {
    const res = await request(app.getHttpServer())
      .post('/api/v1/cargo')
      .set(auth(adminToken))
      .send({ ...cargoBase(), cargoType: 'GENERAL', vin: randomTag })
      .expect(201);
    createdCargos.push({ id: res.body.data.id });
    return { id: res.body.data.id, reference: res.body.data.reference };
  }
});