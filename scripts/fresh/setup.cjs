/**
 * Isolated new-server installer, in one module.
 *
 * On 2026-10-20 the four library modules that used to sit beside this file
 * (config, verify-db, grants, smoke) were folded in. healthcheck.cjs and
 * integration-run.cjs stay separate because they are CLI entry points, not
 * libraries, and now read their configuration from this module. Each keeps its own block scope below, so its locals cannot collide with
 * another module's, and the exported surface is unchanged: every name this
 * installer used to export is still exported here.
 *
 * Run it with: pnpm setup [--upgrade|--status|--health|--integration]
 */
'use strict';

/** Each block below publishes its exports here; later blocks read from it. */
const MODULES = {};

// ---- config.cjs ----
{
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_FILE = path.join(ROOT, '.env.fresh.local');
const STATE_DIR = path.join(ROOT, '.fresh-setup');
const TEST_DATABASE = 'duna_fresh_integration_test';
const OWNER_ROLE = 'shipping';
const RUNTIME_ROLE = 'shipping_runtime_p11';
const EXPORT_ROLE = 'shipping_audit_export_p11';
const KEYS = Object.freeze([
  'FRESH_INSTANCE_ID',
  'FRESH_DATABASE_NAME',
  'FRESH_NEW_SERVER_ACK',
  'FRESH_DB_SUPER_PASSWORD',
  'FRESH_DB_OWNER_PASSWORD',
  'FRESH_DB_RUNTIME_PASSWORD',
  'FRESH_ADMIN_EMAIL',
  'FRESH_ADMIN_PASSWORD',
  'FRESH_AUTH_JWT_SECRET',
  'FRESH_AUTH_REFRESH_SECRET',
  'FRESH_ATTACHMENT_URL_SECRET',
]);
const SECRETS = Object.freeze([
  'FRESH_DB_SUPER_PASSWORD',
  'FRESH_DB_OWNER_PASSWORD',
  'FRESH_DB_RUNTIME_PASSWORD',
  'FRESH_ADMIN_PASSWORD',
  'FRESH_AUTH_JWT_SECRET',
  'FRESH_AUTH_REFRESH_SECRET',
  'FRESH_ATTACHMENT_URL_SECRET',
]);

function parseConfig(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const match = /^([A-Z_]+)=(.*)$/.exec(line);
    if (!match || !KEYS.includes(match[1]) || Object.hasOwn(values, match?.[1])) {
      throw new Error(
        'Fresh configuration has an unknown, repeated or malformed key; use .env.fresh.example'
      );
    }
    values[match[1]] = match[2];
  }
  for (const key of KEYS) {
    if (!values[key] || values[key] !== values[key].trim()) {
      throw new Error(`Fresh configuration requires a nonempty, unquoted ${key}`);
    }
  }
  if (!/^[a-z][a-z0-9-]{3,19}$/.test(values.FRESH_INSTANCE_ID)) {
    throw new Error('FRESH_INSTANCE_ID must be 4-20 lowercase letters, digits or hyphens');
  }
  if (
    !/^duna_fresh_[a-z0-9]{3,24}$/.test(values.FRESH_DATABASE_NAME) ||
    values.FRESH_DATABASE_NAME === TEST_DATABASE
  ) {
    throw new Error(
      'FRESH_DATABASE_NAME must be a dedicated duna_fresh_... database, not an owner/test database'
    );
  }
  if (values.FRESH_NEW_SERVER_ACK !== `NEW_EMPTY_SERVER:${values.FRESH_DATABASE_NAME}`) {
    throw new Error(
      'FRESH_NEW_SERVER_ACK must name the exact new empty database; existing installations are excluded'
    );
  }
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.FRESH_ADMIN_EMAIL) ||
    values.FRESH_ADMIN_EMAIL.length > 200 ||
    values.FRESH_ADMIN_EMAIL !== values.FRESH_ADMIN_EMAIL.toLowerCase()
  ) {
    throw new Error('FRESH_ADMIN_EMAIL must be a lowercase email address');
  }
  for (const key of SECRETS) {
    const value = values[key];
    const min = key === 'FRESH_ADMIN_PASSWORD' ? 16 : 32;
    if (
      value.length < min ||
      /[\x00-\x1f\x7f]/.test(value) ||
      /^(change.?me|example|password|placeholder|your)/i.test(value) ||
      value.startsWith('"') ||
      value.startsWith("'")
    ) {
      throw new Error(`${key} needs a private, unquoted secret of at least ${min} characters`);
    }
  }
  if (new Set(SECRETS.map((key) => values[key])).size !== SECRETS.length) {
    throw new Error('Fresh database, admin, signing and attachment secrets must be distinct');
  }
  return Object.freeze(values);
}

