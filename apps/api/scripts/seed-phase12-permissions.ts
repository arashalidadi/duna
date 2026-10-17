import { PrismaClient } from '@prisma/client';
import { Phase12PermissionConflict, seedPhase12Permissions } from '../../../prisma/seed/phase12-permissions';

/** Existing-database additive seed. Never run the full core/demo seed here. */
async function main() {
  if (process.env.PHASE12_EXPECTED_DB !== 'duna_seed_test') {
    throw new Phase12PermissionConflict('Explicit approved duna_seed_test target required');
  }
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
      url.port !== '5432' || url.pathname !== '/duna_seed_test' ||
      decodeURIComponent(url.username) !== 'shipping') {
    throw new Phase12PermissionConflict('Owner URL does not match the approved host, port, role and database');
  }
  const db = new PrismaClient();
  try {
    const result = await db.$transaction(async (tx) => {
      // Same connection/transaction as writes: URL/config inspection is not
      // proof of the live target. No credentials, row values or URL are logged.
      const [who] = await tx.$queryRaw<Array<{ database: string; login: string; session: string;
        server: string; port: number; version: number; owner: string; auditTriggers: number }>>`
        SELECT current_database()::text AS database, current_user::text AS login,
          session_user::text AS session, inet_server_addr()::text AS server,
          inet_server_port()::int AS port, current_setting('server_version_num')::int AS version,
          pg_get_userbyid(c.relowner)::text AS owner,
          (SELECT count(*)::int FROM pg_trigger WHERE tgrelid = c.oid AND tgenabled = 'A'
            AND tgname IN ('phase11_audit_no_update_delete', 'phase11_audit_no_truncate')) AS "auditTriggers"
        FROM pg_class c WHERE c.oid = 'public."AuditLog"'::regclass`;
      if (!who || who.database !== 'duna_seed_test' || who.login !== 'shipping' ||
          who.session !== 'shipping' || who.owner !== 'shipping' ||
          !who.server || who.port !== 5432 ||
          who.version < 160000 || who.version >= 170000 || who.auditTriggers !== 2) {
        throw new Phase12PermissionConflict('Live database/role/server/PG16/owner/audit protection differs; no seed applied');
      }
      const changed = await seedPhase12Permissions(tx);
      if (changed.created) {
        await tx.auditLog.create({ data: {
          actorId: 'system:phase12-deploy', actorEmail: 'system:phase12-deploy',
          action: 'security.permission_seed.apply', entityType: 'Permission', entityId: 'phase12',
          metadata: { created: changed.created, checked: changed.checked, database: who.database },
        } });
      }
      return changed;
    }, { timeout: 30000, maxWait: 10000 });
    console.log(`Phase 12: ${result.created} permission(s) created, ${result.checked} checked; no role grants or users changed.`);
  } finally { await db.$disconnect(); }
}
main().catch((error: unknown) => {
  console.error('Phase 12 permission seed stopped:', error instanceof Phase12PermissionConflict
    ? error.message : 'database or schema error (details omitted to protect credentials)');
  process.exitCode = 1;
});
