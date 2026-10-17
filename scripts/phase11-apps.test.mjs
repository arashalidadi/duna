import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  attestRunningApi,
  inspectService,
  listenerPids,
  matchesManagedProcess,
  runApps,
} from './phase11-apps.mjs';
import { beginApiBuild, finishApiBuild } from './check-api-build.mjs';

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
    await runApps('stop', 'api', root);
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
    await runApps('stop', 'api', root);
  } finally {
    if (previous === undefined) delete process.env.API_PORT;
    else process.env.API_PORT = previous;
    if (fixture) await dispose(fixture.child);
    rmSync(root, { recursive: true, force: true });
  }
});
