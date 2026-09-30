import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Phase 20 - Agent Portal e2e (ADR-040).
 * Covers: portal:access gate, unlinked-user 403, company-scoped me/summary,
 * booking:create RBAC, BRK numbering, server-side company scoping of lists
 * (never a request customerId), unknown-port 400, PENDING-only cancel with
 * cross-company 404, manifest shipments scoping, statement passthrough,
 * office booking desk (list/detail/respond ACCEPTED|DECLINED + stamps,
 * single-shot respond 409, filters).
 * Tag-scoped hard cleanup in afterAll.
 */
describe('Agent Portal (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();

  let adminToken = '';
  let agentAToken = ''; // portal:access + booking:create, company A
  let agentBToken = ''; // portal:access + booking:create, company B
  let agentCToken = ''; // portal:access ONLY, company C (RBAC probe)
  let unlinkedToken = ''; // portal:access, no company link
  let officeToken = ''; // booking:read + booking:respond, no portal link

  let customerAId = '';
  let customerBId = '';
  let customerCId = '';
  let agentAId = ''; // fixture Agent master linked to user A (portalAgentId)
  let agentBId = ''; // fixture Agent master linked to user B (portalAgentId)
  let portId = '';
  let voyageId = '';
  let manifestAId = '';
  let bookingAId = '';
  let bookingBId = '';

  const auth = (token: string) => ({ Authorization: 'Bearer ' + token });
  const S = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } })
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    const login = await S().post('/api/v1/auth/login').send({ email: admin.email, password: admin.password }).expect(200);
    adminToken = login.body.data.accessToken;

    agentAToken = await createRoleToken(`PFAGA_${tag}`, ['portal:access', 'booking:create'], `pf-aga-${randomTag}@shipping.local`);
    agentBToken = await createRoleToken(`PFAGB_${tag}`, ['portal:access', 'booking:create'], `pf-agb-${randomTag}@shipping.local`);
    agentCToken = await createRoleToken(`PFAGC_${tag}`, ['portal:access', 'booking:read'], `pf-agc-${randomTag}@shipping.local`);
    unlinkedToken = await createRoleToken(`PFUNL_${tag}`, ['portal:access'], `pf-unl-${randomTag}@shipping.local`);
    officeToken = await createRoleToken(`PFOFC_${tag}`, ['booking:read', 'booking:respond'], `pf-ofc-${randomTag}@shipping.local`);

    const prisma = app.get(PrismaService);
    const [custA, custB, custC] = await Promise.all([
      prisma.customer.create({ data: { code: `AGT-A-${tag}`, name: `Agent Alpha ${randomTag}`, type: 'AGENT' } }),
      prisma.customer.create({ data: { code: `AGT-B-${tag}`, name: `Agent Beta ${randomTag}`, type: 'AGENT' } }),
      prisma.customer.create({ data: { code: `AGT-C-${tag}`, name: `Agent Gamma ${randomTag}`, type: 'AGENT' } }),
    ]);
    customerAId = custA.id;
    customerBId = custB.id;
    customerCId = custC.id;
    await prisma.user.update({ where: { email: `pf-aga-${randomTag}@shipping.local` }, data: { portalCustomerId: custA.id } });
    await prisma.user.update({ where: { email: `pf-agb-${randomTag}@shipping.local` }, data: { portalCustomerId: custB.id } });
    await prisma.user.update({ where: { email: `pf-agc-${randomTag}@shipping.local` }, data: { portalCustomerId: custC.id } });

    // Phase 2 portal agent linkage (party-cutover-plan.md §3 addendum / §8 item 0):
    // fixture Agent masters + portalAgentId links on users A and B.
    const [fixtureAgentA, fixtureAgentB] = await Promise.all([
      prisma.agent.create({ data: { code: `PFA-${tag}`, name: `Portal Agent Alpha ${randomTag}` } }),
      prisma.agent.create({ data: { code: `PFB-${tag}`, name: `Portal Agent Beta ${randomTag}` } }),
    ]);
    agentAId = fixtureAgentA.id;
    agentBId = fixtureAgentB.id;
    await prisma.user.update({ where: { email: `pf-aga-${randomTag}@shipping.local` }, data: { portalAgentId: fixtureAgentA.id } });
    await prisma.user.update({ where: { email: `pf-agb-${randomTag}@shipping.local` }, data: { portalAgentId: fixtureAgentB.id } });
    const linked = await prisma.user.findUnique({
      where: { email: `pf-aga-${randomTag}@shipping.local` },
      select: { portalAgentId: true },
    });
    expect(linked?.portalAgentId).toBe(fixtureAgentA.id);

    // Manifest fixtures via Prisma directly - only the agentId scoping matters here.
    // Cutover DONE: manifests.agentId FKs the Agent master, so fixtures carry the
    // fixture AGENT ids; scoping assertions below pass through the portalAgentId
    // leg of portalManifestScopeIds (the legacy portalCustomerId leg stays in place
    // as the documented fallback — kept per task-unit 1 scope item 2).
    const port = await prisma.port.findFirst({ select: { id: true } });
    const voyage = await prisma.voyage.findFirst({ select: { id: true } });
    expect(port).not.toBeNull();
    expect(voyage).not.toBeNull();
    portId = port!.id;
    voyageId = voyage!.id;
    const mA = await prisma.manifest.create({
      data: {
        manifestNumber: `MAN-PF${tag}-A`,
        voyageId,
        vesselName: `Portal Tester ${randomTag}`,
        polPortId: portId,
        podPortId: portId,
        agentId: fixtureAgentA.id,
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });
    await prisma.manifest.create({
      data: {
        manifestNumber: `MAN-PF${tag}-B`,
        voyageId,
        vesselName: `Portal Tester Other ${randomTag}`,
        polPortId: portId,
        podPortId: portId,
        agentId: fixtureAgentB.id,
      },
    });
    manifestAId = mA.id;

    async function createRoleToken(roleCode: string, permissionCodes: string[], email: string): Promise<string> {
      const perms = await S().get('/api/v1/permissions/all').set(auth(adminToken)).expect(200);
      const ids = permissionCodes.map((code) => {
        const perm = perms.body.data.find((p: { code: string }) => p.code === code);
        expect(perm).toBeDefined();
        return perm.id;
      });
      const role = await S().post('/api/v1/roles').set(auth(adminToken)).send({ code: roleCode, name: roleCode }).expect(201);
      await S().patch(`/api/v1/roles/${role.body.data.id}/permissions`).set(auth(adminToken)).send({ permissionIds: ids }).expect(200);
      await S().post('/api/v1/users')
        .set(auth(adminToken))
        .send({ email, password: 'ChangeMe123!', fullName: `PF ${roleCode}`, roleIds: [role.body.data.id] })
        .expect(201);
      const lg = await S().post('/api/v1/auth/login').send({ email, password: 'ChangeMe123!' }).expect(200);
      return lg.body.data.accessToken;
    }
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    try {
      await prisma.bookingRequest.deleteMany({ where: { customerId: { in: [customerAId, customerBId, customerCId] } } });
      await prisma.manifest.deleteMany({ where: { manifestNumber: { startsWith: `MAN-PF${tag}` } } });
      await prisma.agent.deleteMany({ where: { id: { in: [agentAId, agentBId].filter(Boolean) } } });
      const users = await prisma.user.findMany({
        where: { email: { contains: `-${randomTag}@shipping.local` } },
        select: { id: true },
      });
      const userIds = users.map((u: { id: string }) => u.id);
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.role.deleteMany({ where: { code: { endsWith: `_${tag}` } } });
      await prisma.customer.deleteMany({ where: { id: { in: [customerAId, customerBId, customerCId] } } });
    } finally {
      await app.close();
    }
  });

  // ── gates ──────────────────────────────────────────────────────────────────

  it('401 without token; office user (no portal:access) 403', async () => {
    await S().get('/api/v1/portal/me').expect(401);
    await S().get('/api/v1/portal/me').set(auth(officeToken)).expect(403);
  });

  it('portal:access but NOT linked to a company -> 403', async () => {
    await S().get('/api/v1/portal/me').set(auth(unlinkedToken)).expect(403);
    await S().post('/api/v1/portal/bookings').set(auth(unlinkedToken))
      .send({ cargoDescription: `orphan ${randomTag}` }).expect(403);
  });

  // approvedManifests counts manifests whose agentId is in the portal scope ids
  // (portalAgentId + legacy Customer fallback) — mA holds the fixture CUSTOMER id
  // (FK reality), so this passes via the temporary fallback until the cutover unit.
  it('linked agent -> 200 me with company + summary counts', async () => {
    const res = await S().get('/api/v1/portal/me').set(auth(agentAToken)).expect(200);
    expect(res.body.data.customer.name).toBe(`Agent Alpha ${randomTag}`);
    expect(res.body.data.summary.bookingsTotal).toBe(0);
    expect(res.body.data.summary.approvedManifests).toBe(1);
    expect(typeof res.body.data.summary.balanceDue).toBe('number');
  });

  // ── bookings: create RBAC + numbering ─────────────────────────────────────

  it('create: agentC without booking:create -> 403; agentB -> 201 BRK + PENDING', async () => {
    await S().post('/api/v1/portal/bookings').set(auth(agentCToken))
      .send({ cargoDescription: `Denied ${randomTag}` }).expect(403);
    // agentC HAS booking:read, but portal-linked accounts are barred from the office desk (ADR-040)
    await S().get('/api/v1/bookings').set(auth(agentCToken)).expect(403);
    await S().post('/api/v1/bookings/whatever/respond').set(auth(agentCToken))
      .send({ decision: 'ACCEPTED' }).expect(403);

    const res = await S().post('/api/v1/portal/bookings').set(auth(agentBToken))
      .send({ cargoDescription: `Frozen fish ${randomTag}`, containers: 4, weightKg: 1200, notes: 'reefer plugs' })
      .expect(201);
    bookingBId = res.body.data.id;
    expect(res.body.data.bookingNumber).toMatch(/^BRK-\d{4}-\d{5}$/);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.customerId).toBe(customerBId);
    expect(res.body.data.containers).toBe(4);
  });

  it('create with unknown port -> 400', async () => {
    await S().post('/api/v1/portal/bookings').set(auth(agentBToken))
      .send({ cargoDescription: `nope ${randomTag}`, originPortId: 'cuid_does_not_exist0' }).expect(400);
  });

  it('GET /portal/ports: agent list for booking form; RBAC via booking:create', async () => {
    const ok = await S().get('/api/v1/portal/ports').set(auth(agentAToken)).expect(200);
    const rows = ok.body.data;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String) }));
    expect(rows[0]).not.toHaveProperty('createdAt');
    await S().get('/api/v1/portal/ports').set(auth(agentCToken)).expect(403);
  });

  it('list scoping: each company sees ONLY its own bookings', async () => {
    const a = await S().post('/api/v1/portal/bookings').set(auth(agentAToken))
      .send({ cargoDescription: `Auto parts reefer ${randomTag}` }).expect(201);
    bookingAId = a.body.data.id;

    const listA = await S().get('/api/v1/portal/bookings?pageSize=100').set(auth(agentAToken)).expect(200);
    const rowsA = listA.body.data.data ?? listA.body.data;
    expect(rowsA.every((b: { customerId: string }) => b.customerId === customerAId)).toBe(true);
    expect(rowsA.some((b: { id: string }) => b.id === bookingAId)).toBe(true);
    expect(rowsA.some((b: { id: string }) => b.id === bookingBId)).toBe(false);

    const listB = await S().get('/api/v1/portal/bookings?pageSize=100').set(auth(agentBToken)).expect(200);
    const rowsB = listB.body.data.data ?? listB.body.data;
    expect(rowsB.every((b: { customerId: string }) => b.customerId === customerBId)).toBe(true);

    const listC = await S().get('/api/v1/portal/bookings?pageSize=100').set(auth(agentCToken)).expect(200);
    const rowsC = listC.body.data.data ?? listC.body.data;
    expect(rowsC.length).toBe(0);
  });

  it('cancel: cross-company 404; own PENDING -> CANCELLED; again -> 409', async () => {
    const mk = await S().post('/api/v1/portal/bookings').set(auth(agentBToken))
      .send({ cargoDescription: `Cancel me ${randomTag}` }).expect(201);
    const toCancel = mk.body.data.id;

    await S().post(`/api/v1/portal/bookings/${toCancel}/cancel`).set(auth(agentAToken)).expect(404);
    const res = await S().post(`/api/v1/portal/bookings/${toCancel}/cancel`).set(auth(agentBToken)).expect(200);
    expect(res.body.data.status).toBe('CANCELLED');
    await S().post(`/api/v1/portal/bookings/${toCancel}/cancel`).set(auth(agentBToken)).expect(409);
  });

  // ── shipments + statement ──────────────────────────────────────────────────

  // Scoping asserted through the same portal scope ids (portalAgentId + legacy
  // Customer fallback): A sees exactly its own manifest, never B's.
  it('shipments: agent A sees only its manifest, not B-s', async () => {
    const res = await S().get('/api/v1/portal/shipments?pageSize=50').set(auth(agentAToken)).expect(200);
    const rows = res.body.data.data ?? res.body.data;
    const ids = rows.map((m: { id: string }) => m.id);
    expect(ids).toContain(manifestAId);
    const a = rows.find((m: { id: string }) => m.id === manifestAId);
    expect(a.status).toBe('APPROVED');
    expect(a.timeline.approvedAt).toBeTruthy();
    const bRes = await S().get('/api/v1/portal/shipments?pageSize=50').set(auth(agentBToken)).expect(200);
    const bIds = (bRes.body.data.data ?? bRes.body.data).map((m: { id: string }) => m.id);
    expect(bIds).not.toContain(manifestAId);
  });

  it('statement: 200 with summary + entries (server-side company scope)', async () => {
    const res = await S().get('/api/v1/portal/statement').set(auth(agentAToken)).expect(200);
    expect(res.body.data.summary).toBeDefined();
    expect(Array.isArray(res.body.data.entries)).toBe(true);
  });

  // ── office booking desk ────────────────────────────────────────────────────

  it('office list: sees all companies; status filter excludes cancelled', async () => {
    const all = await S().get('/api/v1/bookings?pageSize=100').set(auth(officeToken)).expect(200);
    const rows = all.body.data.data ?? all.body.data;
    const mine = rows.filter((b: { cargoDescription: string }) => b.cargoDescription.includes(randomTag));
    expect(mine.length).toBeGreaterThanOrEqual(3);

    const pending = await S().get('/api/v1/bookings?status=PENDING&pageSize=100').set(auth(officeToken)).expect(200);
    const prows = pending.body.data.data ?? pending.body.data;
    expect(prows.every((b: { status: string }) => b.status === 'PENDING')).toBe(true);
    expect(prows.some((b: { id: string }) => b.id === bookingAId)).toBe(true);
    expect(prows.some((b: { id: string }) => b.id === bookingBId)).toBe(true);
  });

  it('office detail: 200 for known id; 404 for unknown', async () => {
    const det = await S().get(`/api/v1/bookings/${bookingAId}`).set(auth(officeToken)).expect(200);
    expect(det.body.data.customerId).toBe(customerAId);
    await S().get('/api/v1/bookings/cuid_missing_booking0').set(auth(officeToken)).expect(404);
  });

  it('respond: 403 without booking:respond; ACCEPTED + stamps; second -> 409; DECLINED on other', async () => {
    await S().post(`/api/v1/bookings/${bookingAId}/respond`).set(auth(agentAToken))
      .send({ decision: 'ACCEPTED' }).expect(403);

    const acc = await S().post(`/api/v1/bookings/${bookingAId}/respond`).set(auth(officeToken))
      .send({ decision: 'ACCEPTED', responseNote: 'confirmed 4 reefer plugs' }).expect(200);
    expect(acc.body.data.status).toBe('ACCEPTED');
    expect(acc.body.data.responseNote).toBe('confirmed 4 reefer plugs');
    expect(acc.body.data.handledAt).toBeTruthy();
    expect(acc.body.data.handledBy).toBeTruthy();

    await S().post(`/api/v1/bookings/${bookingAId}/respond`).set(auth(officeToken))
      .send({ decision: 'DECLINED' }).expect(409);

    const dec = await S().post(`/api/v1/bookings/${bookingBId}/respond`).set(auth(officeToken))
      .send({ decision: 'DECLINED', responseNote: 'no space' }).expect(200);
    expect(dec.body.data.status).toBe('DECLINED');

    const byStatus = await S().get('/api/v1/bookings?status=DECLINED&pageSize=100').set(auth(officeToken)).expect(200);
    const rows = byStatus.body.data.data ?? byStatus.body.data;
    expect(rows.some((b: { id: string }) => b.id === bookingBId)).toBe(true);
  });
});
