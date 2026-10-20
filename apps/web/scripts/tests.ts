/**
 * Web behaviour tests: portal login routing, the Phase 11 audit proxy and its client, and the Phase 12 policy client. Run with: pnpm exec tsx --test apps/web/scripts/tests.ts

test-pagination.ts deliberately stays a separate file: it exercises fetchAllPages
against a local HTTP server and must load ../src/lib/api/client with its own base
URL, which the shared module cache would otherwise have configured for the proxy
tests above.
 *
 * Merged on 2026-10-20 from 4 files. Imports were hoisted and deduped;
 * every original body keeps its own scope below (a block, or an IIFE for TypeScript,
 * collide with another file's and no statement was rewritten.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAuditBrowsePath,
  buildAuditExportPath,
  EMPTY_AUDIT_FILTERS,
} from '../src/lib/api/audit-query';
import { ApiError, setAccessToken, api } from '../src/lib/api/client';
import { GET, PATCH } from '../src/app/api/v1/[...path]/route';
import { NextRequest } from 'next/server';
import { downloadAuditCsv } from '../src/lib/api/audit-download';
import { postLoginRoute } from '../src/lib/auth/post-login-route';

// ---- apps/web/scripts/test-portal-login.ts (0 tests) ----
(() => {
assert.equal(postLoginRoute(['portal:access', 'booking:create']), '/portal');
assert.equal(postLoginRoute(['dashboard:read', 'portal:access']), '/dashboard');
assert.equal(postLoginRoute(['dashboard:read']), '/dashboard');
assert.equal(postLoginRoute([]), '/dashboard');
console.log('Portal landing route: 4/4 assertions passed');
})();

// ---- apps/web/scripts/test-phase11-audit.ts (3 tests) ----
(() => {
const from = '2026-10-16T09:00';
const to = '2026-10-16T10:00';
const futureNow = new Date('2026-10-17T00:00:00Z').getTime();

function params(path: string): URLSearchParams {
  return new URL(path, 'http://example.test').searchParams;
}

test('browse uses /audit with bounded pages, exact filters and local-to-UTC dates', () => {
  const filters = {
    ...EMPTY_AUDIT_FILTERS,
    action: ' role:create ',
    entityType: 'Role',
    actorId: 'actor-1',
    from,
    to,
  };
  const path = buildAuditBrowsePath(filters, 2);
  assert.equal(path.split('?')[0], '/audit');
  assert.deepEqual(Object.fromEntries(params(path)), {
    limit: '25',
    offset: '25',
    action: 'role:create',
    entityType: 'Role',
    actorId: 'actor-1',
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
  });
  assert.throws(() => buildAuditBrowsePath(filters, 0), RangeError);
  assert.throws(() => buildAuditBrowsePath(filters, 100_000_000), RangeError);
  assert.throws(() => buildAuditBrowsePath({ ...filters, from: to, to: from }, 1), RangeError);
  assert.throws(() => buildAuditBrowsePath({ ...filters, from: 'invalid' }, 1), RangeError);
});

test('export is a separate paged route with a required <=31-day past UTC window', () => {
  const path = buildAuditExportPath(
    { ...EMPTY_AUDIT_FILTERS, entityId: 'R/1' },
    from,
    to,
    500,
    futureNow
  );
  assert.equal(path.split('?')[0], '/audit/export');
  assert.deepEqual(Object.fromEntries(params(path)), {
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    limit: '500',
    offset: '500',
    entityId: 'R/1',
  });
  assert.throws(() => buildAuditExportPath(EMPTY_AUDIT_FILTERS, '', to, 0, futureNow), RangeError);
  assert.throws(
    () => buildAuditExportPath(EMPTY_AUDIT_FILTERS, to, from, 0, futureNow),
    RangeError
  );
  assert.throws(
    () => buildAuditExportPath(EMPTY_AUDIT_FILTERS, '2026-09-01', to, 0, futureNow),
    RangeError
  );
  assert.throws(
    () => buildAuditExportPath(EMPTY_AUDIT_FILTERS, from, '2026-10-18', 0, futureNow),
    RangeError
  );
  assert.throws(
    () => buildAuditExportPath(EMPTY_AUDIT_FILTERS, from, to, -1, futureNow),
    RangeError
  );
});

test('CSV download sends bearer header (not URL), preserves next-page offset and requires CSV', async () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const oldFetch = globals.fetch,
    oldWindow = globals.window,
    oldDocument = globals.document;
  const oldCreate = URL.createObjectURL,
    oldRevoke = URL.revokeObjectURL;
  let clicked = 0,
    created = 0;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  try {
    setAccessToken('unit-only-token');
    globals.window = { setTimeout: () => 0 };
    globals.document = {
      createElement: () => ({
        href: '',
        download: '',
        style: {},
        click: () => {
          clicked++;
        },
        remove: () => {},
      }),
      body: { append: () => {} },
    };
    URL.createObjectURL = () => {
      created++;
      return 'blob:unit-test';
    };
    URL.revokeObjectURL = () => {};
    globals.fetch = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('id,action\r\n', {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'x-audit-export-has-more': 'true',
          'x-audit-export-next-offset': '500',
        },
      });
    };
    const page = await downloadAuditCsv('/audit/export?limit=500&offset=0', 'audit-0.csv');
    assert.deepEqual(page, { hasMore: true, nextOffset: 500 });
    assert.equal(clicked, 1);
    assert.equal(created, 1);
    assert.deepEqual(
      calls.map(({ url }) => url),
      ['/api/v1/audit/export?limit=500&offset=0']
    );
    assert.equal(new Headers(calls[0].init.headers).get('authorization'), 'Bearer unit-only-token');
    assert.equal(calls[0].init.cache, 'no-store');
    globals.fetch = async () => new Response('no route', { status: 404 });
    await assert.rejects(
      downloadAuditCsv('/audit/export', 'audit-0.csv'),
      (e: unknown) => e instanceof ApiError && e.status === 404
    );
    globals.fetch = async () =>
      new Response('id,action\r\n', {
        headers: { 'content-type': 'text/csv' },
      });
    await assert.rejects(
      downloadAuditCsv('/audit/export', 'audit-0.csv'),
      (e: unknown) => e instanceof ApiError && e.status === 502
    );
    assert.equal(clicked, 1, 'never download an incomplete CSV page without pagination headers');
    setAccessToken(null);
    await assert.rejects(
      downloadAuditCsv('/audit/export', 'audit-0.csv'),
      (e: unknown) => e instanceof ApiError && e.status === 401
    );
  } finally {
    setAccessToken(null);
    globals.fetch = oldFetch;
    globals.window = oldWindow;
    globals.document = oldDocument;
    URL.createObjectURL = oldCreate;
    URL.revokeObjectURL = oldRevoke;
  }
});
})();

// ---- apps/web/scripts/test-phase11-audit-proxy.ts (2 tests) ----
(() => {
test('web proxy preserves binary audit CSV, auth and bounded export pagination headers', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: URL; authorization: string | null }> = [];
  try {
    globalThis.fetch = async (input, init) => {
      requests.push({
        url: new URL(String(input)),
        authorization: new Headers(init?.headers).get('authorization'),
      });
      return new Response('id,action\r\n', {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="audit-export.csv"',
          'x-audit-export-has-more': 'true',
          'x-audit-export-next-offset': '500',
          'cache-control': 'no-store',
        },
      });
    };
    const req = new NextRequest('http://web.example/api/v1/audit/export?limit=500&offset=0', {
      headers: { authorization: 'Bearer unit-token' },
    });
    const res = await GET(req, { params: { path: ['audit', 'export'] } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/csv; charset=utf-8');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-audit-export-has-more'), 'true');
    assert.equal(res.headers.get('x-audit-export-next-offset'), '500');
    assert.equal(await res.text(), 'id,action\r\n');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url.pathname, '/api/v1/audit/export');
    assert.equal(requests[0].url.search, '?limit=500&offset=0');
    assert.equal(requests[0].authorization, 'Bearer unit-token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('web proxy does not leak audit pagination headers to unrelated routes', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response('ok', {
        status: 200,
        headers: { 'x-audit-export-has-more': 'true', 'x-audit-export-next-offset': '500' },
      });
    const res = await GET(new NextRequest('http://web.example/api/v1/health'), {
      params: { path: ['health'] },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-audit-export-has-more'), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
})();

// ---- apps/web/scripts/test-phase12-policy-client.ts (3 tests) ----
(() => {
// Synthetic fetch responses only: no owner API, token, retention record or write.
test('policy proxy forwards PATCH status/body and reports an unavailable upstream as 502', async () => {
  const oldFetch = globalThis.fetch;
  const payload = JSON.stringify({
    success: false,
    error: { statusCode: 400, message: ['minimumDays must be an integer number'] },
  });
  try {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      assert.equal(new URL(url).pathname, '/api/v1/archive/policies/LETTER');
      assert.equal(init.method, 'PATCH');
      assert.equal(new Headers(init.headers).get('authorization'), 'Bearer unit-only-token');
      assert.equal(new TextDecoder().decode(init.body as ArrayBuffer), '{"minimumDays":null}');
      return new Response(payload, {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    const request = () =>
      new NextRequest('http://web.example/api/v1/archive/policies/LETTER', {
        method: 'PATCH',
        headers: { authorization: 'Bearer unit-only-token', 'content-type': 'application/json' },
        body: JSON.stringify({ minimumDays: null }),
      });
    const params = { params: { path: ['archive', 'policies', 'LETTER'] } };
    const rejected = await PATCH(request(), params);
    assert.equal(rejected.status, 400);
    assert.equal(rejected.headers.get('content-type'), 'application/json');
    assert.equal(await rejected.text(), payload);
    globalThis.fetch = (async () => {
      throw new Error('private upstream URL');
    }) as typeof fetch;
    const unavailable = await PATCH(request(), params);
    assert.equal(unavailable.status, 502);
    assert.equal((await unavailable.json()).error.code, 'UPSTREAM_UNAVAILABLE');
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('policy Save preserves the actual PATCH status and Nest validation messages', async () => {
  const oldFetch = globalThis.fetch;
  try {
    setAccessToken('unit-only-token');
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      assert.ok(url.endsWith('/archive/policies/LETTER'));
      assert.equal(init.method, 'PATCH');
      assert.equal(new Headers(init.headers).get('authorization'), 'Bearer unit-only-token');
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            statusCode: 418,
            message: [
              'minimumDays must be an integer number',
              'authority must be longer than or equal to 10 characters',
            ],
            details: { field: 'minimumDays' },
          },
        }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }) as typeof fetch;
    await assert.rejects(
      api.patch('/archive/policies/LETTER', { minimumDays: 'bad' }),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 400 &&
        error.message ===
          'minimumDays must be an integer number; authority must be longer than or equal to 10 characters' &&
        (error.details as { field: string }).field === 'minimumDays'
    );
  } finally {
    globalThis.fetch = oldFetch;
    setAccessToken(null);
  }
});

test('policy Save distinguishes API conflict, proxy outage, non-JSON HTTP error and no HTTP response', async () => {
  const oldFetch = globalThis.fetch;
  try {
    for (const [status, body, message] of [
      [
        409,
        {
          success: false,
          error: { message: 'A compliance retention floor cannot be removed or reduced' },
        },
        'A compliance retention floor cannot be removed or reduced',
      ],
      [
        502,
        {
          success: false,
          error: { message: 'API service unavailable', code: 'UPSTREAM_UNAVAILABLE' },
        },
        'API service unavailable',
      ],
    ] as const) {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify(body), { status })) as typeof fetch;
      await assert.rejects(
        api.patch('/archive/policies/LETTER', {}),
        (error: unknown) =>
          error instanceof ApiError && error.status === status && error.message === message
      );
    }
    globalThis.fetch = (async () =>
      new Response('<html>Upstream failed</html>', { status: 503 })) as typeof fetch;
    await assert.rejects(
      api.patch('/archive/policies/LETTER', {}),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 503 &&
        error.message === 'Request failed (HTTP 503)'
    );
    globalThis.fetch = (async () => {
      throw new Error('secret/internal URL');
    }) as typeof fetch;
    await assert.rejects(
      api.patch('/archive/policies/LETTER', {}),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 0 &&
        error.message === 'No HTTP response from API'
    );
  } finally {
    globalThis.fetch = oldFetch;
    setAccessToken(null);
  }
});
})();