function loadConfig() {
  const stat = fs.lstatSync(CONFIG_FILE);
  if (!stat.isFile() || stat.mode & 0o077 || stat.uid !== process.getuid() || stat.size > 16_384) {
    throw new Error(
      '.env.fresh.local must be a regular, current-user-owned file with mode 0600 or 0400 (no symlinks)'
    );
  }
  return parseConfig(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function projectName(config) {
  return `duna-fresh-${config.FRESH_INSTANCE_ID}`;
}
function imageName(config) {
  return `${projectName(config)}:local`;
}
function statePath(config) {
  return path.join(STATE_DIR, `${config.FRESH_INSTANCE_ID}.json`);
}
function databaseUrl(host, database, role, password) {
  const url = new URL(`postgresql://${host}:5432/${database}`);
  url.username = role;
  url.password = password;
  url.searchParams.set('schema', 'public');
  return url.toString();
}
function composeEnvironment(config, testSecrets = {}) {
  // These values go to Docker Compose ONLY in its process environment, never
  // command arguments, console output, source files or a compose --env-file.
  const testPassword = testSecrets.password || randomBytes(36).toString('base64url');
  return {
    ...process.env,
    DUNA_FRESH_INSTANCE: config.FRESH_INSTANCE_ID,
    DUNA_FRESH_DATABASE: config.FRESH_DATABASE_NAME,
    DUNA_PG_SUPER_PASSWORD: config.FRESH_DB_SUPER_PASSWORD,
    DUNA_OWNER_DATABASE_URL: databaseUrl(
      'db',
      config.FRESH_DATABASE_NAME,
      OWNER_ROLE,
      config.FRESH_DB_OWNER_PASSWORD
    ),
    DUNA_RUNTIME_DATABASE_URL: databaseUrl(
      'db',
      config.FRESH_DATABASE_NAME,
      RUNTIME_ROLE,
      config.FRESH_DB_RUNTIME_PASSWORD
    ),
    DUNA_ADMIN_EMAIL: config.FRESH_ADMIN_EMAIL,
    DUNA_ADMIN_PASSWORD: config.FRESH_ADMIN_PASSWORD,
    DUNA_AUTH_JWT_SECRET: config.FRESH_AUTH_JWT_SECRET,
    DUNA_AUTH_REFRESH_SECRET: config.FRESH_AUTH_REFRESH_SECRET,
    DUNA_ATTACHMENT_URL_SECRET: config.FRESH_ATTACHMENT_URL_SECRET,
    DUNA_TEST_PASSWORD: testPassword,
    DUNA_TEST_DATABASE_URL: databaseUrl('test-db', TEST_DATABASE, OWNER_ROLE, testPassword),
    DUNA_TEST_ADMIN_PASSWORD: testSecrets.adminPassword || randomBytes(36).toString('base64url'),
  };
}

MODULES.config = {
  ROOT,
  CONFIG_FILE,
  STATE_DIR,
  TEST_DATABASE,
  OWNER_ROLE,
  RUNTIME_ROLE,
  EXPORT_ROLE,
  parseConfig,
  loadConfig,
  projectName,
  imageName,
  statePath,
  databaseUrl,
  composeEnvironment,
};
}

// ---- verify-db.cjs ----
{
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ROOT, TEST_DATABASE, OWNER_ROLE, RUNTIME_ROLE, EXPORT_ROLE } = MODULES.config;

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
/**
 * The repository ships a squashed migration history: an init baseline, the
 * ALTER TYPE ... ADD VALUE boundary PostgreSQL requires in its own
 * transaction, and the post-lifecycle baseline. The former count floor (48) was
 * a crude proxy for "history is complete"; the exact set is checked now, so a
 * deleted or renamed migration is caught by name. Adding a migration means
 * adding its name here — a deliberate, reviewable change.
 */
const EXPECTED_MIGRATION_NAMES = Object.freeze([
  '20260901000000_init_baseline',
  '20261004000000_bl_lifecycle_enum',
  '20261004000001_post_lifecycle_baseline',
]);
function checkMigrationHistory(expected, rows) {
  if (
    expected.map((row) => row.name).join('\n') !== EXPECTED_MIGRATION_NAMES.join('\n') ||
    rows.length !== expected.length
  ) {
    throw new Error(
      'Migration journal is incomplete or contains unknown entries; expected exactly: ' +
        EXPECTED_MIGRATION_NAMES.join(', ')
    );
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
// The folded verifyDb CLI block is inert when this single module runs as the
// installer entry: only the installer's own main() at the bottom runs. The
// standalone scripts/fresh/verify-db.cjs remains the CLI entry for compose runs.
MODULES.verifyDb = {
  assertDatabaseUrl,
  assertDatabaseIdentity,
  expectedMigrations,
  EXPECTED_MIGRATION_NAMES,
  checkMigrationHistory,
  verifyMigrations,
  verifySeed,
  verifyRuntime,
};
}

// ---- grants.cjs ----
{
'use strict';

const { ROOT, OWNER_ROLE, RUNTIME_ROLE, EXPORT_ROLE } = MODULES.config;
const { reviewedPlan } = require('../../apps/api/scripts/phase11-runtime-privileges.cjs');

function quoteId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z_0-9]*$/.test(value)) {
    throw new Error('Unreviewed database identifier in fresh privilege plan');
  }
  return `"${value}"`;
}
function checkCatalog(plan, tables, sequences, defaults) {
  const names = new Set(Object.keys(plan));
  const expected = new Set([...names, '_prisma_migrations']);
  if (
    new Set(tables.map((row) => row.name)).size !== expected.size ||
    tables.some((row) => !expected.has(row.name) || row.owner !== OWNER_ROLE)
  ) {
    throw new Error(
      'Fresh migration catalog does not match the reviewed 94-table owner-owned schema'
    );
  }
  const bySequence = new Set();
  for (const row of sequences) {
    if (
      bySequence.has(row.name) ||
      row.owner !== OWNER_ROLE ||
      !row.table ||
      !names.has(row.table) ||
      !/^[A-Za-z_][A-Za-z_0-9]*$/.test(row.name)
    ) {
      throw new Error('Unreviewed or unowned public sequence; stop before runtime grants');
    }
    bySequence.add(row.name);
  }
  for (const row of defaults) {
    if (
      plan[row.table]?.INSERT &&
      !sequences.some((seq) => seq.name === row.sequence && seq.table === row.table)
    ) {
      throw new Error(
        'Unmapped nextval default on an INSERT-enabled table; review sequence privileges'
      );
    }
  }
  return sequences
    .filter((row) => plan[row.table].INSERT)
    .map((row) => row.name)
    .sort();
}
function grantStatements(plan, sequenceNames) {
  if (
    Object.keys(plan).length !== 94 ||
    plan.AuditLog?.UPDATE ||
    plan.AuditLog?.DELETE ||
    plan.Permission?.INSERT ||
    plan._prisma_migrations
  ) {
    throw new Error('Runtime privilege review is out of date');
  }
  const statements = [
    `GRANT USAGE ON SCHEMA public TO ${quoteId(RUNTIME_ROLE)}`,
    `GRANT USAGE ON SCHEMA public TO ${quoteId(EXPORT_ROLE)}`,
    `GRANT SELECT ON TABLE public.${quoteId('AuditLog')} TO ${quoteId(EXPORT_ROLE)}`,
  ];
  for (const [table, rights] of Object.entries(plan)) {
    const ops = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].filter((op) => rights[op]);
    if (!ops.length) throw new Error('Empty reviewed table privilege');
    statements.push(
      `GRANT ${ops.join(', ')} ON TABLE public.${quoteId(table)} TO ${quoteId(RUNTIME_ROLE)}`
    );
  }
  if (sequenceNames.length) {
    statements.push(
      `GRANT USAGE ON SEQUENCE ${sequenceNames.map((name) => 'public.' + quoteId(name)).join(', ')} TO ${quoteId(RUNTIME_ROLE)}`
    );
  }
  return statements;
}

