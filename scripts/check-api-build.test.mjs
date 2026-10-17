import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { beginApiBuild, finishApiBuild, verifyApiBuild } from './check-api-build.mjs';

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
