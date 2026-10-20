#!/usr/bin/env node
/**
 * duna — one command line for every repository operation.
 *
 * The per-phase entry points that used to be separate package.json scripts and
 * separate shell wrappers live behind this dispatcher. Nothing is re-implemented
 * here: each command runs the same underlying module or workspace filter it
 * always ran, with the same arguments, environment and exit code, so the
 * reviewed guards (database identity, owner-only seeds, append-only audit) stay
 * exactly where they were written.
 *
 *   node scripts/duna.mjs <command> [args...]
 *
 * Run `node scripts/duna.mjs help` for the full list. The short forms used in
 * day-to-day work are also exposed in package.json (setup, dev, build, start,
 * stop, status, test, test:e2e, check, db, lint, typecheck).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');

/* ------------------------------------------------------------------ helpers */

/** Run a command in the repository root, inheriting stdio and the exit code. */
function run(command, args, options = {}) {
  const child = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...options.env },
    shell: false,
  });
  if (child.error) throw child.error;
  return child.status ?? 1;
}

const pnpm = (args, options) => run('pnpm', args, options);
const node = (args, options) => run(process.execPath, args, options);
const tsx = (args, options) =>
  run('pnpm', ['exec', 'tsx', ...args], {
    ...options,
    env: { TSX_TSCONFIG_PATH: 'apps/api/tsconfig.json', ...options?.env },
  });

/** Fail loudly rather than silently doing nothing. */
function stop(message, code = 2) {
  console.error(message);
  process.exit(code);
}

/* --------------------------------------------------------------- operations */

/**
 * One-command server install: dependencies, database, schema, role grants,
 * reference data and both builds. This is the whole "clone the repository on a
 * server and get the dashboard up" path, using the repository's own guarded
 * installer (scripts/fresh/setup.cjs).
 *
 *   node scripts/duna.mjs setup               # install
 *   node scripts/duna.mjs setup --status      # verify an installed target
 *   node scripts/duna.mjs setup --health      # live health pass
 *   node scripts/duna.mjs setup --integration # integration tier
 *   node scripts/duna.mjs setup --sandbox     # sandbox bring-up (embedded PostgreSQL
 *                                             # + local Prisma engine mirror)
 */
function setup(rest) {
  if (rest.includes('--sandbox')) {
    const withDemo = rest.includes('--with-demo') ? ['--with-demo'] : [];
    console.log('duna setup --sandbox: embedded PostgreSQL, engine mirror, schema, seed, builds');
    const code = run('bash', ['scripts/arena/prepare.sh', ...withDemo]);
    if (code !== 0) return code;
    console.log('\nNext:\n  pnpm start        # API on :3101 and the dashboard on :3000\n  pnpm status      # verify every listener answers');
    return 0;
  }
  const known = ['--install', '--status', '--health', '--integration'];
  const mode = rest.find((flag) => known.includes(flag)) ?? '--install';
  const bad = rest.find((flag) => flag.startsWith('--') && !known.includes(flag));
  if (bad) stop(`Unknown setup option "${bad}". Expected one of: ${known.join(', ')} or --sandbox`);
  return node(['scripts/fresh/setup.cjs', mode]);
}

/**
 * Process management for API/web. Never touches PostgreSQL: the database has its
 * own manager and an unmanaged listener is never killed.
 */
function apps(action, rest, env) {
  const target = rest[0] ?? 'apps';
  if (!['api', 'web', 'apps'].includes(target))
    stop(`Choose api, web or apps (got "${target}")`);
  return node([join('scripts', 'phase11-apps.mjs'), action, target], { env });
}

/**
 * Foreground API entry for a service manager. Verifies the database target
 * BEFORE the API can connect and embeds a non-secret build digest so a stale
 * process is never mistaken for the current build.
 */
/**
 * Pre-start verification for the API process. Returns the non-secret build
 * digest to embed in the process's startup environment, plus the entry point.
 * Shared with the app manager, which must spawn the API itself so that its PID
 * file points at the real process rather than at a wrapper.
 */
