import { PrismaClient, type Prisma } from '@prisma/client';

/**
 * Database-role handoff for P11. Run with the operator's existing migrator DB
 * connection, NEVER with an application role; do not print credentials or URLs.
 * --preflight is read-only; --grant is explicit/idempotent; --verify is read-only.
 * Role creation and other application-table grants remain a DBA decision.
 */
const mode = process.argv[2];
if (!['--preflight', '--grant', '--verify'].includes(mode)) {
  console.error('Usage: phase11-audit-roles.ts --preflight|--grant|--verify');
  process.exit(2);
}
const runtime = process.env.PHASE11_RUNTIME_DB_ROLE ?? '';
const exporter = process.env.PHASE11_EXPORT_DB_ROLE ?? '';
const expectedDb = process.env.PHASE11_EXPECTED_DB ?? '';
if (!/^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/.test(expectedDb)) {
  console.error('Set PHASE11_EXPECTED_DB to the verified database name before any role command.');
  process.exit(2);
}
const roleName = /^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/;
if (!roleName.test(runtime) || !roleName.test(exporter) || runtime === exporter) {
  console.error('Set PHASE11_RUNTIME_DB_ROLE and a distinct PHASE11_EXPORT_DB_ROLE to existing DB roles (names only).');
  process.exit(2);
}
const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
const db = new PrismaClient();
type State = { db: string; login: string; tableOwner: string; triggers: number };
type Role = { name: string; canLogin: boolean; superuser: boolean; canCreateRole: boolean;
  memberOfOwner: boolean; memberOfExport: boolean; canSelect: boolean; canInsert: boolean;
  canUpdate: boolean; canDelete: boolean; canTruncate: boolean; canTrigger: boolean;
  canReference: boolean; canAccessOtherTables: boolean; canAccessSequences: boolean;
  canCreateInPublic: boolean };
type Client = Pick<Prisma.TransactionClient, '$queryRaw'>;

