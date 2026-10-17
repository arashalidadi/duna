import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

// Source-reviewed policy has no Prisma dependency and is independently unit tested.
const { checkUrl, assess, digest, DbStop, TARGET } = require('../../../scripts/phase12/db-policy.cjs');
const ROOT = resolve(__dirname, '../../..');
const STAGES = ['inspect', 'apply', 'verify'];
const migrationRoot = join(ROOT, 'prisma/migrations');
function localMigrations() {
  return readdirSync(migrationRoot, { withFileTypes: true }).filter((d) => d.isDirectory())
    .map((d) => ({ name: d.name, file: join(migrationRoot, d.name, 'migration.sql') }))
    .map(({ name, file }) => ({ name, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function git(...args: string[]) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 });
  if (result.status !== 0) throw new DbStop('Cannot verify the exact clean source checkout');
  return result.stdout.trim();
}
function source() {
  const branch = git('branch', '--show-current');
  const head = git('rev-parse', 'HEAD');
  if (branch !== 'arena/be9b4e5b-duna' || git('status', '--porcelain', '--untracked-files=all') ||
      process.env.PHASE12_DEPLOY_COMMIT !== head) {
    throw new DbStop('Wrong branch/commit or dirty checkout; preserve unrelated work and stop');
  }
  return head;
}
function child(args: string[]) {
  // The SAME already-inspected URL goes only through the child environment.
  // No URL, password, SQL result, or raw child output is written to logs.
  const result = spawnSync('corepack', ['pnpm', 'exec', ...args], {
    cwd: ROOT, env: { ...process.env, PHASE12_EXPECTED_DB: 'duna_seed_test' },
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000,
    maxBuffer: 128 * 1024,
  });
  if (result.status !== 0 || result.error) throw new DbStop(`${args[0]} stage failed; inspect protected owner-host logs; do not retry blindly`);
}
async function snapshot(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const [who] = await tx.$queryRaw<Array<{ database: string; login: string; session: string;
      server: string | null; port: number; version: number; owner: string; auditTriggers: number;
      retentionExists: boolean; retentionTriggers: number; letterGuard: number }>>`
      SELECT current_database()::text AS database, current_user::text AS login,
        session_user::text AS session, inet_server_addr()::text AS server,
        inet_server_port()::int AS port, current_setting('server_version_num')::int AS version,
        pg_get_userbyid(c.relowner)::text AS owner,
        (SELECT count(*)::int FROM pg_trigger WHERE tgrelid = c.oid AND tgenabled = 'A'
          AND tgname IN ('phase11_audit_no_update_delete', 'phase11_audit_no_truncate')) AS "auditTriggers",
        to_regclass('public."RetentionPolicy"') IS NOT NULL AS "retentionExists",
        (SELECT count(*)::int FROM pg_trigger WHERE tgrelid = to_regclass('public."RetentionPolicy"')
          AND tgenabled = 'A' AND tgname IN
          ('phase12_retention_no_reduction', 'phase12_retention_no_truncate')) AS "retentionTriggers",
        (SELECT count(*)::int FROM pg_trigger WHERE tgrelid = 'public."letters"'::regclass
          AND tgenabled = 'A' AND tgname = 'phase12_letter_no_archive_delete_bypass') AS "letterGuard"
      FROM pg_class c WHERE c.oid = 'public."AuditLog"'::regclass`;
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
    const history = await tx.$queryRaw<Array<{ name: string; checksum: string;
      finished: boolean; rolledback: boolean }>>`
      SELECT migration_name::text AS name, checksum::text AS checksum,
        finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolledback
      FROM public._prisma_migrations ORDER BY started_at, id`;
    const permissions = await tx.$queryRaw<Array<{ code: string; module: string; action: string }>>`
      SELECT code::text, module::text, action::text FROM public."Permission"
      WHERE code IN ('archive:create','archive:reopen','archive:delete',
        'retention:read','retention:manage','backup:manage','backup:restore') ORDER BY code`;
    const [{ reservedGrants }] = await tx.$queryRaw<Array<{ reservedGrants: number }>>`
      SELECT count(*)::int AS "reservedGrants" FROM public."RolePermission" rp
      JOIN public."Role" r ON r.id = rp."roleId"
      JOIN public."Permission" p ON p.id = rp."permissionId"
      WHERE r.code = 'ADMIN' AND r."deletedAt" IS NULL
        AND p.code IN ('backup:manage', 'backup:restore', 'archive:delete')`;
    const rights = who?.retentionExists ? (await tx.$queryRaw<Array<{ select: boolean; insert: boolean;
      update: boolean; delete: boolean; truncate: boolean; exporterSelect: boolean }>>`
      SELECT has_table_privilege('shipping_runtime_p11', 'public."RetentionPolicy"', 'SELECT') AS "select",
        has_table_privilege('shipping_runtime_p11', 'public."RetentionPolicy"', 'INSERT') AS "insert",
        has_table_privilege('shipping_runtime_p11', 'public."RetentionPolicy"', 'UPDATE') AS "update",
        has_table_privilege('shipping_runtime_p11', 'public."RetentionPolicy"', 'DELETE') AS "delete",
        has_table_privilege('shipping_runtime_p11', 'public."RetentionPolicy"', 'TRUNCATE') AS "truncate",
        has_table_privilege('shipping_audit_export_p11', 'public."RetentionPolicy"', 'SELECT') AS "exporterSelect"`)[0] : null;
    return { who, runtime, rights, history, permissions, reservedGrants };
  }, { timeout: 30000, maxWait: 10000 });
}
async function runtimeProbe(url: string) {
  checkUrl(process.env.DATABASE_URL);
  const runtime = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(runtime.protocol) ||
      runtime.hostname !== '127.0.0.1' || runtime.port !== '5432' ||
      runtime.pathname !== '/duna_seed_test' ||
      decodeURIComponent(runtime.username) !== 'shipping_runtime_p11') {
    throw new DbStop('Explicit non-owner runtime URL differs from the approved target');
  }
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const [who] = await tx.$queryRaw<Array<{ database: string; role: string; port: number }>>`
        SELECT current_database()::text AS database, current_user::text AS role,
          inet_server_port()::int AS port`;
      if (who?.database !== 'duna_seed_test' || who.role !== 'shipping_runtime_p11' || who.port !== 5432) {
        throw new DbStop('Actual runtime session differs from approved database and role');
      }
      await tx.retentionPolicy.findFirst({ select: { scope: true } });
      await tx.auditLog.findFirst({ select: { id: true } });
    });
  } finally { await db.$disconnect(); }
}
async function main() {
  const mode = process.argv[2];
  if (!STAGES.includes(mode) || process.argv.length !== 3) throw new DbStop('Use inspect, apply or verify');
  if (process.env.PHASE12_EXPECTED_DB !== 'duna_seed_test') throw new DbStop('Explicit approved database assertion missing');
  checkUrl(process.env.DATABASE_URL);
  const head = source();
  const local = localMigrations();
  const db = new PrismaClient();
  try {
    let current = await snapshot(db);
    let state = assess(current, local, mode);
    if (mode === 'inspect') {
      console.log(JSON.stringify({ stage: 'READ_ONLY_INSPECT', sourceCommit: head,
        database: current.who.database, role: current.who.login, pgMajor: 16,
        runtime: state.runtime, pending: state.pending, permissionCodes: state.permissionCodes }, null, 2));
      console.log(`PHASE12_REVIEWED_PLAN_SHA256=${digest(current, local, head)}`);
      return;
    }
    if (mode === 'apply') {
      if (process.env.PHASE12_MIGRATION_APPROVAL !== 'I_APPROVE_ADDITIVE_PHASE12_MIGRATION' ||
          process.env.PHASE12_PRECHANGE_BACKUP_ATTESTED !== 'I_HAVE_RESTORED_PRECHANGE_BACKUP' ||
          process.env.PHASE12_REVIEWED_PLAN_SHA256 !== digest(current, local, head)) {
        throw new DbStop('Reviewed plan/approved prechange restore/migration authorisation missing or stale');
      }
      if (state.pending.length) {
        if (state.pending.join(',') !== TARGET) throw new DbStop('Only the reviewed Phase 12 migration may be pending');
        child(['prisma', 'migrate', 'deploy']);
        current = await snapshot(db);
        state = assess(current, local, 'apply');
        if (!state.migrationApplied) throw new DbStop('Reviewed migration did not finish');
      }
      if (state.permissionCodes < 7) {
        child(['tsx', 'apps/api/scripts/seed-phase12-permissions.ts']);
      }
    }
    current = await snapshot(db);
    state = assess(current, local, 'verify');
    if (!process.env.RUNTIME_DATABASE_URL) throw new DbStop('Non-owner runtime URL required for a separate read-only probe');
    await runtimeProbe(process.env.RUNTIME_DATABASE_URL);
    console.log(`${mode === 'apply' ? 'PHASE12_DB_APPLY_PASS' : 'PHASE12_DB_VERIFY_PASS'}: reviewed migration, seed, triggers and non-owner reads verified; live API session and restore are separate mandatory gates.`);
  } finally { await db.$disconnect(); }
}
main().catch((error: unknown) => {
  console.error('PHASE12_DB_FAIL:', error instanceof Error && error.name === 'DbStop' ? error.message :
    'Protected DB operation failed; review owner-host logs without disclosing credentials or rows');
  process.exitCode = 1;
});
