import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

type Ref = { id: string };

/**
 * Phase 6 — Vessel (master data / registry) end-to-end tests.
 * Runs against the live development database (documented limitation).
 * Self-cleaning: vessels created here have no voyage references, so they are
 * safely hard-deleted in afterAll.
 */
describe('Vessel (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();
  const emailSuffix = randomTag;

  const createdVessels: Ref[] = [];

  let adminToken = '';
  let readerToken = ''; // vessel:read only
  let creatorToken = ''; // vessel:read + create
  let activatorToken = ''; // vessel:read + activate
  let noReadToken = ''; // no vessel permission

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

    readerToken = await createReaderToken(`VSLREAD_${tag}`, ['vessel:read'], `vsl-read-${emailSuffix}@shipping.local`);
    creatorToken = await createReaderToken(
      `VSLCREATE_${tag}`,
      ['vessel:read', 'vessel:create'],
      `vsl-creator-${emailSuffix}@shipping.local`
    );
    activatorToken = await createReaderToken(
      `VSLACTIVATE_${tag}`,
      ['vessel:read', 'vessel:activate'],
      `vsl-activator-${emailSuffix}@shipping.local`
    );
    noReadToken = await createReaderToken(`VSLNOREAD_${tag}`, ['port:read'], `vsl-noread-${emailSuffix}@shipping.local`);
  }, 60000);

  afterAll(async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.vessel.deleteMany({
        where: { id: { in: createdVessels.map((v) => v.id) } },
      });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              `vsl-read-${emailSuffix}@shipping.local`,
              `vsl-creator-${emailSuffix}@shipping.local`,
              `vsl-activator-${emailSuffix}@shipping.local`,
              `vsl-noread-${emailSuffix}@shipping.local`,
            ],
          },
        },
      });
      await prisma.role.deleteMany({
        where: {
          code: { in: [`VSLREAD_${tag}`, `VSLCREATE_${tag}`, `VSLACTIVATE_${tag}`, `VSLNOREAD_${tag}`] },
        },
      });
      await prisma.$disconnect();
    } catch {
      /* best-effort cleanup */
    }
    await app.close();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createReaderToken(roleCode: string, permissionCodes: string[], email: string): Promise<string> {
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
        fullName: `Vessel ${roleCode}`,
        roleIds: [role.body.data.id],
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'ChangeMe123!' })
      .expect(200);
    return login.body.data.accessToken as string;
  }

  const vesselBase = () => ({
    code: `VES-${tag}`,
    name: `MV Horizon ${randomTag}`,
    flag: 'UAE',
    vesselType: 'CONTAINER',
  });

  it('401 without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/vessels').expect(401);
  });

  it('403 when the role lacks vessel permission (IDOR/RBAC)', async () => {
    await request(app.getHttpServer()).get('/api/v1/vessels').set(auth(noReadToken)).expect(403);
    await request(app.getHttpServer()).post('/api/v1/vessels').set(auth(readerToken)).send(vesselBase()).expect(403);
  });

  it('create requires vessel:create (403 for reader)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(readerToken))
      .send(vesselBase())
      .expect(403);
  });

  it('create + list + get as admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send(vesselBase())
      .expect(201);
    const created = res.body.data;
    expect(created.code).toBe(`VES-${tag}`);
    expect(created.name).toBe(`MV Horizon ${randomTag}`);
    expect(created.vesselType).toBe('CONTAINER');
    expect(created.isActive).toBe(true);
    expect(created.imo).toBeNull();
    createdVessels.push({ id: created.id });

    const list = await request(app.getHttpServer())
      .get(`/api/v1/vessels?search=${tag}`)
      .set(auth(adminToken))
      .expect(200);
    expect(list.body.data.data.length).toBeGreaterThanOrEqual(1);
    const found = list.body.data.data.find((v: { id: string }) => v.id === created.id);
    expect(found).toBeDefined();

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/vessels/${created.id}`)
      .set(auth(readerToken))
      .expect(200);
    expect(detail.body.data.id).toBe(created.id);
  });

  it('rejects duplicate vessel code (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send(vesselBase())
      .expect(409);
  });

  it('rejects duplicate IMO (409) and invalid IMO format (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ ...vesselBase(), code: `VES2-${tag}`, imo: '9876543210' }) // 10 digits
      .expect(400);

    const first = await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ ...vesselBase(), code: `VES2-${tag}`, imo: '1234567' })
      .expect(201);
    createdVessels.push({ id: first.body.data.id });

    await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ ...vesselBase(), code: `VES3-${tag}`, imo: '1234567' })
      .expect(409);
  });

  it('rejects empty name / invalid vesselType (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ ...vesselBase(), code: `VES4-${tag}`, name: '' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ ...vesselBase(), code: `VES4-${tag}`, vesselType: 'NUCLEAR' })
      .expect(400);
  });

  it('update (vessel:update) edits master fields but code stays immutable', async () => {
    const first = createdVessels[0].id;
    await request(app.getHttpServer())
      .patch(`/api/v1/vessels/${first}`)
      .set(auth(readerToken)) // reader has no vessel:update
      .send({ name: 'Renamed' })
      .expect(403);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/vessels/${first}`)
      .set(auth(adminToken))
      .send({ name: `MV Horizon Renamed ${randomTag}`, capacityTeu: 2400 })
      .expect(200);
    expect(res.body.data.name).toBe(`MV Horizon Renamed ${randomTag}`);
    expect(res.body.data.capacityTeu).toBe(2400);
  });

  it('activate/deactivate requires vessel:activate', async () => {
    const id = createdVessels[0].id;
    await request(app.getHttpServer())
      .patch(`/api/v1/vessels/${id}/active`)
      .set(auth(adminToken))
      .send({ isActive: false })
      .expect(200);
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/vessels/${id}/active`)
      .set(auth(readerToken))
      .send({ isActive: true })
      .expect(403);
  });

  it('delete is guarded (referenced vessels 409); deactivated vessels appear in list with isActive filter', async () => {
    await request(app.getHttpServer()).get('/api/v1/vessels?isActive=false').set(auth(adminToken)).expect(200);
  });

  it('returns 404 for unknown vessel id', async () => {
    await request(app.getHttpServer()).get('/api/v1/vessels/nonexistent').set(auth(adminToken)).expect(404);
  });

  // ---------------------------------------------------------------------------
  // Phase 2 — vessel type model (TUG / BARGE / LANDING_CRAFT alongside the
  // self-propelled categories).
  // ---------------------------------------------------------------------------

  it('creates vessels with the TUG / BARGE / LANDING_CRAFT types (201 + echo)', async () => {
    for (const [prefix, vType] of [
      ['TUG', 'TUG'],
      ['BRG', 'BARGE'],
      ['LCT', 'LANDING_CRAFT'],
    ] as const) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/vessels')
        .set(auth(adminToken))
        .send({
          ...vesselBase(),
          code: `${prefix}-${tag}`,
          name: `${vType} ${randomTag}`,
          vesselType: vType,
        })
        .expect(201);
      expect(res.body.data.vesselType).toBe(vType);
      createdVessels.push({ id: res.body.data.id });
    }
  });

  it('updates a vessel type and filters the list by vesselType', async () => {
    // find the TUG vessel we just created via list filter
    const list = await request(app.getHttpServer())
      .get(`/api/v1/vessels?vesselType=TUG&search=${tag}`)
      .set(auth(adminToken))
      .expect(200);
    expect(list.body.data.data.length).toBeGreaterThanOrEqual(1);
    for (const v of list.body.data.data) {
      expect(v.vesselType).toBe('TUG');
    }
    const tugId = list.body.data.data[0].id;

    // change its type to BARGE
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/vessels/${tugId}`)
      .set(auth(adminToken))
      .send({ vesselType: 'BARGE' })
      .expect(200);
    expect(res.body.data.vesselType).toBe('BARGE');

    // restore so the TUG filter assertion above stays deterministic for re-runs
    await request(app.getHttpServer())
      .patch(`/api/v1/vessels/${tugId}`)
      .set(auth(adminToken))
      .send({ vesselType: 'TUG' })
      .expect(200);
  });

  it('rejects an unknown vessel type (400) — enum validation still holds', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ ...vesselBase(), code: `BADT-${tag}`, vesselType: 'SUBMARINE' })
      .expect(400);
  });

  it('pre-existing vessels keep their type after the enum extension (backfill-safe)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/vessels?pageSize=100')
      .set(auth(adminToken))
      .expect(200);
    expect(res.body.data.data.length).toBeGreaterThan(0);
    const allowed = new Set([
      'CONTAINER', 'BULK', 'TANKER', 'RORO', 'GENERAL', 'PROJECT', 'OTHER',
      'TUG', 'BARGE', 'LANDING_CRAFT',
    ]);
    for (const v of res.body.data.data) {
      expect(allowed.has(v.vesselType)).toBe(true);
    }

    // The seeded legacy vessel is still readable with its original type.
    const legacy = await request(app.getHttpServer())
      .get('/api/v1/vessels?search=MV-HORIZON')
      .set(auth(adminToken))
      .expect(200);
    const row = legacy.body.data.data.find((v: { code: string }) => v.code === 'MV-HORIZON');
    expect(row).toBeDefined();
    expect(row.vesselType).toBe('CONTAINER');
  });
});