async function snapshot(tx: Client): Promise<{ state: State; roles: Role[] }> {
  const [state] = await tx.$queryRaw<State[]>`
    SELECT current_database()::text AS db, current_user::text AS login,
      owner.rolname::text AS "tableOwner",
      (SELECT count(*)::int FROM pg_trigger WHERE tgrelid = 'public."AuditLog"'::regclass
        AND tgname IN ('phase11_audit_no_update_delete', 'phase11_audit_no_truncate')
        AND tgenabled = 'A') AS triggers
    FROM pg_class target JOIN pg_roles owner ON owner.oid = target.relowner
    WHERE target.oid = 'public."AuditLog"'::regclass`;
  const roles = await tx.$queryRaw<Role[]>`
    SELECT r.rolname::text AS name, r.rolcanlogin AS "canLogin", r.rolsuper AS superuser,
      r.rolcreaterole AS "canCreateRole",
      pg_has_role(r.oid, target.relowner, 'MEMBER') AS "memberOfOwner",
      pg_has_role(r.oid, exported.oid, 'MEMBER') AS "memberOfExport",
      has_table_privilege(r.oid, target.oid, 'SELECT') AS "canSelect",
      has_table_privilege(r.oid, target.oid, 'INSERT') AS "canInsert",
      has_table_privilege(r.oid, target.oid, 'UPDATE') AS "canUpdate",
      has_table_privilege(r.oid, target.oid, 'DELETE') AS "canDelete",
      has_table_privilege(r.oid, target.oid, 'TRUNCATE') AS "canTruncate",
      has_table_privilege(r.oid, target.oid, 'TRIGGER') AS "canTrigger",
      has_table_privilege(r.oid, target.oid, 'REFERENCES') AS "canReference",
      has_schema_privilege(r.oid, 'public', 'CREATE') AS "canCreateInPublic",
      EXISTS (SELECT 1 FROM pg_class other JOIN pg_namespace space ON space.oid = other.relnamespace
        WHERE space.nspname = 'public' AND other.oid <> target.oid
          AND other.relkind IN ('r', 'p', 'v', 'm', 'f')
          AND (has_table_privilege(r.oid, other.oid, 'SELECT') OR
            has_table_privilege(r.oid, other.oid, 'INSERT') OR
            has_table_privilege(r.oid, other.oid, 'UPDATE') OR
            has_table_privilege(r.oid, other.oid, 'DELETE') OR
            has_table_privilege(r.oid, other.oid, 'TRUNCATE') OR
            has_table_privilege(r.oid, other.oid, 'REFERENCES') OR
            has_table_privilege(r.oid, other.oid, 'TRIGGER'))) AS "canAccessOtherTables",
      EXISTS (SELECT 1 FROM pg_class seq JOIN pg_namespace space ON space.oid = seq.relnamespace
        WHERE space.nspname = 'public' AND seq.relkind = 'S'
          AND (has_sequence_privilege(r.oid, seq.oid, 'SELECT') OR
            has_sequence_privilege(r.oid, seq.oid, 'USAGE') OR
            has_sequence_privilege(r.oid, seq.oid, 'UPDATE'))) AS "canAccessSequences"
    FROM pg_roles r CROSS JOIN pg_class target
    JOIN pg_roles exported ON exported.rolname = ${exporter}
    WHERE target.oid = 'public."AuditLog"'::regclass AND r.rolname IN (${runtime}, ${exporter})`;
  if (!state || state.db !== expectedDb || roles.length !== 2) {
    throw new Error('Database identity, AuditLog table, or requested role(s) do not match the explicit preflight target');
  }
  const app = roles.find((role) => role.name === runtime)!;
  const audit = roles.find((role) => role.name === exporter)!;
  if (app.superuser || app.canCreateRole || !app.canLogin || app.memberOfOwner || app.memberOfExport ||
    app.name === state.tableOwner || app.canCreateInPublic ||
    audit.superuser || audit.canCreateRole || audit.canLogin || audit.memberOfOwner ||
    audit.name === state.tableOwner || audit.canCreateInPublic ||
    audit.canAccessOtherTables || audit.canAccessSequences) {
    throw new Error('Runtime/export DB roles have unsafe ownership, inherited/granted access, schema creation, or login flags');
  }
  return { state, roles };
}
function verify({ state, roles }: { state: State; roles: Role[] }) {
  const app = roles.find((role) => role.name === runtime)!;
  const audit = roles.find((role) => role.name === exporter)!;
  if (state.triggers !== 2 || !app.canSelect || !app.canInsert || app.canUpdate || app.canDelete ||
    app.canTruncate || app.canTrigger || app.canReference ||
    !audit.canSelect || audit.canInsert || audit.canUpdate || audit.canDelete ||
    audit.canTruncate || audit.canTrigger || audit.canReference) {
    throw new Error('Append-only triggers or effective runtime/export privileges do not meet Phase 11 policy');
  }
}
async function main() {
  try {
    if (mode === '--grant') {
      await db.$transaction(async (tx) => {
        const before = await snapshot(tx);
        if (before.state.login !== before.state.tableOwner || before.state.triggers !== 2) {
          throw new Error('Use the table-owner migrator only, after deploying the Phase 11 migration');
        }
        // Identifier strings were restricted above; all other SQL uses parameters.
        await tx.$executeRawUnsafe(`GRANT SELECT, INSERT ON TABLE public."AuditLog" TO ${quote(runtime)}`);
        await tx.$executeRawUnsafe(`REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public."AuditLog" FROM ${quote(runtime)}`);
        await tx.$executeRawUnsafe(`GRANT SELECT ON TABLE public."AuditLog" TO ${quote(exporter)}`);
        await tx.$executeRawUnsafe(`REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public."AuditLog" FROM ${quote(exporter)}`);
        const after = await snapshot(tx);
        verify(after);
        await tx.auditLog.create({ data: { actorId: 'system:phase11-deploy',
          actorEmail: 'system:phase11-deploy', action: 'security.audit_db_roles.configure',
          entityType: 'AuditLog', entityId: 'database-roles',
          metadata: { runtimeRole: runtime, exportRole: exporter, database: after.state.db } } });
      });
    } else {
      const result = await snapshot(db);
      if (mode === '--verify') verify(result);
      console.log(`Phase 11 audit roles ${mode.slice(2)}: database=${result.state.db}; table owner=${result.state.tableOwner}; login=${result.state.login}; always-enabled triggers=${result.state.triggers}`);
      if (mode === '--preflight' && result.state.triggers < 2) console.log('Append-only migration is pending; deploy it before --grant.');
    }
    if (mode === '--grant') console.log('Phase 11 audit role grants/revocations committed and logged; effective privileges verified.');
  } finally { await db.$disconnect(); }
}
main().catch((error: unknown) => {
  console.error('Phase 11 audit role check stopped:', error instanceof Error &&
    !error.message.includes('postgresql://') ? error.message : 'database/permission error (details omitted)');
  process.exitCode = 1;
});
