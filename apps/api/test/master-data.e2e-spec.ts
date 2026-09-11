import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

type Row = { id: string; code: string };

/**
 * Phase 3 — Master Data (Customers, Ports, Yards) end-to-end tests.
 * Run against the live development database (documented limitation).
 * Self-cleaning: records are created under random tags and removed in afterAll.
 */
describe('Master Data (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();
  const emailSuffix = randomTag;

  // Track created resources so we can clean them up in the right order.
  const createdCustomers: Row[] = [];
  const createdPorts: Row[] = [];
  const createdYards: Row[] = [];

  let adminToken = '';
  let lowPrivToken = '';

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

    // Admin login
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: admin.password })
      .expect(200);
    adminToken = res.body.data.accessToken as string;
    expect(adminToken).toBeDefined();

    // A low-privilege user with ONLY yard:read, to prove RBAC boundaries across
    // the three master-data modules (read port/customer must be forbidden).
    lowPrivToken = await createReaderToken();
  }, 30000);

  afterAll(async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      // Yards reference ports, so delete child-first.
      await prisma.yard.deleteMany({ where: { id: { in: createdYards.map((y) => y.id) } } });
      await prisma.port.deleteMany({
        where: { id: { in: createdPorts.map((p) => p.id) } },
      });
      await prisma.customer.deleteMany({
        where: { id: { in: createdCustomers.map((c) => c.id) } },
      });
      // Remove the throwaway reader role + user.
      await prisma.role.deleteMany({ where: { code: `MDREAD_${tag}` } });
      await prisma.user.deleteMany({
        where: { email: `md-reader-${emailSuffix}@shipping.local` },
      });
      await prisma.$disconnect();
    } catch {
      /* best-effort cleanup */
    }
    await app.close();
  });

  async function createReaderToken(): Promise<string> {
    const permsRes = await request(app.getHttpServer())
      .get('/api/v1/permissions/all')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const yardRead = permsRes.body.data.find((p: { code: string }) => p.code === 'yard:read');
    expect(yardRead).toBeDefined();

    const roleRes = await request(app.getHttpServer())
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `MDREAD_${tag}`, name: `MD Reader ${randomTag}` })
      .expect(201);
    const roleId = roleRes.body.data.id as string;
    await request(app.getHttpServer())
      .patch(`/api/v1/roles/${roleId}/permissions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ permissionIds: [yardRead.id] })
      .expect(200);

    const email = `md-reader-${emailSuffix}@shipping.local`;
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, password: 'MDRead!2345', fullName: 'MD Reader', roleIds: [roleId] })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'MDRead!2345' })
      .expect(200);
    return login.body.data.accessToken as string;
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('Customers', () => {
    it('requires authentication (401) and permission (403)', async () => {
      await request(app.getHttpServer()).get('/api/v1/customers').expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/customers')
        .set(auth(lowPrivToken))
        .expect(403);
    });

    it('creates a customer and returns it without sensitive fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set(auth(adminToken))
        .send({
          code: `CUS-${tag}`,
          name: `Test Shipper ${randomTag}`,
          type: 'SHIPPER',
          phone: '+971-5-000-' + randomTag,
          email: `cust-${emailSuffix}@example.com`,
          country: 'AE',
          currency: 'AED',
        })
        .expect(201);
      const d = res.body.data;
      expect(d.code).toBe(`CUS-${tag}`);
      expect(d.isActive).toBe(true);
      expect(d.passwordHash).toBeUndefined();
      createdCustomers.push({ id: d.id, code: d.code });
    });

    it('rejects a duplicate code with 409 Conflict', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set(auth(adminToken))
        .send({ code: `CUS-${tag}`, name: 'Duplicate' })
        .expect(409);
    });

    it('rejects invalid payload with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set(auth(adminToken))
        .send({ code: 'lower case', name: '' })
        .expect(400);
    });

    it('lists customers, supports search by phone and isActive filter', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/customers?search=' + randomTag)
        .set(auth(adminToken))
        .expect(200);
      expect(listRes.body.success).toBe(true);
      const found = listRes.body.data.data.filter((c: { code: string }) => c.code === `CUS-${tag}`);
      expect(found.length).toBe(1);

      const activeRes = await request(app.getHttpServer())
        .get('/api/v1/customers?isActive=true')
        .set(auth(adminToken))
        .expect(200);
      expect(activeRes.body.data.data.every((c: { isActive: boolean }) => c.isActive)).toBe(true);
    });

    it('gets a single customer', async () => {
      const target = createdCustomers[0];
      const res = await request(app.getHttpServer())
        .get(`/api/v1/customers/${target.id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.code).toBe(target.code);
    });

    it('updates a customer', async () => {
      const target = createdCustomers[0];
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/customers/${target.id}`)
        .set(auth(adminToken))
        .send({ contactName: 'Updated Contact' })
        .expect(200);
      expect(res.body.data.contactName).toBe('Updated Contact');
    });

    it('deactivates and re-activates a customer via lifecycle endpoint', async () => {
      const target = createdCustomers[0];
      const off = await request(app.getHttpServer())
        .patch(`/api/v1/customers/${target.id}/active`)
        .set(auth(adminToken))
        .send({ isActive: false })
        .expect(200);
      expect(off.body.data.isActive).toBe(false);

      const on = await request(app.getHttpServer())
        .patch(`/api/v1/customers/${target.id}/active`)
        .set(auth(adminToken))
        .send({ isActive: true })
        .expect(200);
      expect(on.body.data.isActive).toBe(true);
    });

    it('returns 404 for a missing customer', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/customers/does-not-exist')
        .set(auth(adminToken))
        .expect(404);
    });
  });

  describe('Ports', () => {
    it('requires authentication (401) and permission (403)', async () => {
      await request(app.getHttpServer()).get('/api/v1/ports').expect(401);
      await request(app.getHttpServer())
        .get('/api/v1/ports')
        .set(auth(lowPrivToken))
        .expect(403);
    });

    it('creates a port and lists it with country/isActive filter', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/ports')
        .set(auth(adminToken))
        .send({ code: `PT-${tag}`, name: `Test Port ${randomTag}`, country: 'OM', city: 'Sohar' })
        .expect(201);

      const searchRes = await request(app.getHttpServer())
        .get('/api/v1/ports?search=' + randomTag)
        .set(auth(adminToken))
        .expect(200);
      const found = searchRes.body.data.data.find((p: { code: string }) => p.code === `PT-${tag}`);
      expect(found).toBeDefined();
      createdPorts.push({ id: found.id, code: found.code });

      const countryRes = await request(app.getHttpServer())
        .get('/api/v1/ports?country=OM')
        .set(auth(adminToken))
        .expect(200);
      expect(
        countryRes.body.data.data.every((p: { country: string }) => p.country === 'OM')
      ).toBe(true);
    });

    it('rejects a duplicate port code with 409', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/ports')
        .set(auth(adminToken))
        .send({ code: `PT-${tag}`, name: 'Dup', country: 'AE' })
        .expect(409);
    });

    const portId = () => createdPorts[0].id;

    it('does not allow creating a yard under a port that does not exist (404)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/yards')
        .set(auth(adminToken))
        .send({
          code: `YD-${tag}`,
          name: 'Orphan',
          portId: 'no-such-port-id',
        })
        .expect(404);
    });

    it('port detail includes its yards', async () => {
      // Create a yard under the created port first.
      const yd = await request(app.getHttpServer())
        .post('/api/v1/yards')
        .set(auth(adminToken))
        .send({
          code: `YD-${tag}`,
          name: `Test Yard ${randomTag}`,
          portId: portId(),
        })
        .expect(201);
      expect(yd.body.data.port.code).toBe(`PT-${tag}`);
      createdYards.push({ id: yd.body.data.id, code: yd.body.data.code });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/ports/${portId()}`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.yards.some((y: { code: string }) => y.code === `YD-${tag}`)).toBe(true);
    });

    it('cannot deactivate a port that still has an active yard (409)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/ports/${portId()}/active`)
        .set(auth(adminToken))
        .send({ isActive: false })
        .expect(409);
    });

    it('deactivates the port after its yards are deactivated, then re-activates', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/yards/${createdYards[0].id}/active`)
        .set(auth(adminToken))
        .send({ isActive: false })
        .expect(200);

      const off = await request(app.getHttpServer())
        .patch(`/api/v1/ports/${portId()}/active`)
        .set(auth(adminToken))
        .send({ isActive: false })
        .expect(200);
      expect(off.body.data.isActive).toBe(false);

      const on = await request(app.getHttpServer())
        .patch(`/api/v1/ports/${portId()}/active`)
        .set(auth(adminToken))
        .send({ isActive: true })
        .expect(200);
      expect(on.body.data.isActive).toBe(true);
    });
  });

  describe('Yards (CRUD + lifecycle)', () => {
    it('lists yards and filters by port and by isActive', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/yards?portId=${createdPorts[0].id}`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.data.some((y: { code: string }) => y.code === `YD-${tag}`)).toBe(true);

      const inactiveRes = await request(app.getHttpServer())
        .get('/api/v1/yards?isActive=false')
        .set(auth(adminToken))
        .expect(200);
      expect(
        inactiveRes.body.data.data.every((y: { isActive: boolean }) => y.isActive === false)
      ).toBe(true);
    });

    it('updates a yard and toggles its port', async () => {
      // Create a second port to move the yard to.
      const p2 = await request(app.getHttpServer())
        .post('/api/v1/ports')
        .set(auth(adminToken))
        .send({ code: `PT2-${tag}`, name: `Test Port Two ${randomTag}`, country: 'AE' })
        .expect(201);
      createdPorts.push({ id: p2.body.data.id, code: p2.body.data.code });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/yards/${createdYards[0].id}`)
        .set(auth(adminToken))
        .send({ name: 'Renamed Yard', portId: p2.body.data.id })
        .expect(200);
      expect(res.body.data.name).toBe('Renamed Yard');
      expect(res.body.data.port.code).toBe(`PT2-${tag}`);
    });

    it('rejects moving a yard to a nonexistent port (404)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/yards/${createdYards[0].id}`)
        .set(auth(adminToken))
        .send({ portId: 'no-such-port-id' })
        .expect(404);
    });

    it('re-activates a yard', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/yards/${createdYards[0].id}/active`)
        .set(auth(adminToken))
        .send({ isActive: true })
        .expect(200);
      expect(res.body.data.isActive).toBe(true);
    });

    it('a user with only yard:read may list yards but not create one (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/yards')
        .set(auth(lowPrivToken))
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/yards')
        .set(auth(lowPrivToken))
        .send({ code: `YD-${tag}-X`, name: 'No access', portId: createdPorts[0].id })
        .expect(403);
    });
  });
});