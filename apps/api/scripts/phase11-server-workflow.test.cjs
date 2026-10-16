'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { reviewedPlan, modelsInSchema } = require('./phase11-runtime-privileges.cjs');
const { TARGET, TABLE_OPS, assertIdentity, readCatalog } = require('./phase11-server-catalog.cjs');
const { assess, migrationStatus, seedStatus, grantSql, checkUrl, stableDigest,
  quoteId } = require('./phase11-server-policy.cjs');
const { runStage, SafetyStop, applyReviewedGrants } = require('./phase11-server-workflow.cjs');
const ROOT = path.resolve(__dirname, '../../..');
const plan = reviewedPlan(ROOT);
const safeAssess = (catalog, rights, root, connected, passwordAttested = false) =>
  assess(catalog, rights, root, connected, passwordAttested, true);
const source = { head: 'f'.repeat(40), dirty: [] };
const local = fs.readdirSync(path.join(ROOT, 'prisma/migrations'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, 'prisma/migrations', d.name, 'migration.sql')))
  .map((d) => d.name).sort();
function seed(complete = true) {
  return {
    permissions: [{ code: 'audit:read', module: 'audit', action: 'read' },
      ...(complete ? [{ code: 'audit:export', module: 'audit', action: 'export' }] : []),
      { code: 'release:override', module: 'release', action: 'override' }],
    roles: [{ id: 'admin-id', code: 'ADMIN', isSystem: true, deleted: false, members: 1 },
      ...(complete ? [{ id: 'export-id', code: 'AUDIT_EXPORTER', isSystem: true, deleted: false, members: 0 }] : [])],
    grants: complete ? [{ role: 'AUDIT_EXPORTER', permission: 'audit:read' },
      { role: 'AUDIT_EXPORTER', permission: 'audit:export' }] : [],
  };
}
function snapshot({ migration = true, grants = true, seeded = true } = {}) {
  const names = migration ? local : local.filter((m) => m !== TARGET.migration);
  const history = names.map((name) => ({ name,
    checksum: crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'prisma/migrations', name, 'migration.sql'))).digest('hex'),
    finished: true, rolledback: false }));
  const role = (name, login) => ({ name, login, superuser: false, createRole: false, createDb: false,
    replication: false, bypassRls: false, memberOfAnyRole: false,
    memberOfOwner: name === TARGET.owner, canCreateSchema: name === TARGET.owner,
    canConnect: login });
  return {
    who: { database: TARGET.database, login: TARGET.owner, session: TARGET.owner, port: 5432, serverVersion: 160014 },
    password: { visible: true, set: true },
    schemaGrant: { owner: 'pg_database_owner', canCreate: true, grantUsage: true },
    roles: [role(TARGET.owner, true), role(TARGET.runtime, true), role(TARGET.exporter, false)],
    tables: [...Object.keys(plan).map((name) => ({ name, owner: TARGET.owner, kind: 'r' })),
      { name: '_prisma_migrations', owner: TARGET.owner, kind: 'r' }],
    functions: migration ? [{ name: 'phase11_reject_audit_mutation()', owner: TARGET.owner,
      securityDefiner: false, definition: `CREATE FUNCTION public.phase11_reject_audit_mutation()
        RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'AuditLog is append-only: UPDATE, DELETE and TRUNCATE are prohibited'
        USING ERRCODE = '42501'; END; $$ LANGUAGE plpgsql` }] : [],
    triggers: migration ? [
      { name: 'phase11_audit_no_update_delete', enabled: 'A',
        function: 'phase11_reject_audit_mutation()',
        definition: 'BEFORE UPDATE OR DELETE ON public."AuditLog"' },
      { name: 'phase11_audit_no_truncate', enabled: 'A',
        function: 'phase11_reject_audit_mutation()', definition: 'BEFORE TRUNCATE ON public."AuditLog"' },
    ] : [],
    journal: true, history, seed: seed(seeded), links: [], nextvals: [],
    schema: [{ role: TARGET.runtime, usage: grants, create: false },
      { role: TARGET.exporter, usage: grants, create: false }],
    otherSchemaRights: { [TARGET.runtime]: [], [TARGET.exporter]: [] },
    tableRights: {
      [TARGET.runtime]: Object.entries(plan).map(([name, wanted]) =>
        ({ name, ...Object.fromEntries(TABLE_OPS.map((op) => [op, grants && !!wanted[op]])) } )).concat([
          { name: '_prisma_migrations', ...Object.fromEntries(TABLE_OPS.map((op) => [op, false])) }]),
      [TARGET.exporter]: Object.keys(plan).concat('_prisma_migrations').map((name) =>
        ({ name, ...Object.fromEntries(TABLE_OPS.map((op) =>
          [op, grants && name === 'AuditLog' && op === 'SELECT'])) })),
    },
    columnRights: { [TARGET.runtime]: [], [TARGET.exporter]: [] },
    sequenceRights: { [TARGET.runtime]: [], [TARGET.exporter]: [] },
  };
}
function context(state, options = {}) {
  const output = [];
  const calls = [];
  const d = { root: ROOT, plan, source, runtime: {}, hbaAttested: true,
    read: async () => structuredClone(state.value),
    runtimeCheck: async () => { calls.push('runtime-auth'); if (options.failAuth) throw new Error('authentication failed'); },
    ownerCheck: async () => { calls.push('owner-identity'); },
    migrate: async () => { calls.push('migrate'); state.value = snapshot({ migration: true, grants: false, seeded: false }); },
    grant: async () => { calls.push('grant'); state.value = snapshot({ migration: true, grants: true, seeded: false }); },
    seed: async () => { calls.push('seed'); state.value = snapshot({ migration: true, grants: true, seeded: true }); },
    probe: async () => { calls.push('read-only-runtime-probe'); },
    print: (line) => output.push(line), ...options };
  return { d, output, calls };
}

