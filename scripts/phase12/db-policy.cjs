'use strict';
const { createHash } = require('node:crypto');
const TARGET = '20261017120000_phase12_archive_retention';
class DbStop extends Error {}
function stop(message) { throw new DbStop(message); }
function checkUrl(input) {
  let url;
  try { url = new URL(input); } catch { stop('Explicit owner DATABASE_URL is missing or malformed'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
      url.port !== '5432' || url.pathname !== '/duna_seed_test' ||
      decodeURIComponent(url.username) !== 'shipping' ||
      (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public')) {
    stop('Owner migration URL differs from approved host/port/role/database/schema');
  }
  return true; // never print the URL or password
}
function assess(snapshot, local, mode) {
  if (!['inspect', 'apply', 'verify'].includes(mode)) stop('Unknown deployment stage');
  const { who, runtime, rights, history, permissions, reservedGrants } = snapshot;
  if (reservedGrants !== 0) stop('Default ADMIN holds a destructive/offline-only Phase 12 capability');
  if (!who || who.database !== 'duna_seed_test' || who.login !== 'shipping' ||
      who.session !== 'shipping' || who.owner !== 'shipping' || who.port !== 5432 ||
      !who.server || who.version < 160000 || who.version >= 170000 ||
      who.auditTriggers !== 2) stop('Live approved DB, owner, PG16 or append-only audit protection differs');
  if (!runtime || runtime.name !== 'shipping_runtime_p11' || !runtime.login ||
      runtime.superuser || runtime.createRole || runtime.createDb || runtime.ownerMember ||
      runtime.createOnDb || !runtime.connect) stop('Reviewed non-owner API runtime identity differs');
  const known = new Map(local.map((m) => [m.name, m.sha256]));
  if (new Set(local.map((m) => m.name)).size !== local.length || !known.has(TARGET)) {
    stop('Local migration list differs or Phase 12 migration is missing');
  }
  const completed = new Set();
  for (const row of history) {
    if (!known.has(row.name) || row.checksum !== known.get(row.name) ||
        !row.finished || row.rolledback || completed.has(row.name)) {
      stop('Migration journal has an unknown, failed, duplicate or changed entry');
    }
    completed.add(row.name);
  }
  if (!completed.has('20261016110000_phase11_audit_append_only')) {
    stop('Previously approved audit migration is absent; do not attempt Phase 12 writes');
  }
  const pending = local.filter((m) => !completed.has(m.name)).map((m) => m.name);
  if (pending.some((name) => name !== TARGET)) stop('Unrelated migration is pending; stop for review');
  if ((mode === 'verify' && pending.length) || (completed.has(TARGET) !== who.retentionExists)) {
    stop('Phase 12 migration state and installed schema disagree');
  }
  if (who.retentionExists) {
    if (who.retentionTriggers !== 2 || who.letterGuard !== 1 ||
        !rights || rights.select !== true ||
        rights.insert !== true || rights.update !== true || rights.delete !== false ||
        rights.truncate !== false || rights.exporterSelect !== false) {
      stop('Retention policy protection or least-privilege runtime rights differ');
    }
  }
  if (mode === 'verify') {
    const expected = [
      ['archive:create', 'archive', 'create'], ['archive:reopen', 'archive', 'reopen'],
      ['archive:delete', 'archive', 'delete'],
      ['retention:read', 'retention', 'read'], ['retention:manage', 'retention', 'manage'],
      ['backup:manage', 'backup', 'manage'], ['backup:restore', 'backup', 'restore'],
    ];
    if (permissions.length !== expected.length || expected.some(([code, module, action]) =>
      !permissions.some((p) => p.code === code && p.module === module && p.action === action))) {
      stop('Phase 12 permission seed missing or conflicting');
    }
  }
  return { pending, migrationApplied: completed.has(TARGET),
    permissionCodes: permissions.length, runtime: runtime.name };
}
function digest(snapshot, local, head) {
  if (!/^[a-f0-9]{40}$/.test(head)) stop('Explicit source commit required');
  const text = JSON.stringify({ head, who: snapshot.who, runtime: snapshot.runtime,
    rights: snapshot.rights, history: snapshot.history, permissions: snapshot.permissions, local });
  return createHash('sha256').update(text).digest('hex');
}
module.exports = { DbStop, TARGET, checkUrl, assess, digest };