export function apiStartupEnv() {
  // Reject an unresolved/wrong database target BEFORE the API can connect.
  if (node([join('scripts', 'check-phase11-api-target.mjs')]) !== 0) return { ok: false };
  const fingerprint = spawnSync(
    process.execPath,
    [join('scripts', 'check-api-build.mjs'), 'fingerprint'],
    { cwd: ROOT, encoding: 'utf8' }
  );
  if (fingerprint.status !== 0) return { ok: false };
  const entry = join(ROOT, 'apps/api/dist/src/main.js');
  if (!existsSync(entry)) {
    console.error('apps/api/dist/src/main.js is missing; run `pnpm build` first.');
    return { ok: false };
  }
  return { ok: true, entry, env: { DUNA_API_BUILD_SHA256: fingerprint.stdout.trim() } };
}

function startApiForeground() {
  const startup = apiStartupEnv();
  if (!startup.ok) return 1;
  const child = spawn(process.execPath, [startup.entry], {
    cwd: join(ROOT, 'apps/api'),
    stdio: 'inherit',
    env: { ...process.env, ...startup.env },
  });
  return new Promise((resolveExit) => {
    child.on('exit', (code) => resolveExit(code ?? 1));
  });
}

/** Every static contract check the repository owns, in one pass. */
/** PID of the running API, discovered by scanning /proc for the built entry point. */
function runningApiPid() {
  let entries = [];
  try {
    entries = readdirSync('/proc');
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const cmdline = readFileSync(`/proc/${entry}/cmdline`, 'utf8').replace(/\0/g, ' ');
      if (cmdline.includes('apps/api/dist/src/main.js')) return entry;
    } catch {
      // The process exited between readdir and read; keep scanning.
    }
  }
  return null;
}

function check(rest) {
  const steps = [
    ['api build contract', () => node([join('scripts', 'check-api-build.mjs'), 'verify'])],
    ['seed safety', () => node([join('scripts', 'check-seed-safety.mjs')])],
    ['authorization inventory', () => node([join('scripts', 'check-phase11-authz.mjs')])],
    ['audit route preflight', () => node([join('scripts', 'check-phase11-audit-routes.mjs')])],
    ['process/db identity', () => {
      // The check observes a live process's startup environment, so it needs the
      // running API's PID. Discover it instead of making the operator supply it;
      // with no API running there is nothing to observe, and that is reported
      // rather than turned into a red contract check.
      const args = rest.length ? rest : [];
      const env = {};
      if (!args.length && !process.env.PHASE11_API_PID) {
        const pid = runningApiPid();
        if (!pid) {
          console.log('  skipped: no running API process to observe ' +
            '(start it with `pnpm start`, or pass a PID: `pnpm check <pid>`)');
          return 0;
        }
        env.PHASE11_API_PID = pid;
      }
      return node([join('scripts', 'check-phase11-process-db-identity.mjs'), ...args], { env });
    }],
    ['web contracts', () => pnpm(['--filter', '@shipping/web', 'test'])],
  ];
  return series(steps);
}

/**
 * Every fast test: the operational-helper unit contracts, the provisioning
 * contracts, the Phase 11 workflow contracts, the web guards and the API
 * service/report/finance contracts.
 */
function test() {
  const steps = [
    ['shared packages', () =>
      pnpm(['--filter', '@shipping/config', '--filter', '@shipping/shared', 'run', 'build'])],
    ['node unit contracts', () =>
      node(['--test',
        'scripts/fresh/setup.test.cjs',
        'scripts/checks.test.mjs',
        'apps/api/scripts/phase11-server-workflow.test.cjs'])],
    ['seed safety', () => node([join('scripts', 'check-seed-safety.mjs')])],
    ['web guards', () => pnpm(['--filter', '@shipping/web', 'test'])],
    ['api unit contracts', () =>
      // Four standalone Phase 6/7/8 suites merged into one file on 2026-10-20.
      tsx([join('apps/api/scripts', 'unit-contracts.ts')])],
  ];
  return series(steps);
}

/** The API end-to-end suite (jest). Extra arguments select suites. */
function testE2e(rest) {
  return pnpm(['--filter', '@shipping/api', 'exec', 'jest', '--config', 'test/jest-e2e.cjs',
    '--runInBand', ...rest]);
}

