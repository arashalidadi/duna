import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveApiPort } from './dev-api-port.mjs';

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
test('API loader, proxy and environment examples agree on port 3010', () => {
  assert.equal(resolveApiPort(), 3010);
  assert.equal(resolveApiPort({}, read('.env.example')), 3010);
  assert.match(read('apps/web/.env.example'), /^API_INTERNAL_URL=http:\/\/127\.0\.0\.1:3010$/m);
  assert.match(
    read('apps/web/src/app/api/v1/[...path]/route.ts'),
    /process\.env\.API_INTERNAL_URL \?\? 'http:\/\/127\.0\.0\.1:3010'/
  );
  assert.match(
    read('packages/config/src/load-config.ts'),
    /toNumberOptional\(env\[ENV_VARS.API_PORT\], 3010,/
  );
});
test('an exported port takes precedence over repo .env', () => {
  assert.equal(resolveApiPort({ API_PORT: '3010' }, 'API_PORT=3101'), 3010);
});
test('dotenv quotes, export prefix and comments are handled without executing code', () => {
  assert.equal(resolveApiPort({}, 'export API_PORT="3101" # former sandbox port'), 3101);
  assert.throws(() => resolveApiPort({}, 'API_PORT=$(echo 3010)'), /API_PORT/);
});
test('legacy explicit ports remain supported', () => {
  for (const port of [3001, 3010, 3101])
    assert.equal(resolveApiPort({ API_PORT: String(port) }), port);
});
test('an explicitly empty port uses the same fallback as Nest configuration', () => {
  assert.equal(resolveApiPort({ API_PORT: '' }, 'API_PORT=3101'), 3010);
});
test('invalid ports fail before scripts start services', () => {
  for (const value of ['0', '65536', '-1', 'abc', '3010.5']) {
    assert.throws(() => resolveApiPort({ API_PORT: value }), /API_PORT/);
  }
});

test('status script fails safely for an invalid exported port', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync('bash', [new URL('./status-dev.sh', import.meta.url).pathname], {
    env: { ...process.env, API_PORT: 'not-a-port' },
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /API_PORT/);
  assert.doesNotMatch(result.stdout, /Shipping ERP status/);
});