test('93 source-reviewed models mapped to exactly 93 operational tables, no journal/table wildcard', () => {
  assert.equal(modelsInSchema(ROOT).size, 93);
  assert.equal(Object.keys(plan).length, 93);
  assert.equal(plan.Permission.INSERT, false); // deployment-only seed uses owner
  assert.equal(plan.AuditLog.SELECT, true);
  assert.equal(plan.AuditLog.INSERT, true);
  assert.equal(plan.AuditLog.UPDATE, false);
  assert.equal(plan.AuditLog.DELETE, false);
  assert.equal(plan.PortAlias.DELETE, true); // nested deleteMany
  assert.equal(plan.CargoIntakeDocument.INSERT, true); // nested create
  assert.equal(plan.journal_lines.INSERT, true); // nested create; @@map
  assert.equal(plan.NotificationDelivery.INSERT, true); // nested create
  assert.equal(plan.CargoLegacyAttribute.INSERT, false); // relation reads only
  assert.equal(plan._prisma_migrations, undefined);
});

test('only exact live DB/PG16/role identity allowed; credentials not reflected in errors', () => {
  const row = { database: TARGET.database, login: TARGET.owner, session: TARGET.owner,
    port: 5432, serverVersion: 160014 };
  assert.doesNotThrow(() => assertIdentity(row, TARGET.owner));
  for (const bad of [{ database: 'duna_seed_test1' }, { session: 'shipping_runtime_p11' },
    { login: 'wrong' }, { port: 55431 }, { serverVersion: 170000 }]) {
    assert.throws(() => assertIdentity({ ...row, ...bad }, TARGET.owner));
  }
  const owner = new URL('postgresql://127.0.0.1:5432/duna_seed_test?schema=public');
  owner.username = TARGET.owner;
  const runtime = new URL(owner); runtime.username = TARGET.runtime; runtime.password = 'test-only';
  assert.equal(checkUrl(owner.toString(), TARGET.owner), owner.toString());
  assert.equal(checkUrl(runtime.toString(), TARGET.runtime), runtime.toString());
  const bad = new URL(runtime); bad.pathname = '/duna_seed_test1';
  assert.throws(() => checkUrl(bad.toString(), TARGET.runtime), /reviewed.*target/);
  bad.pathname = '/duna_seed_test'; bad.hostname = 'server.example';
  assert.throws(() => checkUrl(bad.toString(), TARGET.runtime));
  assert.throws(() => checkUrl(owner.toString(), TARGET.runtime));
});

