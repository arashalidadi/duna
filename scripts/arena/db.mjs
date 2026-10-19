#!/usr/bin/env node
/**
 * Sandbox-only PostgreSQL provisioning.
 *
 * The sandbox has no Docker Engine and no PostgreSQL packages, and the only
 * reachable package hosts are the npm registry and GitHub. This script therefore
 * runs a real PostgreSQL server from the npm-distributed engine package
 * `@embedded-postgres/linux-x64` (PostgreSQL 16, same major as production).
 *
 * Subcommands:
 *   node scripts/arena/db.mjs start      install binaries if needed, initdb if needed, start
 *   node scripts/arena/db.mjs stop       stop the server
 *   node scripts/arena/db.mjs status     report server state and listening socket
 *   node scripts/arena/db.mjs provision  ensure the role/database named in DATABASE_URL exist
 *
 * Configuration (all optional):
 *   ARENA_TOOLS_DIR   tool/data root (default: <repo>/.arena-tools)
 *   ARENA_PG_PORT     TCP port (default: 5432, or the port in DATABASE_URL)
 *   ARENA_PG_VERSION  npm version of @embedded-postgres/linux-x64 (default: 16.14.0-beta.17)
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const DEFAULT_PG_VERSION = '16.14.0-beta.17';
const PG_PACKAGE = '@embedded-postgres/linux-x64';

/** Read the repo-root .env without executing it (same order as the API config loader). */
function readDotenv(root = repoRoot) {
  for (const file of [join(root, 'apps/api/.env'), join(root, '.env')]) {
    if (!existsSync(file)) continue;
    const out = {};
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
    return out;
  }
  return {};
}

const envFile = readDotenv();
const toolsDir = process.env.ARENA_TOOLS_DIR ?? join(repoRoot, '.arena-tools');
const pgDir = join(toolsDir, 'pg');
const pgData = join(toolsDir, 'pgdata');
const runDir = join(toolsDir, 'run');
const logDir = join(toolsDir, 'logs');
const pgVersion = process.env.ARENA_PG_VERSION ?? DEFAULT_PG_VERSION;

let pgPort = Number(process.env.ARENA_PG_PORT ?? 5432);
let databaseUrl = process.env.DATABASE_URL ?? envFile.DATABASE_URL ?? '';
try {
  if (databaseUrl && process.env.ARENA_PG_PORT === undefined) {
    const parsed = new URL(databaseUrl);
    if (parsed.port) pgPort = Number(parsed.port);
  }
} catch {
  /* keep default port */
}