async function applyGrants() {
  const { PrismaClient } = require('@prisma/client');
  const { assertDatabaseIdentity } = MODULES.verifyDb;
  const db = new PrismaClient();
  try {
    await assertDatabaseIdentity(db, OWNER_ROLE, 'db');
    const plan = reviewedPlan(ROOT); // static source-aware 94-model gate
    const tables = await db.$queryRawUnsafe(`
      SELECT c.relname::text AS name, pg_get_userbyid(c.relowner)::text AS owner
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p')`);
    const sequences = await db.$queryRawUnsafe(`
      SELECT seq.relname::text AS name, pg_get_userbyid(seq.relowner)::text AS owner,
        tab.relname::text AS "table"
      FROM pg_class seq JOIN pg_namespace n ON n.oid = seq.relnamespace
      LEFT JOIN pg_depend dep ON dep.objid = seq.oid AND dep.classid = 'pg_class'::regclass
        AND dep.refclassid = 'pg_class'::regclass AND dep.deptype IN ('a','i')
      LEFT JOIN pg_class tab ON tab.oid = dep.refobjid
      WHERE n.nspname = 'public' AND seq.relkind = 'S'`);
    const defaults = await db.$queryRawUnsafe(`
      SELECT tab.relname::text AS "table",
        pg_get_serial_sequence(format('public.%I', tab.relname), att.attname)::regclass::text AS sequence
      FROM pg_attrdef def JOIN pg_attribute att ON att.attrelid = def.adrelid AND att.attnum = def.adnum
      JOIN pg_class tab ON tab.oid = def.adrelid JOIN pg_namespace n ON n.oid = tab.relnamespace
      WHERE n.nspname = 'public' AND pg_get_expr(def.adbin, def.adrelid) LIKE '%nextval(%'`);
    // regclass renders public sequences without the schema in some sessions;
    // extract the bare catalog identifier from pg_get_serial_sequence.
    const mappedDefaults = defaults.map((row) => ({
      table: row.table,
      sequence: row.sequence?.replace(/^public\./, '').replace(/^"|"$/g, ''),
    }));
    const needed = checkCatalog(plan, tables, sequences, mappedDefaults);
    const statements = grantStatements(plan, needed);
    await db.$transaction(
      async (tx) => {
        for (const statement of statements) await tx.$executeRawUnsafe(statement);
      },
      { timeout: 60_000 }
    );
    console.log(
      `Fresh runtime privileges: ${Object.keys(plan).length} reviewed tables, ${needed.length} required sequences; unassigned NOLOGIN exporter read-only on AuditLog; no journal/table wildcard grants`
    );
  } finally {
    await db.$disconnect();
  }
}
// The folded grants CLI block is inert when this single module runs as the
// installer entry; scripts/fresh/grants.cjs remains the compose-run CLI entry.
MODULES.grants = { quoteId, checkCatalog, grantStatements, applyGrants };
}

