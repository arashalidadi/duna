#!/usr/bin/env node
/** One deliberate owner CSV export. Never prints or stores tokens, CSV rows, IDs or URLs. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiDotenvSource } from './check-phase11-api-target.mjs';
import { resolveApiPort } from './dev-api-port.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const CSV_HEADER =
  'id,timestamp,actorId,actorEmail,action,entityType,entityId,beforeData,afterData,metadata,ipAddress,userAgent';

async function boundedText(response, maxBytes = 1024 * 1024) {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes)
    throw new Error('CSV too large for this bounded one-page probe; do not repeat the export');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('CSV response has no body; do not repeat the export');
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error('CSV exceeded probe limit; do not repeat the export');
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function checkAuthorizedAudit({
  ordinaryToken,
  ownerToken,
  port,
  fetcher = fetch,
  print = console.log,
}) {
  if (
    !ordinaryToken ||
    !ownerToken ||
    ordinaryToken === ownerToken ||
    /[\r\n]/.test(ordinaryToken + ownerToken)
  )
    throw new Error('Two distinct approved access tokens are required');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API port');
  const base = `http://127.0.0.1:${port}/api/v1`;
  async function request(route, token, timeout = 8000) {
    return fetcher(`${base}${route}`, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeout),
    });
  }
  async function json(route, token, description, afterExport = false) {
    const instruction = afterExport
      ? 'event may exist; do not repeat export'
      : 'stop before export';
    const response = await request(route, token);
    if (response.status !== 200)
      throw new Error(`${description} returned ${response.status}; ${instruction}`);
    try {
      return (await response.json()).data;
    } catch {
      throw new Error(`${description} returned invalid JSON; ${instruction}`);
    }
  }
  const ordinary = await json('/auth/me', ordinaryToken, 'Ordinary /auth/me');
  const owner = await json('/auth/me', ownerToken, 'Owner /auth/me');
  const ordinaryUser = ordinary?.user;
  const ownerUser = owner?.user;
  if (
    !ordinaryUser?.id ||
    !ownerUser?.id ||
    ordinaryUser.id === ownerUser.id ||
    ordinaryUser.isPrimaryAdmin !== false ||
    ownerUser.isPrimaryAdmin !== true ||
    !Array.isArray(ordinary?.permissions) ||
    !ordinary.permissions.includes('audit:read') ||
    ordinary.permissions.includes('audit:export')
  ) {
    throw new Error(
      'Account identity/authorization does not match approved ordinary-reader and primary-owner fixtures'
    );
  }
  print(
    'Approved identities confirmed: distinct ordinary audit reader and implicit primary owner (IDs suppressed).'
  );
  const ordinaryBrowse = await request('/audit?limit=1', ordinaryToken);
  if (ordinaryBrowse.status !== 200)
    throw new Error(
      `Ordinary browse returned ${ordinaryBrowse.status}, expected 200; stop before export`
    );
  print('Ordinary GET /api/v1/audit: 200');

  const auditPath = `/audit?action=audit.export&entityType=AuditLog&entityId=export&actorId=${encodeURIComponent(ownerUser.id)}&limit=1`;
  const before = await json(auditPath, ownerToken, 'Owner audit-event baseline');
  if (!Number.isSafeInteger(before?.total) || !Array.isArray(before.items)) {
    throw new Error('Audit-event baseline shape is not verified; stop before export');
  }
  const oldId = before.items[0]?.id;
  const to = new Date(Date.now() - 5000).toISOString();
  const from = new Date(Date.now() - 600_000).toISOString();
  const query = new URLSearchParams({ from, to, limit: '1', offset: '0' });
  const route = `/audit/export?${query}`;
  const denied = await request(route, ordinaryToken);
  if (denied.status !== 403)
    throw new Error(
      `Ordinary export returned ${denied.status}, expected 403; STOP before owner export`
    );
  print('Ordinary GET /api/v1/audit/export: 403 (not a missing-route 404).');

  // Exactly ONE authorized export; no retry, pagination fetch or CSV file.
  const response = await request(route, ownerToken, 15000);
  if (response.status !== 200)
    throw new Error(`Owner export returned ${response.status}, expected 200; do not retry blindly`);
  const type = response.headers.get('content-type') ?? '';
  const disposition = response.headers.get('content-disposition') ?? '';
  const cache = response.headers.get('cache-control') ?? '';
  const more = response.headers.get('x-audit-export-has-more');
  const next = response.headers.get('x-audit-export-next-offset');
  if (
    !/^text\/csv(?:;|$)/i.test(type) ||
    !/^attachment;/i.test(disposition) ||
    !/\bno-store\b/i.test(cache) ||
    !['true', 'false'].includes(more) ||
    (more === 'true' && (!/^[1-9][0-9]*$/.test(next ?? '') || Number(next) !== 1)) ||
    (more === 'false' && next !== null)
  ) {
    throw new Error(
      'Owner export returned unsafe/invalid CSV or pagination headers; event may exist, do not retry'
    );
  }
  const csv = await boundedText(response);
  if (csv.split('\r\n', 1)[0] !== CSV_HEADER || !csv.endsWith('\r\n')) {
    throw new Error('Owner export CSV structure invalid; event may exist, do not retry');
  }
  print(
    `Owner GET /api/v1/audit/export: 200; Content-Type=text/csv; attachment; Cache-Control=no-store; has-more=${more}; next-offset=${next ?? 'none'}; CSV header validated; rows suppressed.`
  );
  const after = await json(auditPath, ownerToken, 'Owner audit-event after export', true);
  const event = after?.items?.[0];
  if (
    after?.total !== before.total + 1 ||
    !event ||
    event.id === oldId ||
    event.actorId !== ownerUser.id ||
    event.action !== 'audit.export' ||
    event.entityType !== 'AuditLog' ||
    event.entityId !== 'export' ||
    event.metadata?.from !== from ||
    event.metadata?.to !== to ||
    event.metadata?.offset !== 0 ||
    !Number.isSafeInteger(event.metadata?.preparedRows) ||
    event.metadata?.hasMore !== (more === 'true')
  ) {
    throw new Error(
      'Audit-event count/actor/window/metadata did not match the one export; investigate, do not retry'
    );
  }
  print(
    'Owner audit.export event: exactly +1 for this actor/window, metadata and row count confirmed; sensitive values suppressed.'
  );
  return { ordinaryBrowse: 200, ordinaryExport: 403, ownerExport: 200, auditEvent: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    if (
      process.env.PHASE11_DB_IDENTITY_ATTESTED !== 'I_VERIFIED_ACTIVE_SESSION' ||
      process.env.PHASE11_APPROVED_DB_NAME !== 'duna_seed_test'
    ) {
      throw new Error(
        'STOP: require owner-confirmed duna_seed_test and independently verified active DB session BEFORE an audit export; attestation missing'
      );
    }
    if (process.stdin.isTTY)
      throw new Error(
        'Use: node scripts/duna.mjs phase11 authorized; tokens must arrive via private stdin, never argv or environment'
      );
    const tokens = [];
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk.toString('utf8');
      if (input.length > 20_000) throw new Error('Token input too long');
    }
    tokens.push(...input.trimEnd().split('\n'));
    if (tokens.length !== 2) throw new Error('Expected two approved tokens on private stdin');
    const port = resolveApiPort(process.env, apiDotenvSource(repo));
    await checkAuthorizedAudit({ ordinaryToken: tokens[0], ownerToken: tokens[1], port });
  })().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Authorized audit probe failed');
    process.exitCode = 1;
  });
}
