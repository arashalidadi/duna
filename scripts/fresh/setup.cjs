#!/usr/bin/env node
'use strict';

// New-server-only installer. Do not route any of these commands to the owner
// Phase 11/12 PostgreSQL target, dev Compose or an already populated volume.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
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
} = require('./config.cjs');
const { checkReadOnly, checkAdmin, BASE } = require('./smoke.cjs');

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
    !['--install', '--status', '--health', '--integration'].includes(mode) ||
    process.argv.length > 3
  ) {
    throw new Error(
      'Usage: pnpm setup:fresh [--status] | pnpm test:fast | pnpm test:integration | pnpm test:e2e:health'
    );
  }
  const config = loadConfig();
  const env = composeEnvironment(config);
  if (mode === '--install') return install(config, env);
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
module.exports = {
  exec,
  composeArgs,
  sqlLiteral,
  bootstrapSql,
  assertEmptyCatalog,
  stateRecord,
  ensureVersion,
  assertNoProjectResources,
  checkPort3000,
  parsePs,
};