const nativeDir = join(pgDir, 'node_modules', PG_PACKAGE, 'native');
const bin = {
  initdb: join(nativeDir, 'bin', 'initdb'),
  pgCtl: join(nativeDir, 'bin', 'pg_ctl'),
  postgres: join(nativeDir, 'bin', 'postgres'),
};
const childEnv = {
  ...process.env,
  LD_LIBRARY_PATH: [join(nativeDir, 'lib'), process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'),
  PATH: `${join(nativeDir, 'bin')}:${process.env.PATH}`,
};

function log(message) {
  process.stdout.write(`[arena-db] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[arena-db] ${message}\n`);
  process.exit(1);
}

function ensureBinaries() {
  if (existsSync(bin.postgres)) return;
  mkdirSync(pgDir, { recursive: true });
  const pkg = join(pgDir, 'package.json');
  if (!existsSync(pkg)) {
    writeFileSync(pkg, `${JSON.stringify({ name: 'duna-arena-pg', private: true }, null, 2)}\n`);
  }
  log(`installing ${PG_PACKAGE}@${pgVersion} into ${pgDir}`);
  execSync(`npm install --silent --no-audit --no-fund ${PG_PACKAGE}@${pgVersion}`, {
    cwd: pgDir,
    stdio: 'inherit',
  });
  if (!existsSync(bin.postgres)) fail(`postgres binary missing after install: ${bin.postgres}`);
}

function pgCtl(args, options = {}) {
  return execFileSync(bin.pgCtl, ['-D', pgData, ...args], {
    env: childEnv,
    encoding: 'utf8',
    ...options,
  });
}

function isRunning() {
  try {
    const out = pgCtl(['status']);
    return /server is running/.test(out);
  } catch {
    return false;
  }
}

function ensureCluster() {
  if (existsSync(join(pgData, 'PG_VERSION'))) return;
  mkdirSync(pgData, { recursive: true });
  mkdirSync(runDir, { recursive: true });
  log(`initdb -> ${pgData}`);
  execFileSync(
    bin.initdb,
    [
      '-D', pgData,
      '-U', 'shipping',
      '--auth=trust',
      '--encoding=UTF8',
      '--locale=C.UTF-8',
      '--no-sync',
    ],
    { env: childEnv, stdio: 'inherit' },
  );
}

function startOptions() {
  return `-c listen_addresses=127.0.0.1 -c unix_socket_directories=${runDir} -p ${pgPort}`;
}

function start() {
  ensureBinaries();
  ensureCluster();
  mkdirSync(logDir, { recursive: true });
  mkdirSync(runDir, { recursive: true });
  if (isRunning()) {
    log(`already running on 127.0.0.1:${pgPort}`);
    return;
  }
  log(`starting PostgreSQL on 127.0.0.1:${pgPort}`);
  pgCtl(['-l', join(logDir, 'postgres.log'), '-o', startOptions(), '-w', 'start'], {
    stdio: 'inherit',
  });
  const version = pgCtl(['status']).trim();
  log(version.split('\n')[0]);
}

function stop() {
  if (!isRunning()) {
    log('not running');
    return;
  }
  pgCtl(['-w', 'stop'], { stdio: 'inherit' });
  log('stopped');
}

function status() {
  const running = isRunning();
  log(`running=${running} port=${pgPort} data=${pgData}`);
  if (!running) process.exitCode = 3;
}

/** Connect to the `postgres` maintenance database as the initdb superuser. */
async function adminClient() {
  const require = createRequire(join(repoRoot, 'package.json'));
  const pgEntry = join(pgDir, 'node_modules', 'pg');
  if (!existsSync(pgEntry)) {
    mkdirSync(pgDir, { recursive: true });
    if (!existsSync(join(pgDir, 'package.json'))) {
      writeFileSync(join(pgDir, 'package.json'), `${JSON.stringify({ name: 'duna-arena-pg', private: true }, null, 2)}\n`);
    }
    log('installing the pg client used for provisioning');
    execSync('npm install --silent --no-audit --no-fund pg', { cwd: pgDir, stdio: 'inherit' });
  }
  const pg = require(pgEntry);
  const client = new pg.Client({
    host: '127.0.0.1',
    port: pgPort,
    user: 'shipping',
    database: 'postgres',
  });
  await client.connect();
  return client;
}

async function provision() {
  if (!databaseUrl) fail('DATABASE_URL is not set (repo .env missing?)');
  const url = new URL(databaseUrl);
  const role = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const dbName = decodeURIComponent(url.pathname).replace(/^\//, '');
  if (!role || !dbName) fail('DATABASE_URL must contain a role and a database name');

  const client = await adminClient();
  const quotedRole = `"${role.replace(/"/g, '""')}"`;
  const quotedDb = `"${dbName.replace(/"/g, '""')}"`;
  // DDL cannot be parameterized, so the password is inlined as a quoted literal
  // with embedded single quotes doubled.
  const quotedPassword = `'${password.replace(/'/g, "''")}'`;
  try {
    const roleRow = await client.query('select 1 from pg_roles where rolname = $1', [role]);
    if (roleRow.rowCount === 0) {
      log(`creating role ${role}`);
      await client.query(`create role ${quotedRole} with login password ${quotedPassword}`);
    } else if (password) {
      await client.query(`alter role ${quotedRole} with login password ${quotedPassword}`);
    }

    const dbRow = await client.query('select 1 from pg_database where datname = $1', [dbName]);
    if (dbRow.rowCount === 0) {
      log(`creating database ${dbName}`);
      // Deliberately NOT `template template0`: the pristine template has no
      // plpgsql, and this schema's triggers/functions are written in plpgsql.
      await client.query(`create database ${quotedDb} owner ${quotedRole}`);
    } else {
      await client.query(`alter database ${quotedDb} owner to ${quotedRole}`);
    }
    log(`target ready: ${role}@127.0.0.1:${pgPort}/${dbName}`);
  } finally {
    await client.end();
  }
}

/** Generate the sandbox runtime password once and reuse it on later runs. */
function runtimePasswordFile() {
  return join(toolsDir, 'runtime-db-password');
}

const command = process.argv[2] ?? 'start';
const actions = {
  start,
  stop,
  status,
  provision,
  'password-file': () => process.stdout.write(`${runtimePasswordFile()}\n`),
};

if (command === 'provision') {
  await provision();
} else if (actions[command]) {
  actions[command]();
} else {
  fail(`unknown subcommand "${command}" (start|stop|status|provision)`);
}
