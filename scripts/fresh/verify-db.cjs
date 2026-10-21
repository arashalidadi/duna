'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ROOT, TEST_DATABASE, OWNER_ROLE, RUNTIME_ROLE, EXPORT_ROLE } = require('./config.cjs');

function assertDatabaseUrl(raw, name, role, host) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid private database URL (value omitted)');
  }
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    url.hostname !== host ||
    (url.port && url.port !== '5432') ||
    decodeURIComponent(url.pathname.slice(1)) !== name ||
    decodeURIComponent(url.username) !== role ||
    !url.password ||
    url.searchParams.getAll('schema').length !== 1 ||
    url.searchParams.get('schema') !== 'public' ||
    [...url.searchParams.keys()].some((key) => key !== 'schema')
  ) {
    throw new Error(
      'Database URL does not identify the dedicated PG16 public-schema fresh target/role (value omitted)'
    );
  }
}

async function assertDatabaseIdentity(db, role, host) {
  const name = process.env.DUNA_FRESH_DATABASE;
  if (
    !name ||
    (!/^duna_fresh_[a-z0-9]{3,24}$/.test(name) && name !== TEST_DATABASE) ||
    (host === 'db' && name === TEST_DATABASE) ||
    (host === 'test-db' && name !== TEST_DATABASE)
  ) {
    throw new Error('Expected fresh database name missing or invalid');
  }
  assertDatabaseUrl(process.env.DATABASE_URL, name, role, host);
  const [row] = await db.$queryRawUnsafe(`
    SELECT current_database()::text AS database, current_user::text AS role,
      session_user::text AS session, current_setting('server_version_num')::int AS version,
      r.rolsuper AS superuser, r.rolcreaterole AS "createRole", r.rolcreatedb AS "createDb",
      r.rolreplication AS replication, r.rolbypassrls AS "bypassRls",
      EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid) AS "memberOfRole"
    FROM pg_roles r WHERE r.rolname = current_user`);
  if (
    !row ||
    row.database !== name ||
    row.role !== role ||
    row.session !== role ||
    row.version < 160000 ||
    row.version >= 170000 ||
    (host === 'db' &&
      (row.superuser ||
        row.createRole ||
        row.createDb ||
        row.replication ||
        row.bypassRls ||
        row.memberOfRole)) ||
    (role === RUNTIME_ROLE && (row.superuser || row.createRole || row.createDb))
  ) {
    throw new Error('Connected PG16/database/role identity differs from explicit fresh target');
  }
  return row;
}