test('catalog read assessment detects Phase 11-only pending migration, drift, role and audit faults', () => {
  const s = snapshot({ migration: false, grants: false, seeded: false });
  const a = safeAssess(s, plan, ROOT, true);
  assert.deepEqual(a.issues, []);
  assert.deepEqual(a.migration.pending, [TARGET.migration]);
  assert.equal(a.seed.complete, false);
  assert.equal(a.missing.tables.length, 93 + 1); // one exporter AuditLog grant
  const drift = structuredClone(s);
  drift.history[0].checksum = 'tampered';
  assert.match(migrationStatus(drift, ROOT).issues.join(' '), /checksum differs/);
  drift.history[0].checksum = s.history[0].checksum;
  drift.tableRights[TARGET.runtime].find((t) => t.name === 'AuditLog').UPDATE = true;
  assert.match(safeAssess(drift, plan, ROOT, true).issues.join(' '), /Excess .*UPDATE on public.AuditLog/);
  drift.roles.find((r) => r.name === TARGET.runtime).memberOfOwner = true;
  assert.match(safeAssess(drift, plan, ROOT, true).issues.join(' '), /Unsafe PostgreSQL identity/);
  drift.seed.grants.push({ role: 'ADMIN', permission: 'release:override' });
  assert.match(seedStatus(drift.seed).issues.join(' '), /explicit-only/);
  const tampered = snapshot();
  tampered.functions[0].definition = 'BEGIN RETURN NEW; END';
  assert.match(migrationStatus(tampered, ROOT).issues.join(' '), /append-only triggers/);
});

test('GRANT OPTION on a nominally allowed table/schema privilege is still excessive', () => {
  const s = snapshot();
  s.tableRights[TARGET.runtime].find((r) => r.name === 'AuditLog').grantSELECT = true;
  s.schema.find((r) => r.role === TARGET.exporter).delegateUsage = true;
  const errors = safeAssess(s, plan, ROOT, true).issues.join(' ');
  assert.match(errors, /Delegable .* SELECT on public.AuditLog/);
  assert.match(errors, /schema CREATE\/delegation/);
});

test('non-application schema access for either DB role is blocked without changing grants', () => {
  const s = snapshot();
  s.otherSchemaRights[TARGET.exporter].push({ name: 'private', usage: true,
    create: false, tableAccess: false, sequenceAccess: false });
  assert.match(safeAssess(s, plan, ROOT, true).issues.join(' '), /non-application schema private/);
});

test('preflight refuses unsupported schema grants and pending migration without CREATE', () => {
  const s = snapshot({ migration: false, grants: false });
  s.schemaGrant.grantUsage = false;
  s.schemaGrant.canCreate = false;
  const issues = safeAssess(s, plan, ROOT, true).issues.join(' ');
  assert.match(issues, /cannot grant missing public schema USAGE/);
  assert.match(issues, /cannot CREATE reviewed audit trigger/);
});

test('unattested loopback password-authentication policy blocks switching', async () => {
  const s = snapshot();
  assert.match(assess(s, plan, ROOT, true).issues.join(' '), /HBA rule/);
  const x = context({ value: s }, { hbaAttested: false });
  assert.equal(await runStage('inspect', x.d), false);
  assert(!x.output.some((o) => o.startsWith('REVIEWED_PLAN_SHA256=')));
});

test('unproven or absent runtime role password blocks writes even if a URL exists', () => {
  const s = snapshot();
  s.password = { visible: true, set: false };
  assert.match(safeAssess(s, plan, ROOT, true, true).issues.join(' '), /password is unset/);
  s.password = { visible: false, set: null };
  assert.match(safeAssess(s, plan, ROOT, true).issues.join(' '), /DBA must verify/);
  const a = safeAssess(s, plan, ROOT, true, true);
  assert.deepEqual(a.issues, []);
  assert.match(a.passwordEvidence, /attested/);
});