/** Database operations. */
function db(rest) {
  const [sub = 'status', ...args] = rest;
  switch (sub) {
    case 'generate': return pnpm(['exec', 'prisma', 'generate']);
    case 'migrate': return pnpm(['exec', 'prisma', 'migrate', 'dev', ...args]);
    case 'deploy': return pnpm(['exec', 'prisma', 'migrate', 'deploy', ...args]);
    case 'status': return pnpm(['exec', 'prisma', 'migrate', 'status']);
    case 'reset': return pnpm(['exec', 'prisma', 'migrate', 'reset', ...args]);
    case 'resolve': return pnpm(['exec', 'prisma', 'migrate', 'resolve', ...args]);
    case 'diff': return pnpm(['exec', 'prisma', 'migrate', 'diff', ...args]);
    case 'studio': return pnpm(['exec', 'prisma', 'studio']);
    case 'seed': return pnpm(['exec', 'tsx', 'prisma/seed.ts']);
    case 'seed:demo':
      return pnpm(['exec', 'tsx', 'prisma/seed.ts'], { env: { SEED_DEMO_DATA: 'true' } });
    case 'seed:reference':
      return tsx(['apps/api/scripts/seed-reference.ts', ...args]);
    case 'preflight': return tsx(['apps/api/scripts/preflight-phase10.ts', ...args]);
    case 'reconcile': return tsx(['apps/api/scripts/reconcile-phase6-ledger.ts']);
    case 'migration:test': return node(['apps/api/scripts/test-phase10-migration.cjs']);
    default:
      stop(`Unknown db sub-command "${sub}". Expected one of: generate, migrate, deploy, status,
  reset, resolve, diff, studio, seed, seed:demo, seed:reference, preflight, reconcile, migration:test`);
  }
}

/** Phase 11 owner-only deployment operations. */
function phase11(rest) {
  const [sub = 'help', ...args] = rest;
  switch (sub) {
    case 'roles': return tsx(['apps/api/scripts/phase11-audit-roles.ts', ...args]);
    case 'seed': return tsx(['apps/api/scripts/seed-phase11-permissions.ts']);
    case 'server': return node(['apps/api/scripts/phase11-server-workflow.cjs']);
    case 'server:unit':
      return node(['--test', 'apps/api/scripts/phase11-server-workflow.test.cjs']);
    case 'audit:unit':
      return (
        // The audit-route and process/db identity contracts live in the merged
        // scripts/checks.test.mjs since 2026-10-20.
        node(['--test', 'scripts/checks.test.mjs']) ||
        tsx(['--test', 'apps/api/scripts/test-phase11-audit-guard.ts'])
      );
    case 'authorized': return authorizedAuditCheck();
    default:
      stop(`Unknown phase11 sub-command "${sub}". Expected: roles, seed, server, server:unit,
  audit:unit, authorized`);
  }
}

/**
 * One live, authorized Audit check. Tokens are read from the terminal and piped
 * through stdin: never an argument, never the environment, never a file or log.
 */
async function authorizedAuditCheck() {
  if (process.env.PHASE11_DB_IDENTITY_ATTESTED !== 'I_VERIFIED_ACTIVE_SESSION')
    stop('STOP: independently verify the active DB session before an owner export.');
  if (process.env.PHASE11_APPROVED_DB_NAME !== 'duna_seed_test')
    stop('STOP: require owner-confirmed duna_seed_test before authorized export.');
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  const ordinary = await rl.question('Approved ordinary-reader access token: ');
  const owner = await rl.question('Approved primary-owner access token: ');
  rl.close();
  if (!ordinary || !owner) stop('Both approved tokens are required.');
  const child = spawn(process.execPath, [join('scripts', 'check-phase11-authorized.mjs')], {
    cwd: ROOT, stdio: ['pipe', 'inherit', 'inherit'],
  });
  child.stdin.end(`${ordinary}\n${owner}\n`);
  return new Promise((resolveExit) => child.on('exit', (code) => resolveExit(code ?? 1)));
}

/** Phase 12 archive/retention deployment workflow. */
function phase12(rest) {
  const [sub = 'test', ...args] = rest;
  if (!['apply', 'test'].includes(sub))
    stop(`Unknown phase12 sub-command "${sub}". Expected: apply, test`);
  return node(['scripts/phase12/server-workflow.cjs', sub, ...args]);
}