// ---- smoke.cjs ----
{
'use strict';

const BASE = 'http://127.0.0.1:3000';

async function request(path, options = {}) {
  const response = await fetch(BASE + path, {
    ...options,
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  });
  return response;
}
async function checkReadOnly(fetcher = request) {
  for (const page of ['/', '/fa/login']) {
    const response = await fetcher(page);
    if (
      !response.ok ||
      !(response.headers.get('content-type') || '').includes('text/html') ||
      !(await response.text()).includes('<html')
    ) {
      throw new Error('Web public page is not rendered');
    }
  }
  const response = await fetcher('/api/v1/health');
  const body = response.ok ? await response.json() : null;
  if (
    body?.data?.status !== 'ok' ||
    body?.data?.database?.status !== 'up' ||
    body?.data?.app?.environment !== 'production'
  ) {
    throw new Error('Web-proxied API/database health check failed');
  }
}
async function checkAdmin(email, password, fetcher = request) {
  if (!email || !password) throw new Error('Initial admin not configured for fresh login check');
  const login = await fetcher('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = login.ok ? await login.json() : null;
  const data = body?.data;
  if (
    !login.ok ||
    data?.user?.email !== email ||
    data?.user?.isPrimaryAdmin !== true ||
    !data?.accessToken ||
    !Array.isArray(data?.permissions) ||
    !data.permissions.includes('permission:read')
  ) {
    throw new Error('Fresh primary-admin login via Web proxy failed');
  }
  const headers = { authorization: `Bearer ${data.accessToken}` };
  const me = await fetcher('/api/v1/auth/me', { headers });
  const current = me.ok ? await me.json() : null;
  if (current?.data?.user?.id !== data.user.id || current?.data?.user?.isPrimaryAdmin !== true) {
    throw new Error('Authenticated Web-proxied account read failed');
  }
  const permissions = await fetcher('/api/v1/permissions/all', { headers });
  const list = permissions.ok ? await permissions.json() : null;
  if (!Array.isArray(list?.data) || !list.data.some((row) => row.code === 'audit:read')) {
    throw new Error('Authenticated database-backed permission list failed');
  }
}
MODULES.smoke = { BASE, checkReadOnly, checkAdmin };
}

// ---- setup.cjs ----
{
'use strict';

// New-server-only installer. Do not route any of these commands to the owner
// Phase 11/12 PostgreSQL target, dev Compose or an already populated volume.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { reviewedPlan } = require('../../apps/api/scripts/phase11-runtime-privileges.cjs');
const {
  ROOT,
  STATE_DIR,
  OWNER_ROLE,
  RUNTIME_ROLE,
  EXPORT_ROLE,
  loadConfig,
  projectName,
  imageName,
  statePath,
  composeEnvironment,
} = MODULES.config;
const { checkReadOnly, checkAdmin, BASE } = MODULES.smoke;

const COMPOSE_FILE = path.join(ROOT, 'docker/docker-compose.fresh.yml');
const STARTED = 'preparing';
const COMPLETE = 'complete';

function exec(command, args, { env = process.env, input, timeout = 60_000, output = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env,
    input,
    timeout,
    encoding: 'utf8',
    stdio: [input === undefined ? 'ignore' : 'pipe', output ? 'pipe' : 'ignore', 'ignore'],
    maxBuffer: 16 * 1024 * 1024,
  });
  // Never expose tool stderr/stdout for a failed command: Compose, Prisma or
  // psql may echo SQL, private config values, a URL, or an admin token.
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} stage failed (exit ${result.status ?? 'timeout'}; private output suppressed)`
    );
  return output ? result.stdout.trim() : '';
}
function composeArgs(config, args, profiles = []) {
  return [
    'compose',
    '-p',
    projectName(config),
    '-f',
    COMPOSE_FILE,
    ...profiles.flatMap((profile) => ['--profile', profile]),
    ...args,
  ];
}
function docker(config, args, env, options, profiles = []) {
  return exec('docker', composeArgs(config, args, profiles), { env, ...options });
}
function sqlLiteral(value) {
  if (typeof value !== 'string' || !value || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error('Invalid private SQL literal');
  }
  return `'${value.replace(/'/g, "''")}'`;
}
function assertNonDestructiveMigration(sql, name = 'pending migration') {
  const uncommented = sql.replace(/--[^\r\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const destructive = /\bDROP\s+(?:TABLE|SCHEMA|DATABASE)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bALTER\s+TABLE\b[^;]*\bDROP\s+COLUMN\b/i;
  if (destructive.test(uncommented)) {
    throw new Error(`Destructive SQL is not auto-deployed (${name}); review and authorize separately`);
  }
}
function assertPendingMigrationsSafe(config, env) {
  const applied = new Set(
    psql(
      config,
      env,
      `SELECT migration_name FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name;\n`,
      true
    ).split('\n').filter(Boolean)
  );
  const directory = path.join(ROOT, 'prisma/migrations');
  const pending = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !applied.has(entry.name))
    .map((entry) => entry.name)
    .sort();
  for (const name of pending) {
    const sqlFile = path.join(directory, name, 'migration.sql');
    if (!fs.existsSync(sqlFile)) throw new Error(`Pending migration has no SQL file (${name})`);
    assertNonDestructiveMigration(fs.readFileSync(sqlFile, 'utf8'), name);
  }
  console.log(`[migration safety] PASS ${pending.length} pending migration(s) contain no destructive SQL`);
  return pending;
}
function sqlId(value) {
  if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(value)) throw new Error('Invalid database identifier');
  return `"${value}"`;
}
function bootstrapSql(config) {
  const database = sqlId(config.FRESH_DATABASE_NAME);
  // A new postgres:16 container initializes exactly one empty database owned
  // by postgres. This transaction creates TWO distinct, non-superuser logins
  // and a NOLOGIN, unassigned audit-export DB role. Only the one-shot migrator
  // owns the schema. No role is created on the host.
  return `BEGIN;
SET LOCAL standard_conforming_strings = on;
CREATE ROLE ${sqlId(OWNER_ROLE)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${sqlLiteral(config.FRESH_DB_OWNER_PASSWORD)};
CREATE ROLE ${sqlId(RUNTIME_ROLE)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${sqlLiteral(config.FRESH_DB_RUNTIME_PASSWORD)};
CREATE ROLE ${sqlId(EXPORT_ROLE)} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
REVOKE ALL ON DATABASE ${database} FROM PUBLIC;
ALTER DATABASE ${database} OWNER TO ${sqlId(OWNER_ROLE)};
GRANT CONNECT, TEMPORARY ON DATABASE ${database} TO ${sqlId(RUNTIME_ROLE)};
REVOKE ALL ON DATABASE ${database} FROM ${sqlId(EXPORT_ROLE)};
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ${sqlId(RUNTIME_ROLE)};
COMMIT;\n`;
}
function assertEmptyCatalog(value, config) {
  const cells = value.split('|');
  if (
    cells.length !== 6 ||
    cells[0] !== config.FRESH_DATABASE_NAME ||
    cells[1] !== 'postgres' ||
    !/^16\d{4}$/.test(cells[2]) ||
    cells[3] !== '0' ||
    cells[4] !== '0' ||
    cells[5] !== 'postgres'
  ) {
    throw new Error(
      'Docker PostgreSQL target is not a PG16, postgres-owned, empty new database without pre-existing application roles'
    );
  }
}
const DB_PSQL = [
  'exec',
  '-T',
  'db',
  'sh',
  '-c',
  'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -X -qAt -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d "$POSTGRES_DB"',
];
function psql(config, env, input, output = false) {
  return docker(config, DB_PSQL, env, { input, output, timeout: 60_000 });
}