test('table-specific grants, schema USAGE and linked INSERT sequence only; never blanket rights', () => {
  const s = snapshot({ grants: false });
  s.links = [{ sequence: 'user_ids_seq', table: 'User', column: 'id' },
    { sequence: 'legacy_ids_seq', table: 'CargoLegacyAttribute', column: 'id' }];
  s.nextvals = [{ table: 'User', column: 'id' }, { table: 'CargoLegacyAttribute', column: 'id' }];
  for (const role of [TARGET.runtime, TARGET.exporter]) {
    s.sequenceRights[role] = [{ name: 'user_ids_seq', owner: TARGET.owner, USAGE: false, SELECT: false, UPDATE: false },
      { name: 'legacy_ids_seq', owner: TARGET.owner, USAGE: false, SELECT: false, UPDATE: false }];
  }
  const a = safeAssess(s, plan, ROOT, true);
  assert.deepEqual(a.issues, []);
  assert.deepEqual(a.missing.sequences, ['user_ids_seq']);
  const sql = grantSql(a.missing);
  assert(sql.some((line) => line === 'GRANT USAGE ON SEQUENCE public."user_ids_seq" TO "shipping_runtime_p11"'));
  assert(!sql.join('\n').includes('legacy_ids_seq'));
  assert(!/\b(ALL|REVOKE|ALTER|OWNED BY)\b/.test(sql.join('\n')));
  assert(!sql.join('\n').includes('_prisma_migrations'));
  assert.equal(quoteId('x";DROP'), '"x"";DROP"');
  s.sequenceRights[TARGET.runtime][1].USAGE = true;
  assert.match(safeAssess(s, plan, ROOT, true).issues.join(' '), /Excess .*sequence USAGE/);
});

test('Stage 1 never writes; failed runtime login blocks approval', async () => {
  const state = { value: snapshot({ grants: false, seeded: false }) };
  const good = context(state);
  assert.equal(await runStage('inspect', good.d), true);
  assert(good.output.some((s) => s.startsWith('REVIEWED_PLAN_SHA256=')));
  assert.deepEqual(good.calls, ['runtime-auth']);
  const bad = context(state, { failAuth: true });
  assert.equal(await runStage('inspect', bad.d), false);
  assert(bad.output.join('\n').includes('INSPECTION_BLOCKED'));
  assert.deepEqual(bad.calls, ['runtime-auth']);
});

test('Stage 2 orders migration, grants, owner-only seed and probe; Stage 3 independently verifies', async () => {
  const state = { value: snapshot({ migration: false, grants: false, seeded: false }) };
  const x = context(state);
  await runStage('inspect', x.d);
  const hash = x.output.find((o) => o.startsWith('REVIEWED_PLAN_SHA256=')).split('=')[1];
  x.d.approval = hash;
  x.d.backupVerified = 'I_HAVE_TESTED_RESTORE';
  assert.equal(await runStage('apply', x.d), true);
  assert.deepEqual(x.calls, ['runtime-auth','runtime-auth','owner-identity','migrate',
    'owner-identity','grant','owner-identity','seed','read-only-runtime-probe']);
  const y = context(state);
  assert.equal(await runStage('verify', y.d), true);
  assert(y.output.some((o) => o.startsWith('READY_FOR_API_SWITCH')));
  assert.deepEqual(y.calls, ['runtime-auth','read-only-runtime-probe']);
  const z = context(state);
  z.d.approval = stableDigest(state.value, plan, source, true);
  z.d.backupVerified = 'I_HAVE_TESTED_RESTORE';
  assert.equal(await runStage('apply', z.d), true); // no repeat writes/audit events
  assert.deepEqual(z.calls, ['runtime-auth','read-only-runtime-probe']);
});

test('Stage 2 rejects stale approval, absent backup attestation, source dirt and excess grants before writes', async () => {
  for (const alter of [
    (d) => { d.approval = '0'.repeat(64); },
    (d) => { d.backupVerified = undefined; },
    (d) => { d.source = { ...source, dirty: [' M apps/api/src/modules/auth/auth.service.ts'] }; },
    (d, state) => { state.value.tableRights[TARGET.runtime].find((r) => r.name === 'Permission').INSERT = true; },
  ]) {
    const state = { value: snapshot({ grants: false, seeded: false }) };
    const x = context(state);
    x.d.approval = stableDigest(state.value, plan, source, true);
    x.d.backupVerified = 'I_HAVE_TESTED_RESTORE';
    alter(x.d, state);
    await assert.rejects(() => runStage('apply', x.d), SafetyStop);
    assert.deepEqual(x.calls, ['runtime-auth']);
  }
});