/** Record or compare the end-to-end baseline. */
function e2eBaseline(rest) {
  const script = rest[0] === 'record' ? 'record-e2e-baseline.ts' : 'e2e-baseline-report.test.ts';
  return pnpm(['exec', 'tsx', ...(script.endsWith('.test.ts') ? ['--test'] : []),
    join('scripts', script)]);
}

/* --------------------------------------------------------------------- core */

const COMMANDS = {
  setup: { run: setup, help: 'install on a server: deps, database, schema, grants, seed, builds [--status|--health|--integration|--sandbox]' },
  dev: { run: (r) => apps('start', r, { DUNA_WEB_MODE: 'development' }),
    help: 'start API and the Next dev server [api|web|apps]' },
  start: { run: (r) => apps('start', r, { DUNA_WEB_MODE: 'production' }),
    help: 'start API and the production web build [api|web|apps]' },
  stop: { run: (r) => apps('stop', r), help: 'stop API and web; never PostgreSQL [api|web|apps]' },
  restart: { run: (r) => apps('restart', r, { DUNA_WEB_MODE: 'production' }),
    help: 'restart API and the production web build [api|web|apps]' },
  status: { run: () => apps('status', []), help: 'read-only PID/listener/build status' },
  preflight: { run: (r) => apps('preflight', r), help: 'read-only restart preflight [api|web|apps]' },
  'start-api': { run: startApiForeground, help: 'foreground API entry for a service manager' },
  build: {
    run: () => series([
      ['prisma client', () => pnpm(['exec', 'prisma', 'generate'])],
      ['shared packages', () => pnpm(['--filter', '@shipping/config', '--filter', '@shipping/shared', 'run', 'build'])],
      ['api', () => pnpm(['--filter', '@shipping/api', 'build'])],
      ['web', () => pnpm(['--filter', '@shipping/web', 'build'])],
    ]),
    help: 'build the Prisma client, shared packages, API and web app',
  },
  test: { run: test, help: 'every fast test: unit contracts, guards, web contracts' },
  'test:e2e': { run: testE2e, help: 'API jest end-to-end suite [extra jest args]' },
  check: { run: check, help: 'every static contract check' },
  db: { run: db, help: 'database: generate|migrate|deploy|status|reset|resolve|diff|studio|seed|seed:demo|seed:reference|preflight|reconcile|migration:test' },
  phase11: { run: phase11, help: 'Phase 11 owner-only operations: roles|seed|server|server:unit|audit:unit|authorized' },
  phase12: { run: phase12, help: 'Phase 12 archive workflow: apply|test' },
  'e2e-baseline': { run: e2eBaseline, help: 'end-to-end baseline report [record]' },
  lint: { run: () => pnpm(['-r', 'run', 'lint']), help: 'lint every workspace' },
  typecheck: { run: () => pnpm(['-r', 'run', 'typecheck']), help: 'typecheck every workspace' },
};

/** Run labelled steps in order, stopping at the first failure. */
function series(steps) {
  for (const [label, step] of steps) {
    console.log(`\n=== ${label} ===`);
    const code = step();
    if (code !== 0) {
      console.error(`\n${label}: failed (exit ${code})`);
      return code;
    }
  }
  return 0;
}

function help() {
  console.log('Usage: node scripts/duna.mjs <command> [args...]\n\nCommands:');
  const width = Math.max(...Object.keys(COMMANDS).map((k) => k.length));
  for (const [name, entry] of Object.entries(COMMANDS))
    console.log(`  ${name.padEnd(width)}  ${entry.help}`);
  console.log('\nThe short forms setup, dev, build, start, stop, status, test, test:e2e,');
  console.log('check, db, lint and typecheck are also npm scripts (pnpm <name>).');
}

/* -------------------------------------------------------------------- entry */

async function main() {
  const [command = 'help', ...rest] = process.argv.slice(2);
  if (command === 'help' || command === '--help' || command === '-h') return help();
  const entry = COMMANDS[command];
  if (!entry) stop(`Unknown command "${command}". Try: node scripts/duna.mjs help`);
  const code = await entry.run(rest);
  if (code) process.exitCode = code;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export { COMMANDS, ROOT, readFileSync };