function stateRecord(config, stage) {
  return {
    schema: 1,
    project: projectName(config),
    database: config.FRESH_DATABASE_NAME,
    checkout: fs.realpathSync(ROOT),
    stage,
    updatedAt: new Date().toISOString(),
  };
}
function createState(config) {
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(statePath(config), JSON.stringify(stateRecord(config, STARTED)) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
}
function finishState(config) {
  const file = statePath(config);
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(stateRecord(config, COMPLETE)) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
}
function loadState(config) {
  const file = statePath(config);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.mode & 0o077 || stat.uid !== process.getuid()) {
    throw new Error('Fresh state marker is not a private regular file');
  }
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (
    state.schema !== 1 ||
    state.project !== projectName(config) ||
    state.database !== config.FRESH_DATABASE_NAME ||
    state.checkout !== fs.realpathSync(ROOT) ||
    ![STARTED, COMPLETE].includes(state.stage)
  ) {
    throw new Error('Fresh state marker does not match the reviewed target and checkout');
  }
  return state;
}

async function checkPort3000() {
  const server = net.createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen({ host: '127.0.0.1', port: 3000, exclusive: true }, resolve);
    });
  } catch {
    throw new Error('127.0.0.1:3000 is in use; do not displace another dashboard');
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
}
function ensureVersion(value) {
  const match = /^v?(\d+)\.(\d+)/.exec(value);
  if (!match || Number(match[1]) < 2 || (Number(match[1]) === 2 && Number(match[2]) < 20)) {
    throw new Error('Docker Compose v2.20+ is required for --wait and profiles');
  }
}
function assertNoProjectResources(config, env) {
  const prefix = `${projectName(config)}_`;
  const volumes = exec('docker', ['volume', 'ls', '--format', '{{.Name}}'], { env, output: true });
  if (volumes.split('\n').some((name) => name.startsWith(prefix))) {
    throw new Error(
      'A fresh project volume already exists; never adopt/reset an existing database'
    );
  }
  const containers = exec(
    'docker',
    [
      'ps',
      '-a',
      '--filter',
      `label=com.docker.compose.project=${projectName(config)}`,
      '--format',
      '{{.ID}}',
    ],
    { env, output: true }
  );
  const networks = exec(
    'docker',
    [
      'network',
      'ls',
      '--filter',
      `label=com.docker.compose.project=${projectName(config)}`,
      '--format',
      '{{.ID}}',
    ],
    { env, output: true }
  );
  if (containers || networks)
    throw new Error('Docker project name is already in use; refuse existing services/network');
  const image = spawnSync('docker', ['image', 'inspect', imageName(config)], {
    cwd: ROOT,
    env,
    stdio: 'ignore',
    timeout: 15_000,
  });
  if (image.status === 0)
    throw new Error('Local fresh image tag already exists; refuse to reuse unknown build');
  if (image.status !== 1) throw new Error('Could not safely inspect the proposed Docker image tag');
}
async function preflight(config, env) {
  if (fs.existsSync(statePath(config))) {
    throw new Error(
      'Fresh setup already started or completed for this instance; no automatic replay, upgrade, reset or recovery'
    );
  }
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('Node.js 20+ is required');
  const pnpmVersion = exec('pnpm', ['--version'], { env, output: true });
  if (!/^9\./.test(pnpmVersion)) throw new Error('pnpm 9 is required on the host');
  if (Object.keys(reviewedPlan(ROOT)).length !== 94)
    throw new Error('Unreviewed source or Prisma model count');
  ensureVersion(exec('docker', ['compose', 'version', '--short'], { env, output: true }));
  exec('docker', ['info', '--format', '{{.ServerVersion}}'], { env, output: true });
  // The services' restart policy only survives reboot if the Docker daemon is enabled.
  if (exec('systemctl', ['is-enabled', 'docker'], { env, output: true }) !== 'enabled') {
    throw new Error('Docker systemd service must be enabled at boot before installation');
  }
  assertNoProjectResources(config, env);
  await checkPort3000();
  docker(config, ['config', '--quiet'], env);
  console.log(
    `[preflight] PASS new isolated project ${projectName(config)}, database ${config.FRESH_DATABASE_NAME}, PG16 Compose, Docker boot, port 3000`
  );
}

