import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Phase 2 — Authentication + RBAC end-to-end tests.
 * These run against the live development database (documented limitation).
 * They are non-destructive: they create throwaway users/roles under random
 * names and clean up after themselves where feasible.
 */
describe('Auth & RBAC (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const codeTag = randomTag.toUpperCase();

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
  }, 30000);

  afterAll(async () => {
    // Clean up throwaway roles/users created by this suite so the shared dev
    // database does not accumulate test artifacts across runs.
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const suffixes = [codeTag];
      await prisma.role.deleteMany({
        where: { code: { in: suffixes.map((s) => [`ROLE_${s}`, `CONSUMER_${s}`, `SELF${s}`]).flat() } },
      });
      await prisma.user.deleteMany({
        where: {
          email: { in: [
            `reader-${randomTag}@shipping.local`,
            `consumer-${randomTag}@shipping.local`,
            `self-${randomTag}@shipping.local`,
          ] },
        },
      });
      await prisma.$disconnect();
    } catch {
      /* best-effort cleanup */
    }
    await app.close();
  });

  async function adminServer() {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: admin.password })
      .expect(200);
    const data = res.body.data;
    expect(data.accessToken).toBeDefined();
    expect(data.refreshToken).toBeDefined();
    return {
      accessToken: data.accessToken as string,
      refreshToken: data.refreshToken as string,
      user: data.user,
      permissions: data.permissions as string[],
    };
  }

  it('logs in as the seeded admin and returns tokens + permissions (no hash leaked)', async () => {
    const s = await adminServer();
    expect(s.user.email).toBe(admin.email);
    expect(s.user.passwordHash).toBeUndefined();
    expect(s.permissions).toContain('user:read');
    expect(s.permissions).toContain('auth:read');
    expect(s.permissions.length).toBeGreaterThan(0);
  });

  it('rejects login with wrong password (generic 401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'DefinitelyWrong!1' })
      .expect(401);
    expect(res.body.success).toBe(false);
    expect(String(res.body.error.message)).toContain('Invalid email or password');
  });

  it('rejects login for unknown email (generic 401, no account enumeration)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `nobody-${randomTag}@shipping.local`, password: 'Whatever!1' })
      .expect(401);
    expect(String(res.body.error.message)).toContain('Invalid email or password');
  });

  it('rejects login with invalid payload shape (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email' })
      .expect(400);
  });

  it('GET /auth/me returns the current user with a valid token', async () => {
    const s = await adminServer();
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${s.accessToken}`)
      .expect(200);
    expect(res.body.data.user.email).toBe(admin.email);
    expect(res.body.data.user.roles.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.permissions)).toBe(true);
    expect(res.body.data.permissions.length).toBeGreaterThan(0);
  });

  it('GET /auth/me without a token is 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('protected resource (GET /users) requires authentication (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/users').expect(401);
  });

  it('admin can list users and no user payload contains a password hash', async () => {
    const s = await adminServer();
    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${s.accessToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.data)).toBe(true);
    const serialized = JSON.stringify(res.body.data.data);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('$2b$');
  });

  it('rejects a tampered/invalid token with 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', 'Bearer not.a.valid.jwt')
      .expect(401);
  });

  describe('RBAC enforcement', () => {
    let lowPrivToken: string;
    let restrictedAdminToken: string;

    beforeAll(async () => {
      const s = await adminServer();

      // A read-only role with only currency:read.
      const roleRes = await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${s.accessToken}`)
        .send({ code: `ROLE_${codeTag}`, name: `Reader ${randomTag}` })
        .expect(201);
      const roleId = roleRes.body.data.id as string;

      // Assign only currency:read to it.
      const permsRes = await request(app.getHttpServer())
        .get('/api/v1/permissions/all')
        .set('Authorization', `Bearer ${s.accessToken}`)
        .expect(200);
      const currencyRead = permsRes.body.data.find(
        (p: { code: string }) => p.code === 'currency:read'
      );
      expect(currencyRead).toBeDefined();
      await request(app.getHttpServer())
        .patch(`/api/v1/roles/${roleId}/permissions`)
        .set('Authorization', `Bearer ${s.accessToken}`)
        .send({ permissionIds: [currencyRead.id] })
        .expect(200);

      // A user granted only that role.
      const email = `reader-${randomTag}@shipping.local`;
      const userRes = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${s.accessToken}`)
        .send({ email, password: 'ReaderPass!234', fullName: 'Reader', roleIds: [roleId] })
        .expect(201);
      expect(userRes.body.data.roles.length).toBe(1);

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'ReaderPass!234' })
        .expect(200);
      lowPrivToken = login.body.data.accessToken as string;
    });

    it('a user with currency:read can read currencies (200)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/currencies')
        .set('Authorization', `Bearer ${lowPrivToken}`)
        .expect(200);
    });

    it('the same user is forbidden from /users (403), not just 401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${lowPrivToken}`)
        .expect(403);
      expect(String(res.body.error.message)).toContain('Insufficient permissions');
    });

    it('the same user is forbidden from writing a port (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/ports')
        .set('Authorization', `Bearer ${lowPrivToken}`)
        .send({ code: 'NOPE', name: 'No write' })
        .expect(403);
    });
  });

  describe('refresh token rotation & reuse detection', () => {
    it('rotates the refresh token on use, and reuse of the old one is rejected', async () => {
      const s = await adminServer();
      const refresh1 = s.refreshToken;

      const first = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: refresh1 })
        .expect(200);
      const access2 = first.body.data.accessToken as string;
      const refresh2 = first.body.data.refreshToken as string;
      expect(access2).toBeDefined();
      expect(refresh2).toBeDefined();
      expect(refresh2).not.toBe(refresh1);

      // Old (now replaced) token presented again => reuse detected.
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: refresh1 })
        .expect(401);

      // The rotated token still works.
      const second = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: refresh2 })
        .expect(200);
      expect(second.body.data.accessToken).toBeDefined();
    });

    it('rejects a garbage refresh token with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'deadbeef'.repeat(12) })
        .expect(401);
    });

    it('logout revokes the refresh token', async () => {
      const s = await adminServer();
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${s.accessToken}`)
        .send({ refreshToken: s.refreshToken })
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: s.refreshToken })
        .expect(401);
    });
  });

  describe('roles & permissions administration', () => {
    it('lists permission modules and permissions', async () => {
      const s = await adminServer();
      const res = await request(app.getHttpServer())
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${s.accessToken}`)
        .expect(200);
      expect(res.body.data.data.length).toBeGreaterThan(0);
      const codes = res.body.data.data.map((p: { code: string }) => p.code);
      expect(codes).toContain('auth:read');
    });

    it('lists roles with user counts and permissions', async () => {
      const s = await adminServer();
      // Walk the paginated list (pageSize caps at 100) until exhausted: parallel e2e suites
      // transiently mint dozens of fixture roles, which can push seeded roles past page 1.
      // The assertion is unchanged — ADMIN and OPERATIONS must be listable via the API.
      const roles: { code: string; userCount: number }[] = [];
      for (let page = 1; page <= 3; page += 1) {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/roles?pageSize=100&page=${page}`)
          .set('Authorization', `Bearer ${s.accessToken}`)
          .expect(200);
        const rows = res.body.data.data as { code: string; userCount: number }[];
        roles.push(...rows);
        if (rows.length < 100) break;
      }
      expect(roles.some((r) => r.code === 'ADMIN')).toBe(true);
      expect(roles.some((r) => r.code === 'OPERATIONS')).toBe(true);
    });
  });

  describe('privilege escalation guards', () => {
    it('a low-priv user cannot create another user (403)', async () => {
      // Reuse the low-priv token path via a fresh login is expensive; instead
      // prove the permission check by calling /users POST without user:create.
      const s = await adminServer();
      // Create a role with only user:read (no user:create) and a user on it.
      const roleRes = await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${s.accessToken}`)
        .send({ code: `CONSUMER_${codeTag}`, name: `Consumer ${codeTag}` })
        .expect(201);
      const roleId = roleRes.body.data.id as string;

      const permsRes = await request(app.getHttpServer())
        .get('/api/v1/permissions/all')
        .set('Authorization', `Bearer ${s.accessToken}`)
        .expect(200);
      const userRead = permsRes.body.data.find((p: { code: string }) => p.code === 'user:read');
      const dashboardRead = permsRes.body.data.find(
        (p: { code: string }) => p.code === 'dashboard:read'
      );
      await request(app.getHttpServer())
        .patch(`/api/v1/roles/${roleId}/permissions`)
        .set('Authorization', `Bearer ${s.accessToken}`)
        .send({ permissionIds: [userRead.id, dashboardRead.id] })
        .expect(200);

      const email = `consumer-${randomTag}@shipping.local`;
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${s.accessToken}`)
        .send({ email, password: 'Consumer!234', fullName: 'Consumer', roleIds: [roleId] })
        .expect(201);

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Consumer!234' })
        .expect(200);
      const token = login.body.data.accessToken as string;

      // user:read but NOT user:create => cannot create users.
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: `x-${randomTag}@shipping.local`, password: 'Xx!234567', fullName: 'X', roleIds: [roleId] })
        .expect(403);
    });
  });

  describe('user self-service password change', () => {
    it('a user can change their own password and is forced to use the new one', async () => {
      const s = await adminServer();

      // Dedicated account so we never mutate the shared admin credentials.
      const roleRes = await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${s.accessToken}`)
        .send({ code: `SELF${codeTag}`, name: `Self ${randomTag}` })
        .expect(201);
      const roleId = roleRes.body.data.id as string;
      const permsRes = await request(app.getHttpServer())
        .get('/api/v1/permissions/all')
        .set('Authorization', `Bearer ${s.accessToken}`)
        .expect(200);
      const dashRead = permsRes.body.data.find(
        (p: { code: string }) => p.code === 'dashboard:read'
      );
      await request(app.getHttpServer())
        .patch(`/api/v1/roles/${roleId}/permissions`)
        .set('Authorization', `Bearer ${s.accessToken}`)
        .send({ permissionIds: [dashRead.id] })
        .expect(200);

      const email = `self-${randomTag}@shipping.local`;
      const password = 'SelfPass!123';
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${s.accessToken}`)
        .send({ email, password, fullName: 'Self', roleIds: [roleId] })
        .expect(201);

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const myToken = login.body.data.accessToken as string;
      const myRefresh = login.body.data.refreshToken as string;

      // Wrong current password is rejected.
      const newPass = `Temp${randomTag}!1`;
      await request(app.getHttpServer())
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${myToken}`)
        .send({ currentPassword: 'WrongCurrent!1', newPassword: newPass })
        .expect(400);

      // Correct current password succeeds; old refresh token is revoked.
      await request(app.getHttpServer())
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${myToken}`)
        .send({ currentPassword: password, newPassword: newPass })
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: myRefresh })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: newPass })
        .expect(200);
    });
  });
});