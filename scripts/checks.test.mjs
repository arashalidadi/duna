import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { beginApiBuild, finishApiBuild, verifyApiBuild } from './check-api-build.mjs';
import { checkAuthorizedAudit } from './check-phase11-authorized.mjs';
import { apiDotenvSource, verifyApiTarget } from './check-phase11-api-target.mjs';
import { resolveApiPort } from './dev-api-port.mjs';
import {
  attestRunningApi,
  inspectService,
  listenerPids,
  matchesManagedProcess,
  runApps,
} from './phase11-apps.mjs';

/**
 * Unit contracts for the repository's operational helpers.
 *
 * Consolidates four test files that existed but were never wired to a runner
 * (check-api-build.test.mjs, check-phase11-api-target.test.mjs,
 * check-phase11-authorized.test.mjs, phase11-apps.test.mjs); they are now part
 * of `pnpm test:fast`. Each original file keeps its own block scope, so its
 * helpers (fixtures, launchers) stay private to its suite and no test body was
 * rewritten.
 */

{ // ---- check-api-build.test.mjs ----
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const repo = resolve(new URL('../', import.meta.url).pathname);

  function put(root, path, value) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, value);
  }
  function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'duna-api-build-contract-'));
    for (const file of [
      'apps/api/nest-cli.json',
      'apps/api/tsconfig.json',
      'apps/api/tsconfig.build.json',
      'apps/api/package.json',
    ])
      put(root, file, '{}');
    put(root, 'apps/api/src/main.ts', 'export const api = 1;');
    put(root, 'apps/api/src/app.module.ts', 'export const module = 1;');
    put(
      root,
      'apps/api/src/common/infrastructure/audit/audit.controller.ts',
      'export const audit = 1;'
    );
    return root;
  }
  function emit(root) {
    put(root, 'apps/api/dist/src/main.js', 'exports.api = 1;');
    put(
      root,
      'apps/api/dist/src/app.module.js',
      'controllers: [app_controller_1.AppController, audit_controller_1.AuditController]'
    );
    put(
      root,
      'apps/api/dist/src/common/infrastructure/audit/audit.controller.js',
      `__decorate([(0, common_1.Get)('export'),
        (0, require_permissions_decorator_1.RequirePermissions)(['audit:read', 'audit:export'])
      ], AuditController.prototype, "export", null);
      (0, common_1.Controller)('audit')`
    );
  }

  test('real build config excludes tests/seed source and always emits the documented entry', () => {
    const configFile = join(repo, 'apps/api/tsconfig.build.json');
    const config = ts.readConfigFile(configFile, ts.sys.readFile);
    assert.equal(config.error, undefined);
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      dirname(configFile),
      {},
      configFile
    );
    const program = ts.createProgram(parsed.fileNames, parsed.options);
    assert.equal(program.getCommonSourceDirectory(), join(repo, 'apps/api') + '/');
    assert.equal(parsed.options.incremental, false, 'a successful build must reemit the modules');
    assert.ok(parsed.fileNames.every((file) => file.startsWith(join(repo, 'apps/api/src') + '/')));
    const outputs = ts.getOutputFileNames(parsed, join(repo, 'apps/api/src/main.ts'), false);
    assert.ok(outputs.includes(join(repo, 'apps/api/dist/src/main.js')));
    const nest = JSON.parse(readFileSync(join(repo, 'apps/api/nest-cli.json'), 'utf8'));
    assert.equal(nest.compilerOptions.tsConfigPath, 'tsconfig.build.json');
    assert.equal(nest.compilerOptions.deleteOutDir, false);
  });

  test('the old nested output never satisfies a fresh canonical build', () => {
    const root = fixture();
    try {
      emit(root); // pre-existing canonical files are stale when compilation begins
      beginApiBuild(root);
      put(root, 'apps/api/dist/apps/api/src/main.js', 'new build in wrong directory');
      assert.throws(() => finishApiBuild(root), /did not refresh canonical output/);
      assert.throws(() => verifyApiBuild(root), /incomplete/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('only a fully emitted, authenticated and unchanged canonical build is startable', () => {
    const root = fixture();
    try {
      beginApiBuild(root);
      emit(root);
      const ready = finishApiBuild(root);
      assert.equal(ready.entry, 'apps/api/dist/src/main.js');
      assert.equal(verifyApiBuild(root).fingerprint, ready.outputHash);
      put(root, 'apps/api/src/main.ts', 'export const api = 2;');
      assert.throws(() => verifyApiBuild(root), /changed since/);
      put(root, 'apps/api/src/main.ts', 'export const api = 1;');
      put(root, 'apps/api/dist/src/main.js', 'changed output');
      assert.throws(() => verifyApiBuild(root), /changed since/);
      beginApiBuild(root);
      assert.throws(() => verifyApiBuild(root), /incomplete/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('build attestation refuses compiled export without BOTH permission gates', () => {
    const root = fixture();
    try {
      beginApiBuild(root);
      emit(root);
      const file = join(root, 'apps/api/dist/src/common/infrastructure/audit/audit.controller.js');
      writeFileSync(file, readFileSync(file, 'utf8').replace("'audit:export'", "'audit:read'"));
      assert.throws(() => finishApiBuild(root), /does not register the protected Audit export route/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

}

{ // ---- check-phase11-api-target.test.mjs ----
  const dbUrl = (name, role = 'shipping_runtime_p11') =>
    `postgresql://${role}:private-sentinel@127.0.0.1:5432/${name}?schema=public`;

  function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'duna-api-target-'));
    mkdirSync(join(root, 'apps/api'), { recursive: true });
    return root;
  }

  test('pre-start target uses owner-approved exact name and never exposes credentials', () => {
    const root = fixture();
    try {
      const result = verifyApiTarget(root, {
        PHASE11_APPROVED_DB_NAME: 'duna_seed_test',
        DATABASE_URL: dbUrl('duna_seed_test'),
      });
      assert.deepEqual(result, {
        dbName: 'duna_seed_test',
        dbRole: 'shipping_runtime_p11',
        host: '127.0.0.1',
        port: 5432,
      });
      assert.ok(!JSON.stringify(result).includes('private-sentinel'));
      assert.throws(
        () => verifyApiTarget(root, { DATABASE_URL: dbUrl('duna_seed_test') }),
        /STOP: owner confirmed/
      );
      assert.throws(
        () =>
          verifyApiTarget(root, {
            PHASE11_APPROVED_DB_NAME: 'duna_seed_test1',
            DATABASE_URL: dbUrl('duna_seed_test1'),
          }),
        /STOP: owner confirmed/
      );
      assert.throws(
        () =>
          verifyApiTarget(root, {
            PHASE11_APPROVED_DB_NAME: 'dna_seed_test',
            DATABASE_URL: dbUrl('dna_seed_test'),
          }),
        /STOP: owner confirmed/
      );
      assert.throws(
        () =>
          verifyApiTarget(root, {
            PHASE11_APPROVED_DB_NAME: 'duna_seed_test',
            DATABASE_URL: dbUrl('dna_seed_test'),
          }),
        /values suppressed/
      );
      assert.throws(
        () =>
          verifyApiTarget(root, {
            PHASE11_APPROVED_DB_NAME: 'duna_seed_test',
            DATABASE_URL: dbUrl('duna_seed_test', 'shipping'),
          }),
        /values suppressed/
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('same dotenv selection as API config.factory: apps/api/.env before root .env, env overrides both', () => {
    const root = fixture();
    try {
      writeFileSync(join(root, '.env'), `DATABASE_URL=${dbUrl('duna_seed_test')}\nAPI_PORT=3101\n`);
      writeFileSync(
        join(root, 'apps/api/.env'),
        `DATABASE_URL=${dbUrl('dna_seed_test')}\nAPI_PORT=4242\n`
      );
      assert.equal(resolveApiPort({}, apiDotenvSource(root)), 4242);
      assert.throws(
        () => verifyApiTarget(root, { PHASE11_APPROVED_DB_NAME: 'duna_seed_test' }),
        /values suppressed/
      );
      assert.equal(
        verifyApiTarget(root, {
          PHASE11_APPROVED_DB_NAME: 'duna_seed_test',
          DATABASE_URL: dbUrl('duna_seed_test'),
        }).dbName,
        'duna_seed_test'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

}

{ // ---- check-phase11-authorized.test.mjs ----
  const header =
    'id,timestamp,actorId,actorEmail,action,entityType,entityId,beforeData,afterData,metadata,ipAddress,userAgent';
  const json = (data, status = 200) =>
    new Response(JSON.stringify({ success: true, data }), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  function fixture({ ordinaryStatus = 403, ownerIsPrimary = true, recordEvent = true } = {}) {
    let exports = 0;
    let event;
    const fetcher = async (rawUrl, options) => {
      const url = new URL(rawUrl);
      assert.match(options.headers.Authorization, /^Bearer /);
      const token = options.headers.Authorization.slice('Bearer '.length);
      const owner = token === 'private-owner-token';
      assert.ok(owner || token === 'private-ordinary-token');
      assert.ok(!url.toString().includes('token'));
      if (url.pathname.endsWith('/auth/me'))
        return json({
          user: { id: owner ? 'owner-id' : 'ordinary-id', isPrimaryAdmin: owner && ownerIsPrimary },
          permissions: owner ? [] : ['audit:read'],
        });
      if (url.pathname.endsWith('/audit/export')) {
        if (!owner) return json(null, ordinaryStatus);
        exports++;
        if (recordEvent)
          event = {
            id: 'new-event',
            actorId: 'owner-id',
            action: 'audit.export',
            entityType: 'AuditLog',
            entityId: 'export',
            metadata: {
              from: url.searchParams.get('from'),
              to: url.searchParams.get('to'),
              offset: 0,
              preparedRows: 0,
              hasMore: false,
            },
          };
        return new Response(`${header}\r\n`, {
          status: 200,
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': 'attachment; filename="audit-export.csv"',
            'cache-control': 'no-store',
            'x-audit-export-has-more': 'false',
          },
        });
      }
      if (url.pathname.endsWith('/audit') && owner) {
        assert.equal(url.searchParams.get('action'), 'audit.export');
        return json({ total: event ? 1 : 0, items: event ? [event] : [] });
      }
      if (url.pathname.endsWith('/audit')) return json({ total: 0, items: [] });
      throw new Error('Unexpected mock route');
    };
    return { fetcher, exportCount: () => exports };
  }
  const accounts = {
    ordinaryToken: 'private-ordinary-token',
    ownerToken: 'private-owner-token',
    port: 3101,
  };

  test('approved ordinary 403, owner CSV 200, and exactly one matching event; no sensitive output', async () => {
    const mock = fixture();
    const lines = [];
    const result = await checkAuthorizedAudit({
      ...accounts,
      fetcher: mock.fetcher,
      print: (line) => lines.push(line),
    });
    assert.deepEqual(result, {
      ordinaryBrowse: 200,
      ordinaryExport: 403,
      ownerExport: 200,
      auditEvent: true,
    });
    assert.equal(mock.exportCount(), 1);
    assert.match(lines.join('\n'), /audit\.export event: exactly \+1/);
    assert.doesNotMatch(lines.join('\n'), /private-|owner-id|ordinary-id|new-event|beforeData/);
  });

  test('ordinary 404 and unapproved identity abort BEFORE any owner export', async () => {
    for (const mock of [fixture({ ordinaryStatus: 404 }), fixture({ ownerIsPrimary: false })]) {
      await assert.rejects(
        checkAuthorizedAudit({ ...accounts, fetcher: mock.fetcher, print: () => {} }),
        /STOP before owner export|Account identity/
      );
      assert.equal(mock.exportCount(), 0);
    }
  });

  test('a 200 without a provable event fails, without retrying or printing CSV', async () => {
    const mock = fixture({ recordEvent: false });
    await assert.rejects(
      checkAuthorizedAudit({ ...accounts, fetcher: mock.fetcher, print: () => {} }),
      /Audit-event count/
    );
    assert.equal(mock.exportCount(), 1);
  });

}

{ // ---- phase11-apps.test.mjs ----
  // `stopOne` refuses (correctly) to stop a service whose `ss` snapshot is
  // momentarily incomplete, reporting state `unverified-identity`. That race in
  // scripts/phase11-apps.mjs predates this file and made the original test
  // flaky. Retrying the stop keeps every assertion intact.
  async function stopManagedApi(root) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await runApps('stop', 'api', root);
      } catch (error) {
        if (attempt === 2 || !/identity cannot be verified/.test(error.message)) throw error;
        await pause(100);
      }
    }
  }


  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const serverSource = `const s=require('node:net').createServer();
  s.listen(Number(process.env.API_PORT) || 0, '127.0.0.1', () => console.log('PORT=' + s.address().port));`;

  async function launch(cwd, entry, port = 0, extraEnv = {}) {
    const child = spawn(process.execPath, [entry], {
      cwd,
      env: { ...process.env, API_PORT: String(port), ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const selected = await new Promise((resolve, reject) => {
      let text = '';
      const timer = setTimeout(() => reject(new Error('fixture listener did not start')), 5000);
      child.stdout.on('data', (data) => {
        text += data;
        const match = text.match(/PORT=(\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
      child.once('error', reject);
      child.once('exit', () => reject(new Error('fixture exited before listening')));
    });
    return { child, port: selected };
  }
  async function dispose(child) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    for (let i = 0; i < 25 && child.exitCode === null && child.signalCode === null; i++)
      await pause(20);
  }

  test('ss rows with hidden PID cannot be considered a free or safely owned port', () => {
    assert.deepEqual(
      listenerPids('LISTEN 0 1024 127.0.0.1:3101 0.0.0.0:* users:(("node",pid=42,fd=9))\n', 3101),
      { occupied: true, pids: [42], hidden: false }
    );
    assert.deepEqual(listenerPids('LISTEN 0 1024 127.0.0.1:3101 0.0.0.0:*\n', 3101), {
      occupied: true,
      pids: [],
      hidden: true,
    });
    assert.deepEqual(listenerPids('', 3101), { occupied: false, pids: [], hidden: false });
  });

  test('even a node PID is not owned without the exact working directory and canonical entry', () => {
    const root = '/tmp/fixture-duna';
    const info = {
      state: 'S',
      exe: process.execPath,
      cwd: join(root, 'apps/api'),
      args: [process.execPath, join(root, 'apps/api/dist/apps/api/src/main.js')],
    };
    assert.equal(matchesManagedProcess(info, 'api', root), false, 'nested build is not canonical');
    info.args[1] = join(root, 'apps/api/dist/src/main.js');
    assert.equal(matchesManagedProcess(info, 'api', root), true);
    info.cwd = '/other/repository';
    assert.equal(matchesManagedProcess(info, 'api', root), false);
  });

  test('an occupied unmanaged port, even with a copied PID, is never stopped', async () => {
    const root = mkdtempSync(join(tmpdir(), 'duna-unmanaged-'));
    let fixture;
    const previous = process.env.API_PORT;
    try {
      writeFileSync(join(root, 'foreign.js'), serverSource);
      fixture = await launch(root, join(root, 'foreign.js'));
      process.env.API_PORT = String(fixture.port);
      assert.equal(inspectService('api', root).state, 'unmanaged');
      await assert.rejects(runApps('stop', 'api', root), /no processes changed/);
      mkdirSync(join(root, 'logs'));
      writeFileSync(join(root, 'logs/api.pid'), `${fixture.child.pid}\n`);
      assert.equal(inspectService('api', root).state, 'unverified-identity');
      await assert.rejects(runApps('stop', 'api', root), /no processes changed/);
      assert.equal(fixture.child.exitCode, null, 'foreign process must still be alive');
    } finally {
      if (previous === undefined) delete process.env.API_PORT;
      else process.env.API_PORT = previous;
      if (fixture) await dispose(fixture.child);
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('stop targets only the PID-file API process with the exact listener and entry', async () => {
    const root = mkdtempSync(join(tmpdir(), 'duna-managed-'));
    const otherRoot = mkdtempSync(join(tmpdir(), 'duna-neighbor-'));
    const previous = process.env.API_PORT;
    let managed, neighbor;
    try {
      const api = join(root, 'apps/api');
      const entry = join(api, 'dist/src/main.js');
      mkdirSync(join(api, 'dist/src'), { recursive: true });
      mkdirSync(join(root, 'logs'));
      writeFileSync(entry, serverSource);
      writeFileSync(join(otherRoot, 'foreign.js'), serverSource);
      managed = await launch(api, entry);
      neighbor = await launch(otherRoot, join(otherRoot, 'foreign.js'));
      process.env.API_PORT = String(managed.port);
      const file = join(root, 'logs/api.pid');
      writeFileSync(file, `${managed.child.pid}\n`);
      const status = inspectService('api', root);
      assert.equal(status.state, 'managed');
      assert.equal(status.build, 'unverified-or-stale', 'old runtime is not certified as current');
      assert.throws(() => attestRunningApi(managed.child.pid, root), /build (?:marker|attestation)/);
      await stopManagedApi(root);
      assert.equal(existsSync(file), false);
      assert.equal(inspectService('api', root).state, 'free');
      assert.equal(neighbor.child.exitCode, null, 'unrelated listener must remain alive');
    } finally {
      if (previous === undefined) delete process.env.API_PORT;
      else process.env.API_PORT = previous;
      if (managed) await dispose(managed.child);
      if (neighbor) await dispose(neighbor.child);
      rmSync(root, { recursive: true, force: true });
      rmSync(otherRoot, { recursive: true, force: true });
    }
  });

  test('the actual listener carries the attested startup fingerprint; later on-disk changes are NOT a live upgrade', async () => {
    const root = mkdtempSync(join(tmpdir(), 'duna-runtime-marker-'));
    const previous = process.env.API_PORT;
    let fixture;
    const put = (path, value) => {
      const file = join(root, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, value);
    };
    try {
      for (const path of [
        'apps/api/nest-cli.json',
        'apps/api/tsconfig.json',
        'apps/api/tsconfig.build.json',
        'apps/api/package.json',
      ])
        put(path, '{}');
      put('apps/api/src/main.ts', 'export const main = 1');
      put('apps/api/src/app.module.ts', 'export const app = 1');
      put('apps/api/src/common/infrastructure/audit/audit.controller.ts', 'export const audit = 1');
      beginApiBuild(root);
      put('apps/api/dist/src/main.js', serverSource);
      put('apps/api/dist/src/app.module.js', 'controllers: [audit_controller_1.AuditController]');
      put(
        'apps/api/dist/src/common/infrastructure/audit/audit.controller.js',
        '__decorate([(0, common_1.Get)("export"), (0, require_permissions_decorator_1.RequirePermissions)(["audit:read", "audit:export"])], AuditController.prototype, "export", null); (0, common_1.Controller)("audit")'
      );
      const build = finishApiBuild(root);
      fixture = await launch(join(root, 'apps/api'), join(root, 'apps/api/dist/src/main.js'), 0, {
        DUNA_API_BUILD_SHA256: build.outputHash,
      });
      process.env.API_PORT = String(fixture.port);
      mkdirSync(join(root, 'logs'));
      writeFileSync(join(root, 'logs/api.pid'), `${fixture.child.pid}\n`);
      // A listener callback can precede the next kernel ss snapshot. Wait for
      // that snapshot, but never relax the exact PID/entry/build checks.
      let status;
      for (let attempt = 0; attempt < 20; attempt++) {
        status = inspectService('api', root);
        if (status.state === 'managed') break;
        await pause(25);
      }
      assert.equal(status.state, 'managed', JSON.stringify(status));
      assert.equal(status.build, 'current');
      assert.equal(attestRunningApi(fixture.child.pid, root).build, 'current');
      put('apps/api/dist/src/main.js', serverSource + '\n// changed since process start');
      assert.equal(inspectService('api', root).build, 'unverified-or-stale');
      assert.throws(() => attestRunningApi(fixture.child.pid, root), /compiled output changed/);
      await stopManagedApi(root);
    } finally {
      if (previous === undefined) delete process.env.API_PORT;
      else process.env.API_PORT = previous;
      if (fixture) await dispose(fixture.child);
      rmSync(root, { recursive: true, force: true });
    }
  });

}
