import { createHash, randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

// This entry point is the DB stage of pnpm phase12:apply / phase12:test.
// Its owner URL comes ONLY through a private child environment. Raw driver,
// Docker, Prisma and subprocess messages (which may contain URLs) are hidden.
const { checkUrl, assess, digest, reviewedApply, DbStop, TARGET } = require('../../../scripts/phase12/db-policy.cjs');
const { inspectContainer, inspectSession, dockerQuery, journalGrantSql } =
  require('../../../scripts/phase12/server-target.cjs');
const ROOT = resolve(__dirname, '../../..');
const migrationRoot = join(ROOT, 'prisma/migrations');
const STAGES = ['inspect', 'apply', 'verify'];
const REVIEWED = ['prisma/migrations', 'prisma/schema.prisma',
  'prisma/seed/phase12-permissions.ts', 'apps/api/scripts/phase12-db-deploy.ts',
  'apps/api/scripts/seed-phase12-permissions.ts', 'apps/api/scripts/test-phase12-catalog.cjs',
  'apps/api/scripts/test-phase12-http.ts', 'apps/api/package.json', 'apps/api/src/modules/archive',
  'apps/web/src/app/[locale]/(dashboard)/archive', 'apps/web/src/app/api/v1/[...path]/route.ts',
  'apps/web/src/lib/api/client.ts',
  'apps/web/scripts/test-phase12-policy-client.ts', 'apps/web/package.json',
  'apps/web/next.config.mjs', 'apps/web/tsconfig.json', 'scripts/phase12',
  'package.json', 'pnpm-lock.yaml'];
function git(args: string[]) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
  if (result.status !== 0) throw new DbStop('Reviewed Phase 12 Git source inspection failed');
  return result.stdout.trim();
}
function source() {
  if (git(['branch', '--show-current']) !== 'arena/be9b4e5b-duna') {
    throw new DbStop('Expected approved Phase 12 branch; do not switch or overwrite unrelated work');
  }
  const head = git(['rev-parse', 'HEAD']);
  const changed = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', ...REVIEWED],
    { cwd: ROOT, stdio: 'ignore', timeout: 10000 });
  if (changed.status !== 0 || git(['ls-files', '--others', '--exclude-standard', '--', ...REVIEWED])) {
    throw new DbStop('Reviewed Phase 12 schema/migration/security files differ from HEAD; unrelated changes elsewhere are allowed');
  }
  return head;
}
function localMigrations() {
  return readdirSync(migrationRoot, { withFileTypes: true }).filter((d) => d.isDirectory())
    .map((d) => ({ name: d.name, file: join(migrationRoot, d.name, 'migration.sql') }))
    .map(({ name, file }) => ({ name, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function child(args: string[], label: string, timeout = 240000) {
  // Prisma migrate and the narrow seed need only the shipping-owner DATABASE_URL.
  // Do not expose the restricted runtime credential or backup attestation to them.
  const { RUNTIME_DATABASE_URL: _runtime, MIGRATOR_DATABASE_URL: _migrator,
    PHASE12_PRECHANGE_BACKUP_ATTESTED: _backupApproval,
    PHASE12_INSPECTION_DIGEST: _inspection,
    PHASE12_MIGRATION_APPROVAL: _migrationApproval, ...childEnv } = process.env;
  const result = spawnSync('pnpm', ['exec', ...args], {
    cwd: ROOT, env: { ...childEnv, PHASE12_EXPECTED_DB: 'duna_seed_test',
      PRISMA_HIDE_UPDATE_MESSAGE: 'true' },
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout, maxBuffer: 256 * 1024,
  });
  if (result.status !== 0 || result.error) {
    throw new DbStop(`${label} failed using the owner connection; no raw Prisma/credential output emitted`);
  }
}
type Who = { database: string; login: string; session: string; server: string | null;
  port: number; version: number; owner: string; auditTriggers: number;
  lettersOwner: string; permissionsOwner: string; grantsOwner: string;
  journalOwner: string | null; retentionExists: boolean; retentionTriggers: number;
  letterGuard: number; letterColumn: boolean; letterColumnPresent: boolean; journalRights: {
    ownerSelect: boolean; ownerInsert: boolean; ownerUpdate: boolean;
    runtimeSelect: boolean; runtimeInsert: boolean; runtimeUpdate: boolean; runtimeDelete: boolean;
  }; policyColumns: unknown[]; policyConstraints: unknown[];
  phase12Functions: unknown[]; phase12Triggers: unknown[]; policyRows: number;
  archiveCriteria: number; deleteThresholds: number };
async function snapshot(db: PrismaClient, container: ReturnType<typeof inspectContainer>) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const nonce = `phase12-${randomBytes(12).toString('hex')}`;
    await tx.$queryRaw`SELECT set_config('application_name', ${nonce}, true)`;
    const [session] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid()::int AS pid`;
    const [who] = await tx.$queryRaw<Array<Who>>`
      SELECT current_database()::text AS database, current_user::text AS login,
        session_user::text AS session, inet_server_addr()::text AS server,
        inet_server_port()::int AS port, current_setting('server_version_num')::int AS version,
        pg_get_userbyid(a.relowner)::text AS owner,
        (SELECT count(*)::int FROM pg_trigger WHERE tgrelid = a.oid AND tgenabled = 'A'
          AND tgname IN ('phase11_audit_no_update_delete','phase11_audit_no_truncate')) AS "auditTriggers",
        (SELECT pg_get_userbyid(relowner)::text FROM pg_class WHERE oid = 'public."letters"'::regclass) AS "lettersOwner",
        (SELECT pg_get_userbyid(relowner)::text FROM pg_class WHERE oid = 'public."Permission"'::regclass) AS "permissionsOwner",
        (SELECT pg_get_userbyid(relowner)::text FROM pg_class WHERE oid = 'public."RolePermission"'::regclass) AS "grantsOwner",
        (SELECT pg_get_userbyid(relowner)::text FROM pg_class WHERE oid = to_regclass('public._prisma_migrations')) AS "journalOwner",
        to_regclass('public."RetentionPolicy"') IS NOT NULL AS "retentionExists",
        (SELECT count(*)::int FROM pg_trigger WHERE tgrelid = to_regclass('public."RetentionPolicy"')
          AND tgenabled = 'A' AND tgname IN ('phase12_retention_no_reduction','phase12_retention_no_truncate')) AS "retentionTriggers",
        (SELECT count(*)::int FROM pg_trigger WHERE tgrelid = 'public."letters"'::regclass
          AND tgenabled = 'A' AND tgname = 'phase12_letter_no_archive_delete_bypass') AS "letterGuard",
        EXISTS (SELECT 1 FROM pg_attribute a2 WHERE a2.attrelid = 'public."letters"'::regclass
          AND a2.attname = 'archivedFromStatus' AND NOT a2.attisdropped AND NOT a2.attnotnull
          AND a2.atttypid = 'public."LetterStatus"'::regtype) AS "letterColumn",
        EXISTS (SELECT 1 FROM pg_attribute a2 WHERE a2.attrelid = 'public."letters"'::regclass
          AND a2.attname = 'archivedFromStatus' AND NOT a2.attisdropped) AS "letterColumnPresent"
      FROM pg_class a WHERE a.oid = 'public."AuditLog"'::regclass`;
    if (!who || !session || who.database !== 'duna_seed_test' || who.login !== 'shipping' ||
        who.session !== 'shipping' || who.port !== 5432 || !who.journalOwner) {
      throw new DbStop('Owner session or Prisma migration journal does not match approved target');
    }
    // A second, password-free container-local PostgreSQL 16 client sees this
    // exact live host backend PID and nonce. Docker port mapping alone is not proof.
    const observed = inspectSession(container, session.pid, nonce);
    if (observed.journalOwner !== who.journalOwner) {
      throw new DbStop('Container and owner session disagree about migration journal ownership');
    }
    const [journalRights] = await tx.$queryRaw<Array<Who['journalRights']>>`
      SELECT has_table_privilege('shipping','public._prisma_migrations','SELECT') AS "ownerSelect",
        has_table_privilege('shipping','public._prisma_migrations','INSERT') AS "ownerInsert",
        has_table_privilege('shipping','public._prisma_migrations','UPDATE') AS "ownerUpdate",
        has_table_privilege('shipping_runtime_p11','public._prisma_migrations','SELECT') AS "runtimeSelect",
        has_table_privilege('shipping_runtime_p11','public._prisma_migrations','INSERT') AS "runtimeInsert",
        has_table_privilege('shipping_runtime_p11','public._prisma_migrations','UPDATE') AS "runtimeUpdate",
        has_table_privilege('shipping_runtime_p11','public._prisma_migrations','DELETE') AS "runtimeDelete"`;
    who.journalRights = journalRights;
    const [runtime] = await tx.$queryRaw<Array<{ name: string; login: boolean; superuser: boolean;
      createRole: boolean; createDb: boolean; ownerMember: boolean; createOnDb: boolean;
      connect: boolean }>>`
      SELECT r.rolname::text AS name, r.rolcanlogin AS login, r.rolsuper AS superuser,
        r.rolcreaterole AS "createRole", r.rolcreatedb AS "createDb",
        pg_has_role(r.oid, owner.oid, 'MEMBER') AS "ownerMember",
        has_database_privilege(r.oid, current_database(), 'CREATE') AS "createOnDb",
        has_database_privilege(r.oid, current_database(), 'CONNECT') AS connect
      FROM pg_roles r CROSS JOIN pg_roles owner WHERE r.rolname = 'shipping_runtime_p11'
        AND owner.rolname = 'shipping'`;
    const ownerHistory = journalRights.ownerSelect ? await tx.$queryRaw<Array<{
      name: string; checksum: string; finished: boolean; rolledback: boolean }>>`
      SELECT migration_name::text AS name, checksum::text AS checksum,
        finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolledback
      FROM public._prisma_migrations ORDER BY started_at,id` : null;
    if (ownerHistory && JSON.stringify(ownerHistory) !== JSON.stringify(observed.history)) {
      throw new DbStop('Host and container migration histories disagree');
    }
    const permissions = await tx.$queryRaw<Array<{ code: string; module: string; action: string }>>`
      SELECT code::text, module::text, action::text FROM public."Permission"
      WHERE code IN ('archive:create','archive:reopen','archive:delete',
        'retention:read','retention:manage','backup:manage','backup:restore') ORDER BY code`;
    const [{ reservedGrants }] = await tx.$queryRaw<Array<{ reservedGrants: number }>>`
      SELECT count(*)::int AS "reservedGrants" FROM public."RolePermission" rp
      JOIN public."Permission" p ON p.id = rp."permissionId"
      WHERE p.code IN ('backup:manage','backup:restore','archive:delete')`;
    const rights = who.retentionExists ? (await tx.$queryRaw<Array<{ select: boolean; insert: boolean;
      update: boolean; delete: boolean; truncate: boolean; exporterSelect: boolean }>>`
      SELECT has_table_privilege('shipping_runtime_p11','public."RetentionPolicy"','SELECT') AS "select",
        has_table_privilege('shipping_runtime_p11','public."RetentionPolicy"','INSERT') AS "insert",
        has_table_privilege('shipping_runtime_p11','public."RetentionPolicy"','UPDATE') AS "update",
        has_table_privilege('shipping_runtime_p11','public."RetentionPolicy"','DELETE') AS "delete",
        has_table_privilege('shipping_runtime_p11','public."RetentionPolicy"','TRUNCATE') AS "truncate",
        has_table_privilege('shipping_audit_export_p11','public."RetentionPolicy"','SELECT') AS "exporterSelect"`)[0] : null;
    who.policyColumns = await tx.$queryRaw`
      SELECT a.attname::text AS name, a.atttypid::regtype::text AS type,
        a.atttypmod::int AS modifier, a.attnotnull AS required
      FROM pg_attribute a WHERE a.attrelid = to_regclass('public."RetentionPolicy"')
        AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`;
    who.policyConstraints = await tx.$queryRaw`
      SELECT conname::text AS name, convalidated AS validated FROM pg_constraint
      WHERE conrelid = to_regclass('public."RetentionPolicy"') ORDER BY conname`;
    who.phase12Functions = await tx.$queryRaw`
      SELECT p.proname::text AS name, pg_get_userbyid(p.proowner)::text AS owner,
        p.prosecdef AS "securityDefiner", p.proconfig AS config,
        pg_get_functiondef(p.oid)::text AS definition FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
        AND p.proname LIKE 'phase12_%' ORDER BY p.proname`;
    who.phase12Triggers = await tx.$queryRaw`
      SELECT t.tgname::text AS name, c.relname::text AS "table", t.tgenabled::text AS enabled,
        t.tgisinternal AS internal, pg_get_triggerdef(t.oid)::text AS definition
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND t.tgname LIKE 'phase12_%' ORDER BY t.tgname`;
    const [counter] = who.retentionExists ? await tx.$queryRaw<Array<{
      policyRows: number; archiveCriteria: number; deleteThresholds: number }>>`
      SELECT count(*)::int AS "policyRows",
        count(*) FILTER (WHERE "archiveAfterDays" IS NOT NULL)::int AS "archiveCriteria",
        count(*) FILTER (WHERE "secureDeleteAfterDays" IS NOT NULL)::int AS "deleteThresholds"
      FROM public."RetentionPolicy"` : [{ policyRows: 0, archiveCriteria: 0, deleteThresholds: 0 }];
    who.policyRows = counter.policyRows;
    who.archiveCriteria = counter.archiveCriteria;
    who.deleteThresholds = counter.deleteThresholds;
    return { who, runtime, rights, history: observed.history, permissions, reservedGrants };
  }, { timeout: 90000, maxWait: 10000 });
}
async function grantJournal(db: PrismaClient, container: ReturnType<typeof inspectContainer>,
  previous: Awaited<ReturnType<typeof snapshot>>, local: ReturnType<typeof localMigrations>) {
  // This branch is reached ONLY if the owner lacks a journal grant and a
  // container DBA already read/validated the exact migration history. Runtime
  // receives NOTHING. A fresh correlated session is held during the grant.
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const nonce = `phase12-${randomBytes(12).toString('hex')}`;
    await tx.$queryRaw`SELECT set_config('application_name', ${nonce}, true)`;
    const [session] = await tx.$queryRaw<Array<{ pid: number; role: string }>>`
      SELECT pg_backend_pid()::int AS pid, current_user::text AS role`;
    if (session.role !== 'shipping') throw new DbStop('Owner session changed before journal grant');
    // A postgres-owned journal requires the existing postgres DBA identity to
    // grant table rights. Do not treat an unrelated socket reader as a grantor.
    const observed = inspectSession(container, session.pid, nonce, undefined, 'postgres');
    if (previous.who.journalOwner !== 'postgres' || observed.adminRole !== 'postgres' ||
        observed.journalOwner !== previous.who.journalOwner ||
        JSON.stringify(observed.history) !== JSON.stringify(previous.history)) {
      throw new DbStop('Journal owner/history changed before minimum owner-only grant');
    }
    assess(previous, local, 'apply'); // no unknown migration or partial schema before ANY grant
    const result = dockerQuery(journalGrantSql(session.pid, nonce, observed.journalOwner),
      container, undefined, observed.adminRole);
    if (result.role !== observed.adminRole) {
      throw new DbStop('Container DBA identity changed; re-inspect the journal before any migration');
    }
  }, { timeout: 90000, maxWait: 10000 });
}
function checkRuntimeUrl(url: string) {
  const runtime = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(runtime.protocol) ||
      runtime.hostname !== '127.0.0.1' || runtime.port !== '5432' ||
      runtime.pathname !== '/duna_seed_test' || !runtime.password ||
      decodeURIComponent(runtime.username) !== 'shipping_runtime_p11' ||
      (runtime.searchParams.get('schema') ?? 'public') !== 'public') {
    throw new DbStop('Existing runtime credential differs from approved role, host, port, database or schema');
  }
}
async function runtimeIdentityProbe(url: string) {
  checkRuntimeUrl(url);
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const [who] = await tx.$queryRaw<Array<{ database: string; role: string;
        port: number; version: number; journalSelect: boolean; journalInsert: boolean;
        journalUpdate: boolean }>>`
        SELECT current_database()::text AS database, current_user::text AS role,
          inet_server_port()::int AS port, current_setting('server_version_num')::int AS version,
          has_table_privilege(current_user,'public._prisma_migrations','SELECT') AS "journalSelect",
          has_table_privilege(current_user,'public._prisma_migrations','INSERT') AS "journalInsert",
          has_table_privilege(current_user,'public._prisma_migrations','UPDATE') AS "journalUpdate"`;
      if (!who || who.database !== 'duna_seed_test' || who.role !== 'shipping_runtime_p11' ||
          who.port !== 5432 || who.version < 160000 || who.version >= 170000 ||
          who.journalSelect || who.journalInsert || who.journalUpdate) {
        throw new DbStop('Pre-change runtime connection/PG16/least-privilege identity differs');
      }
      await tx.auditLog.findFirst({ select: { id: true }, take: 0 });
    }, { timeout: 30000, maxWait: 10000 });
  } finally { await db.$disconnect(); }
}
async function runtimeProbe(url: string) {
  checkRuntimeUrl(url);
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const [who] = await tx.$queryRaw<Array<{ database: string; role: string; port: number;
        version: number; journalSelect: boolean; journalInsert: boolean; journalUpdate: boolean;
        retentionSelect: boolean; retentionInsert: boolean; retentionUpdate: boolean;
        retentionDelete: boolean; retentionTruncate: boolean }>>`
        SELECT current_database()::text AS database, current_user::text AS role,
          inet_server_port()::int AS port, current_setting('server_version_num')::int AS version,
          has_table_privilege(current_user,'public._prisma_migrations','SELECT') AS "journalSelect",
          has_table_privilege(current_user,'public._prisma_migrations','INSERT') AS "journalInsert",
          has_table_privilege(current_user,'public._prisma_migrations','UPDATE') AS "journalUpdate",
          has_table_privilege(current_user,'public."RetentionPolicy"','SELECT') AS "retentionSelect",
          has_table_privilege(current_user,'public."RetentionPolicy"','INSERT') AS "retentionInsert",
          has_table_privilege(current_user,'public."RetentionPolicy"','UPDATE') AS "retentionUpdate",
          has_table_privilege(current_user,'public."RetentionPolicy"','DELETE') AS "retentionDelete",
          has_table_privilege(current_user,'public."RetentionPolicy"','TRUNCATE') AS "retentionTruncate"`;
      if (!who || who.database !== 'duna_seed_test' || who.role !== 'shipping_runtime_p11' ||
          who.port !== 5432 || who.version < 160000 || who.version >= 170000 ||
          who.journalSelect || who.journalInsert || who.journalUpdate ||
          !who.retentionSelect || !who.retentionInsert || !who.retentionUpdate ||
          who.retentionDelete || who.retentionTruncate) {
        throw new DbStop('Read-only runtime identity/ACL probe failed; no privilege escalation attempted');
      }
      await tx.retentionPolicy.findFirst({ select: { scope: true } });
      await tx.letter.findFirst({ select: { id: true, archivedFromStatus: true }, take: 0 });
      await tx.auditLog.findFirst({ select: { id: true }, take: 0 });
    }, { timeout: 30000, maxWait: 10000 });
  } finally { await db.$disconnect(); }
}
async function main() {
  const mode = process.argv[2];
  if (!STAGES.includes(mode) || process.argv.length !== 3) throw new DbStop('Use inspect, apply or verify');
  if (process.env.PHASE12_EXPECTED_DB !== 'duna_seed_test') throw new DbStop('Approved target assertion missing');
  checkUrl(process.env.DATABASE_URL);
  if (!process.env.RUNTIME_DATABASE_URL) throw new DbStop('Existing runtime credential missing');
  const head = source();
  const local = localMigrations();
  const container = inspectContainer();
  const db = new PrismaClient();
  try {
    let current = await snapshot(db, container);
    let state = assess(current, local, mode);
    try { await runtimeIdentityProbe(process.env.RUNTIME_DATABASE_URL); }
    catch (error: unknown) {
      if (error instanceof Error && error instanceof DbStop) throw error;
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      throw new DbStop(code === 'P1000' ?
        'Restricted runtime credential failed authentication; review prior completed stages' :
        'Restricted runtime read-only connection failed; review prior completed stages');
    }
    if (mode === 'inspect') {
      console.log(`PHASE12_DB_INSPECT_PASS: PG16 erp-postgres correlation; journal owner=${current.who.journalOwner}; pending Phase 12=${state.pending.length}; owner journal grant needed=${state.journalNeedsGrant}; permissions=${state.permissionCodes}/7; digest=${digest(current, local, head)}`);
      return;
    }
    if (mode === 'apply') {
      if (process.env.PHASE12_MIGRATION_APPROVAL !== 'I_APPROVE_ADDITIVE_PHASE12_MIGRATION' ||
          ((state.journalNeedsGrant || state.pending.length || state.permissionCodes === 0) &&
            process.env.PHASE12_PRECHANGE_BACKUP_ATTESTED !== 'I_HAVE_RESTORED_PRECHANGE_BACKUP')) {
        throw new DbStop('Explicit additive migration and existing recoverable pre-change backup attestation required before any DB write');
      }
      // The operator approved the inspect plan, not a future plan inferred from
      // a stale pending/permission count. Re-read under the verified owner and
      // runtime connections before the first journal grant, migration or seed.
      if (!process.env.PHASE12_INSPECTION_DIGEST) {
        throw new DbStop('Reviewed Phase 12 inspection digest required before any DB write');
      }
      current = await snapshot(db, container);
      state = reviewedApply(current, local, head, process.env.PHASE12_INSPECTION_DIGEST);
      if (state.journalNeedsGrant) {
        await grantJournal(db, container, current, local);
        current = await snapshot(db, container);
        state = assess(current, local, 'apply');
        if (state.journalNeedsGrant) throw new DbStop('Minimum shipping-owner journal rights were not established');
        console.log('PHASE12_JOURNAL_PASS: minimum SELECT/INSERT/UPDATE granted only to shipping; runtime unchanged');
      } else {
        console.log(`PHASE12_JOURNAL_PASS: journal owner=${current.who.journalOwner}; shipping can migrate, runtime cannot`);
      }
      if (state.pending.length) {
        if (state.pending.join(',') !== TARGET) throw new DbStop('Only the reviewed Phase 12 migration may be pending');
        child(['prisma','migrate','deploy'], 'Reviewed Phase 12 migration');
        current = await snapshot(db, container);
        state = assess(current, local, 'apply');
        if (!state.migrationApplied) throw new DbStop('Migration did not finish with the reviewed checksum');
        console.log('PHASE12_MIGRATION_PASS: additive migration applied exactly once');
      } else console.log('PHASE12_MIGRATION_PASS: reviewed migration already applied; no-op');
      if (state.permissionCodes === 0) {
        child(['tsx','apps/api/scripts/seed-phase12-permissions.ts'], 'Incremental Phase 12 permission seed');
        console.log('PHASE12_SEED_PASS: incremental seven-code seed; no demo seed or default grants');
      } else console.log('PHASE12_SEED_PASS: seven permissions already present; no-op');
    }
    current = await snapshot(db, container);
    state = assess(current, local, 'verify');
    if (state.pending.length || state.journalNeedsGrant) throw new DbStop('Migration or journal still pending after verification');
    try { await runtimeProbe(process.env.RUNTIME_DATABASE_URL); }
    catch (error: unknown) {
      if (error instanceof DbStop) throw error;
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      throw new DbStop(code === 'P1000' ?
        'Restricted runtime credential failed authentication; existing API DATABASE_URL was not changed' :
        'Restricted runtime read-only Prisma probe failed; inspect runtime role/ACL privately');
    }
    child(['prisma','migrate','status'], 'Owner-only Prisma migration status', 120000);
    console.log(`PHASE12_DB_VERIFY_PASS: checksum/history, RetentionPolicy structure, three protective triggers, seven Phase 12 permission codes (reserved actions ungranted), runtime read-only identity/privileges; configured archive criteria=${current.who.archiveCriteria}; configured deletion thresholds=${current.who.deleteThresholds}. No policy/schedule set by this command.`);
  } finally { await db.$disconnect(); }
}
main().catch((error: unknown) => {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const meta = error && typeof error === 'object' && 'meta' in error ? error.meta : null;
  const pgCode = meta && typeof meta === 'object' && 'code' in meta ? String(meta.code) : '';
  const cause = error instanceof Error && error instanceof DbStop ? error.message :
    code === 'P1000' ? 'shipping-owner authentication rejected; review existing migrator credential privately' :
    code === 'P1010' || pgCode === '42501' ? 'shipping-owner relation/catalog permission denied; inspect approved migration journal ownership/ACL' :
    code === 'P2010' ? 'approved owner catalog query failed; inspect schema privately without logging credentials' :
    code === 'P1001' ? 'approved PostgreSQL host/port unreachable; review prior completed stages before rerun' :
    'Protected database/Prisma operation failed in apps/api/scripts/phase12-db-deploy.ts; inspect privately without logging credentials';
  console.error('PHASE12_DB_FAIL:', cause);
  process.exitCode = 1;
});
