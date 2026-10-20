/**
 * Fresh-install contracts: the installer's own units (config parsing, grants, smoke, bootstrap SQL) and the migration-replay check against an isolated PostgreSQL 16 fixture.
 *
 * Merged on 2026-10-20 from 2 files. Every original file keeps its own
 * block scope below, so its declarations cannot collide with another file's and no
 * assertion was rewritten. Run it with: node --test scripts/fresh/setup.test.cjs
 */

// ---- scripts/fresh/setup.test.cjs (8 tests) ----
{
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomBytes } = require('node:crypto');
const {
  parseConfig,
  databaseUrl,
  composeEnvironment,
  ROOT,
  TEST_DATABASE,
} = require('./setup.cjs');
const {
  sqlLiteral,
  bootstrapSql,
  assertEmptyCatalog,
  ensureVersion,
  composeArgs,
  assertNoProjectResources,
} = require('./setup.cjs');
const { quoteId, checkCatalog, grantStatements } = require('./setup.cjs');
const { assertDatabaseUrl, expectedMigrations, checkMigrationHistory, EXPECTED_MIGRATION_NAMES } = require('./setup.cjs');
const { checkReadOnly, checkAdmin } = require('./setup.cjs');
const { reviewedPlan } = require('../../apps/api/scripts/phase11-runtime-privileges.cjs');

function valid() {
  return {
    FRESH_INSTANCE_ID: 'freshalpha',
    FRESH_DATABASE_NAME: 'duna_fresh_alpha',
    FRESH_NEW_SERVER_ACK: 'NEW_EMPTY_SERVER:duna_fresh_alpha',
    FRESH_DB_SUPER_PASSWORD: 'a'.repeat(40),
    FRESH_DB_OWNER_PASSWORD: 'b'.repeat(40),
    FRESH_DB_RUNTIME_PASSWORD: 'c'.repeat(40),
    FRESH_ADMIN_EMAIL: 'owner@example.invalid',
    FRESH_ADMIN_PASSWORD: 'd'.repeat(40),
    FRESH_AUTH_JWT_SECRET: 'e'.repeat(40),
    FRESH_AUTH_REFRESH_SECRET: 'f'.repeat(40),
    FRESH_ATTACHMENT_URL_SECRET: 'g'.repeat(40),
  };
}
function text(config) {
  return (
    Object.entries(config)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n'
  );
}

test('automatic updates reject destructive pending migrations before touching production data', () => {
  const { assertNonDestructiveMigration } = require('./setup.cjs');
  assert.doesNotThrow(() => assertNonDestructiveMigration('ALTER TABLE "Customer" ADD COLUMN "region" TEXT;'));
  assert.doesNotThrow(() => assertNonDestructiveMigration('-- DROP TABLE ignored\nSELECT 1;'));
  for (const sql of [
    'DROP TABLE "Customer";',
    'ALTER TABLE "Customer" DROP COLUMN "taxId";',
    'TRUNCATE TABLE "Invoice";',
    'DELETE FROM "Customer";',
  ]) {
    assert.throws(() => assertNonDestructiveMigration(sql), /Destructive SQL is not auto-deployed/);
  }
});

test('fresh config requires explicit NEW EMPTY target, separate strong secrets and only known keys', () => {
  assert.deepEqual(parseConfig(text(valid())), valid());
  for (const change of [
    { FRESH_NEW_SERVER_ACK: 'NEW_EMPTY_SERVER:duna_seed_test' },
    { FRESH_DATABASE_NAME: 'duna_seed_test' },
    { FRESH_DATABASE_NAME: 'duna_seed_test1' },
    { FRESH_DATABASE_NAME: TEST_DATABASE },
    { FRESH_INSTANCE_ID: '../owner' },
    { FRESH_DB_RUNTIME_PASSWORD: 'short' },
    { FRESH_DB_RUNTIME_PASSWORD: valid().FRESH_DB_OWNER_PASSWORD },
    { FRESH_ADMIN_EMAIL: 'Owner@example.invalid' },
  ])
    assert.throws(() => parseConfig(text({ ...valid(), ...change })));
  assert.throws(() =>
    parseConfig(text(valid()) + 'DATABASE_URL=postgresql://should-not-be-loaded\n')
  );
  assert.throws(() => parseConfig(text(valid()) + 'FRESH_INSTANCE_ID=duplicate\n'));
  assert.throws(() =>
    parseConfig(text(valid()).replace('FRESH_ADMIN_PASSWORD=' + 'd'.repeat(40), ''))
  );
});

