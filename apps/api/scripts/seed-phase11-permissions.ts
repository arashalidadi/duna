import { PrismaClient } from '@prisma/client';
import { Phase11PermissionConflict, seedPhase11Permissions } from '../../../prisma/seed/phase11-permissions';

/** Add only the audit-export vocabulary and dedicated role. No user membership changes. */
async function main() {
  const expected = process.env.PHASE11_EXPECTED_DB ?? '';
  if (!/^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/.test(expected)) {
    throw new Phase11PermissionConflict('Set PHASE11_EXPECTED_DB to the verified target name');
  }
  const db = new PrismaClient();
  try {
    const [identity] = await db.$queryRaw<Array<{ name: string; triggers: number }>>`
      SELECT current_database()::text AS name,
        (SELECT count(*)::int FROM pg_trigger
          WHERE tgrelid = 'public."AuditLog"'::regclass AND tgenabled = 'A'
            AND tgname IN ('phase11_audit_no_update_delete', 'phase11_audit_no_truncate')) AS triggers`;
    if (!identity || identity.name !== expected || identity.triggers !== 2) {
      throw new Phase11PermissionConflict('Target database or append-only migration differs from the verified Phase 11 target');
    }
    const result = await db.$transaction(async (tx) => {
      const changed = await seedPhase11Permissions(tx);
      if (changed.created || changed.roleCreated || changed.granted) {
        await tx.auditLog.create({ data: {
          actorId: 'system:phase11-deploy', actorEmail: 'system:phase11-deploy',
          action: 'security.permission_seed.apply', entityType: 'Role', entityId: 'AUDIT_EXPORTER',
          metadata: { ...changed, database: expected },
        } });
      }
      return changed;
    });
    console.log(`Phase 11: ${result.created} permission(s), ${result.roleCreated} dedicated role(s), ${result.granted} role grant(s); no user memberships changed.`);
  } finally { await db.$disconnect(); }
}
main().catch((error: unknown) => {
  console.error('Phase 11 permission seed stopped:', error instanceof Phase11PermissionConflict
    ? error.message : 'database or schema error (details omitted to protect credentials)');
  process.exitCode = 1;
});
