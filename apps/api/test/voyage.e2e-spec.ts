import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

type Ref = { id: string };

/**
 * Phase 6 — Voyage (operational; lifecycle + state machine) end-to-end tests.
 * Runs against the live development database (documented limitation).
 * Self-cleaning: creates its own ports/vessel and removes them in afterAll
 * (voyages are cleaned first, then vessels, then ports).
 */
describe('Voyage (e2e)', () => {
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

  let adminToken = '';
  let readerToken = ''; // voyage:read only
  let creatorToken = ''; // voyage:read + create
  let schedulerToken = ''; // voyage:read + schedule
  let cancellerToken = ''; // voyage:read + cancel
  let noReadToken = ''; // no voyage permission

  let originPortId = '';
  let destPortId = '';
  let vesselId = '';

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

    readerToken = await createReaderToken(`VOYREAD_${tag}`, ['voyage:read'], `voy-read-${emailSuffix}@shipping.local`);
    creatorToken = await createReaderToken(
      `VOYCREATE_${tag}`,
      ['voyage:read', 'voyage:create'],
      `voy-creator-${emailSuffix}@shipping.local`
    );
    schedulerToken = await createReaderToken(
      `VOYSCHED_${tag}`,
      ['voyage:read', 'voyage:create', 'voyage:schedule', 'voyage:start', 'voyage:complete'],
      `voy-scheduler-${emailSuffix}@shipping.local`
    );
    cancellerToken = await createReaderToken(
      `VOYCANCEL_${tag}`,
      ['voyage:read', 'voyage:create', 'voyage:cancel'],
      `voy-canceller-${emailSuffix}@shipping.local`
    );
    noReadToken = await createReaderToken(`VOYNOREAD_${tag}`, ['port:read'], `voy-noread-${emailSuffix}@shipping.local`);

    // Self-contained master data: two ports + one vessel.
    const portA = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `VOYA-${tag}`, name: `Voy Port A ${randomTag}`, country: 'AE' })
      .expect(201);
    createdPorts.push({ id: portA.body.data.id });
    const portB = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `VOYB-${tag}`, name: `Voy Port B ${randomTag}`, country: 'IN' })
      .expect(201);
    createdPorts.push({ id: portB.body.data.id });
    originPortId = portA.body.data.id;
    destPortId = portB.body.data.id;

    const ves = await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ code: `VSL-${tag}`, name: `MV Voyage ${randomTag}`, flag: 'PA', vesselType: 'CONTAINER' })
      .expect(201);
    createdVessels.push({ id: ves.body.data.id });
    vesselId = ves.body.data.id;
  }, 60000);

  afterAll(async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.voyage.deleteMany({
        where: { id: { in: createdVoyages.map((v) => v.id) } },
      });
      await prisma.vessel.deleteMany({ where: { id: { in: createdVessels.map((v) => v.id) } } });
      await prisma.port.deleteMany({ where: { id: { in: createdPorts.map((p) => p.id) } } });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              `voy-read-${emailSuffix}@shipping.local`,
              `voy-creator-${emailSuffix}@shipping.local`,
              `voy-scheduler-${emailSuffix}@shipping.local`,
              `voy-canceller-${emailSuffix}@shipping.local`,
              `voy-noread-${emailSuffix}@shipping.local`,
            ],
          },
        },
      });
      await prisma.role.deleteMany({
        where: {
          code: {
            in: [
              `VOYREAD_${tag}`,
              `VOYCREATE_${tag}`,
              `VOYSCHED_${tag}`,
              `VOYCANCEL_${tag}`,
              `VOYNOREAD_${tag}`,
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
        fullName: `Voyage ${roleCode}`,
        roleIds: [role.body.data.id],
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'ChangeMe123!' })
      .expect(200);
    return login.body.data.accessToken as string;
  }

  const voyageBase = () => ({
    vesselId,
    originPortId,
    destinationPortId: destPortId,
  });

  const D1 = () => new Date(Date.UTC(2030, 0, 10, 8, 0)).toISOString();
  const D2 = () => new Date(Date.UTC(2030, 0, 12, 8, 0)).toISOString();

  it('401 without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/voyages').expect(401);
  });

  it('403 when role lacks voyage permission', async () => {
    await request(app.getHttpServer()).get('/api/v1/voyages').set(auth(noReadToken)).expect(403);
    await request(app.getHttpServer()).get(`/api/v1/voyages/${'x'.repeat(24)}`).set(auth(noReadToken)).expect(403);
  });

  it('create requires voyage:create (403 for reader)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(readerToken))
      .send(voyageBase())
      .expect(403);
  });

  it('create + get + list as admin; voyageNumber is auto-generated VOY-YYMM-#####', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send(voyageBase())
      .expect(201);
    const created = res.body.data;
    expect(created.status).toBe('DRAFT');
    expect(created.voyageNumber).toMatch(/^VOY-\d{4}-\d{5}$/);
    expect(created.vessel.id).toBe(vesselId);
    expect(created.originPort.id).toBe(originPortId);
    expect(created.destinationPort.id).toBe(destPortId);
    expect(created.notes).toBeNull();
    createdVoyages.push({ id: created.id });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/voyages/${created.id}`)
      .set(auth(readerToken))
      .expect(200);
    expect(detail.body.data.voyageNumber).toBe(created.voyageNumber);
  });

  it('create rejects inactive vessel (409)', async () => {
    const inactiveVes = await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ code: `VSLI-${tag}`, name: `MV Inactive ${randomTag}`, flag: 'PA', vesselType: 'BULK' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/vessels/${inactiveVes.body.data.id}/active`)
      .set(auth(adminToken))
      .send({ isActive: false })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ ...voyageBase(), vesselId: inactiveVes.body.data.id })
      .expect(409);
    createdVessels.push({ id: inactiveVes.body.data.id });
  });

  it('create rejects missing/inactive ports (404/409)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ ...voyageBase(), originPortId: 'nonexistent' })
      .expect(404);

    const inactivePort = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `VOYC-${tag}`, name: `Voy Port C ${randomTag}`, country: 'AE' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/ports/${inactivePort.body.data.id}/active`)
      .set(auth(adminToken))
      .send({ isActive: false })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ ...voyageBase(), destinationPortId: inactivePort.body.data.id })
      .expect(409);
    createdPorts.push({ id: inactivePort.body.data.id });
  });

  it('schedule requires voyage:schedule + valid ordered dates; rejects invalid (400)', async () => {
    const id = createdVoyages[0].id;
    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${id}/schedule`)
      .set(auth(readerToken))
      .send({ plannedDepartureAt: D1(), plannedArrivalAt: D2() })
      .expect(403);

    // arrival before departure -> 400
    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${id}/schedule`)
      .set(auth(adminToken))
      .send({ plannedDepartureAt: D2(), plannedArrivalAt: D1() })
      .expect(400);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/voyages/${id}/schedule`)
      .set(auth(adminToken))
      .send({ plannedDepartureAt: D1(), plannedArrivalAt: D2() })
      .expect(200);
    expect(res.body.data.status).toBe('SCHEDULED');
    expect(res.body.data.plannedDepartureAt).toBe(D1());
  });

  it('re-scheduling is a validated transition (409 on invalid), duplicate overlap guarded', async () => {
    const id = createdVoyages[0].id;
    // SCHEDULED -> SCHEDULED is invalid
    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${id}/schedule`)
      .set(auth(adminToken))
      .send({ plannedDepartureAt: D1(), plannedArrivalAt: D2() })
      .expect(409);

    // A second voyage on the same vessel, overlapping window -> 409 (ADR-027)
    const second = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send(voyageBase())
      .expect(201);
    createdVoyages.push({ id: second.body.data.id });
    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${second.body.data.id}/schedule`)
      .set(auth(adminToken))
      .send({ plannedDepartureAt: D1(), plannedArrivalAt: D2() })
      .expect(409);

    // A non-overlapping window is allowed.
    const D3 = () => new Date(Date.UTC(2030, 1, 10, 8, 0)).toISOString();
    const D4 = () => new Date(Date.UTC(2030, 1, 14, 8, 0)).toISOString();
    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${second.body.data.id}/schedule`)
      .set(auth(adminToken))
      .send({ plannedDepartureAt: D3(), plannedArrivalAt: D4() })
      .expect(200);
  });

  it('start (SCHEDULED->IN_PROGRESS) then complete (IN_PROGRESS->COMPLETED); further transitions 409', async () => {
    const id = createdVoyages[0].id;
    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${id}/start`)
      .set(auth(readerToken))
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${id}/start`)
      .set(auth(adminToken))
      .expect(200);
    const started = await request(app.getHttpServer()).get(`/api/v1/voyages/${id}`).set(auth(adminToken)).expect(200);
    expect(started.body.data.status).toBe('IN_PROGRESS');

    // complete IN_PROGRESS -> COMPLETED
    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${id}/complete`)
      .set(auth(adminToken))
      .expect(200);
    const done = await request(app.getHttpServer()).get(`/api/v1/voyages/${id}`).set(auth(adminToken)).expect(200);
    expect(done.body.data.status).toBe('COMPLETED');

    // COMPLETED -> start/complete/cancel all invalid
    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${id}/start`)
      .set(auth(adminToken))
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${id}/cancel`)
      .set(auth(adminToken))
      .send({ cancelReason: 'nope' })
      .expect(409);
  });

  it('cancel requires a reason (400 without) and is allowed from DRAFT or SCHEDULED', async () => {
    const c = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send(voyageBase())
      .expect(201);
    createdVoyages.push({ id: c.body.data.id });
    const id = c.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${id}/cancel`)
      .set(auth(adminToken))
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${id}/cancel`)
      .set(auth(adminToken))
      .send({ cancelReason: '  ' })
      .expect(400);

    // DRAFT -> CANCELLED
    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${id}/cancel`)
      .set(auth(adminToken))
      .send({ cancelReason: 'Reroute via Jebel Ali' })
      .expect(200);
    const cancelled = await request(app.getHttpServer()).get(`/api/v1/voyages/${id}`).set(auth(adminToken)).expect(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
    expect(cancelled.body.data.cancelReason).toBe('Reroute via Jebel Ali');
  });

  it('start requires voyage:start (403 without) and is disallowed from DRAFT', async () => {
    const d = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send(voyageBase())
      .expect(201);
    createdVoyages.push({ id: d.body.data.id });
    // DRAFT -> IN_PROGRESS is invalid
    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${d.body.data.id}/start`)
      .set(auth(adminToken))
      .expect(409);
  });

  it('update is allowed only on DRAFT route; SCHEDULED route is frozen', async () => {
    const u = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send(voyageBase())
      .expect(201);
    createdVoyages.push({ id: u.body.data.id });
    const id = u.body.data.id;

    // DRAFT: notes editable, route re-targetable
    await request(app.getHttpServer())
      .patch(`/api/v1/voyages/${id}`)
      .set(auth(adminToken))
      .send({ notes: 'transit via Suez' })
      .expect(200);

    // SCHEDULE it, then route-edit must be blocked
    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${id}/schedule`)
      .set(auth(adminToken))
      .send({ plannedDepartureAt: new Date(Date.UTC(2035, 0, 5, 8, 0)).toISOString(), plannedArrivalAt: new Date(Date.UTC(2035, 0, 8, 8, 0)).toISOString() })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/voyages/${id}`)
      .set(auth(adminToken))
      .send({ originPortId: originPortId })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/voyages/${id}`)
      .set(auth(adminToken))
      .send({ notes: 'still allowed' })
      .expect(200);

    // SCHEDULED route is frozen; vessel re-target blocked
    await request(app.getHttpServer())
      .patch(`/api/v1/voyages/${id}`)
      .set(auth(adminToken))
      .send({ vesselId: createdVessels[0].id })
      .expect(409);
  });

  it('list supports status/vessel filters and sorting; 404 for unknown voyage', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/voyages?status=SCHEDULED&vesselId=${vesselId}`)
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/voyages?sort=plannedDepartureAt&order=asc')
      .set(auth(adminToken))
      .expect(200);
    await request(app.getHttpServer()).get('/api/v1/voyages/nonexistent').set(auth(adminToken)).expect(404);
  });

  // ---------------------------------------------------------------------------
  // Phase 2 — tug/barge pairing on voyages.
  // ---------------------------------------------------------------------------

  let tugId = '';
  let bargeId = '';

  async function createPairingVessels() {
    if (tugId) return;
    const tug = await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ code: `TG-${tag}`, name: `Tug ${randomTag}`, flag: 'AE', vesselType: 'TUG' })
      .expect(201);
    createdVessels.push({ id: tug.body.data.id });
    tugId = tug.body.data.id;

    const barge = await request(app.getHttpServer())
      .post('/api/v1/vessels')
      .set(auth(adminToken))
      .send({ code: `BG-${tag}`, name: `Barge ${randomTag}`, flag: 'AE', vesselType: 'BARGE' })
      .expect(201);
    createdVessels.push({ id: barge.body.data.id });
    bargeId = barge.body.data.id;
  }

  it('creates a voyage with a valid tug + barge pairing (201, echoed)', async () => {
    await createPairingVessels();
    const res = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ ...voyageBase(), tugVesselId: tugId, bargeVesselId: bargeId })
      .expect(201);
    expect(res.body.data.tugVessel.id).toBe(tugId);
    expect(res.body.data.tugVessel.vesselType).toBe('TUG');
    expect(res.body.data.bargeVessel.id).toBe(bargeId);
    expect(res.body.data.bargeVessel.vesselType).toBe('BARGE');
    createdVoyages.push({ id: res.body.data.id });

    // list + detail both expose the pairing
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/voyages/${res.body.data.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(detail.body.data.tugVessel.id).toBe(tugId);
    expect(detail.body.data.bargeVessel.id).toBe(bargeId);

    const list = await request(app.getHttpServer())
      .get(`/api/v1/voyages?vesselId=${vesselId}`)
      .set(auth(adminToken))
      .expect(200);
    const row = list.body.data.data.find((v: { id: string }) => v.id === res.body.data.id);
    expect(row).toBeDefined();
    expect(row.tugVessel.id).toBe(tugId);
    expect(row.bargeVessel.id).toBe(bargeId);
  });

  it('rejects assigning a self-propelled vessel as the tug (409)', async () => {
    await createPairingVessels();
    const res = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ ...voyageBase(), tugVesselId: vesselId }) // vesselId is CONTAINER
      .expect(409);
    expect(JSON.stringify(res.body)).toContain('TUG');
  });

  it('rejects assigning a non-BARGE vessel as the barge (409)', async () => {
    await createPairingVessels();
    const res = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ ...voyageBase(), bargeVesselId: vesselId }) // vesselId is CONTAINER
      .expect(409);
    expect(JSON.stringify(res.body)).toContain('BARGE');
  });

  it('rejects unknown tug/barge ids (404)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ ...voyageBase(), tugVesselId: 'no-such-tug' })
      .expect(404);
  });

  it('updates the pairing on a DRAFT voyage; a plain voyage has null pairing', async () => {
    await createPairingVessels();
    // plain voyage — pairing fields come back null
    const plain = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send(voyageBase())
      .expect(201);
    createdVoyages.push({ id: plain.body.data.id });
    expect(plain.body.data.tugVessel).toBeNull();
    expect(plain.body.data.bargeVessel).toBeNull();

    // attach the pairing via update (DRAFT only)
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/voyages/${plain.body.data.id}`)
      .set(auth(adminToken))
      .send({ tugVesselId: tugId, bargeVesselId: bargeId })
      .expect(200);
    expect(res.body.data.tugVessel.id).toBe(tugId);
    expect(res.body.data.bargeVessel.id).toBe(bargeId);

    // clearing the pairing (empty string) detaches it
    const cleared = await request(app.getHttpServer())
      .patch(`/api/v1/voyages/${plain.body.data.id}`)
      .set(auth(adminToken))
      .send({ tugVesselId: '' })
      .expect(200);
    expect(cleared.body.data.tugVessel).toBeNull();
    expect(cleared.body.data.bargeVessel.id).toBe(bargeId);
  });

  // ---------------------------------------------------------------------------
  // Phase 2 — Voyage per-destination numbering (VoyageDestination legs).
  // ---------------------------------------------------------------------------

  /** `{seq}/{YY}` per-destination document number, e.g. 1/26. */
  const LEG_NUMBER_RE = /^\d+\/\d{2}$/;
  const yy = new Date().getUTCFullYear().toString().slice(-2);

  async function createPort(codeSuffix: string, nameSuffix: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `${codeSuffix}-${tag}`, name: `${nameSuffix} ${randomTag}`, country: 'AE' })
      .expect(201);
    createdPorts.push({ id: res.body.data.id });
    return res.body.data.id as string;
  }

  it('single-destination create yields exactly 1 leg with a {seq}/{YY} number', async () => {
    const destPort = await createPort('VOYS1', 'Voy Single Dest');
    const res = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ ...voyageBase(), destinationPortId: destPort })
      .expect(201);
    createdVoyages.push({ id: res.body.data.id });
    const created = res.body.data;

    // parent format unchanged (VOY-YYMM-#####)
    expect(created.voyageNumber).toMatch(/^VOY-\d{4}-\d{5}$/);

    expect(created.legs).toHaveLength(1);
    expect(created.legs[0].legNumber).toBe(1);
    expect(created.legs[0].destinationPortId).toBe(destPort);
    expect(created.legs[0].destinationPort.id).toBe(destPort);
    expect(created.legs[0].voyageNumber).toMatch(LEG_NUMBER_RE);
    expect(created.legs[0].voyageNumber).toBe(`1/${yy}`); // fresh destination -> first in sequence

    // detail echoes the same leg
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/voyages/${created.id}`)
      .set(auth(adminToken))
      .expect(200);
    expect(detail.body.data.legs).toHaveLength(1);
    expect(detail.body.data.legs[0].voyageNumber).toBe(created.legs[0].voyageNumber);
  });

  it('multi-destination create yields N legs, sequential legNumbers, distinct per-destination numbers', async () => {
    const destPort = await createPort('VOYM1', 'Voy Multi Dest 1');
    const destPort2 = await createPort('VOYM2', 'Voy Multi Dest 2');

    const res = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({
        ...voyageBase(),
        destinationPortId: destPort,
        destinations: [destPort2],
      })
      .expect(201);
    createdVoyages.push({ id: res.body.data.id });
    const created = res.body.data;

    expect(created.legs).toHaveLength(2);
    expect(created.legs.map((l: { legNumber: number }) => l.legNumber)).toEqual([1, 2]);
    expect(created.legs[0].destinationPortId).toBe(destPort);
    expect(created.legs[1].destinationPortId).toBe(destPort2);

    // each leg carries its own destination-scoped number
    for (const leg of created.legs) {
      expect(leg.voyageNumber).toMatch(LEG_NUMBER_RE);
    }
    // distinct destinations -> distinct numbers (sequences are per destination,
    // both fresh here so both start at 1/<YY> — the (destination, number) pair
    // is what stays unique, enforced by the DB constraint)
    const pairs = created.legs.map(
      (l: { destinationPortId: string; voyageNumber: string }) =>
        `${l.destinationPortId}:${l.voyageNumber}`
    );
    expect(new Set(pairs).size).toBe(2);

    // list row also carries the legs
    const list = await request(app.getHttpServer())
      .get(`/api/v1/voyages?vesselId=${vesselId}`)
      .set(auth(adminToken))
      .expect(200);
    const row = list.body.data.data.find((v: { id: string }) => v.id === created.id);
    expect(row).toBeDefined();
    expect(row.legs).toHaveLength(2);
    expect(row.legs[0].destinationPort.code).toBeTruthy();
  });

  it('rejects duplicate destinations within one voyage (400)', async () => {
    const destPort = await createPort('VOYDUP', 'Voy Dup Dest');
    // duplicate of the primary destination
    await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ ...voyageBase(), destinations: [destPortId] })
      .expect(400);
    // duplicate inside the additional list
    await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ ...voyageBase(), destinationPortId: destPort, destinations: [destPort, destPort] })
      .expect(400);
    // unknown destination -> 404
    await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ ...voyageBase(), destinations: ['nonexistent'] })
      .expect(404);
  });

  it('number-preview returns the next {seq}/{YY} per destination without allocating', async () => {
    const destPort = await createPort('VOYPRE', 'Voy Preview Dest');
    const before = await request(app.getHttpServer())
      .get(`/api/v1/voyages/number-preview?destinationPortIds=${destPort}`)
      .set(auth(adminToken))
      .expect(200);
    expect(before.body.data).toHaveLength(1);
    expect(before.body.data[0].destinationPortId).toBe(destPort);
    expect(before.body.data[0].nextVoyageNumber).toBe(`1/${yy}`);

    // creating a voyage there advances the sequence the preview reported
    const created = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ ...voyageBase(), destinationPortId: destPort })
      .expect(201);
    createdVoyages.push({ id: created.body.data.id });
    expect(created.body.data.legs[0].voyageNumber).toBe(`1/${yy}`);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/voyages/number-preview?destinationPortIds=${destPort}`)
      .set(auth(adminToken))
      .expect(200);
    expect(after.body.data[0].nextVoyageNumber).toBe(`2/${yy}`);
  });

  it('DRAFT voyage: legs can be added and removed via PATCH; SCHEDULED rejects destinations', async () => {
    const primary = await createPort('VOYU1', 'Voy Update Primary');
    const extra = await createPort('VOYU2', 'Voy Update Extra');
    const created = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ ...voyageBase(), destinationPortId: primary })
      .expect(201);
    createdVoyages.push({ id: created.body.data.id });
    const id = created.body.data.id;
    expect(created.body.data.legs).toHaveLength(1);
    const originalNumber = created.body.data.legs[0].voyageNumber;

    // add a leg
    const added = await request(app.getHttpServer())
      .patch(`/api/v1/voyages/${id}`)
      .set(auth(adminToken))
      .send({ destinations: [extra] })
      .expect(200);
    expect(added.body.data.legs).toHaveLength(2);
    expect(added.body.data.legs.map((l: { legNumber: number }) => l.legNumber)).toEqual([1, 2]);
    // kept leg keeps its number; new leg gets a fresh per-destination number
    expect(added.body.data.legs[0].voyageNumber).toBe(originalNumber);
    expect(added.body.data.legs[1].voyageNumber).toMatch(LEG_NUMBER_RE);

    // remove it again -> back to 1 leg (soft-deleted server-side)
    const removed = await request(app.getHttpServer())
      .patch(`/api/v1/voyages/${id}`)
      .set(auth(adminToken))
      .send({ destinations: [] })
      .expect(200);
    expect(removed.body.data.legs).toHaveLength(1);
    expect(removed.body.data.legs[0].destinationPortId).toBe(primary);
    expect(removed.body.data.legs[0].voyageNumber).toBe(originalNumber);

    // re-adding the same destination revives its row (unique voyageId+destination)
    const revived = await request(app.getHttpServer())
      .patch(`/api/v1/voyages/${id}`)
      .set(auth(adminToken))
      .send({ destinations: [extra] })
      .expect(200);
    expect(revived.body.data.legs).toHaveLength(2);
    expect(revived.body.data.legs[1].destinationPortId).toBe(extra);
    expect(revived.body.data.legs[1].voyageNumber).toMatch(LEG_NUMBER_RE);

    // duplicate within the desired list -> 400
    await request(app.getHttpServer())
      .patch(`/api/v1/voyages/${id}`)
      .set(auth(adminToken))
      .send({ destinations: [primary, primary] })
      .expect(400);

    // SCHEDULED: route (incl. destinations) is frozen
    await request(app.getHttpServer())
      .post(`/api/v1/voyages/${id}/schedule`)
      .set(auth(adminToken))
      .send({ plannedDepartureAt: D1(), plannedArrivalAt: D2() })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/voyages/${id}`)
      .set(auth(adminToken))
      .send({ destinations: [extra] })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/voyages/${id}`)
      .set(auth(adminToken))
      .send({ notes: 'notes still editable' })
      .expect(200);
  });

  it('PATCH without destinations preserves existing legs (regression)', async () => {
    const destPort = await createPort('VOYPRES', 'Voy Preserve Dest');
    const created = await request(app.getHttpServer())
      .post('/api/v1/voyages')
      .set(auth(adminToken))
      .send({ ...voyageBase(), destinationPortId: destPort, destinations: [destPortId] })
      .expect(201);
    createdVoyages.push({ id: created.body.data.id });
    const id = created.body.data.id;
    expect(created.body.data.legs).toHaveLength(2);

    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/voyages/${id}`)
      .set(auth(adminToken))
      .send({ notes: 'unrelated edit' })
      .expect(200);
    expect(patched.body.data.legs).toHaveLength(2);
    expect(patched.body.data.legs.map((l: { voyageNumber: string }) => l.voyageNumber)).toEqual(
      created.body.data.legs.map((l: { voyageNumber: string }) => l.voyageNumber)
    );
  });

  it('backfill regression: pre-existing voyages have exactly 1 leg mirroring the parent number', async () => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      // voyages that existed before this task (legNumber=1 rows created by the
      // migration backfill) must mirror their parent voyageNumber.
      const legacy = await prisma.voyage.findMany({
        where: { voyageNumber: { startsWith: 'VOY-24' } }, // seeded/backfilled era
        select: {
          voyageNumber: true,
          legs: { where: { deletedAt: null }, select: { legNumber: true, voyageNumber: true } },
        },
      });
      expect(legacy.length).toBeGreaterThan(0);
      for (const voyage of legacy) {
        expect(voyage.legs).toHaveLength(1);
        expect(voyage.legs[0].legNumber).toBe(1);
        expect(voyage.legs[0].voyageNumber).toBe(voyage.voyageNumber);
      }
    } finally {
      await prisma.$disconnect();
    }
  });
});