function parsePs(config, env) {
  const raw = docker(config, ['ps', '--format', 'json'], env, { output: true });
  if (!raw) return [];
  let rows;
  try {
    rows = raw.startsWith('[') ? JSON.parse(raw) : raw.split('\n').map((line) => JSON.parse(line));
  } catch {
    throw new Error('Docker Compose service status cannot be parsed safely');
  }
  return rows.map((row) => ({ service: row.Service, state: row.State, health: row.Health }));
}
function assertHealthy(config, env) {
  const rows = parsePs(config, env);
  for (const service of ['db', 'api', 'web']) {
    if (
      !rows.some(
        (row) => row.service === service && row.state === 'running' && row.health === 'healthy'
      )
    ) {
      throw new Error(`Fresh ${service} service is not running and healthy`);
    }
  }
}
function status(config, env) {
  const marker = loadState(config);
  console.log(
    `[status] project=${marker.project} database=${marker.database} setup=${marker.stage}`
  );
  for (const row of parsePs(config, env).filter((row) =>
    ['db', 'api', 'web', 'test-db'].includes(row.service)
  )) {
    const state = String(row.state || '?').replace(/[^a-z_-]/gi, '');
    const health = String(row.health || '?').replace(/[^a-z_-]/gi, '');
    console.log(`[status] ${row.service}: ${state}/${health}`);
  }
}

