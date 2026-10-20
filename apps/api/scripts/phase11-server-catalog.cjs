'use strict';

// Read-only catalog adapter for the EXISTING duna_seed_test database. The
// command line entry point does not load this module's Prisma dependency until
// after URL/target checks; tests can exercise the policy without a database.
const TARGET = Object.freeze({
  database: 'duna_seed_test', owner: 'shipping', runtime: 'shipping_runtime_p11',
  exporter: 'shipping_audit_export_p11', port: 5432, pgMajor: 16,
  // The reviewed Phase 11 append-only audit DDL now lives in the squashed
  // post-lifecycle baseline (the 49 per-phase migrations were consolidated into
  // three; see prisma/migrations). The guard keeps its meaning: exactly one
  // reviewed migration may be pending, and it must be this one.
  migration: '20261004000001_post_lifecycle_baseline',
});
const TABLE_OPS = Object.freeze(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);
const SEQUENCE_OPS = Object.freeze(['USAGE', 'SELECT', 'UPDATE']);

function assertIdentity(row, role) {
  if (!row || row.database !== TARGET.database || row.login !== role ||
      row.session !== role || row.port !== TARGET.port ||
      row.serverVersion < 160000 || row.serverVersion >= 170000) {
    throw new Error(`Database/role/port/PG16 identity differs from reviewed ${role} target`);
  }
}
async function identity(tx, role) {
  const [row] = await tx.$queryRawUnsafe(`
    SELECT current_database()::text AS "database", current_user::text AS "login",
      session_user::text AS "session", inet_server_port()::int AS "port",
      current_setting('server_version_num')::int AS "serverVersion"`);
  assertIdentity(row, role);
  return row;
}

