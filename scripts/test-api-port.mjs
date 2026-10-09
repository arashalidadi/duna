import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveApiPort } from './dev-api-port.mjs';

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
test('API loader, proxy and environment examples agree on port 3101', () => {
  assert.equal(resolveApiPort(), 3101);
  assert.equal(resolveApiPort({}, read('.env.example')), 3101);
  for (const file of ['.env.example', 'apps/web/.env.example']) {
    assert.match(read(file), /^(?:# )?API_INTERNAL_URL=http:\/\/127\.0\.0\.1:3101$/m);
  }
  assert.match(
    read('apps/web/src/app/api/v1/[...path]/route.ts'),
    /process\.env\.API_INTERNAL_URL \?\? 'http:\/\/127\.0\.0\.1:3101'/
  );
  assert.match(
    read('packages/config/src/load-config.ts'),
    /toNumberOptional\(env\[ENV_VARS.API_PORT\], 3101,/
  );
});
test('an exported port takes precedence over repo .env', () => {
  assert.equal(resolveApiPort({ API_PORT: '4242' }, 'API_PORT=3101'), 4242);
});
test('dotenv quotes, export prefix and comments are handled without executing code', () => {
  assert.equal(resolveApiPort({}, 'export API_PORT="3101" # required project port'), 3101);
  assert.throws(() => resolveApiPort({}, 'API_PORT=$(echo 3101)'), /API_PORT/);
});
test('historical and deployment-specific ports remain explicit overrides, not defaults', () => {
  for (const port of [3101, 3001, 4242])
    assert.equal(resolveApiPort({ API_PORT: String(port) }), port);
});
test('an explicitly empty port uses the same fallback as Nest configuration', () => {
  assert.equal(resolveApiPort({ API_PORT: '' }, 'API_PORT=4242'), 3101);
});
test('invalid ports fail before scripts start services', () => {
  for (const value of ['0', '65536', '-1', 'abc', '3101.5']) {
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

test('the command-line resolver uses the required default and preserves explicit overrides', async () => {
  const { spawnSync } = await import('node:child_process');
  for (const [value, expected] of [
    ['', '3101'],
    ['4242', '4242'],
  ]) {
    const result = spawnSync(
      process.execPath,
      [new URL('./dev-api-port.mjs', import.meta.url).pathname],
      {
        env: { ...process.env, API_PORT: value },
        encoding: 'utf8',
      }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), expected);
  }
});

test('start, status and stop scripts all resolve the configured API port through the shared helper', () => {
  for (const name of ['start-dev.sh', 'status-dev.sh', 'stop-dev.sh']) {
    assert.match(
      read(`scripts/${name}`),
      /API_PORT="\$\(node "\$REPO_ROOT\/scripts\/dev-api-port\.mjs"\)"/
    );
  }
});

test('frontend requests remain same-origin on port 3000 and Docker remains PostgreSQL-only', () => {
  const web = JSON.parse(read('apps/web/package.json'));
  assert.match(web.scripts.dev, /-p 3000\b/);
  assert.match(web.scripts.start, /-p 3000\b/);
  assert.match(read('apps/web/.env.example'), /^NEXT_PUBLIC_API_URL=\/api\/v1$/m);
  assert.match(
    read('apps/web/src/lib/api/client.ts'),
    /process\.env\.NEXT_PUBLIC_API_URL \?\? '\/api\/v1'/
  );
  const compose = read('docker/docker-compose.dev.yml');
  assert.match(compose, /'5432:5432'/);
  const services = compose.split('\nvolumes:')[0];
  assert.deepEqual(
    [...services.matchAll(/^  (\w+):$/gm)].map((match) => match[1]),
    ['db']
  );
});
