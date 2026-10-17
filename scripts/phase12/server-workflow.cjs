#!/usr/bin/env node
'use strict';
// Two entry points, one ordered workflow. NEVER echo a child environment,
// database URL, Docker inspect output, Prisma/Jest raw output or response body.
// Unit tests inject fake runners; no production target is available in CI.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inspectContainer, connections } = require('./server-target.cjs');
const { DbStop } = require('./db-policy.cjs');
const ROOT = path.resolve(__dirname, '../..');
class StageFailure extends Error {}
function stop(message) { throw new StageFailure(message); }
function execute(bin, args, env = process.env, timeout = 600000, cwd = ROOT) {
  const result = spawnSync(bin, args, { cwd, env, encoding: 'utf8',
    stdio: ['ignore','pipe','pipe'], timeout, maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    // The only details allowed through are our own fixed-string DB errors.
    const line = (result.stdout + '\n' + result.stderr).split(/\r?\n/)
      .find((row) => row.startsWith('PHASE12_DB_FAIL: '));
    const safe = line?.slice('PHASE12_DB_FAIL: '.length);
    const hint = safe && /^[\w\s.,;:'()\/=-]{5,210}$/.test(safe) &&
      !/postgres(?:ql)?:\/\/|@[^\s]+:5432|token=/i.test(safe) ? safe : null;
    stop(`${bin} ${args.slice(0, 3).join(' ')} exited ${result.status ?? 'abnormally'}; ` +
      (hint || 'protected child output withheld; inspect this stage and its file without disclosing credentials'));
  }
  return result.stdout;
}
function toolchain(run = execute) {
  const node = Number(process.versions.node.split('.')[0]);
  if (!Number.isInteger(node) || node < 20) stop('Node 20+ required');
  const version = run('pnpm', ['--version']).trim();
  if (!/^\d+\.\d+\.\d+$/.test(version) || Number(version.split('.')[0]) < 9) {
    stop('pnpm 9+ executable required; Corepack is not used');
  }
  return version;
}
function needsInstall(root = ROOT) {
  return !['node_modules/.bin/prisma','node_modules/.bin/tsx',
    'apps/api/node_modules/.bin/nest','apps/web/node_modules/.bin/next'].every((name) =>
      fs.existsSync(path.join(root, name)));
}
function codeReview(root = ROOT, run = execute) {
  if (run('git',['branch','--show-current']).trim() !== 'arena/be9b4e5b-duna') {
    stop('Phase 12 source must be on the approved arena/be9b4e5b-duna branch');
  }
  // Only reviewed Phase 12 inputs are guarded. Unrelated local work is not
  // stashed/reset/cleaned, staged, overwritten or used as an excuse to block.
  const paths = ['prisma/migrations','prisma/schema.prisma','prisma/seed/phase12-permissions.ts',
    'apps/api/scripts/phase12-db-deploy.ts','apps/api/scripts/seed-phase12-permissions.ts',
    'apps/api/src/modules/archive','apps/web/src/app/[locale]/(dashboard)/archive',
    'apps/web/next.config.mjs','apps/web/tsconfig.json','scripts/phase12','package.json'];
  const diff = spawnSync('git', ['diff','--quiet','HEAD','--',...paths],
    { cwd:root, stdio:'ignore', timeout:10000 });
  const extra = run('git',['ls-files','--others','--exclude-standard','--',...paths]);
  if (diff.status !== 0 || extra.trim()) {
    stop('Reviewed Phase 12 schema, migration, scripts or permission files changed locally; unrelated paths are allowed');
  }
}
function inspectLine(output) {
  const line = output.split(/\r?\n/).find((row) => row.startsWith('PHASE12_DB_INSPECT_PASS: '));
  const matched = line?.match(/journal owner=(shipping|postgres); pending Phase 12=([01]); owner journal grant needed=(true|false); permissions=(0|7)\/7; digest=([0-9a-f]{64})$/);
  if (!matched) stop('DB inspection did not return the reviewed Phase 12 status marker');
  return { journalOwner:matched[1], pending:Number(matched[2]),
    needsGrant:matched[3]==='true', permissions:Number(matched[4]), digest:matched[5],
    needsWrite:matched[2]==='1'||matched[3]==='true'||matched[4]==='0' };
}
function safeDbResult(text) {
  const line = text.split(/\r?\n/).find((item) => item.startsWith('PHASE12_DB_VERIFY_PASS: '));
  const match = line?.match(/^PHASE12_DB_VERIFY_PASS: checksum\/history, RetentionPolicy structure, three protective triggers, seven Phase 12 permission codes \(reserved actions ungranted\), runtime read-only identity\/privileges; configured archive criteria=(\d+); configured deletion thresholds=(\d+)\. No policy\/schedule set by this command\.$/);
  if (!match) stop('Owner DB verification did not return the reviewed PASS marker');
  return `[RESULT] PG16 owner migration history/checksums, retention catalog/three triggers, ` +
    `seven permissions and no reserved grants, restricted runtime Prisma read: PASS; ` +
    `configured archive criteria=${match[1]}; deletion thresholds=${match[2]}; no policy/schedule changed`;
}
function prechangeApproval(env, needed, input = process.stdin, output = process.stdout) {
  if (!needed) return 'NO_DB_CHANGE';
  if (env.PHASE12_PRECHANGE_BACKUP_ATTESTED === 'I_HAVE_RESTORED_PRECHANGE_BACKUP') {
    return env.PHASE12_PRECHANGE_BACKUP_ATTESTED;
  }
  if (!input.isTTY) stop('Recoverable pre-change backup not attested. Approve it using the protected PHASE12_PRECHANGE_BACKUP_ATTESTED environment; no DB write occurred');
  output.write('A current pre-change backup must already have been restored successfully. Type I_HAVE_RESTORED_PRECHANGE_BACKUP to authorize the additive DB change: ');
  const answer = Buffer.alloc(128); let length = 0; let byte = Buffer.alloc(1);
  while (length < answer.length) {
    const n = fs.readSync(input.fd, byte, 0, 1, null);
    if (!n || byte[0] === 10) break;
    answer[length++] = byte[0];
  }
  if (answer.subarray(0,length).toString('utf8').trim() !== 'I_HAVE_RESTORED_PRECHANGE_BACKUP') {
    stop('Current independently restored pre-change backup not approved; no DB write occurred');
  }
  return 'I_HAVE_RESTORED_PRECHANGE_BACKUP';
}
function applicationManager(env, run = execute, root = ROOT) {
  const api = env.PHASE12_API_SYSTEMD_UNIT, web = env.PHASE12_WEB_SYSTEMD_UNIT;
  if (api || web) {
    if (!api || !web || api === web || [api,web].some((unit) =>
        !/^[a-zA-Z0-9_.@-]+\.service$/.test(unit) ||
        /postgres|database|docker|redis/i.test(unit))) {
      stop('Both explicitly approved, different application-only systemd unit names are required');
    }
    for (const [unit,dir] of [[api,'apps/api'],[web,'apps/web']]) {
      const state = run('systemctl',['show',unit,'-p','ActiveState','-p','WorkingDirectory']);
      if (!state.includes('ActiveState=active') ||
          !state.includes(`WorkingDirectory=${path.join(root, dir)}`)) {
        stop('Approved systemd unit is inactive or not running from this checkout; no service touched');
      }
    }
    return { kind:'systemd', units:[api,web] };
  }
  const output = run('node',['scripts/phase11-apps.mjs','preflight','apps'],
    { ...env, PHASE11_APPROVED_DB_NAME:'duna_seed_test' });
  if (!/\[api\] (?:managed|free) port=/.test(output) ||
      !/\[web\] (?:managed|free) port=/.test(output) ||
      !output.includes('App-only preflight passed')) {
    stop('API/web manager is not the reviewed repo PID manager; supply both approved systemd unit names, never touch PostgreSQL');
  }
  return { kind:'repo' };
}
function offlineCommands(mode) {
  const commands = [
    ['Prisma engine and schema', 'prisma/schema.prisma', 'pnpm', ['exec','prisma','generate']],
    ['Prisma schema validation', 'prisma/schema.prisma', 'pnpm', ['exec','prisma','validate']],
    ['Shared/config builds', 'packages/shared; packages/config', 'pnpm',
      ['--filter','@shipping/config','--filter','@shipping/shared','run','build']],
    ['API typecheck', 'apps/api/src', 'pnpm', ['--filter','@shipping/api','typecheck']],
    ...(mode === 'apply' ? [['API build', 'apps/api/src', 'pnpm',
      ['--filter','@shipping/api','build']]] : []),
    ['Canonical API artifact', 'scripts/check-api-build.mjs', 'pnpm', ['check:api:build']],
    ['Phase 12 operation script types', 'apps/api/scripts/phase12-db-deploy.ts', 'pnpm',
      ['exec','tsc','--noEmit','--module','commonjs','--target','ES2021',
        '--moduleResolution','node','--esModuleInterop','--skipLibCheck','--strict',
        '--strictPropertyInitialization','false','--experimentalDecorators',
        '--emitDecoratorMetadata','apps/api/scripts/phase12-db-deploy.ts',
        'apps/api/scripts/seed-phase12-permissions.ts','apps/api/scripts/run-phase12-archive.ts']],
    ['Web typecheck', 'apps/web/src', 'pnpm', ['--filter','@shipping/web','typecheck']],
    ['Web contracts', 'apps/web/scripts', 'pnpm', ['--filter','@shipping/web','test']],
    ['Web build', 'apps/web/src/app/[locale]/(dashboard)/archive/page.tsx', 'pnpm',
      ['--filter','@shipping/web','build']],
    ['Phase 12 JS and workflow contracts', 'scripts/phase12', 'node', ['--test',
      ...fs.readdirSync(path.join(ROOT,'scripts/phase12'))
        .filter((name) => /\.test\.(?:cjs|mjs)$/.test(name))
        .map((name) => `scripts/phase12/${name}`)]],
    ['Archive/audit Nest HTTP and service tests', 'apps/api/scripts/test-phase12-http.ts', 'pnpm',
      ['exec','tsx','--test','apps/api/scripts/test-phase12-archive.ts',
        'apps/api/scripts/test-phase12-http.ts']],
    ['Earlier API regression suites', 'apps/api/test/*.unit-spec.ts', 'pnpm',
      ['--filter','@shipping/api','exec','jest','--config','test/jest-e2e.cjs',
        '--testRegex','.*\\.unit-spec\\.ts$','--runInBand']],
    ['Phase 11 database-grant contracts', 'apps/api/scripts/phase11-server-workflow.test.cjs',
      'pnpm',['test:phase11:server:unit']],
    ['Phase 10 isolated legacy migration fixture', 'apps/api/scripts/test-phase10-migration.cjs',
      'pnpm',['test:phase10:migration']],
    ['Phase 11 audit regression (mocks only)', 'apps/api/scripts/test-phase11-audit-guard.ts',
      'pnpm',['test:phase11:audit:unit']],
    ['HTTP authorization inventory', 'scripts/check-phase11-authz.mjs',
      'pnpm',['check:phase11:authz']],
    ['No demo/sample-data seed path', 'scripts/check-seed-safety.mjs',
      'pnpm',['check:seed-safety']],
  ];
  return commands;
}
function activationCheck(run = execute) {
  // Observation only. On repo-PID-manager hosts there may be no systemd bus.
  // A missing bus is safe ONLY if no known Phase 12 unit is installed on disk;
  // otherwise we cannot establish whether it is enabled and must stop.
  const timers = ['duna-phase12-archive.timer','duna-phase12-backup.timer',
    'duna-phase12-monitor.timer'];
  const locations = ['/etc/systemd/system','/run/systemd/system',
    '/lib/systemd/system','/usr/lib/systemd/system',
    path.join(require('node:os').homedir(),'.config/systemd/user')];
  const present = (file) => {
    try { fs.lstatSync(file); return true; }
    catch (error) {
      if (error.code === 'ENOENT') return false;
      stop('Cannot inspect known Phase 12 timer files');
    }
  };
  const results = [];
  for (const timer of timers) {
    const state = spawnSync('systemctl',['is-enabled',timer], {
      encoding:'utf8', stdio:['ignore','pipe','pipe'], timeout:5000 });
    let value = state.stdout?.trim();
    if (state.error || !['disabled','not-found','masked','static','enabled'].includes(value)) {
      if (locations.some((dir) => present(path.join(dir,timer)) ||
          present(path.join(dir,'timers.target.wants',timer)))) {
        stop(`Unable to establish whether ${timer} is enabled; no scheduling changed`);
      }
      value = 'not-installed (systemd unavailable)';
    }
    results.push([timer,value]);
  }
  return results;
}
function verifyWebArchive(root = ROOT, dist = '.next') {
  const manifest = path.join(root,`apps/web/${dist}/app-path-routes-manifest.json`);
  if (!fs.existsSync(manifest)) stop('Current Next build manifest missing; archive dashboard not proven');
  const routes = JSON.parse(fs.readFileSync(manifest,'utf8'));
  if (routes['/[locale]/(dashboard)/archive/page'] !== '/[locale]/archive') {
    stop('Current web build does not contain the protected archive dashboard route');
  }
  for (const locale of ['en','fa','ar']) {
    const messages = JSON.parse(fs.readFileSync(path.join(root,`apps/web/messages/${locale}.json`),'utf8'));
    if (!messages.archive?.title) stop(`Archive dashboard localization missing for ${locale}`);
  }
}
async function readOnlyRoutes(env, root = ROOT) {
  let port = Number(env.API_PORT);
  // Resolve the already-approved API port without executing a dotenv file.
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const text = fs.existsSync(path.join(root,'.env')) ?
      fs.readFileSync(path.join(root,'.env'),'utf8') : '';
    const match = text.match(/^API_PORT\s*=\s*([0-9]+)\s*$/m);
    port = Number(match?.[1] || 3101);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) stop('Cannot resolve approved API port');
  for (const [route, expected] of [['health',200],['archive/letters',401],
    ['archive/policies',401],['archive/letters/not-a-real-id/history',401],
    ['audit',401],['audit/export',401]]) {
    let response;
    try { response = await fetch(`http://127.0.0.1:${port}/api/v1/${route}`,
      { redirect:'manual', signal:AbortSignal.timeout(8000), cache:'no-store' }); }
    catch { stop(`Read-only API GET /api/v1/${route} failed to reach reviewed listener`); }
    if (response.status !== expected) stop(`Read-only API GET /api/v1/${route}: expected ${expected}, got ${response.status}`);
  }
  // The reviewed repo manager runs Next in dev mode and may replace .next on
  // restart; the production/isolated App Router manifest was checked directly
  // at Web-build time. Probe the actual protected route on the running Web app.
  const webPort = Number(env.PHASE12_WEB_PORT || 3000);
  if (!Number.isInteger(webPort) || webPort < 1 || webPort > 65535) stop('Invalid approved Web port');
  for (const locale of ['en','fa','ar']) {
    let response;
    try { response = await fetch(`http://127.0.0.1:${webPort}/${locale}/archive`,
      { redirect:'manual', signal:AbortSignal.timeout(20000), cache:'no-store' }); }
    catch { stop(`Read-only protected Web route /${locale}/archive is unreachable`); }
    if (![200,302,303,307,308,401].includes(response.status)) {
      stop(`Read-only Web route /${locale}/archive: unexpected status ${response.status}`);
    }
    if ([302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) stop(`Protected Web route /${locale}/archive returned an empty redirect`);
      const next = new URL(location, `http://127.0.0.1:${webPort}`);
      if (next.hostname !== '127.0.0.1' || next.port !== String(webPort) ||
          !next.pathname.endsWith('/login')) {
        stop(`Protected Web route /${locale}/archive redirected outside the approved sign-in flow`);
      }
    }
  }
}
async function workflow(mode, { run = execute, containerInspect = inspectContainer,
  resolveUrls = connections, review = codeReview, installCheck = needsInstall,
  commands = offlineCommands, managerFactory = applicationManager,
  approval = prechangeApproval, activations = activationCheck, routes = readOnlyRoutes,
  output = console.log, env = process.env, root = ROOT } = {}) {
  if (!['apply','test'].includes(mode)) stop('Use pnpm phase12:apply or pnpm phase12:test');
  const results=[];
  const pass = (label, detail = '') => {
    results.push({ label, outcome:'PASS' });
    output(`[PASS] ${label}${detail ? ` — ${detail}` : ''}`);
  };
  const stage = async (label, file, fn) => {
    try { const value = await fn(); pass(label); return value; }
    catch (error) {
      const message = error instanceof StageFailure || error instanceof DbStop ?
        error.message : 'unexpected protected operation error (details suppressed)';
      results.push({ label, outcome:'FAIL' });
      output(`[FAIL] ${label} (${file}): ${message}`);
      throw error;
    }
  };
  try {
    await stage('Toolchain', 'package.json', () => toolchain(run));
    const container = await stage('Docker PostgreSQL 16/approved port',
      'scripts/phase12/server-target.cjs', () => containerInspect());
    const urls = await stage('Existing runtime and migration-owner credentials',
      'scripts/phase12/server-target.cjs', () => resolveUrls(env,root,container));
    // Never put a migrator secret, owner passfile or attestation in the API,
    // Web, compiler/test, or manager environment. Only the DB stage receives
    // the owner URL, and the API keeps its existing restricted DATABASE_URL.
    const { MIGRATOR_DATABASE_URL: _migrator, RUNTIME_DATABASE_URL: _priorRuntime,
      PGPASSFILE: _ownerPassfile, PGPASSWORD: _pgPassword, PGUSER: _pgUser,
      PGHOST: _pgHost, PGPORT: _pgPort, PGDATABASE: _pgDatabase,
      POSTGRES_USER: _containerUser, POSTGRES_PASSWORD: _containerPassword,
      POSTGRES_PASSWORD_FILE: _containerSecretFile,
      PHASE12_PRECHANGE_BACKUP_ATTESTED: _prechange,
      PHASE12_MIGRATION_APPROVAL: _approval, ...safeEnv } = env;
    const runtimeEnv = { ...safeEnv, DATABASE_URL:urls.runtime, PHASE11_APPROVED_DB_NAME:'duna_seed_test',
      PHASE12_EXPECTED_DB:'duna_seed_test', SEED_DEMO_DATA:'false' };
    const dbEnv = { ...runtimeEnv, DATABASE_URL:urls.owner, RUNTIME_DATABASE_URL:urls.runtime };
    await stage('Reviewed Phase 12 source; unrelated files preserved',
      'scripts/phase12/server-workflow.cjs', () => review(root, run));
    if (installCheck(root)) await stage('Frozen dependencies (no install hooks or DB writes)',
      'pnpm-lock.yaml', () => run('pnpm',['install','--frozen-lockfile','--ignore-scripts'],runtimeEnv));
    for (const [label,file,bin,args] of commands(mode)) {
      const nextEnv = { ...runtimeEnv,
        ...(label === 'Archive/audit Nest HTTP and service tests' ?
          { TSX_TSCONFIG_PATH:'apps/api/tsconfig.json' } : {}),
        ...(label === 'Web build' && mode === 'test' ? { PHASE12_NEXT_ISOLATED_BUILD:'1' } : {}) };
      await stage(label,file, () => run(bin,args,nextEnv, label === 'Web build' ? 900000 : 600000));
      if (label === 'Web build') await stage('Built archive dashboard mapping/locales',
        'apps/web/src/app/[locale]/(dashboard)/archive/page.tsx', () =>
          verifyWebArchive(root, mode === 'test' ? 'build' : '.next'));
    }
    const state = await stage('Independent read-only host/container migration inspection',
      'apps/api/scripts/phase12-db-deploy.ts', () => inspectLine(run('pnpm',
        ['exec','tsx','apps/api/scripts/phase12-db-deploy.ts','inspect'],dbEnv)));
    output(`[PLAN] PG16 erp-postgres; journal owner=${state.journalOwner}; Phase 12 pending=${state.pending}; ` +
      `minimum owner journal grant needed=${state.needsGrant}; permissions=${state.permissions}/7; ` +
      `reviewed catalog/source digest=${state.digest}`);
    if (mode === 'apply') {
      await stage('Pre-change Phase 12 timer inventory',
        'scripts/phase12/server-workflow.cjs', () => {
          const timers = activations(run);
          if (timers.some(([,state]) => state === 'enabled')) {
            stop('A Phase 12 timer is already enabled; reconcile its separate owner approval before any DB change');
          }
        });
      const manager = await stage('Application-only restart preflight',
        'scripts/phase11-apps.mjs', () => managerFactory(runtimeEnv,run,root));
      const attestation = await stage('Verified pre-change recovery prerequisite',
        'scripts/phase12/server-workflow.cjs', () =>
          approval(env,state.needsWrite));
      const authorized = { ...dbEnv, PHASE12_MIGRATION_APPROVAL:'I_APPROVE_ADDITIVE_PHASE12_MIGRATION',
        PHASE12_PRECHANGE_BACKUP_ATTESTED:attestation };
      const deployed = await stage('Conditional owner migration and seven-code incremental seed',
        'apps/api/scripts/phase12-db-deploy.ts', () => safeDbResult(run('pnpm',
          ['exec','tsx','apps/api/scripts/phase12-db-deploy.ts','apply'], authorized)));
      output(deployed);
      const verified = await stage('Independent owner migration status and restricted runtime probe',
        'apps/api/scripts/phase12-db-deploy.ts', () => safeDbResult(run('pnpm',
          ['exec','tsx','apps/api/scripts/phase12-db-deploy.ts','verify'],dbEnv)));
      output(verified);
      await stage('Restart only the existing API and web services',
        manager.kind === 'repo' ? 'scripts/restart-apps-only.sh' : 'systemd', () =>
          manager.kind === 'repo' ? run('bash',['scripts/restart-apps-only.sh','apps'],runtimeEnv,180000) :
            run('systemctl',['restart',...manager.units],runtimeEnv,180000));
      await stage('Running API PID/startup runtime role',
        'scripts/check-phase11-process-db-identity.mjs', () => {
          const pid = manager.kind === 'repo' ?
            fs.readFileSync(path.join(root,'logs/api.pid'),'utf8').trim() :
            run('systemctl',['show',manager.units[0],'-p','MainPID','--value'],runtimeEnv).trim();
          if (!/^[1-9][0-9]*$/.test(pid)) stop('Managed API PID is not valid');
          return run('node',['scripts/check-phase11-process-db-identity.mjs',pid],runtimeEnv);
        });
    } else {
      const verified = await stage('Read-only owner migration status, schema, ACL and runtime checks',
        'apps/api/scripts/phase12-db-deploy.ts', () => safeDbResult(run('pnpm',
          ['exec','tsx','apps/api/scripts/phase12-db-deploy.ts','verify'],dbEnv)));
      output(verified);
    }
    const timerStates = await stage('No implicit Phase 12 timer activation or purge job',
      'scripts/phase12/render-units.cjs', () => {
        const timers = activations(run);
        if (timers.some(([,state]) => state === 'enabled')) {
          stop('An existing Phase 12 timer is enabled; its separate owner approval must be reviewed (this workflow did not enable it)');
        }
        return timers;
      });
    output(`[RESULT] Phase 12 timer states: ${timerStates.map(([timer,state]) => `${timer}=${state}`).join('; ')}`);
    await stage('Read-only live API and three-locale dashboard routes',
      'apps/web/src/app/[locale]/(dashboard)/archive/page.tsx', () => routes(runtimeEnv,root));
    output(`PHASE12_${mode.toUpperCase()}_PASS: ${results.length} stages passed; ` +
      (mode === 'apply' ? 'migration/seed idempotent, apps restarted; no timers/purge activated.' :
        'owner DB queries read-only; no migration, seed, timer or production fixture writes.'));
    return results;
  } catch {
    output(`PHASE12_${mode.toUpperCase()}_FAIL: ${results.filter((r)=>r.outcome==='PASS').length} passed, ` +
      `${results.filter((r)=>r.outcome==='FAIL').length} failed; subsequent stages NOT RUN. No success claim.`);
    throw new StageFailure('Phase 12 stopped at the first failed mandatory stage');
  }
}
if (require.main === module) {
  workflow(process.argv[2]).catch(() => { process.exitCode=1; });
}
module.exports = { StageFailure, toolchain, needsInstall, codeReview, inspectLine, safeDbResult,
  prechangeApproval, applicationManager, offlineCommands, activationCheck,
  verifyWebArchive, readOnlyRoutes, workflow };