test('compose URLs encode passwords and separate migrator, runtime, and disposable test database', () => {
  const cfg = valid();
  cfg.FRESH_DB_RUNTIME_PASSWORD = 'c'.repeat(34) + '@:/?#!';
  const parsed = parseConfig(text(cfg));
  const env = composeEnvironment(parsed, {
    password: randomBytes(36).toString('base64url'),
    adminPassword: randomBytes(36).toString('base64url'),
  });
  assertDatabaseUrl(env.DUNA_OWNER_DATABASE_URL, cfg.FRESH_DATABASE_NAME, 'shipping', 'db');
  assertDatabaseUrl(
    env.DUNA_RUNTIME_DATABASE_URL,
    cfg.FRESH_DATABASE_NAME,
    'shipping_runtime_p11',
    'db'
  );
  assertDatabaseUrl(env.DUNA_TEST_DATABASE_URL, TEST_DATABASE, 'shipping', 'test-db');
  assert.equal(
    new URL(env.DUNA_RUNTIME_DATABASE_URL).password,
    encodeURIComponent(cfg.FRESH_DB_RUNTIME_PASSWORD)
  );
  assert.notEqual(env.DUNA_RUNTIME_DATABASE_URL, env.DUNA_OWNER_DATABASE_URL);
  assert.throws(() =>
    assertDatabaseUrl(env.DUNA_RUNTIME_DATABASE_URL, cfg.FRESH_DATABASE_NAME, 'shipping', 'db')
  );
  assert.throws(() =>
    assertDatabaseUrl(
      databaseUrl('127.0.0.1', 'duna_seed_test', 'shipping', 'secret'),
      cfg.FRESH_DATABASE_NAME,
      'shipping',
      'db'
    )
  );
  assert.ok(composeArgs(cfg, ['ps'], ['tests']).includes('--profile'));
  assert.ok(composeArgs(cfg, ['ps']).includes(path.join(ROOT, 'docker/docker-compose.fresh.yml')));
});

test('bootstrap SQL is target-scoped, quotes secret literals, and never grants a superuser runtime', () => {
  const cfg = valid();
  cfg.FRESH_DB_RUNTIME_PASSWORD = 'x'.repeat(40) + "'OR'";
  const sql = bootstrapSql(cfg);
  assert.ok(sql.startsWith('BEGIN;'));
  assert.match(sql, /ALTER DATABASE "duna_fresh_alpha" OWNER TO "shipping"/);
  assert.match(sql, /CREATE ROLE "shipping_runtime_p11" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE/);
  assert.match(sql, /CREATE ROLE "shipping_audit_export_p11" NOLOGIN NOSUPERUSER NOCREATEDB/);
  assert.match(sql, /REVOKE ALL ON SCHEMA public FROM PUBLIC/);
  assert.ok(sql.includes(sqlLiteral(cfg.FRESH_DB_RUNTIME_PASSWORD)));
  assert.ok(sql.includes("''OR''"));
  assert.throws(() => sqlLiteral('bad\nsecret'));
  assert.throws(() => quoteId('public;drop'));
  const row = 'duna_fresh_alpha|postgres|160014|0|0|postgres';
  assert.doesNotThrow(() => assertEmptyCatalog(row, cfg));
  for (const bad of [
    row.replace('alpha', 'seed_test'),
    row.replace('160014', '170001'),
    row.replace('|0|0|', '|1|0|'),
    row.replace('|0|0|', '|0|1|'),
    row.replace('|postgres|160014', '|shipping|160014'),
  ]) {
    assert.throws(() => assertEmptyCatalog(bad, cfg));
  }
  ensureVersion('v2.20.0');
  assert.throws(() => ensureVersion('2.19.9'));
});

