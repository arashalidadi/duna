#!/usr/bin/env node
/** Owner-host read-only route registration probe. Never sends tokens or rows. */
import { pathToFileURL } from 'node:url';

export async function checkRoutes(port, fetcher = fetch, print = console.log) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Explicit API port required');
  const endpoints = [
    ['GET', 'health', 200],
    ['GET', 'archive/letters', 401],
    ['GET', 'archive/policies', 401],
    ['GET', 'archive/letters/not-a-real-id/history', 401],
    ['POST', 'archive/letters/not-a-real-id/reopen', 401],
    ['POST', 'archive/letters/run', 401],
    ['PATCH', 'archive/policies/LETTER', 401],
    ['GET', 'attachments', 401],
    ['POST', 'attachments', 401],
  ];
  for (const [method, route, expected] of endpoints) {
    const response = await fetcher(`http://127.0.0.1:${port}/api/v1/${route}`, {
      method, redirect: 'manual', signal: AbortSignal.timeout(5000), cache: 'no-store',
    });
    print(`${method} /api/v1/${route}: ${response.status} (expected ${expected})`);
    if (response.status !== expected) throw new Error('Route missing, unprotected or wrong listener');
  }
  print('PHASE12_ROUTE_PASS: registered protected routes; authenticated business checks still required.');
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const port = Number(process.argv[2] ?? process.env.API_PORT);
  checkRoutes(port).catch(() => {
    console.error('PHASE12_ROUTE_FAIL: inspect attested API listener and protected routes; do not change DB target.');
    process.exitCode = 1;
  });
}