function expectedMigrations(root = ROOT) {
  const base = path.join(root, 'prisma/migrations');
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      checksum: crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(base, entry.name, 'migration.sql')))
        .digest('hex'),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function checkMigrationHistory(expected, rows) {
  // The baseline-only branch ships a squashed migration history, so the count
  // must match the committed files exactly instead of a fixed minimum.
  if (expected.length < 1 || rows.length !== expected.length) {
    throw new Error('Migration journal is incomplete or contains unknown entries');
  }
  const known = new Map(expected.map((row) => [row.name, row.checksum]));
  if (
    new Set(rows.map((row) => row.name)).size !== rows.length ||
    rows.some((row) => !row.finished || row.rolledBack || known.get(row.name) !== row.checksum)
  ) {
    throw new Error(
      'Migration history/checksum differs from committed files; stop without repair/reset'
    );
  }
}
async function verifyMigrations(db) {
  const rows = await db.$queryRawUnsafe(`
    SELECT migration_name::text AS name, checksum::text,
      (finished_at IS NOT NULL) AS finished, (rolled_back_at IS NOT NULL) AS "rolledBack"
    FROM public._prisma_migrations`);
  const expected = expectedMigrations();
  checkMigrationHistory(expected, rows);
  const [audit] = await db.$queryRawUnsafe(`
    SELECT count(*)::int AS total FROM pg_trigger
    WHERE tgrelid = 'public."AuditLog"'::regclass AND tgenabled = 'A'
      AND tgname IN ('phase11_audit_no_update_delete', 'phase11_audit_no_truncate')`);
  if (audit?.total !== 2) throw new Error('Append-only audit triggers not enabled after migration');
  console.log(
    `Fresh migrations verified: ${expected.length} committed, applied, matching checksums; audit triggers enabled`
  );
}
async function verifySeed(db) {
  const email = process.env.SEED_ADMIN_EMAIL;
  if (!email || !process.env.SEED_ADMIN_PASSWORD || process.env.SEED_DEMO_DATA === 'true') {
    throw new Error('Fresh administrator credentials and non-demo seed mode required');
  }
  const admin = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      isPrimaryAdmin: true,
      isActive: true,
      roles: { select: { role: { select: { code: true } } } },
    },
  });
  const exporter = await db.role.findUnique({
    where: { code: 'AUDIT_EXPORTER' },
    select: { users: { select: { userId: true } } },
  });
  const permissions = await db.permission.findMany({
    where: { code: { in: ['audit:read', 'audit:export', 'backup:restore', 'archive:delete'] } },
    select: { code: true },
  });
  const categories = await db.voyageCostCategory.count();
  const currencies = await db.currency.count();
  const demos = await Promise.all([
    db.customer.count(),
    db.cargo.count(),
    db.vessel.count(),
    db.voyage.count(),
    db.loadList.count(),
  ]);
  const retention = await db.retentionPolicy.count();
  if (
    !admin?.isPrimaryAdmin ||
    !admin.isActive ||
    !admin.roles.some(({ role }) => role.code === 'ADMIN') ||
    !exporter ||
    exporter.users.length ||
    permissions.length !== 4 ||
    categories < 5 ||
    currencies < 2 ||
    demos.some(Boolean) ||
    retention !== 0
  ) {
    throw new Error(
      'Fresh structural seed/admin verification failed; do not continue with demo or incomplete data'
    );
  }
  console.log(
    'Fresh seed verified: initial primary admin, roles/reference values, no business fixtures or retention policy'
  );
}
async function verifyRuntime(db) {
  const [row] = await db.$queryRawUnsafe(`
    SELECT has_table_privilege(current_user, 'public."AuditLog"', 'SELECT') AS "canReadAudit",
      has_table_privilege(current_user, 'public."AuditLog"', 'INSERT') AS "canInsertAudit",
      has_table_privilege(current_user, 'public."AuditLog"', 'UPDATE') AS "canUpdateAudit",
      has_table_privilege(current_user, 'public."AuditLog"', 'DELETE') AS "canDeleteAudit",
      has_table_privilege(current_user, 'public._prisma_migrations', 'SELECT') AS "canReadJournal"`);
  const [exporter] = await db.$queryRawUnsafe(
    `
    SELECT r.rolcanlogin AS login, r.rolsuper AS superuser, r.rolcreaterole AS "createRole",
      r.rolcreatedb AS "createDb", r.rolbypassrls AS "bypassRls",
      EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid) AS member,
      has_database_privilege(r.oid, current_database(), 'CONNECT') AS "canConnect",
      has_schema_privilege(r.oid, 'public', 'USAGE') AS "canUseSchema",
      has_table_privilege(r.oid, 'public."AuditLog"', 'SELECT') AS "canReadAudit",
      has_table_privilege(r.oid, 'public."AuditLog"', 'INSERT') AS "canInsertAudit",
      has_table_privilege(r.oid, 'public."User"', 'SELECT') AS "canReadUser"
    FROM pg_roles r WHERE r.rolname = $1`,
    EXPORT_ROLE
  );
  if (
    !row?.canReadAudit ||
    !row.canInsertAudit ||
    row.canUpdateAudit ||
    row.canDeleteAudit ||
    row.canReadJournal ||
    !exporter ||
    exporter.login ||
    exporter.superuser ||
    exporter.createRole ||
    exporter.createDb ||
    exporter.bypassRls ||
    exporter.member ||
    exporter.canConnect ||
    !exporter.canUseSchema ||
    !exporter.canReadAudit ||
    exporter.canInsertAudit ||
    exporter.canReadUser ||
    (await db.user.count()) < 1 ||
    (await db.permission.count()) < 1
  ) {
    throw new Error(
      'Restricted runtime/exporter grants and seed reads differ from reviewed fresh plan'
    );
  }
  console.log(
    'Fresh API credential verified: restricted login, DB model reads, append-only audit, NOLOGIN exporter, no migration journal read'
  );
}
async function main(stage) {
  const { PrismaClient } = require('@prisma/client');
  const role = stage === 'runtime' ? RUNTIME_ROLE : OWNER_ROLE;
  if (!['migrations', 'seed', 'runtime'].includes(stage))
    throw new Error('Unknown fresh database check');
  const db = new PrismaClient();
  try {
    await assertDatabaseIdentity(db, role, 'db');
    if (stage !== 'runtime') await verifyMigrations(db);
    if (stage === 'seed') await verifySeed(db);
    if (stage === 'runtime') await verifyRuntime(db);
  } finally {
    await db.$disconnect();
  }
}
if (require.main === module) {
  main(process.argv[2]).catch(() => {
    console.error(
      'Fresh database verification failed (details suppressed; no repair/reset attempted)'
    );
    process.exitCode = 1;
  });
}
module.exports = {
  assertDatabaseUrl,
  assertDatabaseIdentity,
  expectedMigrations,
  checkMigrationHistory,
  verifyMigrations,
  verifySeed,
  verifyRuntime,
};