test('Docker preflight refuses an existing volume, container, network or image before setup writes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duna-fresh-preflight-'));
  try {
    const fake = path.join(dir, 'docker');
    fs.writeFileSync(
      fake,
      `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'volume') process.stdout.write(process.env.MOCK_VOLUME || '');
else if (args[0] === 'ps') process.stdout.write(process.env.MOCK_CONTAINER || '');
else if (args[0] === 'network') process.stdout.write(process.env.MOCK_NETWORK || '');
else if (args[0] === 'image') process.exit(process.env.MOCK_IMAGE === 'yes' ? 0 : 1);
else process.exit(90);
`
    );
    fs.chmodSync(fake, 0o700);
    const base = { ...process.env, PATH: `${dir}:${process.env.PATH}` };
    const cfg = valid();
    assert.throws(
      () =>
        assertNoProjectResources(cfg, {
          ...base,
          MOCK_VOLUME: 'duna-fresh-freshalpha_postgres_data',
        }),
      /volume already exists/
    );
    assert.throws(
      () => assertNoProjectResources(cfg, { ...base, MOCK_CONTAINER: 'existing' }),
      /project name is already in use/
    );
    assert.throws(
      () => assertNoProjectResources(cfg, { ...base, MOCK_NETWORK: 'existing' }),
      /project name is already in use/
    );
    assert.throws(
      () => assertNoProjectResources(cfg, { ...base, MOCK_IMAGE: 'yes' }),
      /image tag already exists/
    );
    assert.doesNotThrow(() => assertNoProjectResources(cfg, base));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('reviewed 94-table plan and sequence catalog never grant journal, audit mutation or wildcards', () => {
  const plan = reviewedPlan(ROOT);
  const tables = [...Object.keys(plan), '_prisma_migrations'].map((name) => ({
    name,
    owner: 'shipping',
  }));
  const sequences = [
    { name: 'audit_id_seq', owner: 'shipping', table: 'AuditLog' },
    { name: 'permission_id_seq', owner: 'shipping', table: 'Permission' },
  ];
  const required = checkCatalog(plan, tables, sequences, [
    { sequence: 'audit_id_seq', table: 'AuditLog' },
    { sequence: 'permission_id_seq', table: 'Permission' },
  ]);
  assert.deepEqual(required, ['audit_id_seq']);
  const grants = grantStatements(plan, required);
  assert.equal(grants.length, 98); // two schema, 94 tables, exporter AuditLog, one sequence
  assert.ok(
    grants.some(
      (sql) =>
        sql.includes('ON TABLE public."AuditLog"') &&
        !sql.includes('UPDATE') &&
        !sql.includes('DELETE')
    )
  );
  assert.ok(
    grants.some(
      (sql) => sql === 'GRANT SELECT ON TABLE public."AuditLog" TO "shipping_audit_export_p11"'
    )
  );
  assert.ok(grants.every((sql) => !sql.includes('"Permission" TO "shipping_audit_export_p11"')));
  assert.ok(grants.every((sql) => !/ON ALL TABLES|ALL PRIVILEGES|_prisma_migrations/.test(sql)));
  assert.throws(() => checkCatalog(plan, tables.slice(1), sequences, []));
  assert.throws(() =>
    checkCatalog(plan, [...tables, { name: 'stray', owner: 'shipping' }], sequences, [])
  );
  assert.throws(() =>
    checkCatalog(plan, tables, [{ name: 'unknown', owner: 'postgres', table: 'AuditLog' }], [])
  );
  assert.throws(() =>
    checkCatalog(plan, tables, sequences, [{ sequence: 'unlinked', table: 'AuditLog' }])
  );
});

test('committed migration journal checks exact checksums and rejects missing, drift and rollback', () => {
  const expected = expectedMigrations();
  assert.deepEqual(expected.map((row) => row.name), [...EXPECTED_MIGRATION_NAMES]);
  const rows = expected.map((row) => ({ ...row, finished: true, rolledBack: false }));
  assert.doesNotThrow(() => checkMigrationHistory(expected, rows));
  assert.throws(() => checkMigrationHistory(expected, rows.slice(1)));
  assert.throws(() => checkMigrationHistory(expected, [...rows, rows[0]]));
  assert.throws(() =>
    checkMigrationHistory(
      expected,
      rows.map((row, index) => (index ? row : { ...row, checksum: 'altered' }))
    )
  );
  assert.throws(() =>
    checkMigrationHistory(
      expected,
      rows.map((row, index) => (index ? row : { ...row, rolledBack: true }))
    )
  );
});

test('Web-proxied health and authenticated DB reads are distinguished, without printing credentials', async () => {
  const called = [];
  const token = randomBytes(32).toString('base64url');
  const fake = async (route, options) => {
    called.push({ route, method: options?.method || 'GET' });
    if (route === '/' || route === '/fa/login')
      return new Response('<html>ready</html>', { headers: { 'content-type': 'text/html' } });
    if (route === '/api/v1/health')
      return Response.json({
        data: {
          status: 'ok',
          database: { status: 'up' },
          app: { environment: 'production' },
        },
      });
    if (route === '/api/v1/auth/login')
      return Response.json({
        data: {
          user: { id: 'owner-id', email: 'owner@example.invalid', isPrimaryAdmin: true },
          accessToken: token,
          permissions: ['permission:read'],
        },
      });
    if (route === '/api/v1/auth/me') {
      assert.equal(options.headers.authorization, `Bearer ${token}`);
      return Response.json({ data: { user: { id: 'owner-id', isPrimaryAdmin: true } } });
    }
    if (route === '/api/v1/permissions/all')
      return Response.json({ data: [{ code: 'audit:read' }] });
    throw new Error('Unexpected smoke route');
  };
  await checkReadOnly(fake);
  assert.ok(called.every((call) => call.method === 'GET'));
  await checkAdmin('owner@example.invalid', randomBytes(32).toString('base64url'), fake);
  assert.ok(called.some((call) => call.route === '/api/v1/auth/login' && call.method === 'POST'));
  await assert.rejects(() => checkReadOnly(async () => Response.json({ data: { status: 'ok' } })));
});

test('Compose/Dockerfile isolate new PG16, runtime role and offline build; historical scripts remain', () => {
  const compose = fs.readFileSync(path.join(ROOT, 'docker/docker-compose.fresh.yml'), 'utf8');
  const image = fs.readFileSync(path.join(ROOT, 'docker/Dockerfile.fresh'), 'utf8');
  assert.match(compose, /image: postgres:16-alpine/);
  assert.match(compose, /127\.0\.0\.1:3000:3000/);
  assert.doesNotMatch(compose, /5432:5432|3101:3101|duna_seed_test/);
  assert.match(compose, /DATABASE_URL: \$\{DUNA_RUNTIME_DATABASE_URL:\?\}/);
  assert.match(compose, /DATABASE_URL: \$\{DUNA_OWNER_DATABASE_URL:\?\}/);
  assert.match(compose, /tmpfs:/);
  assert.match(image, /pnpm install --frozen-lockfile/);
  // The offline build gate runs the unit contracts and the API typecheck;
  // pnpm check's audit-route probe needs the deployed API process and is
  // covered by the runtime smoke pass, not by the image build.
  assert.match(image, /RUN pnpm test && pnpm --filter @shipping\/api typecheck/);
  assert.ok(fs.existsSync(path.join(ROOT, 'docker/docker-compose.dev.yml')));
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts/phase12/server-workflow.cjs')));
});
}

