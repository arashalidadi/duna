import { PrismaClient } from '@prisma/client';
import { Phase11PermissionConflict, seedPhase11Permissions } from '../../../prisma/seed/phase11-permissions';

/** Add only the audit-export vocabulary and dedicated role. No user membership changes. */
async function main() {
  // This is a *deployment* seed, not an API operation. Run once as the table
  // owner, so the long-lived runtime role never needs Permission INSERT.
  if (process.env.PHASE11_EXPECTED_DB !== 'duna_seed_test') {
    throw new Phase11PermissionConflict('Only the independently reviewed duna_seed_test target is permitted');
  }
  const db = new PrismaClient();
  try {
    const result = await db.$transaction(async (tx) => {
      // Same connection/transaction as all later writes. Never infer identity
      // from URL alone (or run the full core/demo seed on an existing database).
      const [identity] = await tx.$queryRaw<Array<{
        name: string; login: string; session: string; port: number; owner: string; triggers: number
      }>>`
        SELECT current_database()::text AS name, current_user::text AS login,
          session_user::text AS session, inet_server_port()::int AS port,
          pg_get_userbyid(c.relowner)::text AS owner,
          (SELECT count(*)::int FROM pg_trigger WHERE tgrelid = c.oid AND tgenabled = 'A'
            AND tgname IN ('phase11_audit_no_update_delete', 'phase11_audit_no_truncate')) AS triggers
        FROM pg_class c WHERE c.oid = 'public."AuditLog"'::regclass`;
      if (!identity || identity.name !== 'duna_seed_test' || identity.login !== 'shipping' ||
          identity.session !== 'shipping' || identity.owner !== 'shipping' ||
          identity.port !== 5432 || identity.triggers !== 2) {
        throw new Phase11PermissionConflict('Database, table owner, login, port or audit triggers differ from reviewed Phase 11 target');
      }
      const changed = await seedPhase11Permissions(tx);
      if (changed.created || changed.roleCreated || changed.granted) {
        await tx.auditLog.create({ data: {
          actorId: 'system:phase11-deploy', actorEmail: 'system:phase11-deploy',
          action: 'security.permission_seed.apply', entityType: 'Role', entityId: 'AUDIT_EXPORTER',
          metadata: { ...changed, database: identity.name },
        } });
      }
      return changed;
    }, { timeout: 30000, maxWait: 10000 });
    console.log(`Phase 11: ${result.created} permission(s), ${result.roleCreated} dedicated role(s), ${result.granted} role grant(s); no user memberships changed.`);
  } finally { await db.$disconnect(); }
}
main().catch((error: unknown) => {
  console.error('Phase 11 permission seed stopped:', error instanceof Phase11PermissionConflict
    ? error.message : 'database or schema error (details omitted to protect credentials)');
  process.exitCode = 1;
});
