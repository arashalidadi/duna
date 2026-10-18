import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { PATCH } from '../src/app/api/v1/[...path]/route';
import { api, ApiError, setAccessToken } from '../src/lib/api/client';

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
