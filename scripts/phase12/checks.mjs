/**
 * Phase 12 live probes: the anonymous route registration check and the authenticated synthetic-lifecycle check.

Merged on 2026-10-20 from check-routes.mjs and check-authenticated.mjs; the
exported functions are unchanged.
 *
 * Merged on 2026-10-20 from 2 files. Imports were hoisted and deduped;
 * every original body keeps its own scope below (a block, or an IIFE for TypeScript,
 * collide with another file's and no statement was rewritten.
 */

import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

// ---- scripts/phase12/check-routes.mjs (0 tests) ---- [top level: has exports]
/** Owner-host read-only route registration probe. Never sends tokens or rows. */

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
// One CLI entry for both probes. Each source module used to guard its own entry
// point; merged, they would both run, so the first argument now selects one.
const CLI = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
const [command = 'routes', ...cliArgs] = CLI ? process.argv.slice(2) : [];
if (CLI && command === 'routes') {
  const port = Number(cliArgs[0] ?? process.env.API_PORT);
  checkRoutes(port).catch(() => {
    console.error('PHASE12_ROUTE_FAIL: inspect attested API listener and protected routes; do not change DB target.');
    process.exitCode = 1;
  });
}

// ---- scripts/phase12/check-authenticated.mjs (0 tests) ---- [top level: has exports]
/**
 * Owner-host ONLY, explicitly authorised synthetic correspondence fixture.
 * Leaves a SENT record and append-only archive/reopen history for review. Never
 * runs without the DBA's live API-session attestation and test-data approval.
 * Tokens arrive through protected environment/stdin, never argv or logs.
 */
export async function checkAuthenticated(env, fetcher = fetch, print = console.log) {
  const port = Number(env.API_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535 ||
      env.PHASE12_LIVE_DB_ATTESTED !== 'I_MATCHED_API_PID_AND_DB_SESSION' ||
      env.PHASE12_LIFECYCLE_TEST_APPROVED !== 'I_AUTHORIZE_SYNTHETIC_LETTER' ||
      !env.PHASE12_OWNER_TOKEN || !env.PHASE12_READER_TOKEN ||
      env.PHASE12_OWNER_TOKEN === env.PHASE12_READER_TOKEN) {
    throw new Error('Live-session attestation, explicit test record authorisation and two distinct access tokens required');
  }
  const base = `http://127.0.0.1:${port}/api/v1`;
  async function call(method, route, token, body, status) {
    const response = await fetcher(`${base}/${route}`, { method, redirect: 'manual',
      cache: 'no-store', signal: AbortSignal.timeout(5000),
      headers: { Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status !== status) throw new Error(`${method} ${route}: expected ${status}, got ${response.status}`);
    if (status >= 400) return null;
    const json = await response.json();
    return json.data;
  }
  await call('GET', 'archive/policies', env.PHASE12_OWNER_TOKEN, null, 200);
  await call('GET', 'archive/letters?page=1&pageSize=1', env.PHASE12_READER_TOKEN, null, 200);
  const tag = randomBytes(8).toString('hex').toUpperCase();
  const created = await call('POST', 'letters', env.PHASE12_OWNER_TOKEN,
    { direction: 'OUTGOING', subject: `PHASE12-TEST-${tag}` }, 201);
  if (!created?.id || created.status !== 'DRAFT') throw new Error('Test-only letter creation returned an unexpected record');
  const id = created.id;
  const sent = await call('POST', `letters/${encodeURIComponent(id)}/send`, env.PHASE12_OWNER_TOKEN, null, 200);
  if (sent?.status !== 'SENT') throw new Error('Test letter did not enter SENT');
  await call('POST', `archive/letters/${encodeURIComponent(id)}/reopen`, env.PHASE12_READER_TOKEN,
    { reason: 'Unprivileged reopen must be rejected' }, 403);
  await call('POST', `archive/letters/${encodeURIComponent(id)}/reopen`, env.PHASE12_OWNER_TOKEN,
    { reason: 'short' }, 400);
  const archived = await call('POST', `letters/${encodeURIComponent(id)}/archive`, env.PHASE12_OWNER_TOKEN,
    { reason: 'Owner-authorised Phase 12 archive test' }, 200);
  if (archived?.status !== 'ARCHIVED') throw new Error('Test letter was not archived');
  const search = await call('GET', `archive/letters?search=${encodeURIComponent(created.letterNumber)}`,
    env.PHASE12_READER_TOKEN, null, 200);
  if (!search?.data?.some((item) => item.id === id)) throw new Error('Reader cannot find the archived letter');
  const history = await call('GET', `archive/letters/${encodeURIComponent(id)}/history`,
    env.PHASE12_READER_TOKEN, null, 200);
  if (!history?.items?.some((event) => event.action === 'letter.archive' && event.metadata?.reason)) {
    throw new Error('Reasoned archive history missing');
  }
  const reopened = await call('POST', `archive/letters/${encodeURIComponent(id)}/reopen`,
    env.PHASE12_OWNER_TOKEN, { reason: 'Owner-authorised reopening after verification' }, 200);
  if (reopened?.status !== 'SENT') throw new Error('Reopen did not preserve prior SENT state');
  await call('DELETE', `letters/${encodeURIComponent(id)}`, env.PHASE12_OWNER_TOKEN, null, 409);
  const again = await call('GET', `archive/letters/${encodeURIComponent(id)}/history`,
    env.PHASE12_OWNER_TOKEN, null, 200);
  if (!again?.items?.some((event) => event.action === 'letter.reopen' && event.metadata?.reason)) {
    throw new Error('Reasoned reopening history missing');
  }
  print(`PHASE12_LIFECYCLE_PASS: synthetic letter ${id} retained as SENT with archive/reopen audit history; no deletion.`);
  return id;
}
if (CLI && command === 'authenticated') {
  checkAuthenticated(process.env).catch(() => {
    console.error('PHASE12_LIFECYCLE_FAIL: inspect protected owner-host API/audit logs; test record may remain. Do not delete it to hide a failure.');
    process.exitCode = 1;
  });
}

if (CLI && command !== 'routes' && command !== 'authenticated') {
  console.error('Usage: node scripts/phase12/checks.mjs routes [port] | authenticated');
  process.exitCode = 2;
}
