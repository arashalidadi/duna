'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { TARGET, TABLE_OPS, SEQUENCE_OPS } = require('./phase11-server-catalog.cjs');

const SOURCE_PATHS = Object.freeze([
  'apps/api/src', 'apps/api/scripts/phase11-audit-roles.ts',
  'apps/api/scripts/seed-phase11-permissions.ts',
  'apps/api/scripts/phase11-runtime-privileges.cjs',
  'apps/api/scripts/phase11-server-catalog.cjs',
  'apps/api/scripts/phase11-server-policy.cjs',
  'apps/api/scripts/phase11-server-workflow.cjs',
  'apps/api/scripts/phase11-server-workflow.test.cjs',
  'prisma/schema.prisma', 'prisma/seed/phase11-permissions.ts',
  'prisma/migrations', 'packages/config/src/load-config.ts',
  'package.json', 'apps/api/package.json', 'pnpm-lock.yaml',
]);
function sourceState(root) {
  return {
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 5000 }).trim(),
    dirty: execFileSync('git', ['status', '--porcelain', '--', ...SOURCE_PATHS],
      { cwd: root, encoding: 'utf8', timeout: 5000 }).trim().split('\n').filter(Boolean),
  };
}
function checkUrl(raw, role) {
  if (!raw) throw new Error(`Missing private ${role === TARGET.owner ? 'migrator' : 'runtime'} database URL`);
  let u;
  try { u = new URL(raw); } catch { throw new Error('Malformed database URL (value never printed)'); }
  if (!['postgresql:', 'postgres:'].includes(u.protocol) || u.hostname !== '127.0.0.1' ||
      (u.port && Number(u.port) !== TARGET.port) ||
      decodeURIComponent(u.pathname.slice(1)) !== TARGET.database ||
      decodeURIComponent(u.username) !== role ||
      u.searchParams.getAll('schema').some((s) => s !== 'public') ||
      (role === TARGET.runtime && !u.password)) {
    throw new Error(`Private database URL is not the reviewed 127.0.0.1:${TARGET.port}/${TARGET.database} ${role} public-schema target`);
  }
  return raw; // never log, embed in a process argument, or persist
}
function quoteId(identifier) {
  if (typeof identifier !== 'string' || !identifier || identifier.includes('\0')) {
    throw new Error('Invalid catalog SQL identifier');
  }
  return `"${identifier.replace(/"/g, '""')}"`;
}
function migrationStatus(s, root) {
  const issues = [];
  const dir = path.join(root, 'prisma/migrations');
  const local = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'migration.sql')))
    .map((d) => d.name).sort();
  if (!s.journal) issues.push('Prisma migration journal missing; this is not the reviewed existing database');
  const byName = new Map();
  for (const r of s.history) {
    if (!local.includes(r.name)) issues.push(`Unknown recorded migration ${r.name}`);
    if (r.rolledback || !r.finished || byName.has(r.name)) {
      issues.push(`Failed, rolled-back or duplicate migration ${r.name}; do not rewrite history`);
    }
    byName.set(r.name, r);
    if (local.includes(r.name)) {
      const checksum = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, r.name, 'migration.sql'))).digest('hex');
      if (checksum !== r.checksum) issues.push(`Migration checksum differs: ${r.name}`);
    }
  }
  const pending = local.filter((name) => !byName.has(name));
  if (pending.length && (pending.length !== 1 || pending[0] !== TARGET.migration)) {
    issues.push(`Only the reviewed Phase 11 migration may be pending; found ${pending.length} other/pending migration(s)`);
  }
  const funcs = s.functions || [];
  const fn = funcs[0];
  const validFunction = funcs.length === 1 && fn.owner === TARGET.owner &&
    !fn.securityDefiner && fn.name.includes('phase11_reject_audit_mutation(') &&
    /RAISE\s+EXCEPTION\s+'AuditLog is append-only:/i.test(fn.definition) &&
    /ERRCODE\s*=\s*'42501'/i.test(fn.definition);
  const audit = s.triggers;
  const update = audit.find((t) => t.name === 'phase11_audit_no_update_delete');
  const truncate = audit.find((t) => t.name === 'phase11_audit_no_truncate');
  const valid = validFunction && audit.length === 2 && update?.enabled === 'A' && truncate?.enabled === 'A' &&
    update.function.includes('phase11_reject_audit_mutation') &&
    truncate.function.includes('phase11_reject_audit_mutation') &&
    /BEFORE\b.*\bUPDATE\b.*\bDELETE\b|BEFORE\b.*\bDELETE\b.*\bUPDATE\b/i.test(update.definition) &&
    /BEFORE\s+TRUNCATE\b/i.test(truncate.definition);
  if (!pending.length && !valid) issues.push('Applied audit migration lacks the two reviewed ALWAYS append-only triggers');
  if (pending.length && (audit.length || funcs.length)) {
    issues.push('Audit function/triggers exist without a completed matching migration; inspect drift');
  }
  return { issues, pending, valid };
}
function seedStatus(seed) {
  const issues = [];
  const find = (name) => seed.permissions.find((p) => p.code === name);
  const read = find('audit:read');
  const exportPermission = find('audit:export');
  const exportRole = seed.roles.find((r) => r.code === 'AUDIT_EXPORTER');
  const admin = seed.roles.find((r) => r.code === 'ADMIN');
  if (!read || read.module !== 'audit' || read.action !== 'read') issues.push('audit:read vocabulary missing/conflicting');
  if (exportPermission && (exportPermission.module !== 'audit' || exportPermission.action !== 'export')) {
    issues.push('audit:export vocabulary conflicts');
  }
  const exportGrants = seed.grants.filter((g) => g.role === 'AUDIT_EXPORTER').map((g) => g.permission);
  if (exportRole && (exportRole.deleted || !exportRole.isSystem ||
      exportGrants.some((p) => !['audit:read','audit:export'].includes(p)))) {
    issues.push('AUDIT_EXPORTER role has conflicting status or privileges');
  }
  if (seed.grants.some((g) => g.permission === 'audit:export' && g.role !== 'AUDIT_EXPORTER')) {
    issues.push('audit:export assigned to a different dashboard role');
  }
  if (!admin || admin.deleted) issues.push('Expected existing ADMIN dashboard role missing');
  if (seed.grants.some((g) => g.role === 'ADMIN' &&
      ['audit:export','release:override'].includes(g.permission))) {
    issues.push('Ordinary ADMIN has an explicit-only authority; investigate, never revoke automatically');
  }
  const complete = !!exportPermission && !!exportRole &&
    ['audit:read','audit:export'].every((code) => exportGrants.includes(code)) && !issues.length;
  if (exportRole?.members && !complete) {
    issues.push('AUDIT_EXPORTER already has members but the seed is incomplete');
  }
  return { issues, complete, members: exportRole?.members ?? 0 };
}

