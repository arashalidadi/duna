#!/usr/bin/env node
/**
 * Read-only running-API route probe for the Phase 11 audit 404.
 * No token, DB writes, export window or CSV download. Do NOT add credentials here.
 * An authenticated guard returns 401 before either handler can run; a missing
 * handler returns 404. This distinguishes a deployed route gap from a 403 policy.
 * Run on the API host: node scripts/check-phase11-audit-routes.mjs [API_PORT]
 */
import { pathToFileURL } from 'node:url';

export async function checkAuditRoutes(port, fetcher = fetch, print = console.log) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be an integer between 1 and 65535');
  }
  const base = `http://127.0.0.1:${port}/api/v1`;
  const checks = [
    ['health', 200],
    ['audit', 401],
    ['audit/export', 401],
  ];
  const statuses = {};
  for (const [path, expected] of checks) {
    const response = await fetcher(`${base}/${path}`, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    statuses[path] = response.status;
    print(`GET /api/v1/${path} (no credentials): ${response.status} (expected ${expected})`);
  }
  if (statuses.health !== 200)
    throw new Error('Health is not 200: check the actual API PID, port and prefix.');
  if (statuses.audit !== 401)
    throw new Error('Browse is not 401: check that this is the protected API route.');
  if (statuses['audit/export'] === 404) {
    throw new Error(
      'Export route is 404 before authentication: the running process does not serve this route. Inspect its loaded build/PID; rebuild and restart the API using the existing process manager, then recheck.'
    );
  }
  if (statuses['audit/export'] !== 401) {
    throw new Error(
      'Export route is not protected by the expected authentication guard; inspect the running build.'
    );
  }
  print(
    'Phase 11 route preflight OK (401 means registered, not that export authorization is verified).'
  );
  return statuses;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const port = Number(process.argv[2] ?? process.env.API_PORT ?? 3101);
  checkAuditRoutes(port).catch((error) => {
    console.error(error instanceof Error ? error.message : 'Audit route probe failed');
    process.exitCode = 1;
  });
}
