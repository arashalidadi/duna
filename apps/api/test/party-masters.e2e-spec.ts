import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaClient } from '@prisma/client';

/**
 * Phase 2 — Party masters e2e (roadmap §3: tests "Party CRUD" + "Agent destination scoping").
 *
 * Coverage (authoritative enumeration from implementation-log/2026-09-30-phase2-party-master-tests.md):
 *  A1–A10 per master ∈ {shippers, consignees, agents} — 401/403 RBAC, create echo, validation
 *    (duplicate 409 / empty 400 / code>20 400), list envelope + search + isActive + page=0 400,
 *    read paths (200/404/soft-deleted 404), PATCH echo + code-property rejection 400,
 *    active flip + filter + restore, delete + 404 + absent-from-list, Prisma cross-check.
 *  B1–B7 agent destinations — create/list echo, duplicate 409, nonexistent portId status recorded,
 *    lifecycle (PATCH/DELETE/post-404s), IDOR 404, unknown agent 404 ×4 verbs, RBAC (agent:read
 *    vs agent:update).
 *  C isolation — unique random tag everywhere; hard-delete in afterAll; TAG-SCOPED fixture counts
 *    asserted back to 0 (global counts logged as context only — they race parallel suites).
 *
 * Bootstrap mirrors party-cutover.e2e-spec.ts EXCEPT the ValidationPipe, which copies
 * apps/api/src/main.ts:42-47 verbatim (whitelist + forbidNonWhitelisted) so the test app matches
 * production validation.
 */