// ---- scripts/fresh/migration-replay.test.cjs (1 tests) ----
{
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { PGlite } = require('../../apps/api/node_modules/pglite-pg16');
const { ROOT } = require('./setup.cjs');
const { bootstrapSql } = require('./setup.cjs');
const { expectedMigrations, EXPECTED_MIGRATION_NAMES } = require('./setup.cjs');
const { checkCatalog, grantStatements } = require('./setup.cjs');
const { reviewedPlan } = require('../../apps/api/scripts/phase11-runtime-privileges.cjs');

test(
  'all committed SQL migrations replay on isolated in-memory PG16; fresh role grants remain narrow',
  { timeout: 90_000 },
  async () => {
    const db = new PGlite(); // no dataDir, no TCP socket, never the owner/application DB
    try {
      const [{ server_version_num: version }] = (await db.query('SHOW server_version_num')).rows;
      assert.match(version, /^16\d{4}$/);
      const [{ name }] = (await db.query('SELECT current_database()::text AS name')).rows;
      // Execute the SAME new-instance role/ownership transaction before replay;
      // fixture secrets live only in memory and are never printed or saved.
      await db.exec(
        bootstrapSql({
          FRESH_DATABASE_NAME: name,
          FRESH_DB_OWNER_PASSWORD: randomBytes(32).toString('base64url'),
          FRESH_DB_RUNTIME_PASSWORD: randomBytes(32).toString('base64url'),
        })
      );
      await db.exec('SET ROLE shipping;');
      const migrations = expectedMigrations();
      for (const { name } of migrations) {
        await db.exec(
          fs.readFileSync(path.join(ROOT, 'prisma/migrations', name, 'migration.sql'), 'utf8')
        );
      }
      // Prisma migrate deploy owns this journal, not an application model.
      await db.exec('CREATE TABLE public._prisma_migrations (migration_name text);');
      const plan = reviewedPlan(ROOT);
      const tables = (
        await db.query(`SELECT c.relname::text AS name,
        pg_get_userbyid(c.relowner)::text AS owner FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r','p')`)
      ).rows;
      const sequences = (
        await db.query(`SELECT seq.relname::text AS name,
        pg_get_userbyid(seq.relowner)::text AS owner, tab.relname::text AS "table"
        FROM pg_class seq JOIN pg_namespace n ON n.oid = seq.relnamespace
        LEFT JOIN pg_depend dep ON dep.objid = seq.oid AND dep.classid = 'pg_class'::regclass
          AND dep.refclassid = 'pg_class'::regclass AND dep.deptype IN ('a','i')
        LEFT JOIN pg_class tab ON tab.oid = dep.refobjid
        WHERE n.nspname = 'public' AND seq.relkind = 'S'`)
      ).rows;
      const required = checkCatalog(plan, tables, sequences, []);
      for (const statement of grantStatements(plan, required)) await db.exec(statement + ';');
      const [rights] = (
        await db.query(`SELECT
        has_table_privilege('shipping_runtime_p11', 'public."AuditLog"', 'SELECT') AS read,
        has_table_privilege('shipping_runtime_p11', 'public."AuditLog"', 'INSERT') AS write,
        has_table_privilege('shipping_runtime_p11', 'public."AuditLog"', 'UPDATE') AS mutate,
        has_table_privilege('shipping_runtime_p11', 'public._prisma_migrations', 'SELECT') AS journal,
        has_table_privilege('shipping_audit_export_p11', 'public."AuditLog"', 'SELECT') AS export,
        has_table_privilege('shipping_audit_export_p11', 'public."User"', 'SELECT') AS users`)
      ).rows;
      assert.deepEqual(rights, {
        read: true,
        write: true,
        mutate: false,
        journal: false,
        export: true,
        users: false,
      });
      assert.equal(tables.length, 95);
      assert.deepEqual(migrations.map((m) => m.name), [...EXPECTED_MIGRATION_NAMES]);
    } finally {
      await db.close();
    }
  }
);
}