function assertNoTestContainer(config, env) {
  const raw = docker(config, ['ps', '-a', '--format', 'json', 'test-db'], env, { output: true }, [
    'tests',
  ]);
  if (!raw || raw === '[]') return;
  // Docker Compose v2 versions emit either an array or JSON lines.
  try {
    const rows = raw.startsWith('[')
      ? JSON.parse(raw)
      : raw.split('\n').map((line) => JSON.parse(line));
    if (!rows.length) return;
  } catch {
    throw new Error('Isolated test container inventory cannot be parsed safely');
  }
  throw new Error(
    'Isolated test-db container already exists; review it before running another test'
  );
}
function runIntegration(config, env) {
  assertNoTestContainer(config, env);
  const password = crypto.randomBytes(36).toString('base64url');
  const adminPassword = crypto.randomBytes(36).toString('base64url');
  const isolatedEnv = composeEnvironment(config, { password, adminPassword });
  console.log(
    '[integration] Starting dedicated PG16 tmpfs fixture (no host port or production DB access)'
  );
  let error;
  try {
    docker(config, ['run', '--rm', '-T', 'integration'], isolatedEnv, { timeout: 1_800_000 }, [
      'tests',
    ]);
    console.log('[integration] PASS isolated migrations, seed, Auth/RBAC and master-data E2E');
  } catch (cause) {
    error = cause;
  }
  // Only the explicitly named ephemeral test-db created by THIS invocation.
  // Never run compose down, prune, or volume operations here.
  try {
    docker(config, ['stop', '-t', '15', 'test-db'], isolatedEnv, {}, ['tests']);
    docker(config, ['rm', '-f', 'test-db'], isolatedEnv, {}, ['tests']);
  } catch {
    throw new Error('Isolated test-db cleanup failed; inspect this project before any rerun');
  }
  if (error) throw error;
}

async function backupDatabase(config, env) {
  const directory = path.join(STATE_DIR, 'backups');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const file = path.join(
    directory,
    `${config.FRESH_INSTANCE_ID}-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`
  );
  const fd = fs.openSync(file, 'wx', 0o600);
  const args = composeArgs(config, [
    'exec', '-T', 'db', 'pg_dump', '-U', 'postgres', '-d', config.FRESH_DATABASE_NAME,
    '--format=custom',
  ]);
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('docker', args, { cwd: ROOT, env, stdio: ['ignore', fd, 'ignore'] });
      child.once('error', reject);
      child.once('close', (code) =>
        code === 0 ? resolve() : reject(new Error('Database backup failed; update aborted'))
      );
    });
    fs.fsyncSync(fd);
    if (fs.fstatSync(fd).size < 32) throw new Error('Database backup is empty; update aborted');
  } catch (error) {
    fs.closeSync(fd);
    fs.rmSync(file, { force: true });
    throw error;
  }
  fs.closeSync(fd);
  console.log(`[backup] PASS private pre-update database snapshot: ${path.relative(ROOT, file)}`);
  return file;
}

async function upgrade(config, env) {
  const state = loadState(config);
  if (state.stage !== COMPLETE) {
    throw new Error('Fresh setup is incomplete; updates are refused and database was not modified');
  }
  assertHealthy(config, env);
  await checkReadOnly();
  console.log('[upgrade] Existing installation verified; database and persistent volumes will be retained');
  console.log('[build] Building and testing the candidate image before database changes');
  docker(config, ['build', 'api'], env, { timeout: 1_800_000 });
  console.log('[build] PASS image and offline tests');
  runIntegration(config, env);
  // Pending migrations that explicitly discard rows/schema are never automatic.
  assertPendingMigrationsSafe(config, env);
  // Save a private, complete PostgreSQL snapshot before the first migration.
  // Never reset, prune, recreate the DB volume, or re-run fresh seed on updates.
  await backupDatabase(config, env);
  const migrator = (args, timeout = 900_000) =>
    docker(config, ['run', '--rm', '-T', '--no-deps', 'migrator', ...args], env, { timeout }, [
      'install',
    ]);
  migrator(['pnpm', 'exec', 'prisma', 'migrate', 'deploy']);
  migrator(['node', 'scripts/fresh/verify-db.cjs', 'migrations']);
  console.log('[migrations] PASS committed deploy and checksum/trigger verification');
  migrator(['node', 'scripts/fresh/grants.cjs']);
  docker(
    config,
    ['run', '--rm', '-T', '--no-deps', 'api', 'node', 'scripts/fresh/verify-db.cjs', 'runtime'],
    env,
    { timeout: 120_000 }
  );
  docker(config, ['up', '-d', '--wait', '--no-build', 'api', 'web'], env, { timeout: 300_000 });
  assertHealthy(config, env);
  await checkReadOnly();
  console.log('[smoke] PASS Web and database-backed API health; existing records and credentials retained');
  finishState(config);
  console.log(`DUNA_UPGRADE_PASS project=${projectName(config)} database=${config.FRESH_DATABASE_NAME}`);
}

