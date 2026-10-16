import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkAuditRoutes } from './check-phase11-audit-routes.mjs';

test('source registers protected GET /api/v1/audit/export, distinct from browse', () => {
  const controller = readFileSync(
    new URL('../apps/api/src/common/infrastructure/audit/audit.controller.ts', import.meta.url),
    'utf8'
  );
  const module = readFileSync(new URL('../apps/api/src/app.module.ts', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../apps/api/src/main.ts', import.meta.url), 'utf8');
  assert.match(controller, /@Controller\('audit'\)/);
  assert.match(controller, /@Get\(\)\s+@RequirePermissions\('audit:read'\)/);
  assert.match(
    controller,
    /@Get\('export'\)\s+@RequirePermissions\(\['audit:read', 'audit:export'\]\)/
  );
  assert.match(module, /controllers:\s*\[AppController, AuditController\]/);
  assert.match(main, /globalPrefix\s*=\s*`api\/v\$\{apiVersion\}`/);
});

function fakeApi(statuses, seen) {
  return async (url, init) => {
    seen.push({ url, init });
    return { status: statuses[new URL(url).pathname] };
  };
}

test('unauthenticated preflight distinguishes registered protected routes without export', async () => {
  const seen = [];
  const logs = [];
  const result = await checkAuditRoutes(
    3101,
    fakeApi(
      {
        '/api/v1/health': 200,
        '/api/v1/audit': 401,
        '/api/v1/audit/export': 401,
      },
      seen
    ),
    (line) => logs.push(line)
  );
  assert.equal(result['audit/export'], 401);
  assert.deepEqual(
    seen.map(({ url }) => new URL(url).pathname),
    ['/api/v1/health', '/api/v1/audit', '/api/v1/audit/export']
  );
  assert.ok(
    seen.every(
      ({ url, init }) =>
        !url.includes('?') &&
        init.method === 'GET' &&
        init.redirect === 'manual' &&
        !('headers' in init)
    )
  );
  assert.match(logs.at(-1), /not that export authorization is verified/);
});

test('live export 404 is a missing route, not a successful permission denial', async () => {
  const seen = [];
  await assert.rejects(
    checkAuditRoutes(
      3101,
      fakeApi(
        {
          '/api/v1/health': 200,
          '/api/v1/audit': 401,
          '/api/v1/audit/export': 404,
        },
        seen
      ),
      () => {}
    ),
    /404 before authentication/
  );
  assert.equal(seen.length, 3);
});

test('wrong API port/route and unprotected export fail closed', async () => {
  await assert.rejects(
    checkAuditRoutes(0, fakeApi({}, []), () => {}),
    /API_PORT/
  );
  await assert.rejects(
    checkAuditRoutes(
      3101,
      fakeApi(
        {
          '/api/v1/health': 404,
          '/api/v1/audit': 404,
          '/api/v1/audit/export': 404,
        },
        []
      ),
      () => {}
    ),
    /Health is not 200/
  );
  await assert.rejects(
    checkAuditRoutes(
      3101,
      fakeApi(
        {
          '/api/v1/health': 200,
          '/api/v1/audit': 401,
          '/api/v1/audit/export': 200,
        },
        []
      ),
      () => {}
    ),
    /not protected/
  );
});
