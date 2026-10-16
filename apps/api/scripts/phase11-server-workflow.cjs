'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { reviewedPlan } = require('./phase11-runtime-privileges.cjs');
const { TARGET, identity, readCatalog, readCatalogInTx } = require('./phase11-server-catalog.cjs');
const { sourceState, checkUrl, assess, stableDigest, grantSql, planSummary } =
  require('./phase11-server-policy.cjs');

const ROOT = path.resolve(__dirname, '../../..');
class SafetyStop extends Error {}
const missingCount = (a) => a.missing.schema.length + a.missing.tables.length + a.missing.sequences.length;
function ensureSafe(a, source) {
  if (source.dirty.length) throw new SafetyStop('Phase 11/API source paths have local changes; review them without discarding unrelated work');
  if (a.issues.length) throw new SafetyStop('Inspection has blockers; resolve them and rerun inspect before applying');
}
async function runtimeIdentity(db) {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return identity(tx, TARGET.runtime);
  }, { timeout: 15000, maxWait: 5000 });
}
async function ownerIdentity(db) {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return identity(tx, TARGET.owner);
  }, { timeout: 15000, maxWait: 5000 });
}
async function runtimeReadProbe(db, plan) {
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await identity(tx, TARGET.runtime);
    // Zero-row reads actually parse/authorize every reviewed application table;
    // no customer/financial rows are returned, logged, modified or copied.
    for (const table of Object.keys(plan)) {
      const identifier = `"${table.replace(/"/g, '""')}"`;
      await tx.$queryRawUnsafe(`SELECT * FROM public.${identifier} LIMIT 0`);
    }
    // Exercise the same Prisma engine and relational read shapes used by API
    // authorization and ordinary operations, not just pg_catalog ACL checks.
    const role = await tx.role.findUnique({ where: { code: 'ADMIN' },
      select: { id: true, permissions: { take: 1,
        select: { permission: { select: { code: true } } } },
      users: { take: 1, select: { user: { select: { id: true } } } } } });
    const primary = await tx.user.findFirst({ where: { isPrimaryAdmin: true, deletedAt: null },
      select: { id: true } });
    const permission = await tx.permission.findUnique({ where: { code: 'audit:read' }, select: { id: true } });
    if (!role || !primary || !permission) throw new SafetyStop('Core role, primary administrator or audit:read missing');
    await tx.cargo.findFirst({ select: { id: true } });
    await tx.auditLog.findFirst({ select: { id: true } });
    await tx.notificationRule.findFirst({ select: { id: true } });
  }, { timeout: 90000, maxWait: 10000 });
}
function commandOnPath(name) {
  return (process.env.PATH || '').split(path.delimiter).some((dir) => {
    try { fs.accessSync(path.join(dir, name), fs.constants.X_OK); return true; }
    catch { return false; }
  });
}
function runChild(args, databaseUrl, timeout) {
  // The URL is passed ONLY through the child environment, never argv or logs.
  const { RUNTIME_DATABASE_URL: _runtimeUrl, MIGRATOR_DATABASE_URL: _migratorUrl,
    ...childEnvironment } = process.env;
  const binary = commandOnPath('pnpm') ? 'pnpm' : 'corepack';
  const cli = binary === 'pnpm' ? ['exec', ...args] : ['pnpm', 'exec', ...args];
  const result = spawnSync(binary, cli, {
    cwd: ROOT, env: { ...childEnvironment, DATABASE_URL: databaseUrl,
      PHASE11_EXPECTED_DB: TARGET.database, PRISMA_HIDE_UPDATE_MESSAGE: 'true' },
    encoding: 'utf8', timeout, maxBuffer: 128 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    throw new SafetyStop(`${args[0] === 'prisma' ? 'Reviewed migration' : 'Incremental permission seed'} failed; child output withheld to protect credentials. Inspect protected server logs`);
  }
}
async function applyReviewedGrants(db, previous, previousAssessment, plan, root, source,
  passwordAttested = false, hbaAttested = false) {
  const sql = grantSql(previousAssessment.missing);
  if (!sql.length) return 0; // no duplicate audit event on a fully-granted DB
  await db.$transaction(async (tx) => {
    await identity(tx, TARGET.owner); // independently checked in same transaction
    const live = await readCatalogInTx(tx);
    if (stableDigest(live, plan, source, true) !== stableDigest(previous, plan, source, true)) {
      throw new SafetyStop('Catalog changed before grants; rerun read-only inspect for a new approval');
    }
    const before = assess(live, plan, root, true, passwordAttested, hbaAttested);
    ensureSafe(before, source);
    for (const statement of sql) {
      await identity(tx, TARGET.owner); // guard EVERY catalog write
      await tx.$executeRawUnsafe(statement);
    }
    const after = assess(await readCatalogInTx(tx), plan, root, true, passwordAttested, hbaAttested);
    if (after.issues.length || missingCount(after)) {
      throw new SafetyStop('Grant verification failed in transaction; no grants or audit event committed');
    }
    await identity(tx, TARGET.owner); // guard append-only audit INSERT too
    await tx.auditLog.create({ data: {
      actorId: 'system:phase11-deploy', actorEmail: 'system:phase11-deploy',
      action: 'security.runtime_db_roles.configure', entityType: 'AuditLog',
      entityId: 'database-roles', metadata: { database: TARGET.database,
        sourceCommit: source.head, runtimeRole: TARGET.runtime, exportRole: TARGET.exporter,
        tableGrants: previousAssessment.missing.tables.length,
        sequenceGrants: previousAssessment.missing.sequences.length,
        schemaGrants: previousAssessment.missing.schema.length },
    } });
  }, { timeout: 90000, maxWait: 10000 });
  return sql.length;
}

/** Purely ordered stage controller; inject DB operations for no-database tests. */
async function runStage(mode, d) {
  if (!['inspect','apply','verify'].includes(mode)) throw new SafetyStop('Use inspect, apply or verify');
  let snapshot = await d.read();
  let connected = false;
  if (d.runtime) {
    try { await d.runtimeCheck(); connected = true; } catch { connected = false; }
  }
  let result = assess(snapshot, d.plan, d.root, connected, d.passwordAttested, d.hbaAttested);
  const report = (step) => d.print(JSON.stringify({ stage: step,
    connection: snapshot.who, runtimeConnection: connected ? 'verified non-owner' : 'NOT verified',
    dbRoles: snapshot.roles.map((r) => ({ name: r.name, login: r.login, superuser: r.superuser,
      createRole: r.createRole, memberOfAnyRole: r.memberOfAnyRole, canCreateSchema: r.canCreateSchema })),
    publicTables: snapshot.tables.length, reviewedAppTables: Object.keys(d.plan).length,
    otherPublicTables: snapshot.tables.filter((t) => !d.plan[t.name]).map((t) => t.name),
    auditTriggers: snapshot.triggers.map(({ name, enabled }) => ({ name, enabled })),
    migrationJournalEntries: snapshot.history.length,
    sourceCommit: d.source.head, sourceDirtyPaths: d.source.dirty.length,
    ...planSummary(result) }, null, 2));
  if (mode === 'inspect') {
    report('1: read-only inspect');
    if (!result.issues.length && !d.source.dirty.length) {
      d.print(`REVIEWED_PLAN_SHA256=${stableDigest(snapshot, d.plan, d.source, connected)}`);
      return true;
    }
    d.print('INSPECTION_BLOCKED: no writes authorized. Resolve prerequisites and rerun Stage 1.');
    return false;
  }
  if (mode === 'verify' && (result.issues.length || d.source.dirty.length)) {
    report('3: final verification BLOCKED');
  }
  ensureSafe(result, d.source);
  if (mode === 'apply') {
    const actualDigest = stableDigest(snapshot, d.plan, d.source, connected);
    if (!/^[a-f0-9]{64}$/.test(d.approval || '') || d.approval !== actualDigest) {
      throw new SafetyStop('Reviewed plan approval hash missing/stale; run Stage 1 again and review output');
    }
    if (d.backupVerified !== 'I_HAVE_TESTED_RESTORE') {
      throw new SafetyStop('Operator must confirm independently tested backup restore; no backup is verified by this script');
    }
    if (result.migration.pending.length) {
      await d.ownerCheck(); // guard CLI write; CLI gets explicit, target-validated owner URL
      const fresh = await d.read();
      if (stableDigest(fresh, d.plan, d.source, true) !== actualDigest) {
        throw new SafetyStop('Database changed immediately before migration; rerun inspect');
      }
      await d.migrate();
      snapshot = await d.read();
      result = assess(snapshot, d.plan, d.root, connected, d.passwordAttested, d.hbaAttested);
      ensureSafe(result, d.source);
      if (result.migration.pending.length) throw new SafetyStop('Reviewed migration still pending; do not retry blindly');
    }
    if (missingCount(result)) {
      await d.ownerCheck(); // guard grants before their transactional per-write guards
      await d.grant(snapshot, result);
      snapshot = await d.read();
      result = assess(snapshot, d.plan, d.root, connected, d.passwordAttested, d.hbaAttested);
      ensureSafe(result, d.source);
      if (missingCount(result)) throw new SafetyStop('Operational grants still missing; do not retry blindly');
    }
    if (!result.seed.complete) {
      await d.ownerCheck(); // seed CLI also guards owner/DB/triggers inside transaction
      await d.seed();
      snapshot = await d.read();
      result = assess(snapshot, d.plan, d.root, connected, d.passwordAttested, d.hbaAttested);
      ensureSafe(result, d.source);
      if (!result.seed.complete) throw new SafetyStop('Incremental seed incomplete; inspect before retrying');
    }
    // Non-owner, read-only real Prisma operations on the same existing DB.
    await d.probe();
    report('2: reviewed changes applied and read-only runtime probes passed');
    d.print('STAGE_2_COMPLETE: no API connection switch performed. Run Stage 3 verify.');
    return true;
  }
  if (result.migration.pending.length || missingCount(result) || !result.seed.complete) {
    report('3: final verification BLOCKED');
    throw new SafetyStop('Migration/grants/seed incomplete; do not switch API connection');
  }
  await d.probe();
  report('3: independent final read-only verification');
  d.print('READY_FOR_API_SWITCH: use DATABASE_URL with verified non-owner role; switch/restart and live UI checks remain operator actions.');
  return true;
}

async function main() {
  const mode = process.argv[2];
  if (!['inspect','apply','verify'].includes(mode) || process.argv.length !== 3) {
    throw new SafetyStop('Usage: node apps/api/scripts/phase11-server-workflow.cjs inspect|apply|verify');
  }
  require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });
  const ownerUrl = checkUrl(process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL, TARGET.owner);
  let runtimeUrl;
  if (process.env.RUNTIME_DATABASE_URL) runtimeUrl = checkUrl(process.env.RUNTIME_DATABASE_URL, TARGET.runtime);
  const plan = reviewedPlan(ROOT);
  const source = sourceState(ROOT);
  const { PrismaClient } = require('@prisma/client');
  const owner = new PrismaClient({ datasources: { db: { url: ownerUrl } }, log: [] });
  const runtime = runtimeUrl ? new PrismaClient({ datasources: { db: { url: runtimeUrl } }, log: [] }) : null;
  try {
    const ok = await runStage(mode, { root: ROOT, plan, source, runtime,
      read: () => readCatalog(owner), runtimeCheck: () => runtimeIdentity(runtime),
      ownerCheck: () => ownerIdentity(owner),
      grant: (s, a) => applyReviewedGrants(owner, s, a, plan, ROOT, source,
        process.env.PHASE11_RUNTIME_PASSWORD_ATTESTED === 'I_HAVE_VERIFIED_ROLE_PASSWORD',
        process.env.PHASE11_RUNTIME_HBA_ATTESTED === 'I_HAVE_VERIFIED_PASSWORD_AUTH'),
      migrate: () => runChild(['prisma','migrate','deploy'], ownerUrl, 180000),
      seed: () => runChild(['tsx','apps/api/scripts/seed-phase11-permissions.ts'], ownerUrl, 120000),
      probe: () => runtimeReadProbe(runtime, plan),
      approval: process.env.PHASE11_APPROVE, backupVerified: process.env.PHASE11_BACKUP_RESTORE_VERIFIED,
      passwordAttested: process.env.PHASE11_RUNTIME_PASSWORD_ATTESTED === 'I_HAVE_VERIFIED_ROLE_PASSWORD',
      hbaAttested: process.env.PHASE11_RUNTIME_HBA_ATTESTED === 'I_HAVE_VERIFIED_PASSWORD_AUTH',
      print: console.log });
    if (!ok) process.exitCode = 2;
  } finally {
    await owner.$disconnect();
    if (runtime) await runtime.$disconnect();
  }
}
if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof SafetyStop ? e.message :
      'Phase 11 workflow stopped: database/engine/source error (details omitted to protect secrets)');
    process.exitCode = 1;
  });
}
module.exports = { SafetyStop, ensureSafe, runStage, applyReviewedGrants,
  runtimeReadProbe, runtimeIdentity, ownerIdentity };