test('Stage 3 cannot emit READY when prior stages or runtime authentication are incomplete', async () => {
  for (const opts of [{ migration: false, grants: false, seeded: false },
    { migration: true, grants: false, seeded: true }, { migration: true, grants: true, seeded: false }]) {
    const state = { value: snapshot(opts) };
    const x = context(state);
    await assert.rejects(() => runStage('verify', x.d), SafetyStop);
    assert(!x.output.some((o) => o.includes('READY_FOR_API_SWITCH')));
  }
  const x = context({ value: snapshot() }, { failAuth: true });
  await assert.rejects(() => runStage('verify', x.d), SafetyStop);
  assert.deepEqual(x.calls, ['runtime-auth']);
});

test('catalog adapter runs a read-only transaction and builds the same reviewed inventory', async () => {
  const expected = snapshot();
  const calls = [];
  const tx = {
    $executeRawUnsafe: async (sql) => {
      calls.push(sql);
      assert.equal(sql, 'SET TRANSACTION READ ONLY');
    },
    $queryRawUnsafe: async (sql, role) => {
      calls.push('query');
      if (sql.includes('current_database()::text AS "database"')) return [expected.who];
      if (sql.includes('FROM pg_roles r CROSS JOIN pg_roles owner')) return expected.roles;
      if (sql.includes("has_table_privilege(current_user, 'pg_catalog.pg_authid'")) return [{ visible: true }];
      if (sql.includes('FROM pg_catalog.pg_authid')) return [{ set: true }];
      if (sql.includes('c.relkind::text AS kind')) return expected.tables;
      if (sql.includes('FROM pg_trigger t JOIN pg_class c')) return expected.triggers;
      if (sql.includes('FROM pg_proc p JOIN pg_namespace n')) return expected.functions;
      if (sql.includes('pg_get_userbyid(n.nspowner)')) return [expected.schemaGrant];
      if (sql.includes("to_regclass('public._prisma_migrations')")) return [{ present: true }];
      if (sql.includes('FROM public._prisma_migrations ORDER BY')) return expected.history;
      if (sql.includes('FROM public."Permission"')) return expected.seed.permissions;
      if (sql.includes('FROM public."Role" r WHERE code IN')) return expected.seed.roles;
      if (sql.includes('FROM public."RolePermission" rp JOIN')) return expected.seed.grants;
      if (sql.includes('FROM pg_attrdef d') && sql.includes('UNION')) return expected.links;
      if (sql.includes('FROM pg_attrdef d') && sql.includes("LIKE '%nextval(%'")) return expected.nextvals;
      if (sql.includes("has_schema_privilege($1::text, 'public', 'USAGE')")) {
        return [expected.schema.find((r) => r.role === role)];
      }
      if (sql.includes('FROM pg_namespace n WHERE n.nspname NOT IN')) return [];
      if (sql.includes('has_column_privilege($1::text')) return expected.columnRights[role];
      if (sql.includes('has_sequence_privilege($1::text')) return expected.sequenceRights[role];
      if (sql.includes('has_table_privilege($1::text')) return expected.tableRights[role];
      throw new Error('Unknown catalog query in no-database fixture');
    },
  };
  const db = { $transaction: async (callback) => callback(tx) };
  const read = await readCatalog(db);
  assert.deepEqual(read, expected);
  assert.equal(calls[0], 'SET TRANSACTION READ ONLY');
  assert.equal(calls.filter((c) => c !== 'query').length, 1);
  assert.deepEqual(safeAssess(read, plan, ROOT, true).issues, []);
});

test('grant transaction guards every write, rereads catalog, and rolls back failed verification', async () => {
  const s = snapshot({ grants: false });
  const a = safeAssess(s, plan, ROOT, true);
  const calls = [];
  const tx = {
    $queryRawUnsafe: async (query) => {
      if (query.includes('current_database()::text AS "database"')) { calls.push('identity'); return [{ ...s.who }]; }
      throw new Error('Stop mock catalog at first SQL call');
    },
    $executeRawUnsafe: async () => { calls.push('WRITE'); },
  };
  const db = { $transaction: async (f) => f(tx) };
  await assert.rejects(() => applyReviewedGrants(db, s, a, plan, ROOT, source), /Stop mock catalog/);
  assert.deepEqual(calls, ['identity', 'identity']); // no grant before same-transaction identity+catalog read
});
