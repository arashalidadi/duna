import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuditBrowsePath,
  buildAuditExportPath,
  EMPTY_AUDIT_FILTERS,
} from '../src/lib/api/audit-query';
import { downloadAuditCsv } from '../src/lib/api/audit-download';
import { ApiError, setAccessToken } from '../src/lib/api/client';

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
