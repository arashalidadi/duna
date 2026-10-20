'use strict';
const { createHash } = require('node:crypto');
// The 49 original migrations were squashed into a three-file baseline on
// 2026-10-19. The Phase 12 archive/retention DDL now lives in the post-lifecycle
// baseline, so that is the migration this workflow gates on.
const TARGET = '20261004000001_post_lifecycle_baseline';
const CODES = Object.freeze([
  ['archive:create', 'archive', 'create'], ['archive:reopen', 'archive', 'reopen'],
  ['archive:delete', 'archive', 'delete'], ['retention:read', 'retention', 'read'],
  ['retention:manage', 'retention', 'manage'], ['backup:manage', 'backup', 'manage'],
  ['backup:restore', 'backup', 'restore'],
]);
const POLICY_COLUMNS = Object.freeze([
  ['scope', 'character varying', 44, true], ['minimumDays', 'integer', -1, false],
  ['archiveAfterDays', 'integer', -1, false], ['secureDeleteAfterDays', 'integer', -1, false],
  ['authority', 'character varying', 504, false],
  ['lawfulBasis', 'character varying', 504, false], ['updatedById', 'text', -1, true],
  // PostgreSQL 16 pg_attribute.atttypmod stores TIMESTAMP(3) as 3, unlike
  // varchar(40), whose typmod is 40 + VARHDRSZ (44). Verified by executing
  // the reviewed migration in an isolated PostgreSQL 16 catalog fixture.
  ['createdAt', 'timestamp without time zone', 3, true],
  ['updatedAt', 'timestamp without time zone', 3, true],
]);
const POLICY_CONSTRAINTS = Object.freeze([
  'RetentionPolicy_pkey', 'RetentionPolicy_scope_check', 'RetentionPolicy_archive_check',
  'RetentionPolicy_minimum_check', 'RetentionPolicy_identity_check', 'RetentionPolicy_purge_check',
]);
class DbStop extends Error {}
function stop(message) { throw new DbStop(message); }
function checkUrl(input) {
  let url;
  try { url = new URL(input); } catch { stop('Explicit owner connection is missing or malformed (value suppressed)'); }
  try {
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
        url.port !== '5432' || url.pathname !== '/duna_seed_test' ||
        decodeURIComponent(url.username) !== 'shipping' || !url.password ||
        url.searchParams.getAll('schema').length > 1 ||
        (url.searchParams.get('schema') ?? 'public') !== 'public') {
      stop('Owner connection differs from approved host/port/role/database/public schema');
    }
  } catch (error) {
    if (error instanceof DbStop) throw error;
    stop('Owner credential contains invalid encoding (value suppressed)');
  }
  return true; // never print credentials
}
function checkStructure(who, applied) {
  const columns = who.policyColumns || [];
  const constraints = who.policyConstraints || [];
  const functions = who.phase12Functions || [];
  const triggers = who.phase12Triggers || [];
  if (!applied) {
    if (who.retentionExists || who.letterColumnPresent || columns.length || constraints.length ||
        functions.length || triggers.length || who.retentionTriggers || who.letterGuard) {
      stop('Unrecorded/partial Phase 12 schema exists; no migration or seed attempted');
    }
    return;
  }
  // Report only fixed, reviewed catalog labels, never raw pg_get_functiondef,
  // arbitrary identifiers, policy row values, URLs or password-bearing errors.
  const issues = [];
  if (!who.retentionExists) issues.push('RetentionPolicy table missing');
  if (who.letterColumnPresent !== true || who.letterColumn !== true) {
    issues.push('letters archivedFromStatus column/type/nullability');
  }
  if (columns.length !== POLICY_COLUMNS.length) issues.push('RetentionPolicy column count');
  for (const [index, [name, type, modifier, required]] of POLICY_COLUMNS.entries()) {
    const actual = columns[index];
    if (actual?.name !== name || actual.type !== type ||
        actual.modifier !== modifier || actual.required !== required) {
      issues.push(`RetentionPolicy column ${name} position/type/precision/nullability`);
    }
  }
  if (constraints.length !== POLICY_CONSTRAINTS.length) issues.push('RetentionPolicy constraint count');
  for (const name of POLICY_CONSTRAINTS) {
    if (!constraints.some((row) => row.name === name && row.validated === true)) {
      issues.push(`RetentionPolicy constraint ${name} missing/unvalidated`);
    }
  }
  if (who.retentionTriggers !== 2) issues.push('RetentionPolicy ENABLE ALWAYS trigger count');
  if (who.letterGuard !== 1) issues.push('letters ENABLE ALWAYS archive guard');
  if (functions.length !== 2) issues.push('Phase 12 protection function count');
  if (functions.some((row) => row.owner !== 'shipping' || row.securityDefiner !== false ||
      !row.config?.includes('search_path=pg_catalog') ||
      typeof row.definition !== 'string' || !/RAISE EXCEPTION/.test(row.definition))) {
    issues.push('Phase 12 protection function owner/security/search_path/body');
  }
  if (!functions.some((row) => row.name === 'phase12_protect_retention_policy' &&
      /NEW\."minimumDays" < OLD\."minimumDays"/.test(row.definition))) {
    issues.push('Phase 12 retention-floor protection body');
  }
  if (!functions.some((row) => row.name === 'phase12_protect_archived_letter' &&
      /OLD\."archivedFromStatus" IS NOT NULL/.test(row.definition))) {
    issues.push('Phase 12 archived-letter protection body');
  }
  if (triggers.length !== 3) issues.push('Phase 12 protection trigger count');
  if (triggers.some((row) => row.enabled !== 'A' || row.internal)) {
    issues.push('Phase 12 trigger enablement/internals');
  }
  if (!triggers.some((row) => row.name === 'phase12_retention_no_reduction' &&
      row.table === 'RetentionPolicy' &&
      /BEFORE (?:UPDATE OR DELETE|DELETE OR UPDATE)/.test(row.definition))) {
    issues.push('Phase 12 RetentionPolicy update/delete trigger');
  }
  if (!triggers.some((row) => row.name === 'phase12_retention_no_truncate' &&
      row.table === 'RetentionPolicy' && /BEFORE TRUNCATE/.test(row.definition))) {
    issues.push('Phase 12 RetentionPolicy truncate trigger');
  }
  if (!triggers.some((row) => row.name === 'phase12_letter_no_archive_delete_bypass' &&
      row.table === 'letters' && /BEFORE UPDATE OF "deletedAt"/.test(row.definition))) {
    issues.push('Phase 12 letters deletion-guard trigger');
  }
  if (issues.length) {
    stop(`Phase 12 catalog differs: ${issues.slice(0, 3).join('; ')}${issues.length > 3 ? '; further mismatches' : ''}. Catalog check is read-only; stop before any further write`);
  }
}
function assess(snapshot, local, mode) {
  if (!['inspect', 'apply', 'verify'].includes(mode)) stop('Unknown deployment stage');
  const { who, runtime, rights, history, permissions, reservedGrants } = snapshot;
  if (!who || who.database !== 'duna_seed_test' || who.login !== 'shipping' ||
      who.session !== 'shipping' || who.owner !== 'shipping' || who.port !== 5432 ||
      !who.server || who.version < 160000 || who.version >= 170000 ||
      who.auditTriggers !== 2 || who.lettersOwner !== 'shipping' ||
      who.permissionsOwner !== 'shipping' || who.grantsOwner !== 'shipping') {
    stop('Live approved DB, owner, PG16, Phase 11 audit protection or core table ownership differs');
  }
  if (!['shipping','postgres'].includes(who.journalOwner) || !who.journalRights ||
      who.journalRights.runtimeSelect || who.journalRights.runtimeInsert ||
      who.journalRights.runtimeUpdate || who.journalRights.runtimeDelete) {
    stop('Migration journal owner/ACL unexpected or runtime role has unsafe journal access');
  }
  if (!runtime || runtime.name !== 'shipping_runtime_p11' || !runtime.login ||
      runtime.superuser || runtime.createRole || runtime.createDb || runtime.ownerMember ||
      runtime.createOnDb || !runtime.connect) stop('Reviewed non-owner API runtime identity differs');
  if (reservedGrants !== 0) stop('Reserved backup/delete capability has an unexpected role grant');
  const known = new Map(local.map((m) => [m.name, m.sha256]));
  if (new Set(local.map((m) => m.name)).size !== local.length || !known.has(TARGET)) {
    stop('Local migration list differs or Phase 12 migration is missing');
  }
  if (!Array.isArray(history)) stop('Migration history could not be inspected using the approved Docker/owner session');
  const completed = new Set();
  for (const row of history) {
    if (!known.has(row.name) || row.checksum !== known.get(row.name) ||
        !row.finished || row.rolledback || completed.has(row.name)) {
      stop('Migration journal contains an unknown, failed, duplicate or changed checksum');
    }
    completed.add(row.name);
  }
  // The Phase 11 append-only audit protection used to be its own migration and
  // is now part of TARGET. The prerequisite it expressed - everything already
  // approved is applied before Phase 12 writes - is enforced by the pending
  // check below, which only ever allows TARGET itself to be outstanding. The
  // protection's own content is asserted in workflow.test.cjs.
  if (!known.has(TARGET)) stop('Phase 12 target migration is missing from the reviewed set');
  const pending = local.filter((m) => !completed.has(m.name)).map((m) => m.name);
  if (pending.some((name) => name !== TARGET)) stop('Unrelated migration is pending; no Phase 12 write allowed');
  const applied = completed.has(TARGET);
  if (mode === 'verify' && !applied) stop('Phase 12 migration has not been applied');
  checkStructure(who, applied);
  const activeCodes = CODES.filter(([code]) => permissions.some((row) => row.code === code));
  if (permissions.length !== activeCodes.length || activeCodes.some(([code, module, action]) =>
      !permissions.some((p) => p.code === code && p.module === module && p.action === action))) {
    stop('Phase 12 permission code conflicts with reviewed vocabulary');
  }
  if (activeCodes.length !== 0 && activeCodes.length !== CODES.length) {
    stop('Partial Phase 12 permission seed; stop for DBA review, no automatic repair');
  }
  if (!applied && activeCodes.length) stop('Phase 12 permissions exist without the reviewed migration');
  if (mode === 'verify' && activeCodes.length !== CODES.length) {
    stop('Seven reviewed Phase 12 permissions are not present');
  }
  if (applied && (!rights || rights.select !== true || rights.insert !== true ||
      rights.update !== true || rights.delete !== false || rights.truncate !== false ||
      rights.exporterSelect !== false)) {
    stop('Runtime RetentionPolicy grants do not match least-privilege policy');
  }
  const journalNeedsGrant = !who.journalRights.ownerSelect ||
    !who.journalRights.ownerInsert || !who.journalRights.ownerUpdate;
  if (mode === 'verify' && journalNeedsGrant) {
    stop('Shipping migration owner lacks minimum journal SELECT/INSERT/UPDATE rights');
  }
  if (journalNeedsGrant && who.journalOwner === 'shipping') {
    stop('Shipping owns the journal but lacks owner rights; schema state is inconsistent');
  }
  return { pending, migrationApplied: applied, permissionCodes: activeCodes.length,
    journalNeedsGrant, runtime: runtime.name };
}
function digest(snapshot, local, head) {
  if (!/^[a-f0-9]{40}$/.test(head)) stop('Explicit source commit required');
  const text = JSON.stringify({ head, who: snapshot.who, runtime: snapshot.runtime,
    rights: snapshot.rights, history: snapshot.history, permissions: snapshot.permissions, local });
  return createHash('sha256').update(text).digest('hex');
}
function reviewedApply(snapshot, local, head, approvedDigest) {
  if (typeof approvedDigest !== 'string' || !/^[a-f0-9]{64}$/.test(approvedDigest)) {
    stop('Reviewed Phase 12 inspection digest required before any DB write');
  }
  const state = assess(snapshot, local, 'apply');
  if (digest(snapshot, local, head) !== approvedDigest) {
    stop(`Reviewed Phase 12 inspection became stale (migration recorded=${state.migrationApplied}; permissions=${state.permissionCodes}/7); no apply write attempted; inspect again`);
  }
  return state;
}
module.exports = { DbStop, TARGET, CODES, POLICY_COLUMNS, POLICY_CONSTRAINTS,
  checkUrl, checkStructure, assess, digest, reviewedApply };