describe('Party masters: Party CRUD + agent destinations (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();

  let adminToken = '';
  let prisma: PrismaClient;

  // read-only tokens (role holds ONLY the listed permission)
  let shpReaderToken = ''; // shipper:read
  let cnsReaderToken = ''; // consignee:read
  let agtReaderToken = ''; // agent:read  (also B7's read-only role)

  // destinations fixtures (B)
  let portAId = '';
  let portACode = '';
  let portBId = '';
  let destAgentId = ''; // fixture agent that owns the destination
  let otherAgentId = ''; // fixture agent for the IDOR check

  // cleanup registries (tag-scoped)
  const createdRoleCodes: string[] = [];
  const createdUserEmails: string[] = [];

  // global counts before the suite — CONTEXT ONLY, never asserted (parallel suites race)
  const globalPre: Record<string, number> = {};

  const auth = (token: string) => ({ Authorization: 'Bearer ' + token });
  const S = () => request(app.getHttpServer());

  /** Portal-suite createRoleToken pattern (GET /permissions/all -> role -> permissions -> user -> login). */
  async function createRoleToken(
    roleCode: string,
    permissionCodes: string[],
    email: string,
  ): Promise<string> {
    const perms = await S().get('/api/v1/permissions/all').set(auth(adminToken)).expect(200);
    const ids = permissionCodes.map((code) => {
      const perm = perms.body.data.find((p: { code: string }) => p.code === code);
      expect(perm).toBeDefined();
      return perm.id;
    });
    const role = await S()
      .post('/api/v1/roles')
      .set(auth(adminToken))
      .send({ code: roleCode, name: roleCode })
      .expect(201);
    createdRoleCodes.push(roleCode);
    await S()
      .patch(`/api/v1/roles/${role.body.data.id}/permissions`)
      .set(auth(adminToken))
      .send({ permissionIds: ids })
      .expect(200);
    await S()
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({ email, password: 'ChangeMe123!', fullName: `PM ${roleCode}`, roleIds: [role.body.data.id] })
      .expect(201);
    createdUserEmails.push(email);
    const lg = await S().post('/api/v1/auth/login').send({ email, password: 'ChangeMe123!' }).expect(200);
    return lg.body.data.accessToken as string;
  }

  /** Structural shape shared by the three master rows (full service select). */
  type MasterRow = {
    id: string;
    code: string;
    name: string;
    taxId: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    isActive: boolean;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  };

  type MasterDef = {
    mod: string; // route segment: shippers | consignees | agents
    pfx: string; // unique code prefix for this suite
    label: string; // Shipper | Consignee | Agent
    permRead: string;
    permCreate: string;
    reader: () => string;
    countTag: () => Promise<number>;
    rowById: (id: string) => Promise<MasterRow | null>;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    prisma = new PrismaClient();

    const login = await S()
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: admin.password })
      .expect(200);
    adminToken = login.body.data.accessToken as string;
    expect(adminToken).toBeDefined();

    // Global counts BEFORE — recorded as context only (never asserted; see C in the log).
    globalPre.shippers = await prisma.shipper.count();
    globalPre.consignees = await prisma.consignee.count();
    globalPre.agents = await prisma.agent.count();
    globalPre.ports = await prisma.port.count();
    globalPre.destinations = await prisma.agentDestination.count();
    globalPre.roles = await prisma.role.count();
    globalPre.users = await prisma.user.count();

    // B fixtures: two ports + two agents (POST /ports requires code, name, country).
    const portA = await S()
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `PMPA${tag}`, name: `PM Port Alpha ${tag}`, country: 'AE' })
      .expect(201);
    portAId = portA.body.data.id;
    portACode = portA.body.data.code;
    const portB = await S()
      .post('/api/v1/ports')
      .set(auth(adminToken))
      .send({ code: `PMPB${tag}`, name: `PM Port Beta ${tag}`, country: 'IN' })
      .expect(201);
    portBId = portB.body.data.id;

    const destAgent = await S()
      .post('/api/v1/agents')
      .set(auth(adminToken))
      .send({ code: `PMD${tag}`, name: `PM Dest Agent ${tag}` })
      .expect(201);
    destAgentId = destAgent.body.data.id;
    const otherAgent = await S()
      .post('/api/v1/agents')
      .set(auth(adminToken))
      .send({ code: `PMO${tag}`, name: `PM Other Agent ${tag}` })
      .expect(201);
    otherAgentId = otherAgent.body.data.id;

    // Read-only tokens for A2 (and B7 for agents).
    shpReaderToken = await createRoleToken(`PMSREAD_${tag}`, ['shipper:read'], `pm-shp-${randomTag}@shipping.local`);
    cnsReaderToken = await createRoleToken(`PMCREAD_${tag}`, ['consignee:read'], `pm-cns-${randomTag}@shipping.local`);
    agtReaderToken = await createRoleToken(`PMAREAD_${tag}`, ['agent:read'], `pm-agt-${randomTag}@shipping.local`);
  }, 120000);

  afterAll(async () => {
    try {
      // C: hard-delete every fixture this suite created, then assert TAG-SCOPED counts == 0.
      // Global counts are logged for context only (parallel suites own their own rows).
      await prisma.agentDestination.deleteMany({
        where: { agentId: { in: [destAgentId, otherAgentId].filter(Boolean) } },
      });
      const survivorsDest = await prisma.agentDestination.count({
        where: { agentId: { in: [destAgentId, otherAgentId].filter(Boolean) } },
      });

      await prisma.shipper.deleteMany({ where: { code: { contains: tag } } });
      await prisma.consignee.deleteMany({ where: { code: { contains: tag } } });
      await prisma.agent.deleteMany({ where: { code: { contains: tag } } });
      const survivorsMasters = {
        shippers: await prisma.shipper.count({ where: { code: { contains: tag } } }),
        consignees: await prisma.consignee.count({ where: { code: { contains: tag } } }),
        agents: await prisma.agent.count({ where: { code: { contains: tag } } }),
      };

      await prisma.port.deleteMany({ where: { code: { contains: tag } } });
      const survivorsPorts = await prisma.port.count({ where: { code: { contains: tag } } });

      const users = await prisma.user.findMany({
        where: { email: { contains: `-${randomTag}@shipping.local` } },
        select: { id: true },
      });
      const userIds = users.map((u) => u.id);
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.role.deleteMany({ where: { code: { in: createdRoleCodes } } });
      const survivorsUsers = await prisma.user.count({
        where: { email: { contains: `-${randomTag}@shipping.local` } },
      });
      const survivorsRoles = await prisma.role.count({ where: { code: { in: createdRoleCodes } } });

      const globalPost = {
        shippers: await prisma.shipper.count(),
        consignees: await prisma.consignee.count(),
        agents: await prisma.agent.count(),
        ports: await prisma.port.count(),
        destinations: await prisma.agentDestination.count(),
        roles: await prisma.role.count(),
        users: await prisma.user.count(),
      };
      console.log(`[party-masters] global counts pre-suite: ${JSON.stringify(globalPre)}`);
      console.log(`[party-masters] global counts post-cleanup (context only): ${JSON.stringify(globalPost)}`);

      // C assertions — no fixture may survive the run.
      expect(survivorsDest).toBe(0);
      expect(survivorsMasters).toEqual({ shippers: 0, consignees: 0, agents: 0 });
      expect(survivorsPorts).toBe(0);
      expect(survivorsUsers).toBe(0);
      expect(survivorsRoles).toBe(0);
    } finally {
      await prisma.$disconnect();
      await app.close();
    }
  });

  // ─────────────────────────── A: Party CRUD per master ───────────────────────────

  const masters: MasterDef[] = [
    {
      mod: 'shippers',
      pfx: 'PMS',
      label: 'Shipper',
      permRead: 'shipper:read',
      permCreate: 'shipper:create',
      reader: () => shpReaderToken,
      countTag: () => prisma.shipper.count({ where: { code: { contains: tag } } }),
      rowById: (id) => prisma.shipper.findUnique({ where: { id } }),
    },
    {
      mod: 'consignees',
      pfx: 'PMC',
      label: 'Consignee',
      permRead: 'consignee:read',
      permCreate: 'consignee:create',
      reader: () => cnsReaderToken,
      countTag: () => prisma.consignee.count({ where: { code: { contains: tag } } }),
      rowById: (id) => prisma.consignee.findUnique({ where: { id } }),
    },
    {
      mod: 'agents',
      pfx: 'PMA',
      label: 'Agent',
      permRead: 'agent:read',
      permCreate: 'agent:create',
      reader: () => agtReaderToken,
      countTag: () => prisma.agent.count({ where: { code: { contains: tag } } }),
      rowById: (id) => prisma.agent.findUnique({ where: { id } }),
    },
  ];

  masters.forEach((m) => {
    describe(`${m.mod} (${m.label} CRUD)`, () => {
      const mainCode = `${m.pfx}${tag}`;
      const sdCode = `${m.pfx}${tag}X`; // A6's soft-deleted row (code still occupies the unique index)
      const mainName = `Alpha ${m.label} ${tag}`;
      const updatedName = `Beta ${m.label} ${tag}`;
      let mainId = '';
      let sdId = '';

      it(
        'A1 GET list without a token -> 401',
        async () => {
          await S().get(`/api/v1/${m.mod}`).expect(401);
        },
        30000,
      );

      it(
        `A2 read-only role (${m.permRead} only): GET 200, POST 403`,
        async () => {
          const list = await S().get(`/api/v1/${m.mod}`).set(auth(m.reader())).expect(200);
          expect(list.body.data).toHaveProperty('data');
          expect(list.body.data).toHaveProperty('meta');

          await S()
            .post(`/api/v1/${m.mod}`)
            .set(auth(m.reader()))
            .send({ code: `${m.pfx}R${tag}`, name: `Readonly Cannot Create ${tag}` })
            .expect(403);
        },
        30000,
      );

      it(
        'A3 POST valid body -> 201 with full echo',
        async () => {
          const res = await S()
            .post(`/api/v1/${m.mod}`)
            .set(auth(adminToken))
            .send({
              code: mainCode,
              name: mainName,
              taxId: `TAX-${tag}`,
              address: `7 Al Mina Rd ${tag}`,
              phone: '+971500000000',
              email: `pm@${tag}.test`,
              notes: `fixture notes ${tag}`,
            })
            .expect(201);
          const row = res.body.data;
          mainId = row.id;
          expect(row.code).toBe(mainCode);
          expect(row.name).toBe(mainName);
          expect(row.taxId).toBe(`TAX-${tag}`);
          expect(row.address).toBe(`7 Al Mina Rd ${tag}`);
          expect(row.phone).toBe('+971500000000');
          expect(row.email).toBe(`pm@${tag}.test`);
          expect(row.notes).toBe(`fixture notes ${tag}`);
          expect(row.isActive).toBe(true);
          expect(row.deletedAt).toBeNull();
          expect(typeof row.id).toBe('string');
          expect(row.createdAt).toBeDefined();
          expect(row.updatedAt).toBeDefined();
        },
        30000,
      );

      it(
        'A4 validation: duplicate code 409; empty code 400; empty name 400; code > 20 chars 400',
        async () => {
          await S()
            .post(`/api/v1/${m.mod}`)
            .set(auth(adminToken))
            .send({ code: mainCode, name: `Duplicate ${m.label} ${tag}` })
            .expect(409);

          await S()
            .post(`/api/v1/${m.mod}`)
            .set(auth(adminToken))
            .send({ code: '', name: `No Code ${m.label} ${tag}` })
            .expect(400);

          await S()
            .post(`/api/v1/${m.mod}`)
            .set(auth(adminToken))
            .send({ code: `${m.pfx}${tag}E`, name: '' })
            .expect(400);

          await S()
            .post(`/api/v1/${m.mod}`)
            .set(auth(adminToken))
            .send({ code: 'K'.repeat(21), name: `Too Long Code ${m.label} ${tag}` })
            .expect(400);
        },
        30000,
      );

      it(
        'A5 list envelope + case-insensitive search (code, name) + isActive filter + page=0 -> 400',
        async () => {
          const page1 = await S()
            .get(`/api/v1/${m.mod}?page=1&pageSize=5`)
            .set(auth(adminToken))
            .expect(200);
          const env = page1.body.data;
          expect(Array.isArray(env.data)).toBe(true);
          expect(env.data.length).toBeLessThanOrEqual(5);
          expect(env.meta).toEqual({
            page: 1,
            pageSize: 5,
            totalItems: expect.any(Number),
            totalPages: expect.any(Number),
          });
          expect(env.meta.totalItems).toBeGreaterThanOrEqual(env.data.length);

          // search matches code (case-insensitive)
          const byCode = await S()
            .get(`/api/v1/${m.mod}?search=${mainCode.toLowerCase()}`)
            .set(auth(adminToken))
            .expect(200);
          expect(byCode.body.data.data.map((r: { id: string }) => r.id)).toContain(mainId);

          // search matches name (case-insensitive)
          const nameQuery = encodeURIComponent(`ALPHA ${m.label.toUpperCase()} ${tag}`);
          const byName = await S()
            .get(`/api/v1/${m.mod}?search=${nameQuery}`)
            .set(auth(adminToken))
            .expect(200);
          expect(byName.body.data.data.map((r: { id: string }) => r.id)).toContain(mainId);

          // no match
          const none = await S()
            .get(`/api/v1/${m.mod}?search=ZZNO${tag}`)
            .set(auth(adminToken))
            .expect(200);
          expect(none.body.data.meta.totalItems).toBe(0);

          // isActive filters
          const active = await S()
            .get(`/api/v1/${m.mod}?isActive=true`)
            .set(auth(adminToken))
            .expect(200);
          expect(active.body.data.data.map((r: { id: string }) => r.id)).toContain(mainId);
          const inactive = await S()
            .get(`/api/v1/${m.mod}?isActive=false`)
            .set(auth(adminToken))
            .expect(200);
          expect(inactive.body.data.data.map((r: { id: string }) => r.id)).not.toContain(mainId);

          // pagination bound: page=0 -> 400 (@Min(1))
          await S().get(`/api/v1/${m.mod}?page=0`).set(auth(adminToken)).expect(400);
        },
        30000,
      );

      it(
        'A6 GET by id 200; unknown id 404; soft-deleted id 404',
        async () => {
          const got = await S()
            .get(`/api/v1/${m.mod}/${mainId}`)
            .set(auth(adminToken))
            .expect(200);
          expect(got.body.data.id).toBe(mainId);

          await S()
            .get(`/api/v1/${m.mod}/no-such-${m.mod}-${tag}`)
            .set(auth(adminToken))
            .expect(404);

          // soft-deleted row: create -> DELETE -> GET 404
          const sd = await S()
            .post(`/api/v1/${m.mod}`)
            .set(auth(adminToken))
            .send({ code: sdCode, name: `Soft Deleted ${m.label} ${tag}` })
            .expect(201);
          sdId = sd.body.data.id;
          await S().delete(`/api/v1/${m.mod}/${sdId}`).set(auth(adminToken)).expect(200);
          await S().get(`/api/v1/${m.mod}/${sdId}`).set(auth(adminToken)).expect(404);
        },
        30000,
      );

      it(
        'A7 PATCH full mutable payload -> 200 + echo; PATCH {code} -> 400 (not an Update DTO property)',
        async () => {
          const payload = {
            name: updatedName,
            taxId: `TAX2-${tag}`,
            address: `8 Corniche St ${tag}`,
            phone: '+971500000001',
            email: `pm2@${tag}.test`,
            notes: `updated notes ${tag}`,
            isActive: true,
          };
          const res = await S()
            .patch(`/api/v1/${m.mod}/${mainId}`)
            .set(auth(adminToken))
            .send(payload)
            .expect(200);
          expect(res.body.data.id).toBe(mainId);
          expect(res.body.data.code).toBe(mainCode); // code untouched
          expect(res.body.data.name).toBe(payload.name);
          expect(res.body.data.taxId).toBe(payload.taxId);
          expect(res.body.data.address).toBe(payload.address);
          expect(res.body.data.phone).toBe(payload.phone);
          expect(res.body.data.email).toBe(payload.email);
          expect(res.body.data.notes).toBe(payload.notes);
          expect(res.body.data.isActive).toBe(true);

          // Update*Dto has no `code` property -> forbidNonWhitelisted (main.ts) rejects it.
          // The value is deliberately the DUPLICATE sdCode: uniqueness is unreachable because
          // the property itself is rejected first (design resolution, see log).
          const codeRes = await S()
            .patch(`/api/v1/${m.mod}/${mainId}`)
            .set(auth(adminToken))
            .send({ code: sdCode })
            .expect(400);
          console.log(
            `[${m.mod}] A7 PATCH {code} response: ${codeRes.status} ${JSON.stringify(codeRes.body)}`,
          );
        },
        30000,
      );

      it(
        'A8 PATCH /:id/active flips isActive; filter reflects it; restore',
        async () => {
          const off = await S()
            .patch(`/api/v1/${m.mod}/${mainId}/active`)
            .set(auth(adminToken))
            .send({ isActive: false })
            .expect(200);
          expect(off.body.data.isActive).toBe(false);

          const got = await S()
            .get(`/api/v1/${m.mod}/${mainId}`)
            .set(auth(adminToken))
            .expect(200);
          expect(got.body.data.isActive).toBe(false);

          const inactive = await S()
            .get(`/api/v1/${m.mod}?isActive=false`)
            .set(auth(adminToken))
            .expect(200);
          expect(inactive.body.data.data.map((r: { id: string }) => r.id)).toContain(mainId);
          const active = await S()
            .get(`/api/v1/${m.mod}?isActive=true`)
            .set(auth(adminToken))
            .expect(200);
          expect(active.body.data.data.map((r: { id: string }) => r.id)).not.toContain(mainId);

          const on = await S()
            .patch(`/api/v1/${m.mod}/${mainId}/active`)
            .set(auth(adminToken))
            .send({ isActive: true })
            .expect(200);
          expect(on.body.data.isActive).toBe(true);
          const restored = await S()
            .get(`/api/v1/${m.mod}/${mainId}`)
            .set(auth(adminToken))
            .expect(200);
          expect(restored.body.data.isActive).toBe(true);
        },
        30000,
      );

      it(
        'A9 DELETE -> 200; subsequent GET -> 404; row absent from the list',
        async () => {
          await S().delete(`/api/v1/${m.mod}/${mainId}`).set(auth(adminToken)).expect(200);
          await S().get(`/api/v1/${m.mod}/${mainId}`).set(auth(adminToken)).expect(404);

          const list = await S()
            .get(`/api/v1/${m.mod}?search=${mainCode.toLowerCase()}&pageSize=50`)
            .set(auth(adminToken))
            .expect(200);
          const ids = list.body.data.data.map((r: { id: string }) => r.id);
          expect(ids).not.toContain(mainId);
          expect(ids).not.toContain(sdId);
        },
        30000,
      );

      it(
        'A10 Prisma cross-check: persisted values + soft delete on disk',
        async () => {
          const row = (await m.rowById(mainId)) as MasterRow | null;
          expect(row).not.toBeNull();
          expect(row!.code).toBe(mainCode);
          expect(row!.name).toBe(updatedName); // A7's write persisted
          expect(row!.taxId).toBe(`TAX2-${tag}`);
          expect(row!.isActive).toBe(true); // A8 restored before A9's soft delete
          expect(row!.deletedAt).not.toBeNull(); // A9 soft-deleted
        },
        30000,
      );
    });
  });

  // ─────────────────────────── B: Agent destinations ───────────────────────────

  describe('agent destinations (/agents/:id/destinations)', () => {
    let destId = '';

    it(
      'B1 POST {portId} -> 201 echoing the port; GET -> paginated envelope containing it',
      async () => {
        const res = await S()
          .post(`/api/v1/agents/${destAgentId}/destinations`)
          .set(auth(adminToken))
          .send({ portId: portAId })
          .expect(201);
        destId = res.body.data.id;
        expect(res.body.data.agentId).toBe(destAgentId);
        expect(res.body.data.portId).toBe(portAId);
        expect(res.body.data.isActive).toBe(true);
        expect(res.body.data.port).toMatchObject({ id: portAId, code: portACode });

        const list = await S()
          .get(`/api/v1/agents/${destAgentId}/destinations?page=1&pageSize=5`)
          .set(auth(adminToken))
          .expect(200);
        const env = list.body.data;
        expect(Array.isArray(env.data)).toBe(true);
        expect(env.meta).toEqual({
          page: 1,
          pageSize: 5,
          totalItems: expect.any(Number),
          totalPages: expect.any(Number),
        });
        expect(env.data.map((d: { id: string }) => d.id)).toContain(destId);
      },
      30000,
    );

    it(
      'B2 same agentId+portId twice -> 409 (unique on (agentId, portId))',
      async () => {
        await S()
          .post(`/api/v1/agents/${destAgentId}/destinations`)
          .set(auth(adminToken))
          .send({ portId: portAId })
          .expect(409);
      },
      30000,
    );

    it(
      'B3 nonexistent portId -> actual status recorded (service has no existence check; FK-only)',
      async () => {
        const res = await S()
          .post(`/api/v1/agents/${destAgentId}/destinations`)
          .set(auth(adminToken))
          .send({ portId: `PX${tag}NOPORT` })
          .expect(400); // HttpExceptionFilter maps Prisma P2003 -> 400 (http-exception.filter.ts:76-85)
        console.log(`[B3] nonexistent portId response: ${res.status} ${JSON.stringify(res.body)}`);
      },
      30000,
    );

    it(
      'B5 IDOR: destination of agent A addressed under agent B -> 404 (no mutation)',
      async () => {
        await S()
          .patch(`/api/v1/agents/${otherAgentId}/destinations/${destId}`)
          .set(auth(adminToken))
          .send({ isActive: false })
          .expect(404);
        // untouched: still active under its real owner
        const list = await S()
          .get(`/api/v1/agents/${destAgentId}/destinations?isActive=true`)
          .set(auth(adminToken))
          .expect(200);
        expect(list.body.data.data.map((d: { id: string }) => d.id)).toContain(destId);
      },
      30000,
    );

    it(
      'B7 RBAC: read-only role (agent:read) -> GET 200; POST/PATCH/DELETE -> 403',
      async () => {
        const list = await S()
          .get(`/api/v1/agents/${destAgentId}/destinations`)
          .set(auth(agtReaderToken))
          .expect(200);
        expect(list.body.data).toHaveProperty('data');

        await S()
          .post(`/api/v1/agents/${destAgentId}/destinations`)
          .set(auth(agtReaderToken))
          .send({ portId: portBId })
          .expect(403);
        await S()
          .patch(`/api/v1/agents/${destAgentId}/destinations/${destId}`)
          .set(auth(agtReaderToken))
          .send({ isActive: false })
          .expect(403);
        await S()
          .delete(`/api/v1/agents/${destAgentId}/destinations/${destId}`)
          .set(auth(agtReaderToken))
          .expect(403);
      },
      30000,
    );

    it(
      'B4 lifecycle: PATCH isActive:false 200 + filter; DELETE 200; GET/PATCH/DELETE on the deleted destination -> 404',
      async () => {
        const off = await S()
          .patch(`/api/v1/agents/${destAgentId}/destinations/${destId}`)
          .set(auth(adminToken))
          .send({ isActive: false })
          .expect(200);
        expect(off.body.data.isActive).toBe(false);

        const inactive = await S()
          .get(`/api/v1/agents/${destAgentId}/destinations?isActive=false`)
          .set(auth(adminToken))
          .expect(200);
        expect(inactive.body.data.data.map((d: { id: string }) => d.id)).toContain(destId);
        const active = await S()
          .get(`/api/v1/agents/${destAgentId}/destinations?isActive=true`)
          .set(auth(adminToken))
          .expect(200);
        expect(active.body.data.data.map((d: { id: string }) => d.id)).not.toContain(destId);

        await S()
          .delete(`/api/v1/agents/${destAgentId}/destinations/${destId}`)
          .set(auth(adminToken))
          .expect(200);

        // absent from the list now
        const list = await S()
          .get(`/api/v1/agents/${destAgentId}/destinations`)
          .set(auth(adminToken))
          .expect(200);
        expect(list.body.data.data.map((d: { id: string }) => d.id)).not.toContain(destId);

        // GET (no GET-one route exists -> route-level 404), PATCH and DELETE -> service-level 404
        await S()
          .get(`/api/v1/agents/${destAgentId}/destinations/${destId}`)
          .set(auth(adminToken))
          .expect(404);
        await S()
          .patch(`/api/v1/agents/${destAgentId}/destinations/${destId}`)
          .set(auth(adminToken))
          .send({ isActive: true })
          .expect(404);
        await S()
          .delete(`/api/v1/agents/${destAgentId}/destinations/${destId}`)
          .set(auth(adminToken))
          .expect(404);
      },
      30000,
    );

    it(
      'B6 unknown agentId -> 404 on all four verbs',
      async () => {
        const unknown = `PZ${tag}AGENT`;
        await S().get(`/api/v1/agents/${unknown}/destinations`).set(auth(adminToken)).expect(404);
        await S()
          .post(`/api/v1/agents/${unknown}/destinations`)
          .set(auth(adminToken))
          .send({ portId: portBId })
          .expect(404);
        await S()
          .patch(`/api/v1/agents/${unknown}/destinations/nope-${tag}`)
          .set(auth(adminToken))
          .send({ isActive: false })
          .expect(404);
        await S()
          .delete(`/api/v1/agents/${unknown}/destinations/nope-${tag}`)
          .set(auth(adminToken))
          .expect(404);
      },
      30000,
    );
  });
});