async function install(config, env) {
  await preflight(config, env); // No marker, Docker resource or DB write on failure.
  createState(config); // A failed/partial install is NEVER mistaken for an upgrade.
  console.log(
    '[build] Installing pinned dependencies, generating Prisma, fast tests, API/Web builds inside an isolated image'
  );
  docker(config, ['build', 'api'], env, { timeout: 1_800_000 });
  console.log('[build] PASS image and offline tests');
  runIntegration(config, env);
  console.log('[database] Starting and awaiting the project-owned PostgreSQL 16 container');
  docker(config, ['up', '-d', '--wait', '--no-build', 'db'], env, { timeout: 300_000 });
  const catalog = psql(
    config,
    env,
    `SELECT current_database()::text || '|' || current_user::text || '|' || current_setting('server_version_num') || '|' ||
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r','p')) || '|' ||
    (SELECT count(*) FROM pg_roles WHERE rolname IN ('shipping','shipping_runtime_p11','shipping_audit_export_p11')) || '|' ||
    pg_get_userbyid(datdba)::text FROM pg_database WHERE datname = current_database();\n`,
    true
  );
  assertEmptyCatalog(catalog, config);
  // Credentials are sent exclusively on psql stdin; even an SQL error is not
  // emitted to console or a log. Docker volume/roles are never auto-deleted.
  psql(config, env, bootstrapSql(config));
  console.log(
    '[database] PASS empty target identity, separated private logins and unassigned NOLOGIN exporter role'
  );
  const migrator = (args, timeout = 900_000) =>
    docker(config, ['run', '--rm', '-T', '--no-deps', 'migrator', ...args], env, { timeout }, [
      'install',
    ]);
  migrator(['pnpm', 'exec', 'prisma', 'migrate', 'deploy']);
  migrator(['node', 'scripts/fresh/verify-db.cjs', 'migrations']);
  console.log('[migrations] PASS committed deploy and complete checksum/trigger verification');
  migrator(['pnpm', 'db:seed']); // DUNA_FRESH_SEED=1, demo=false, explicit admin.
  migrator(['node', 'scripts/fresh/verify-db.cjs', 'seed']);
  console.log(
    '[seed] PASS structural non-demo values and primary admin; no business/retention fixtures'
  );
  migrator(['node', 'scripts/fresh/grants.cjs']);
  docker(
    config,
    ['run', '--rm', '-T', '--no-deps', 'api', 'node', 'scripts/fresh/verify-db.cjs', 'runtime'],
    env,
    { timeout: 120_000 }
  );
  console.log('[privileges] PASS reviewed restricted API credential and model reads');
  docker(config, ['up', '-d', '--wait', '--no-build', 'api', 'web'], env, { timeout: 300_000 });
  assertHealthy(config, env);
  await checkReadOnly();
  await checkAdmin(config.FRESH_ADMIN_EMAIL, config.FRESH_ADMIN_PASSWORD);
  console.log(
    '[smoke] PASS Web, database-backed API health, fresh-admin login, account and permission reads through proxy'
  );
  finishState(config);
  console.log(
    `FRESH_SETUP_PASS project=${projectName(config)} database=${config.FRESH_DATABASE_NAME} url=${BASE}/`
  );
  console.log(
    'The public landing page leads to sign-in; authenticated users reach their permitted dashboard. Credentials are not printed.'
  );
}

async function main() {
  const mode = process.argv[2] || '--install';
  if (
    !['--install', '--upgrade', '--status', '--health', '--integration'].includes(mode) ||
    process.argv.length > 3
  ) {
    throw new Error(
      'Usage: pnpm setup | pnpm setup --upgrade | pnpm setup --status | pnpm setup --health | pnpm setup --integration'
    );
  }
  const config = loadConfig();
  const env = composeEnvironment(config);
  if (mode === '--install') return install(config, env);
  if (mode === '--upgrade') return upgrade(config, env);
  const state = loadState(config);
  if (mode === '--status') return status(config, env);
  if (state.stage !== COMPLETE)
    throw new Error('Fresh setup is incomplete; no test or upgrade is authorized');
  if (mode === '--integration') return runIntegration(config, env);
  assertHealthy(config, env);
  await checkReadOnly();
  console.log(
    `E2E_HEALTH_PASS project=${projectName(config)} url=${BASE}/ Web + proxied API/PG16 (read-only; not an authenticated dashboard proof)`
  );
}
if (require.main === module) {
  main().catch((error) => {
    // Only our own fixed diagnostics; never serialize the config, a URL,
    // third-party stderr, an SQL statement, or a Prisma error/response body.
    const safe =
      error instanceof Error &&
      /^(Fresh |Docker |Node\.js |pnpm |Could not |Database |Invalid |Expected |A fresh |Local |127\.0\.0\.1|The |Unknown |FRESH_|\.env|ENOENT|EEXIST|systemctl |docker |Isolated |Migration |Unreviewed |Runtime |Usage:)/.test(
        error.message
      )
        ? error.message
        : 'installation or health stage failed (private details suppressed)';
    console.error(`FRESH_SETUP_STOP: ${safe}`);
    console.error(
      'No reset, restore, upgrade, container/volume prune or owner-host DB operation was attempted. Inspect docs/fresh-server-install.md and the private state marker.'
    );
    process.exitCode = 1;
  });
}
MODULES.setup = {
  exec,
  composeArgs,
  sqlLiteral,
  assertNonDestructiveMigration,
  bootstrapSql,
  assertEmptyCatalog,
  stateRecord,
  ensureVersion,
  assertNoProjectResources,
  checkPort3000,
  parsePs,
};
}

// The public surface is the union of every block's exports, which is exactly the
// set of names the six separate modules used to export between them.
module.exports = Object.assign({}, ...Object.values(MODULES).filter((m) => m && typeof m === 'object'));
