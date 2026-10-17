#!/usr/bin/env node
/**
 * API build provenance. This never connects to a database, deletes dist, or
 * executes the API. The build script marks the output unavailable BEFORE Nest
 * compiles, then records only a fully emitted canonical dist/src tree.
 *
 * Usage: node scripts/check-api-build.mjs begin|finish|verify
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const sourceInputs = [
  'apps/api/nest-cli.json',
  'apps/api/tsconfig.json',
  'apps/api/tsconfig.build.json',
  'apps/api/package.json',
];
const canonical = 'apps/api/dist/src/main.js';
const controller = 'apps/api/dist/src/common/infrastructure/audit/audit.controller.js';
const appModule = 'apps/api/dist/src/app.module.js';
const stateFile = 'apps/api/dist/phase11-build-state.json';

function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const name = join(dir, item.name);
    return item.isDirectory()
      ? filesIn(name)
      : item.isFile() && /\.ts$/.test(item.name) && !item.name.endsWith('.d.ts')
        ? [name]
        : [];
  });
}

function inputs(root) {
  return [
    ...sourceInputs,
    ...filesIn(join(root, 'apps/api/src')).map((file) => relative(root, file)),
  ].sort();
}

function hash(root, paths) {
  const digest = createHash('sha256');
  for (const name of paths) {
    const value = readFileSync(join(root, name));
    digest.update(`${name.length}:${name}:${value.length}:`);
    digest.update(value);
  }
  return digest.digest('hex');
}

function outputs(paths) {
  return paths
    .filter((name) => name.startsWith('apps/api/src/') && name.endsWith('.ts'))
    .map((name) => name.replace(/^apps\/api\/src\//, 'apps/api/dist/src/').replace(/\.ts$/, '.js'));
}

function save(root, data) {
  const path = join(root, stateFile);
  mkdirSync(resolve(path, '..'), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function load(root) {
  try {
    return JSON.parse(readFileSync(join(root, stateFile), 'utf8'));
  } catch {
    throw new Error('API build attestation missing; build with pnpm --filter @shipping/api build');
  }
}

function assertRoutes(root) {
  const js = readFileSync(join(root, controller), 'utf8');
  const app = readFileSync(join(root, appModule), 'utf8');
  const methodBlocks = [
    ...js.matchAll(/__decorate\(\[([\s\S]*?)\],\s*AuditController\.prototype,\s*["']([^"']+)["']/g),
  ];
  const exportMethod = methodBlocks.find((match) => match[2] === 'export')?.[1];
  if (
    !exportMethod ||
    !/\.Get\)\(['"]export['"]\)/.test(exportMethod) ||
    !/\.RequirePermissions\)\(\[['"]audit:read['"],\s*['"]audit:export['"]\]\)/.test(
      exportMethod
    ) ||
    !/AuditController/.test(app) ||
    !/\.Controller\)\(['"]audit['"]\)/.test(js)
  ) {
    throw new Error('Canonical compiled API does not register the protected Audit export route');
  }
}

export function beginApiBuild(root = repo) {
  const paths = inputs(root);
  const before = Object.fromEntries(
    outputs(paths)
      .filter((name) => existsSync(join(root, name)))
      .map((name) => [name, statSync(join(root, name)).mtimeMs])
  );
  const state = {
    schema: 1,
    status: 'building',
    startedAt: Date.now(),
    sourceHash: hash(root, paths),
    previousOutputMtimes: before,
  };
  save(root, state);
  // Compare timestamps from the same filesystem. In virtualized filesystems,
  // Date.now() can lead file mtimes by several milliseconds.
  state.markerMtimeMs = statSync(join(root, stateFile)).mtimeMs;
  save(root, state);
  return state;
}

export function finishApiBuild(root = repo) {
  const state = load(root);
  if (state.schema !== 1 || state.status !== 'building') {
    throw new Error(
      'API build was not marked as started; rebuild using the supported package script'
    );
  }
  const paths = inputs(root);
  if (hash(root, paths) !== state.sourceHash)
    throw new Error('API sources changed during compilation');
  const emitted = outputs(paths);
  for (const name of emitted) {
    const path = join(root, name);
    const oldMtime = state.previousOutputMtimes?.[name];
    if (
      !existsSync(path) ||
      (oldMtime === undefined
        ? statSync(path).mtimeMs < state.markerMtimeMs
        : statSync(path).mtimeMs <= oldMtime)
    ) {
      throw new Error(`API compilation did not refresh canonical output: ${name}`);
    }
  }
  if (
    !emitted.includes(canonical) ||
    !emitted.includes(controller) ||
    !emitted.includes(appModule)
  ) {
    throw new Error('Canonical API entry/controller/module are not among emitted files');
  }
  assertRoutes(root);
  const ready = {
    ...state,
    status: 'ready',
    entry: canonical,
    sourceCount: paths.length,
    emittedCount: emitted.length,
    outputHash: hash(root, emitted),
    completedAt: Date.now(),
  };
  save(root, ready);
  return ready;
}

export function verifyApiBuild(root = repo) {
  const state = load(root);
  if (state.schema !== 1 || state.status !== 'ready' || state.entry !== canonical) {
    throw new Error('API build is incomplete or targets the wrong entry; rebuild before start');
  }
  const paths = inputs(root);
  const emitted = outputs(paths);
  if (
    paths.length !== state.sourceCount ||
    emitted.length !== state.emittedCount ||
    hash(root, paths) !== state.sourceHash ||
    hash(root, emitted) !== state.outputHash
  ) {
    throw new Error('API source or compiled output changed since the verified build; rebuild');
  }
  assertRoutes(root);
  return {
    entry: join(root, canonical),
    completedAt: state.completedAt,
    emittedCount: emitted.length,
    fingerprint: state.outputHash,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const action = process.argv[2];
    if (action === 'begin') {
      beginApiBuild();
      console.log('API build marked in progress; stale output is not startable.');
    } else if (action === 'finish') {
      const result = finishApiBuild();
      console.log(`API build verified: ${result.entry}, ${result.emittedCount} compiled modules.`);
    } else if (action === 'verify' || action === 'fingerprint') {
      const result = verifyApiBuild();
      console.log(
        action === 'fingerprint'
          ? result.fingerprint
          : `API build current: ${result.entry}, ${result.emittedCount} compiled modules.`
      );
    } else
      throw new Error('Usage: node scripts/check-api-build.mjs begin|finish|verify|fingerprint');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'API build verification failed');
    process.exitCode = 1;
  }
}
