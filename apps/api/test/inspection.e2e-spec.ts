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
  }, 60000);

  afterAll(async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const cargoIds = createdCargos.map((c) => c.id);
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

      // creator cannot approve/reject
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${insId}/approve`)
        .set(auth(inspectorCreatorToken))
        .expect(403);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${insId}/reject`)
        .set(auth(inspectorCreatorToken))
        .send({ rejectionReason: 'x' })
        .expect(403);

      // approver cannot create; but can approve (approver has :read + :approve)
      await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(inspectionApproverToken))
        .send({ cargoId: cargo.id })
        .expect(403);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${insId}/approve`)
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
        .post(`/api/v1/inspections/${created.body.data.id}/approve`)
        .set(auth(inspectionReaderToken))
        .expect(403);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/reject`)
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
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/approve`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/v1/inspections/${created.body.data.id}`)
        .set(auth(adminToken))
        .send({ findings: 'nope' })
        .expect(409);
    });
  });

  describe('Approve / Reject workflow', () => {
    it('approving sets the cargo inspection-approved (eligible for future load planning)', async () => {
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
      const appr = await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/approve`)
        .set(auth(adminToken))
        .expect(200);
      expect(appr.body.data.status).toBe('APPROVED');
      expect(appr.body.data.approvedAt).toBeDefined();

      const cargoAfter = await request(app.getHttpServer())
        .get(`/api/v1/cargo/${cargo.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(cargoAfter.body.data.inspectionStatus).toBe('APPROVED');
      // The cargo can now be moved to READY (inspection approved + at yard).
      await request(app.getHttpServer())
        .patch(`/api/v1/cargo/${cargo.id}/status`)
        .set(auth(adminToken))
        .send({ status: 'READY' })
        .expect(200);
    });

    it('rejecting requires a reason (400 without, 200 with) and makes cargo ineligible', async () => {
      const cargo = await createCargo();
      const created = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(201);

      // no reason -> 400
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/reject`)
        .set(auth(adminToken))
        .send({})
        .expect(400);

      const rej = await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/reject`)
        .set(auth(adminToken))
        .send({ rejectionReason: 'Chassis damage found' })
        .expect(200);
      expect(rej.body.data.status).toBe('REJECTED');
      expect(rej.body.data.rejectionReason).toBe('Chassis damage found');
      expect(rej.body.data.rejectedAt).toBeDefined();

      const cargoAfter = await request(app.getHttpServer())
        .get(`/api/v1/cargo/${cargo.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(cargoAfter.body.data.inspectionStatus).toBe('REJECTED');

      // Rejected cargo cannot be marked READY (inspection not approved).
      await request(app.getHttpServer())
        .patch(`/api/v1/cargo/${cargo.id}/status`)
        .set(auth(adminToken))
        .send({ status: 'READY' })
        .expect(409);
    });

    it('double actions are rejected (approve after approve, reject after reject) (409)', async () => {
      const cargo = await createCargo();
      const created = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/approve`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/approve`)
        .set(auth(adminToken))
        .expect(409);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/reject`)
        .set(auth(adminToken))
        .send({ rejectionReason: 'x' })
        .expect(409);
    });

    it('an approved inspection cannot later be rejected (state machine) (409)', async () => {
      const cargo = await createCargo();
      const created = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/approve`)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${created.body.data.id}/reject`)
        .set(auth(adminToken))
        .send({ rejectionReason: 'x' })
        .expect(409);
    });
  });

  describe('History, list, search, filters', () => {
    it('rejected then approved shows full history (newest first)', async () => {
      const cargo = await createCargo();
      const one = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id, findings: 'first pass' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${one.body.data.id}/reject`)
        .set(auth(adminToken))
        .send({ rejectionReason: 'needs repair' })
        .expect(200);

      const two = await request(app.getHttpServer())
        .post('/api/v1/inspections')
        .set(auth(adminToken))
        .send({ cargoId: cargo.id, findings: 'repaired' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/inspections/${two.body.data.id}/approve`)
        .set(auth(adminToken))
        .expect(200);

      // Cargo is inspection-approved.
      const cargoAfter = await request(app.getHttpServer())
        .get(`/api/v1/cargo/${cargo.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(cargoAfter.body.data.inspectionStatus).toBe('APPROVED');

      const hist = await request(app.getHttpServer())
        .get(`/api/v1/inspections/cargo/${cargo.id}/history`)
        .set(auth(adminToken))
        .expect(200);
      expect(hist.body.data.length).toBe(2);
      expect(hist.body.data[0].status).toBe('APPROVED'); // newest first
      expect(hist.body.data[1].status).toBe('REJECTED');
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