function assess(s, plan, root, runtimeConnected, passwordAttested = false, hbaAttested = false) {
  const migration = migrationStatus(s, root);
  const seed = seedStatus(s.seed);
  const issues = [...migration.issues, ...seed.issues];
  const passwordEvidence = s.password?.visible ? (s.password.set ? 'catalog-confirmed' : 'catalog-unset') :
    passwordAttested ? 'DBA-attested (not independently readable)' : 'unverified';
  if (passwordEvidence === 'catalog-unset') issues.push('Runtime PostgreSQL role password is unset; DBA must configure it privately');
  if (passwordEvidence === 'unverified') issues.push('DBA must verify role password privately and attest it; pg_authid is not readable here');
  if (!hbaAttested) issues.push('DBA must attest the password-authenticated HBA rule for the loopback runtime connection');
  const missing = { schema: [], tables: [], sequences: [] };
  const roles = Object.fromEntries(s.roles.map((r) => [r.name, r]));
  const owner = roles[TARGET.owner];
  if (!owner?.login) issues.push('Migrator PostgreSQL role missing/NOLOGIN');
  for (const [role, shouldLogin] of [[TARGET.runtime, true], [TARGET.exporter, false]]) {
    const r = roles[role];
    if (!r) { issues.push(`PostgreSQL role ${role} missing (never create automatically)`); continue; }
    if (r.login !== shouldLogin || r.superuser || r.createRole || r.createDb || r.replication ||
        r.bypassRls || r.memberOfAnyRole || r.memberOfOwner || r.canCreateSchema ||
        (shouldLogin && !r.canConnect)) issues.push(`Unsafe PostgreSQL identity/membership/database access: ${role}`);
    const schema = s.schema.find((v) => v.role === role);
    if (!schema || schema.create || schema.delegateUsage) {
      issues.push(`Unsafe public schema CREATE/delegation/unknown rights: ${role}`);
    }
    if (schema && !schema.usage) missing.schema.push(role);
    for (const extra of s.otherSchemaRights?.[role] || []) {
      if (extra.usage || extra.create || extra.delegateUsage || extra.tableAccess || extra.sequenceAccess) {
        issues.push(`Unexpected ${role} access to non-application schema ${extra.name}`);
      }
    }
  }
  const byName = new Map(s.tables.map((t) => [t.name, t]));
  for (const table of Object.keys(plan)) {
    const actual = byName.get(table);
    if (!actual || !['r','p'].includes(actual.kind) || actual.owner !== TARGET.owner) {
      issues.push(`Required table ${table} missing, replaced or not owned by reviewed migrator`);
    }
  }
  if (s.tables.find((t) => t.name === '_prisma_migrations')?.owner !== TARGET.owner) {
    issues.push('Migration journal is not owned by the reviewed migrator');
  }
  if (migration.pending.length && !s.schemaGrant?.canCreate) {
    issues.push('Migrator cannot CREATE reviewed audit trigger function in public schema');
  }
  if (missing.schema.length && !s.schemaGrant?.grantUsage) {
    issues.push('Migrator cannot grant missing public schema USAGE; DBA review required');
  }
  for (const role of [TARGET.runtime, TARGET.exporter]) {
    if (!roles[role]) continue;
    for (const table of Object.keys(plan)) {
      if (!(s.tableRights[role] || []).some((r) => r.name === table)) {
        issues.push(`Privilege inventory missing ${role} public.${table}`);
      }
    }
    for (const row of s.tableRights[role] || []) {
      const want = role === TARGET.runtime ? plan[row.name] :
        row.name === 'AuditLog' ? { SELECT: true } : null;
      const absent = [];
      for (const op of TABLE_OPS) {
        if (row[op] && !want?.[op]) issues.push(`Excess ${role} ${op} on public.${row.name}`);
        if (row[`grant${op}`]) issues.push(`Delegable ${role} ${op} on public.${row.name}`);
        if (want?.[op] && !row[op]) absent.push(op);
      }
      if (absent.length) missing.tables.push({ role, table: row.name, ops: absent });
    }
    for (const row of s.columnRights[role] || []) {
      const want = role === TARGET.runtime ? plan[row.name] :
        row.name === 'AuditLog' ? { SELECT: true } : null;
      for (const op of ['SELECT','INSERT','UPDATE','REFERENCES']) {
        if (row[op] && !want?.[op]) issues.push(`Excess ${role} column ${op} on public.${row.name}`);
        if (row[`grant${op}`]) issues.push(`Delegable ${role} column ${op} on public.${row.name}`);
      }
    }
  }
  const required = new Map();
  for (const link of s.links) {
    if (plan[link.table]?.INSERT) required.set(link.sequence, link.table);
  }
  for (const def of s.nextvals) {
    if (plan[def.table]?.INSERT && !s.links.some((link) =>
      link.table === def.table && link.column === def.column)) {
      issues.push(`Unmapped nextval default ${def.table}.${def.column}; inspect sequence dependencies`);
    }
  }
  for (const role of [TARGET.runtime, TARGET.exporter]) {
    if (!roles[role]) continue;
    for (const seq of s.sequenceRights[role] || []) {
      const needed = role === TARGET.runtime && required.has(seq.name);
      if (needed && seq.owner !== TARGET.owner) issues.push(`Required sequence ${seq.name} is not owned by migrator`);
      for (const op of SEQUENCE_OPS) {
        if (seq[op] && !(needed && op === 'USAGE')) issues.push(`Excess ${role} sequence ${op} on public.${seq.name}`);
        if (seq[`grant${op}`]) issues.push(`Delegable ${role} sequence ${op} on public.${seq.name}`);
      }
      if (needed && !seq.USAGE) missing.sequences.push(seq.name);
    }
  }
  for (const name of required.keys()) {
    if (!(s.sequenceRights[TARGET.runtime] || []).some((row) => row.name === name)) {
      issues.push(`Required sequence ${name} not found in public schema`);
    }
  }
  if (!runtimeConnected) issues.push('Runtime credential/login not verified; supply private RUNTIME_DATABASE_URL and rerun inspect');
  return { issues: [...new Set(issues)], missing, requiredSequences: [...required.keys()].sort(),
    passwordEvidence, hbaEvidence: hbaAttested ? 'DBA-attested (not independently readable)' : 'unverified',
    migration, seed };
}
function stableDigest(s, plan, source, runtimeConnected) {
  return crypto.createHash('sha256').update(JSON.stringify({ target: TARGET, plan, catalog: s,
    source, runtimeConnected })).digest('hex');
}
function grantSql(missing) {
  const statements = [];
  for (const role of missing.schema) {
    statements.push(`GRANT USAGE ON SCHEMA public TO ${quoteId(role)}`);
  }
  const groups = new Map();
  for (const row of missing.tables) {
    const key = `${row.role}|${row.ops.join(', ')}`;
    if (!groups.has(key)) groups.set(key, { role: row.role, ops: row.ops, tables: [] });
    groups.get(key).tables.push(row.table);
  }
  for (const { role, ops, tables } of groups.values()) {
    statements.push(`GRANT ${ops.join(', ')} ON TABLE ${tables.map((t) => 'public.' + quoteId(t)).join(', ')} TO ${quoteId(role)}`);
  }
  if (missing.sequences.length) {
    statements.push(`GRANT USAGE ON SEQUENCE ${missing.sequences.map((s) => 'public.' + quoteId(s)).join(', ')} TO ${quoteId(TARGET.runtime)}`);
  }
  return statements;
}
function planSummary(result) {
  return {
    missingSchema: result.missing.schema,
    missingTablePrivileges: result.missing.tables,
    missingSequences: result.missing.sequences,
    requiredSequences: result.requiredSequences,
    runtimePasswordEvidence: result.passwordEvidence,
    runtimeHbaEvidence: result.hbaEvidence,
    migrationPending: result.migration.pending,
    seedPending: !result.seed.complete,
    exporterDashboardMembers: result.seed.members,
    blockers: result.issues,
  };
}
module.exports = { SOURCE_PATHS, sourceState, checkUrl, quoteId, migrationStatus,
  seedStatus, assess, stableDigest, grantSql, planSummary };
