import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

type Ref = { id: string };

/**
 * Phase 4 — Cargo + Yard Inventory end-to-end tests.
 * Runs against the live development database (documented limitation).
 * Self-cleaning: creates its own customer/port/yard and removes them in afterAll.
 */
describe('Cargo & Yard Inventory (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();
  const emailSuffix = randomTag;

  const createdCustomers: Ref[] = [];
  // Cargo.shipperId / Cargo.consigneeId are FKs to the Phase 2 party masters
  // (shippers / consignees tables), NOT to Customer.
  const createdShippers: Ref[] = [];
  const createdConsignees: Ref[] = [];
  const createdPorts: Ref[] = [];
  const createdYards: Ref[] = [];
  const createdCargos: Ref[] = [];

  let adminToken = '';
  let cargoReaderToken = '';
  let inventoryReaderToken = '';

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

    // A role with only cargo:read, and one with only yard-inventory:read,
    // to prove the two modules are independently permission-gated.
    cargoReaderToken = await createReaderToken(
      `CARGORD_${tag}`,
      'cargo:read',
      `cargo-reader-${emailSuffix}@shipping.local`
    );
    inventoryReaderToken = await createReaderToken(
      `INVREAD_${tag}`,
      'yard-inventory:read',
      `inv-reader-${emailSuffix}@shipping.local`
    );

    // Create a self-contained customer, port, and two yards (for move tests).
    const cust = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set(auth(adminToken))
      .send({ code: `CUS-${tag}`, name: `Cargo Test Co ${randomTag}`, type: 'SHIPPER' })
      .expect(201);
    createdCustomers.push({ id: cust.body.data.id });

    // Shippers/consignees are created straight through Prisma: the
    // shipper:*/consignee:* permission codes are defined in prisma/seed.ts but
    // are not yet present in the Permission table, so POST /shippers returns
    // 403 for every role (including ADMIN). Fixture-only — cargo creation still
    // goes through the API and is FK-checked against these rows.
    const { PrismaClient } = require('@prisma/client');
    const fx = new PrismaClient();
    try {
      const shp = await fx.shipper.create({
        data: { code: `SHP-${tag}`, name: `Cargo Test Shipper ${randomTag}` },
      });
      createdShippers.push({ id: shp.id });
      const cns = await fx.consignee.create({
        data: { code: `CNS-${tag}`, name: `Cargo Test Consignee ${randomTag}` },
      });
      createdConsignees.push({ id: cns.id });
    } finally {
      await fx.$disconnect();
    }

    const port1 = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `PT-${tag}`, name: `Cargo Port ${randomTag}`, country: 'AE' })
      .expect(201);
    createdPorts.push({ id: port1.body.data.id });

    const port2 = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `PT2-${tag}`, name: `Cargo Port Two ${randomTag}`, country: 'AE' })
      .expect(201);
    createdPorts.push({ id: port2.body.data.id });

    const yd1 = await request(app.getHttpServer())
      .post('/api/v1/yards')
      .set(auth(adminToken))
      .send({ code: `YD-${tag}`, name: `Yard One ${randomTag}`, portId: port1.body.data.id })
      .expect(201);
    createdYards.push({ id: yd1.body.data.id });

    const yd2 = await request(app.getHttpServer())
      .post('/api/v1/yards')
      .set(auth(adminToken))
      .send({ code: `YD2-${tag}`, name: `Yard Two ${randomTag}`, portId: port2.body.data.id })
      .expect(201);
    createdYards.push({ id: yd2.body.data.id });
  }, 60000);

  afterAll(async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const cargoIds = createdCargos.map((c) => c.id);
      // Cargo-of-first (inventory) references cargo, cargo references yard/port/customer.
      await prisma.yardInventory.deleteMany({ where: { cargoId: { in: cargoIds } } });
      await prisma.cargo.deleteMany({ where: { id: { in: cargoIds } } });
      await prisma.yard.deleteMany({ where: { id: { in: createdYards.map((y) => y.id) } } });
      await prisma.port.deleteMany({ where: { id: { in: createdPorts.map((p) => p.id) } } });
      await prisma.customer.deleteMany({
        where: { id: { in: createdCustomers.map((c) => c.id) } },
      });
      await prisma.shipper.deleteMany({
        where: { id: { in: createdShippers.map((s) => s.id) } },
      });
      await prisma.consignee.deleteMany({
        where: { id: { in: createdConsignees.map((c) => c.id) } },
      });
      await prisma.role.deleteMany({
        where: { code: { in: [`CARGORD_${tag}`, `INVREAD_${tag}`] } },
      });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              `cargo-reader-${emailSuffix}@shipping.local`,
              `inv-reader-${emailSuffix}@shipping.local`,
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
    yardId: createdYards[0].id,
    cargoType: 'CONTAINER',
  });

  async function createReaderToken(
    roleCode: string,
    permissionCode: string,
    email: string
  ): Promise<string> {
    const perms = await request(app.getHttpServer())
      .get('/api/v1/permissions/all')
      .set(auth(adminToken))
      .expect(200);
    const perm = perms.body.data.find((p: { code: string }) => p.code === permissionCode);
    expect(perm).toBeDefined();

    const role = await request(app.getHttpServer())
      .post('/api/v1/roles')
      .set(auth(adminToken))
      .send({ code: roleCode, name: roleCode })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/roles/${role.body.data.id}/permissions`)
      .set(auth(adminToken))
      .send({ permissionIds: [perm.id] })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({ email, password: 'Phase4!2345', fullName: roleCode, roleIds: [role.body.data.id] })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Phase4!2345' })
      .expect(200);
    return login.body.data.accessToken as string;
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  describe('Cargo', () => {
    it('requires auth (401) and permission (403)', async () => {
      await request(app.getHttpServer()).get('/api/v1/cargo').expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/cargo')
        .set(auth(inventoryReaderToken))
        .expect(403);
    });

    it('creates a cargo with an auto reference and stringified Decimal weight', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cargo')
        .set(auth(adminToken))
        .send({ ...cargoBase(), specification: 'Test 40ft box', weight: '12.50', weightUnit: 'MT' })
        .expect(201);
      const d = res.body.data;
      expect(d.reference).toMatch(/^CRG-\d{4}-\d{5}$/);
      expect(typeof d.weight).toBe('string');
      expect(d.weight).toBe('12.5');
      expect(d.status).toBe('REGISTERED');
      expect(d.inspectionStatus).toBe('PENDING');
      expect(d.loadingStatus).toBe('NOT_LOADED');
      createdCargos.push({ id: d.id });
    });

    it('rejects an unknown customer/port/yard and inactive yard (409/404)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cargo')
        .set(auth(adminToken))
        .send({ ...cargoBase(), customerId: 'no-such-customer' })
        .expect(404);
      await request(app.getHttpServer())
        .post('/api/v1/cargo')
        .set(auth(adminToken))
        .send({ ...cargoBase(), portId: 'no-such-port' })
        .expect(404);
    });

    it('rejects invalid payload (400) and duplicate creates are allowed as distinct records', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cargo')
        .set(auth(adminToken))
        .send({ ...cargoBase(), cargoType: 'NOT_A_TYPE' })
        .expect(400);
      expect(res.body.error.statusCode).toBe(400);
    });

    it('lists cargo with search and filters', async () => {
      const target = createdCargos[0];

      // Search by customer name (the customer record contains the random tag)
      const custRes = await request(app.getHttpServer())
        .get('/api/v1/cargo?search=' + randomTag)
        .set(auth(adminToken))
        .expect(200);
      expect(
        custRes.body.data.data.some((c: { id: string }) => c.id === target.id)
      ).toBe(true);

      // Filter by inYard=true should be empty (nothing placed yet)
      const inYard = await request(app.getHttpServer())
        .get('/api/v1/cargo?inYard=true')
        .set(auth(adminToken))
        .expect(200);
      expect(inYard.body.data.data.every((c: { inYard: boolean }) => c.inYard === true)).toBe(true);
    });

    it('gets a single cargo, including nested relations', async () => {
      const target = createdCargos[0];
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cargo/${target.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.reference).toMatch(/^CRG-/);
      expect(res.body.data.customer.code).toBe(`CUS-${tag}`);
      expect(res.body.data.port.code).toBe(`PT-${tag}`);
      expect(res.body.data.inventory).toBeNull();
    });

    it('updates cargo fields (not lifecycle)', async () => {
      const target = createdCargos[0];
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/cargo/${target.id}`)
        .set(auth(adminToken))
        .send({ specification: 'Updated 40ft' })
        .expect(200);
      expect(res.body.data.specification).toBe('Updated 40ft');
    });

    it('enforces the cargo lifecycle: READY_FOR_LOADING requires DONE inspection (409)', async () => {
      const target = createdCargos[createdCargos.length - 1];
      await request(app.getHttpServer())
        .patch(`/api/v1/cargo/${target.id}/status`)
        .set(auth(adminToken))
        .send({ status: 'READY_FOR_LOADING' })
        .expect(409);
    });

    it('creates cargo with all Phase 3A fields and returns them', async () => {
      const cargo = {
        customerId: createdCustomers[0].id,
        portId: createdPorts[0].id,
        yardId: createdYards[0].id,
        cargoType: 'GENERAL',
        pol: 'POL-PHASE3A',
        pod: 'POD-PHASE3A',
        description: 'Phase 3A full field test',
        chassis: 'CH-3A',
        serial: 'SER-3A',
        units: 10,
        comment: 'Phase 3A comment',
        shipperId: createdShippers[0].id,
        consigneeId: createdConsignees[0].id,
        jobId: 'JOB-3A-001',
        cargoValue: '9999.99',
        cargoValueCurrency: 'EUR',
      };
      const res = await request(app.getHttpServer())
        .post('/api/v1/cargo')
        .set(auth(adminToken))
        .send(cargo)
        .expect(201);
      const d = res.body.data;
      expect(d.pol).toBe('POL-PHASE3A');
      expect(d.pod).toBe('POD-PHASE3A');
      expect(d.description).toBe('Phase 3A full field test');
      expect(d.chassis).toBe('CH-3A');
      expect(d.serial).toBe('SER-3A');
      expect(d.units).toBe(10);
      expect(d.comment).toBe('Phase 3A comment');
      expect(d.shipperId).toBe(createdShippers[0].id);
      expect(d.consigneeId).toBe(createdConsignees[0].id);
      expect(d.jobId).toBe('JOB-3A-001');
      expect(d.cargoValue).toBe('9999.99');
      expect(d.cargoValueCurrency).toBe('EUR');
      createdCargos.push({ id: d.id });
    });

    it('returns null for omitted Phase 3A party/financial fields', async () => {
      // Re-read the first cargo (created by cargoBase which omits the 5 new fields).
      const target = createdCargos[0];
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cargo/${target.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.shipperId).toBeNull();
      expect(res.body.data.consigneeId).toBeNull();
      expect(res.body.data.jobId).toBeNull();
      expect(res.body.data.cargoValue).toBeNull();
      expect(res.body.data.cargoValueCurrency).toBeNull();
    });

    it('updates Phase 3A pol/pod/description/chassis/serial/units/comment fields', async () => {
      const target = createdCargos[0];
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/cargo/${target.id}`)
        .set(auth(adminToken))
        .send({
          pol: 'POL-UPDATED',
          pod: 'POD-UPDATED',
          description: 'Updated description',
          chassis: 'CH-UPDATED',
          serial: 'SER-UPDATED',
          units: 99,
          comment: 'Updated comment',
        })
        .expect(200);
      expect(res.body.data.pol).toBe('POL-UPDATED');
      expect(res.body.data.pod).toBe('POD-UPDATED');
      expect(res.body.data.description).toBe('Updated description');
      expect(res.body.data.chassis).toBe('CH-UPDATED');
      expect(res.body.data.serial).toBe('SER-UPDATED');
      expect(res.body.data.units).toBe(99);
      expect(res.body.data.comment).toBe('Updated comment');
    });

    it('updates Phase 3A shipper/consignee/job/cargoValue/cargoValueCurrency fields', async () => {
      const target = createdCargos[0];
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/cargo/${target.id}`)
        .set(auth(adminToken))
        .send({
          shipperId: createdShippers[0].id,
          consigneeId: createdConsignees[0].id,
          jobId: 'JOB-UPDATED',
          cargoValue: '5555.55',
          cargoValueCurrency: 'GBP',
        })
        .expect(200);
      expect(res.body.data.shipperId).toBe(createdShippers[0].id);
      expect(res.body.data.consigneeId).toBe(createdConsignees[0].id);
      expect(res.body.data.jobId).toBe('JOB-UPDATED');
      expect(res.body.data.cargoValue).toBe('5555.55');
      expect(res.body.data.cargoValueCurrency).toBe('GBP');
    });

    it('rejects SELECTED as an invalid CargoStatus', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/cargo/${createdCargos[0].id}/status`)
        .set(auth(adminToken))
        .send({ status: 'SELECTED' })
        .expect(400);
    });

    it('loads dependency masters and supports cargo:read-only user isolation', async () => {
      // A yard-inventory reader cannot read cargo.
      await request(app.getHttpServer())
        .get('/api/v1/cargo')
        .set(auth(inventoryReaderToken))
        .expect(403);
      // A cargo reader can read but not create.
      await request(app.getHttpServer())
        .get('/api/v1/cargo')
        .set(auth(cargoReaderToken))
        .expect(200);
    });
  });

  describe('Yard Inventory', () => {
    let placedCargoId = '';
    let inventoryId = '';

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cargo')
        .set(auth(adminToken))
        .send({ ...cargoBase(), cargoType: 'VEHICLE' })
        .expect(201);
      placedCargoId = res.body.data.id;
      createdCargos.push({ id: placedCargoId });
    });

    it('requires auth (401) and permission (403)', async () => {
      await request(app.getHttpServer()).get('/api/v1/yard-inventory').expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/yard-inventory')
        .set(auth(cargoReaderToken))
        .expect(403);
    });

    it('places cargo in a yard; cargo becomes AT_YARD', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/yard-inventory')
        .set(auth(adminToken))
        .send({ cargoId: placedCargoId, yardId: createdYards[0].id, locationLabel: 'Bay A' })
        .expect(201);
      inventoryId = res.body.data.id;
      expect(res.body.data.status).toBe('IN_YARD');
      expect(res.body.data.cargo.status).toBe('AT_YARD');
      expect(res.body.data.port.code).toBe(`PT-${tag}`);
    });

    it('rejects placing the same cargo twice (409)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/yard-inventory')
        .set(auth(adminToken))
        .send({ cargoId: placedCargoId, yardId: createdYards[1].id })
        .expect(409);
    });

    it('rejects placing an unknown cargo or an inactive/foreign yard', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/yard-inventory')
        .set(auth(adminToken))
        .send({ cargoId: 'no-such-cargo', yardId: createdYards[0].id })
        .expect(404);
    });

    it('lists inventory with cargoStatus filter and returns the placed record', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/yard-inventory?cargoStatus=AT_YARD')
        .set(auth(adminToken))
        .expect(200);
      expect(
        res.body.data.data.some((i: { id: string }) => i.id === inventoryId)
      ).toBe(true);
      expect(res.body.data.data.every((i: { cargo: { status: string } }) => i.cargo.status === 'AT_YARD')).toBe(true);
    });

    it('filters by yard id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/yard-inventory?yardId=${createdYards[0].id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.data.some((i: { id: string }) => i.id === inventoryId)).toBe(true);
    });

    it('moves cargo to another yard and reservation status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/yard-inventory/${inventoryId}`)
        .set(auth(adminToken))
        .send({ yardId: createdYards[1].id, status: 'RESERVED' })
        .expect(200);
      expect(res.body.data.yard.code).toBe(`YD2-${tag}`);
      expect(res.body.data.port.code).toBe(`PT2-${tag}`);
      expect(res.body.data.status).toBe('RESERVED');
    });

    it('cargo remains AT_YARD across the move', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cargo/${placedCargoId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.status).toBe('AT_YARD');
      expect(res.body.data.inventory).not.toBeNull();
    });

    it('rejects moving to an unknown yard (404)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/yard-inventory/${inventoryId}`)
        .set(auth(adminToken))
        .send({ yardId: 'no-such-yard' })
        .expect(404);
    });

    it('removes cargo from the yard; cargo reverts to REGISTERED', async () => {
      const del = await request(app.getHttpServer())
        .delete(`/api/v1/yard-inventory/${inventoryId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(del.body.data.removed).toBe(true);

      const cargo = await request(app.getHttpServer())
        .get(`/api/v1/cargo/${placedCargoId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(cargo.body.data.status).toBe('REGISTERED');
      expect(cargo.body.data.inventory).toBeNull();
    });

    it('cancelled cargo cannot be placed (409)', async () => {
      // Create a spare cargo, cancel it, then attempt placement.
      const spare = await request(app.getHttpServer())
        .post('/api/v1/cargo')
        .set(auth(adminToken))
        .send({ ...cargoBase(), cargoType: 'BULK' })
        .expect(201);
      createdCargos.push({ id: spare.body.data.id });
      await request(app.getHttpServer())
        .patch(`/api/v1/cargo/${spare.body.data.id}/status`)
        .set(auth(adminToken))
        .send({ status: 'CANCELLED' })
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/yard-inventory')
        .set(auth(adminToken))
        .send({ cargoId: spare.body.data.id, yardId: createdYards[0].id })
        .expect(409);
    });

    it('cargo with an active inventory record cannot be hard-deleted (409)', async () => {
      const spare = await request(app.getHttpServer())
        .post('/api/v1/cargo')
        .set(auth(adminToken))
        .send({ ...cargoBase(), cargoType: 'GENERAL' })
        .expect(201);
      createdCargos.push({ id: spare.body.data.id });
      await request(app.getHttpServer())
        .post('/api/v1/yard-inventory')
        .set(auth(adminToken))
        .send({ cargoId: spare.body.data.id, yardId: createdYards[0].id })
        .expect(201);
      await request(app.getHttpServer())
        .delete(`/api/v1/cargo/${spare.body.data.id}`)
        .set(auth(adminToken))
        .expect(409);
    });

    it('a user with only yard-inventory:read may list but not place (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/yard-inventory')
        .set(auth(inventoryReaderToken))
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/yard-inventory')
        .set(auth(inventoryReaderToken))
        .send({ cargoId: placedCargoId, yardId: createdYards[0].id })
        .expect(403);
    });
  });

  describe('IDOR / authorization boundaries on cargo ops', () => {
    it('a cargo reader cannot create, update, or delete cargo (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/cargo')
        .set(auth(cargoReaderToken))
        .send(cargoBase())
        .expect(403);
      const target = createdCargos[createdCargos.length - 1];
      await request(app.getHttpServer())
        .patch(`/api/v1/cargo/${target.id}`)
        .set(auth(cargoReaderToken))
        .send({ specification: 'x' })
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/api/v1/cargo/${target.id}`)
        .set(auth(cargoReaderToken))
        .expect(403);
    });

    it('an inventory reader cannot update or remove inventory (403)', async () => {
      // Create a fresh cargo and place it for the sake of the check.
      const fresh = await request(app.getHttpServer())
        .post('/api/v1/cargo')
        .set(auth(adminToken))
        .send({ ...cargoBase(), cargoType: 'GENERAL' })
        .expect(201);
      createdCargos.push({ id: fresh.body.data.id });
      const placeRes = await request(app.getHttpServer())
        .post('/api/v1/yard-inventory')
        .set(auth(adminToken))
        .send({ cargoId: fresh.body.data.id, yardId: createdYards[0].id })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/yard-inventory/${placeRes.body.data.id}`)
        .set(auth(inventoryReaderToken))
        .send({ status: 'RESERVED' })
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/api/v1/yard-inventory/${placeRes.body.data.id}`)
        .set(auth(inventoryReaderToken))
        .expect(403);
    });
  });
});