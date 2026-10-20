/**
 * Behavioural test for `fetchAllPages` (apps/web/src/lib/api/pagination.ts).
 *
 * Runs the REAL api client and the REAL helper against a local HTTP server that
 * reproduces the API's pagination contract — including the rule that a
 * `pageSize` above MAX_PAGE_SIZE is answered with **HTTP 400** (the API's global
 * ValidationPipe rejects it; it does not clamp).
 *
 * Run: pnpm exec tsx apps/web/scripts/test-pagination.ts
 */
import http from 'node:http';
import assert from 'node:assert/strict';

const MAX = 100;

/** What the fake API saw, so the test can assert on the actual requests made. */
const seen: { path: string; pageSize: number; page: number }[] = [];
let totalRows = 0;
let rows: { id: string; code: string; name: string }[] = [];
let reportTotalPages = 0; // 0 = let the server compute it

function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i + 1}`,
    code: `CUS-${String(i + 1).padStart(3, '0')}`,
    name: `Customer ${i + 1}`,
  }));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const page = Number(url.searchParams.get('page') ?? '1');
  const rawPageSize = url.searchParams.get('pageSize');
  const pageSize = Number(rawPageSize ?? '25');

  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  // Reproduce the API's rejection rule exactly.
  if (rawPageSize !== null && (pageSize > MAX || pageSize < 1 || !Number.isInteger(pageSize))) {
    return send(400, {
      success: false,
      error: { statusCode: 400, message: ['pageSize must not be greater than 100'] },
      meta: { timestamp: new Date().toISOString() },
    });
  }

  // Optional filter carried in the path by the caller.
  const type = url.searchParams.get('type');
  const pool = type ? rows.filter((r) => (type === 'SHIPPER' ? Number(r.id.slice(1)) % 2 === 1 : true)) : rows;

  seen.push({ path: url.pathname, pageSize, page });

  const totalPages = reportTotalPages || (pool.length === 0 ? 0 : Math.ceil(pool.length / pageSize));
  const start = (page - 1) * pageSize;
  return send(200, {
    success: true,
    data: {
      data: pool.slice(start, start + pageSize),
      meta: { page, pageSize, totalItems: pool.length, totalPages },
    },
    meta: { timestamp: new Date().toISOString() },
  });
});

function reset() {
  seen.length = 0;
}

async function main() {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;

  // The client reads its base URL at module load, so set it before importing.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api/v1`;
  const { fetchAllPages, MAX_PAGE_SIZE } = await import('../src/lib/api/pagination');
  const { api, ApiError } = await import('../src/lib/api/client');

  let passed = 0;
  const failures: string[] = [];
  const it = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      passed++;
      console.log(`  PASS  ${name}`);
    } catch (e) {
      failures.push(`${name} -> ${(e as Error).message}`);
      console.log(`  FAIL  ${name}\n        ${(e as Error).message}`);
    }
  };

  console.log('fetchAllPages — behavioural tests\n');

  await it('publishes the same limit as the API', async () => {
    assert.equal(MAX_PAGE_SIZE, MAX);
  });

  await it('REGRESSION: the raw request that broke the Users section is a 400', async () => {
    // This is exactly what apps/web used to send, and what the server logged.
    await assert.rejects(
      () => api.get('/customers?pageSize=200'),
      (e: unknown) => e instanceof ApiError && (e as InstanceType<typeof ApiError>).status === 400
    );
  });

  await it('returns every row across multiple pages', async () => {
    rows = makeRows(250); // 3 pages at pageSize=100
    reset();
    const all = await fetchAllPages<{ id: string }>('/customers');
    assert.equal(all.length, 250, 'must return all 250 rows, not just the first page');
    assert.deepEqual(
      all.map((r) => r.id),
      rows.map((r) => r.id),
      'rows must stay in order'
    );
  });

  await it('never asks for more than the API limit', async () => {
    for (const s of seen) {
      assert.ok(s.pageSize <= MAX, `requested pageSize=${s.pageSize}, above the limit of ${MAX}`);
    }
  });

  await it('walks the pages exactly once each', async () => {
    assert.deepEqual(
      seen.map((s) => s.page),
      [1, 2, 3],
      'should request pages 1..3'
    );
  });

  await it('handles a single page', async () => {
    rows = makeRows(7);
    reset();
    const all = await fetchAllPages<{ id: string }>('/customers');
    assert.equal(all.length, 7);
    assert.equal(seen.length, 1, 'one page means one request');
  });

  await it('handles an empty list', async () => {
    rows = [];
    reset();
    const all = await fetchAllPages<{ id: string }>('/customers');
    assert.equal(all.length, 0);
    assert.equal(seen.length, 1, 'must not loop when there is nothing to read');
  });

  await it('preserves an existing query string', async () => {
    rows = makeRows(150);
    reset();
    const all = await fetchAllPages<{ id: string }>('/customers?type=SHIPPER');
    // Half the rows are odd-numbered ids -> 75 SHIPPER rows across 1 page.
    assert.equal(all.length, 75);
    assert.ok(
      seen.every((s) => s.path === '/api/v1/customers'),
      'the filter must survive the pagination parameters being appended'
    );
  });

  await it('stops at maxPages even if the server claims more', async () => {
    rows = makeRows(1000);
    reportTotalPages = 500; // lie: would be 10 real pages
    reset();
    const all = await fetchAllPages<{ id: string }>('/customers', { maxPages: 4 });
    reportTotalPages = 0;
    assert.equal(seen.length, 4, 'must stop after maxPages');
    assert.equal(all.length, 400);
  });

  await it('caps a caller-supplied pageSize at the API limit', async () => {
    rows = makeRows(250);
    reset();
    await fetchAllPages<{ id: string }>('/customers', { pageSize: 500 });
    assert.ok(
      seen.every((s) => s.pageSize <= MAX),
      'an oversized request must be capped, never sent'
    );
    assert.equal(seen[0].pageSize, MAX);
  });

  server.close();

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
}

void main();
