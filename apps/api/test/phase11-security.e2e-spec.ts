import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/common/infrastructure/audit/audit.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Opt-in only: run against a NEW, expressly named, isolated test database with
 * the Phase 11 migration, core seed and a NON-OWNER runtime DB login. Never
 * point this suite at an owner database (including duna_seed_test).
 */
describe('Phase 11 audit and privilege denials (isolated database)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let ready = false;
  let ownerToken = '';
  let managerToken = '';
  let ownerId = '';
  let managerId = '';
  let exporterUserId = '';
  let protectedUserId = '';
  let managerRoleId = '';
  let protectedRoleId = '';
  let exporterRoleId = '';
  let readId = '';
  let exportId = '';
  let rolePermissionId = '';
  let userRolesId = '';
  let userCreateId = '';
  const tag = Math.random().toString(36).slice(2, 9).toUpperCase();
  const email = `phase11-${tag.toLowerCase()}@example.test`;
  const password = 'TestOnly123!';
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const path = '/api/v1';
  const server = () => request(app.getHttpServer());

  beforeAll(async () => {
    const expectedDb = process.env.PHASE11_ISOLATED_TEST_DB_NAME;
    if (!expectedDb || !/^duna_phase11_[a-z0-9_]+$/.test(expectedDb)) {
      throw new Error('Set PHASE11_ISOLATED_TEST_DB_NAME to a newly created isolated Phase 11 database');
    }
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix(path.slice(1));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true,
      transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
    db = app.get(PrismaService);
    const [identity] = await db.$queryRaw<Array<{ db: string; role: string; owner: string;
      superuser: boolean; triggers: number; canUpdate: boolean; canDelete: boolean }>>`
      SELECT current_database()::text AS db, current_user::text AS role,
        pg_get_userbyid(c.relowner)::text AS owner,
        r.rolsuper AS superuser,
        (SELECT count(*)::int FROM pg_trigger WHERE tgrelid = c.oid AND tgenabled = 'A'
          AND tgname IN ('phase11_audit_no_update_delete', 'phase11_audit_no_truncate')) AS triggers,
        has_table_privilege(current_user, c.oid, 'UPDATE') AS "canUpdate",
        has_table_privilege(current_user, c.oid, 'DELETE') AS "canDelete"
      FROM pg_class c JOIN pg_roles r ON r.rolname = current_user
      WHERE c.oid = 'public."AuditLog"'::regclass`;
    if (!identity || identity.db !== expectedDb || identity.role === identity.owner ||
        identity.superuser || identity.triggers !== 2 || identity.canUpdate || identity.canDelete) {
      throw new Error('Isolated DB, separated runtime role and append-only triggers are mandatory');
    }
    ready = true;
    const owner = await server().post(`${path}/auth/login`).send({
      email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
      password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
    }).expect(200);
    ownerToken = owner.body.data.accessToken;
    ownerId = owner.body.data.user.id;
    const permissions = await server().get(`${path}/permissions/all`).set(bearer(ownerToken)).expect(200);
    const idOf = (code: string): string => {
      const found = permissions.body.data.find((p: { code: string }) => p.code === code);
      if (!found) throw new Error(`Missing ${code} permission; seed first`);
      return found.id;
    };
    readId = idOf('audit:read'); exportId = idOf('audit:export');
    rolePermissionId = idOf('role:permissions'); userRolesId = idOf('user:roles');
    userCreateId = idOf('user:create');
    const roleUpdateId = idOf('role:update');
    const userUpdateId = idOf('user:update');
    const userActiveId = idOf('user:activate');
    const exporter = await db.role.findUnique({ where: { code: 'AUDIT_EXPORTER' },
      select: { id: true, users: { select: { userId: true } } } });
    if (!exporter || exporter.users.length) throw new Error('Export role must begin unassigned in isolated fixture');
    exporterRoleId = exporter.id;
    const created = await server().post(`${path}/roles`).set(bearer(ownerToken)).send({
      code: `P11_${tag}`, name: 'Phase 11 test-only manager',
    }).expect(201);
    managerRoleId = created.body.data.id;
    await server().patch(`${path}/roles/${managerRoleId}/permissions`).set(bearer(ownerToken))
      .send({ permissionIds: [readId, rolePermissionId, roleUpdateId, userRolesId,
        userCreateId, userUpdateId, userActiveId] }).expect(200);
    const user = await server().post(`${path}/users`).set(bearer(ownerToken)).send({
      email, password, fullName: 'Phase 11 test manager', roleIds: [managerRoleId],
    }).expect(201);
    managerId = user.body.data.id;
    const manager = await server().post(`${path}/auth/login`).send({ email, password }).expect(200);
    managerToken = manager.body.data.accessToken;
  }, 60000);

  afterAll(async () => {
    // Only test-owned relational fixtures are cleaned. AuditLog is NEVER deleted.
    if (ready && db) {
      if (exporterUserId) {
        await db.userRole.deleteMany({ where: { userId: exporterUserId } });
        await db.user.delete({ where: { id: exporterUserId } });
      }
      if (protectedUserId) {
        await db.refreshToken.deleteMany({ where: { userId: protectedUserId } });
        await db.userRole.deleteMany({ where: { userId: protectedUserId } });
        await db.user.delete({ where: { id: protectedUserId } });
      }
      if (managerId) {
        await db.refreshToken.deleteMany({ where: { userId: managerId } });
        await db.userRole.deleteMany({ where: { userId: managerId } });
        await db.user.delete({ where: { id: managerId } });
      }
      if (managerRoleId) {
        await db.rolePermission.deleteMany({ where: { roleId: managerRoleId } });
        await db.role.delete({ where: { id: managerRoleId } });
      }
      if (protectedRoleId) {
        await db.rolePermission.deleteMany({ where: { roleId: protectedRoleId } });
        await db.role.delete({ where: { id: protectedRoleId } });
      }
    }
    await app?.close();
  });

  it('browsing is independent of exporting; export is bounded and atomically logs the actor', async () => {
    await server().get(`${path}/audit`).expect(401);
    await server().get(`${path}/audit`).set(bearer(managerToken)).expect(200);
    const grant = await db.auditLog.findFirst({ where: {
      action: 'role:permissions:set', entityType: 'Role', entityId: managerRoleId,
    } });
    expect(grant?.actorId).toBe(ownerId);
    expect(grant?.afterData).toMatchObject({ permissionCodes: expect.arrayContaining([
      'user:create', 'user:update', 'audit:read',
    ]) });
    const managerCreation = await db.auditLog.findFirst({ where: {
      action: 'user:create', entityType: 'User', entityId: managerId,
    } });
    expect(managerCreation?.actorId).toBe(ownerId);
    expect(JSON.stringify(managerCreation)).not.toContain(password);
    const from = new Date(Date.now() - 60 * 60_000).toISOString();
    // Bound the window at request time: setup just created the role, so a
    // one-second lookback would incorrectly exclude the event under test.
    const to = new Date().toISOString();
    const endpoint = `${path}/audit/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` +
      `&entityType=Role&entityId=${managerRoleId}&limit=20`;
    const before = await db.auditLog.count({ where: { action: 'audit.export', actorId: ownerId } });
    await server().get(endpoint).expect(401);
    await server().get(endpoint).set(bearer(managerToken)).expect(403);
    expect(await db.auditLog.count({ where: { action: 'audit.export', actorId: ownerId } })).toBe(before);
    const exportResult = await server().get(endpoint).set(bearer(ownerToken)).expect(200);
    expect(exportResult.headers['content-type']).toContain('text/csv');
    expect(exportResult.headers['cache-control']).toBe('no-store');
    expect(exportResult.text).toContain('role:create');
    const logged = await db.auditLog.findFirst({ where: { action: 'audit.export', actorId: ownerId },
      orderBy: { createdAt: 'desc' } });
    expect(logged?.actorEmail).toBe((process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase());
    expect(logged?.metadata).toEqual(expect.objectContaining({ preparedRows: expect.any(Number), offset: 0 }));
    expect(await db.auditLog.count({ where: { action: 'audit.export', actorId: ownerId } })).toBe(before + 1);
    await server().get(`${path}/audit/export?from=2020-01-01&to=${encodeURIComponent(to)}`)
      .set(bearer(ownerToken)).expect(400);
    await server().get(`${path}/audit/export?from=${encodeURIComponent(from)}&to=2999-01-01`)
      .set(bearer(ownerToken)).expect(400);
  });

  it('even a manager with role/user management cannot grant export or impersonate the primary admin', async () => {
    const prior = await db.rolePermission.findMany({ where: { roleId: managerRoleId },
      select: { permissionId: true } });
    await server().patch(`${path}/roles/${managerRoleId}/permissions`).set(bearer(managerToken))
      .send({ permissionIds: [...prior.map((p) => p.permissionId), exportId] }).expect(403);
    const financial = await db.permission.findUniqueOrThrow({ where: { code: 'journal:post' } });
    await server().patch(`${path}/roles/${managerRoleId}/permissions`).set(bearer(managerToken))
      .send({ permissionIds: [...prior.map((p) => p.permissionId), financial.id] }).expect(403);
    // Not even the owner can attach audit:export to an arbitrary role.
    await server().patch(`${path}/roles/${managerRoleId}/permissions`).set(bearer(ownerToken))
      .send({ permissionIds: [...prior.map((p) => p.permissionId), exportId] }).expect(403);
    await server().patch(`${path}/users/${managerId}/roles`).set(bearer(managerToken))
      .send({ roleIds: [managerRoleId, exporterRoleId] }).expect(403);
    await server().post(`${path}/users`).set(bearer(managerToken)).send({
      email: `forbidden-${tag.toLowerCase()}@example.test`, password, fullName: 'Forbidden exporter',
      roleIds: [exporterRoleId],
    }).expect(403);
    const adminRole = await db.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
    await server().patch(`${path}/users/${managerId}/roles`).set(bearer(managerToken))
      .send({ roleIds: [managerRoleId, adminRole.id] }).expect(403);
    await server().post(`${path}/users`).set(bearer(managerToken)).send({
      email: `forbidden-admin-${tag.toLowerCase()}@example.test`, password,
      fullName: 'Forbidden administrator', roleIds: [adminRole.id],
    }).expect(403);
    await server().post(`${path}/users/primary-admin/transfer`).set(bearer(managerToken))
      .send({ userId: managerId }).expect(403);
    // user:update must not let a delegated manager reset the owner's password
    // and log in as the owner, nor reset a separate audit exporter.
    const ownerBefore = await db.user.findUniqueOrThrow({ where: { id: ownerId },
      select: { email: true, passwordHash: true } });
    await server().post(`${path}/users/${ownerId}/reset-password`).set(bearer(managerToken))
      .send({ newPassword: 'Forbidden123!' }).expect(403);
    await server().patch(`${path}/users/${ownerId}`).set(bearer(managerToken))
      .send({ email: `hijacked-${tag.toLowerCase()}@example.test` }).expect(403);
    await server().patch(`${path}/users/${ownerId}/active`).set(bearer(managerToken))
      .send({ isActive: false }).expect(403);
    await server().patch(`${path}/users/${ownerId}/roles`).set(bearer(managerToken))
      .send({ roleIds: [managerRoleId] }).expect(403);
    const protectedUser = await server().post(`${path}/users`).set(bearer(ownerToken)).send({
      email: `exporter-${tag.toLowerCase()}@example.test`, password,
      fullName: 'Protected exporter fixture', roleIds: [exporterRoleId],
    }).expect(201);
    exporterUserId = protectedUser.body.data.id;
    await server().post(`${path}/users/${exporterUserId}/reset-password`).set(bearer(managerToken))
      .send({ newPassword: 'Forbidden123!' }).expect(403);
    await server().patch(`${path}/users/${exporterUserId}/active`).set(bearer(managerToken))
      .send({ isActive: false }).expect(403);
    expect(await db.user.findUniqueOrThrow({ where: { id: ownerId },
      select: { email: true, passwordHash: true } })).toEqual(ownerBefore);
    expect((await db.rolePermission.findMany({ where: { roleId: managerRoleId },
      select: { permissionId: true } })).map((p) => p.permissionId).sort())
      .toEqual(prior.map((p) => p.permissionId).sort());
    expect(await db.userRole.count({ where: { userId: managerId, roleId: exporterRoleId } })).toBe(0);
    expect(await db.user.count({ where: { email: { in: [
      `forbidden-${tag.toLowerCase()}@example.test`,
      `forbidden-admin-${tag.toLowerCase()}@example.test`,
    ] } } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: ownerId } })).isPrimaryAdmin).toBe(true);
  });

  it('delegated role editor cannot resurrect an owner-only release delegation or change stronger roles', async () => {
    const releaseId = (await db.permission.findUniqueOrThrow({
      where: { code: 'release:override' }, select: { id: true },
    })).id;
    const created = await server().post(`${path}/roles`).set(bearer(ownerToken))
      .send({ code: `P11_PRIV_${tag}`, name: 'Owner-only release role' }).expect(201);
    protectedRoleId = created.body.data.id;
    await server().patch(`${path}/roles/${protectedRoleId}/permissions`).set(bearer(ownerToken))
      .send({ permissionIds: [releaseId] }).expect(200);
    const member = await server().post(`${path}/users`).set(bearer(ownerToken)).send({
      email: `release-member-${tag.toLowerCase()}@example.test`, password,
      fullName: 'Owner-delegated release approver', roleIds: [protectedRoleId],
    }).expect(201);
    protectedUserId = member.body.data.id;
    const original = await db.user.findUniqueOrThrow({ where: { id: protectedUserId },
      select: { email: true, passwordHash: true, isActive: true } });
    // Even if a role editor merely renames, revokes, or deactivates this role,
    // the action changes an authority they cannot delegate to begin with.
    await server().patch(`${path}/roles/${protectedRoleId}`).set(bearer(managerToken))
      .send({ name: 'Deceptive role' }).expect(403);
    await server().patch(`${path}/roles/${protectedRoleId}/permissions`).set(bearer(managerToken))
      .send({ permissionIds: [rolePermissionId] }).expect(403);
    await server().patch(`${path}/roles/${protectedRoleId}/active`).set(bearer(managerToken))
      .send({ isActive: false }).expect(403);
    await server().patch(`${path}/roles/${protectedRoleId}/active`).set(bearer(ownerToken))
      .send({ isActive: false }).expect(200);
    // Inactive memberships remain in the DB. Reactivation must not silently
    // restore an owner's explicitly delegated release:override authority.
    await server().patch(`${path}/roles/${protectedRoleId}/active`).set(bearer(managerToken))
      .send({ isActive: true }).expect(403);
    // Inactivity does not erase a membership: resetting its user's password
    // today would hijack release authority if the owner reactivates it later.
    await server().post(`${path}/users/${protectedUserId}/reset-password`).set(bearer(managerToken))
      .send({ newPassword: 'Forbidden123!' }).expect(403);
    await server().patch(`${path}/users/${protectedUserId}`).set(bearer(managerToken))
      .send({ email: `hijacked-release-${tag.toLowerCase()}@example.test` }).expect(403);
    await server().patch(`${path}/users/${protectedUserId}/active`).set(bearer(managerToken))
      .send({ isActive: false }).expect(403);
    await server().patch(`${path}/users/${protectedUserId}/roles`).set(bearer(managerToken))
      .send({ roleIds: [managerRoleId] }).expect(403);
    await server().post(`${path}/users`).set(bearer(ownerToken)).send({
      email: `inactive-release-${tag.toLowerCase()}@example.test`, password,
      fullName: 'Inactive role must not be assigned', roleIds: [protectedRoleId],
    }).expect(400);
    expect(await db.user.findUniqueOrThrow({ where: { id: protectedUserId },
      select: { email: true, passwordHash: true, isActive: true } })).toEqual(original);
    expect(await db.auditLog.count({ where: { entityType: 'User', entityId: protectedUserId,
      action: 'user:password:reset' } })).toBe(0);
    const role = await db.role.findUniqueOrThrow({ where: { id: protectedRoleId } });
    expect(role.deletedAt).not.toBeNull();
    expect(await db.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: protectedRoleId, permissionId: releaseId } },
    })).not.toBeNull();
  });

  it('authenticated-only logout cannot revoke another account’s refresh token', async () => {
    const login = await server().post(`${path}/auth/login`).send({
      email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
      password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
    }).expect(200);
    const refreshToken = login.body.data.refreshToken as string;
    await server().post(`${path}/auth/logout`).set(bearer(managerToken))
      .send({ refreshToken }).expect(200);
    await server().post(`${path}/auth/refresh`).send({ refreshToken }).expect(200);
  });

  it('a failed business transaction leaves neither its row nor its audit event', async () => {
    const audit = app.get(AuditService);
    let recordId = '';
    await expect(db.$transaction(async (tx) => {
      const role = await tx.role.create({ data: { code: `P11RB_${tag}`,
        name: 'Must roll back', isSystem: false } });
      recordId = role.id;
      await audit.recordIn(tx, { action: 'role:create', entityType: 'Role', entityId: recordId,
        actorId: ownerId, actorEmail: 'phase11-test@example.test',
        afterData: { code: role.code } });
      throw new Error('phase11 controlled rollback');
    })).rejects.toThrow('phase11 controlled rollback');
    expect(recordId).toBeTruthy();
    expect(await db.role.findUnique({ where: { id: recordId } })).toBeNull();
    expect(await db.auditLog.count({ where: { entityType: 'Role', entityId: recordId } })).toBe(0);
  });

  it('owner has no audit mutation endpoint; DB role rejects UPDATE, DELETE and TRUNCATE', async () => {
    const row = await db.auditLog.findFirstOrThrow({ where: { action: 'role:create', entityId: managerRoleId } });
    expect(row.actorId).toBe(ownerId);
    expect(row.afterData).toEqual(expect.objectContaining({ code: `P11_${tag}` }));
    await server().patch(`${path}/audit/${row.id}`).set(bearer(ownerToken))
      .send({ action: 'tampered' }).expect(404);
    await server().delete(`${path}/audit/${row.id}`).set(bearer(ownerToken)).expect(404);
    for (const run of [
      () => db.$executeRaw`UPDATE public."AuditLog" SET "action" = 'tampered' WHERE "id" = ${row.id}`,
      () => db.$executeRaw`DELETE FROM public."AuditLog" WHERE "id" = ${row.id}`,
      () => db.$executeRawUnsafe('TRUNCATE public."AuditLog"'),
    ]) {
      await expect(run()).rejects.toThrow(/42501|permission denied|append-only/i);
    }
    expect((await db.auditLog.findUniqueOrThrow({ where: { id: row.id } })).action).toBe('role:create');
  });
});
