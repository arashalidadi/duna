import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRoutes } from './check-routes.mjs';
test('anonymous checks prove registered protected routes without sending credentials or writes', async () => {
  const calls = [];
  await checkRoutes(3101, async (url, options) => {
    calls.push([url, options]);
    return { status: url.endsWith('/health') ? 200 : 401 };
  }, () => {});
  assert.equal(calls.length, 9);
  assert.ok(calls.every(([url, options]) => url.startsWith('http://127.0.0.1:3101/api/v1/') &&
    !options.body && !options.headers && options.redirect === 'manual'));
});
test('missing route, unprotected route, health failure and invalid port fail independently', async () => {
  for (const status of [200, 403, 404, 500]) {
    await assert.rejects(checkRoutes(3101, async (url) =>
      ({ status: url.endsWith('/health') ? 200 : status }), () => {}));
  }
  await assert.rejects(checkRoutes(3101, async () => ({ status: 401 }), () => {}));
  await assert.rejects(checkRoutes(0, async () => ({ status: 200 }), () => {}));
});