async function readCatalogInTx(tx) {
    const who = await identity(tx, TARGET.owner);
    const roles = await tx.$queryRawUnsafe(`
      SELECT r.rolname::text AS name, r.rolcanlogin AS login, r.rolsuper AS superuser,
        r.rolcreaterole AS "createRole", r.rolcreatedb AS "createDb",
        r.rolreplication AS replication, r.rolbypassrls AS "bypassRls",
        EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid) AS "memberOfAnyRole",
        pg_has_role(r.oid, owner.oid, 'MEMBER') AS "memberOfOwner",
        has_database_privilege(r.oid, current_database(), 'CREATE') AS "canCreateSchema",
        has_database_privilege(r.oid, current_database(), 'CONNECT') AS "canConnect"
      FROM pg_roles r CROSS JOIN pg_roles owner
      WHERE owner.rolname = $1 AND r.rolname IN ($1, $2, $3)
      ORDER BY r.rolname`, TARGET.owner, TARGET.runtime, TARGET.exporter);
    // pg_roles deliberately masks rolpassword. Read *only* the boolean from
    // pg_authid when this migrator has catalog permission; never fetch/hash/log
    // the credential. Otherwise require a separate DBA attestation.
    const [passwordAccess] = await tx.$queryRawUnsafe(`
      SELECT has_table_privilege(current_user, 'pg_catalog.pg_authid', 'SELECT') AS visible`);
    const password = { visible: passwordAccess.visible, set: null };
    if (password.visible) {
      const [state] = await tx.$queryRawUnsafe(`
        SELECT rolpassword IS NOT NULL AS "set" FROM pg_catalog.pg_authid WHERE rolname = $1`, TARGET.runtime);
      password.set = state?.set ?? false;
    }
    const tables = await tx.$queryRawUnsafe(`
      SELECT c.relname::text AS name, pg_get_userbyid(c.relowner)::text AS owner,
        c.relkind::text AS kind
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
      ORDER BY c.relname`);
    const triggers = await tx.$queryRawUnsafe(`
      SELECT t.tgname::text AS name, t.tgenabled::text AS enabled,
        t.tgfoid::regprocedure::text AS "function", pg_get_triggerdef(t.oid)::text AS definition
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'AuditLog' AND NOT t.tgisinternal
      ORDER BY t.tgname`);
    const functions = await tx.$queryRawUnsafe(`
      SELECT p.oid::regprocedure::text AS name, pg_get_userbyid(p.proowner)::text AS owner,
        p.prosecdef AS "securityDefiner", pg_get_functiondef(p.oid)::text AS definition
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'phase11_reject_audit_mutation'
      ORDER BY p.oid`);
    const [schemaGrant] = await tx.$queryRawUnsafe(`
      SELECT pg_get_userbyid(n.nspowner)::text AS owner,
        has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreate",
        has_schema_privilege(current_user, 'public', 'USAGE WITH GRANT OPTION') AS "grantUsage"
      FROM pg_namespace n WHERE n.nspname = 'public'`);
    const [journal] = await tx.$queryRawUnsafe(`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`);
    const history = journal.present ? await tx.$queryRawUnsafe(`
      SELECT migration_name::text AS name, checksum::text AS checksum,
        finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolledback
      FROM public._prisma_migrations ORDER BY started_at, id`) : [];
    const seed = {
      permissions: await tx.$queryRawUnsafe(`
        SELECT code::text, module::text, action::text FROM public."Permission"
        WHERE code IN ('audit:read','audit:export','release:override') ORDER BY code`),
      roles: await tx.$queryRawUnsafe(`
        SELECT id::text, code::text, "isSystem" AS "isSystem",
          "deletedAt" IS NOT NULL AS deleted,
          (SELECT count(*)::int FROM public."UserRole" u WHERE u."roleId" = r.id) AS members
        FROM public."Role" r WHERE code IN ('AUDIT_EXPORTER','ADMIN') ORDER BY code`),
      grants: await tx.$queryRawUnsafe(`
        SELECT r.code::text AS role, p.code::text AS permission
        FROM public."RolePermission" rp JOIN public."Role" r ON r.id = rp."roleId"
          JOIN public."Permission" p ON p.id = rp."permissionId"
        WHERE p.code IN ('audit:read','audit:export','release:override')
          OR r.code = 'AUDIT_EXPORTER' ORDER BY r.code, p.code`),
    };
    const links = await tx.$queryRawUnsafe(`
      SELECT DISTINCT seq.relname::text AS sequence, c.relname::text AS table,
        a.attname::text AS column FROM pg_attrdef d
      JOIN pg_class c ON c.oid = d.adrelid
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.adnum
      JOIN pg_depend dep ON dep.classid = 'pg_attrdef'::regclass AND dep.objid = d.oid
      JOIN pg_class seq ON seq.oid = dep.refobjid AND seq.relkind = 'S'
      WHERE c.relnamespace = 'public'::regnamespace AND seq.relnamespace = c.relnamespace
      UNION
      SELECT DISTINCT seq.relname::text, c.relname::text, a.attname::text
      FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attidentity <> ''
      JOIN pg_depend dep ON dep.refobjid = c.oid AND dep.refobjsubid = a.attnum
      JOIN pg_class seq ON seq.oid = dep.objid AND seq.relkind = 'S'
      WHERE c.relnamespace = 'public'::regnamespace AND seq.relnamespace = c.relnamespace
      ORDER BY 1, 2, 3`);
    const nextvals = await tx.$queryRawUnsafe(`
      SELECT c.relname::text AS table, a.attname::text AS column
      FROM pg_attrdef d JOIN pg_class c ON c.oid = d.adrelid
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.adnum
      WHERE c.relnamespace = 'public'::regnamespace
        AND pg_get_expr(d.adbin, d.adrelid) LIKE '%nextval(%'
      ORDER BY 1, 2`);
    const roleNames = roles.map((r) => r.name);
    const schema = [];
    const otherSchemaRights = {};
    const tableRights = {};
    const sequenceRights = {};
    const columnRights = {};
    for (const role of [TARGET.runtime, TARGET.exporter]) {
      if (!roleNames.includes(role)) continue; // show missing roles, never invent them
      const [rights] = await tx.$queryRawUnsafe(`
        SELECT has_schema_privilege($1::text, 'public', 'USAGE') AS usage,
          has_schema_privilege($1::text, 'public', 'CREATE') AS create,
          has_schema_privilege($1::text, 'public', 'USAGE WITH GRANT OPTION') AS "delegateUsage"`, role);
      schema.push({ role, ...rights });
      otherSchemaRights[role] = await tx.$queryRawUnsafe(`
        SELECT n.nspname::text AS name,
          has_schema_privilege($1::text, n.oid, 'USAGE') AS usage,
          has_schema_privilege($1::text, n.oid, 'CREATE') AS create,
          has_schema_privilege($1::text, n.oid, 'USAGE WITH GRANT OPTION') AS "delegateUsage",
          EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace = n.oid
            AND c.relkind IN ('r','p','v','m','f') AND
            (has_table_privilege($1::text, c.oid, 'SELECT') OR
             has_table_privilege($1::text, c.oid, 'INSERT') OR
             has_table_privilege($1::text, c.oid, 'UPDATE') OR
             has_table_privilege($1::text, c.oid, 'DELETE'))) AS "tableAccess",
          EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace = n.oid
            AND c.relkind = 'S' AND
            (has_sequence_privilege($1::text, c.oid, 'USAGE') OR
             has_sequence_privilege($1::text, c.oid, 'SELECT') OR
             has_sequence_privilege($1::text, c.oid, 'UPDATE'))) AS "sequenceAccess"
        FROM pg_namespace n WHERE n.nspname NOT IN ('public','information_schema')
          AND n.nspname NOT LIKE 'pg%'
        ORDER BY n.nspname`, role);
      const rightsSql = TABLE_OPS.flatMap((op) => [
        `has_table_privilege($1::text, c.oid, '${op}') AS "${op}"`,
        `has_table_privilege($1::text, c.oid, '${op} WITH GRANT OPTION') AS "grant${op}"`,
      ]).join(',\n');
      tableRights[role] = await tx.$queryRawUnsafe(`
        SELECT c.relname::text AS name, ${rightsSql}
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
        ORDER BY c.relname`, role);
      const columnSql = ['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']
        .flatMap((op) => [
          `has_column_privilege($1::text, c.oid, a.attnum, '${op}') AS "${op}"`,
          `has_column_privilege($1::text, c.oid, a.attnum, '${op} WITH GRANT OPTION') AS "grant${op}"`,
        ]).join(',\n');
      columnRights[role] = await tx.$queryRawUnsafe(`
        SELECT c.relname::text AS name, a.attname::text AS column, ${columnSql}
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0
          AND NOT a.attisdropped AND a.attacl IS NOT NULL
        WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
        ORDER BY c.relname, a.attname`, role);
      const seqSql = SEQUENCE_OPS.flatMap((op) => [
        `has_sequence_privilege($1::text, c.oid, '${op}') AS "${op}"`,
        `has_sequence_privilege($1::text, c.oid, '${op} WITH GRANT OPTION') AS "grant${op}"`,
      ]).join(',\n');
      sequenceRights[role] = await tx.$queryRawUnsafe(`
        SELECT c.relname::text AS name, pg_get_userbyid(c.relowner)::text AS owner,
          ${seqSql} FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'S' ORDER BY c.relname`, role);
    }
    return { who, roles, password, schemaGrant, tables, triggers, functions,
      journal: journal.present, history, seed, links, nextvals, schema, otherSchemaRights,
      tableRights, sequenceRights, columnRights };
}

async function readCatalog(db) {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    return readCatalogInTx(tx);
  }, { timeout: 60000, maxWait: 10000 });
}

module.exports = { TARGET, TABLE_OPS, SEQUENCE_OPS, identity, assertIdentity,
  readCatalog, readCatalogInTx };
