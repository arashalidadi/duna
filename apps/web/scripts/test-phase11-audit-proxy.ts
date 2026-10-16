import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/v1/[...path]/route';

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
