#!/usr/bin/env bash
# Sandbox-only fixture for apps/api/test/phase11-security.e2e-spec.ts.
#
# That suite refuses to run unless it is pointed at an isolated database whose
# AuditLog table is append-only for the role the API connects with:
#
#   * database name matches ^duna_phase11_[a-z0-9_]+$  (PHASE11_ISOLATED_TEST_DB_NAME)
#   * current_user is NOT the table owner (migrations must be applied by an owner role)
#   * current_user is not a superuser
#   * both phase11_audit_no_update_delete / phase11_audit_no_truncate triggers are enabled
#   * has_table_privilege(current_user, "AuditLog", UPDATE|DELETE) is false
#
# This script provisions exactly that on the sandbox PostgreSQL, using the
# required core seed only (the AUDIT_EXPORTER role must start unassigned).
#
# Usage: bash scripts/arena/phase11-isolated-db.sh
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

DB_NAME="${ARENA_PHASE11_DB_NAME:-duna_phase11_arena}"
OWNER_ROLE="${ARENA_PHASE11_OWNER_ROLE:-shipping_owner_p11}"
RUNTIME_ROLE="$(sed -n 's#^DATABASE_URL=postgresql://\([^:@]*\):.*#\1#p' .env | tail -1)"
RUNTIME_PASSWORD="$(cat .arena-tools/runtime-db-password)"
TOOLS_DIR="$REPO_ROOT/.arena-tools"
OWNER_PASSWORD_FILE="$TOOLS_DIR/owner-db-password"

if [[ ! "$DB_NAME" =~ ^duna_phase11_[a-z0-9_]+$ ]]; then
  echo "database name must match ^duna_phase11_[a-z0-9_]+$, got: $DB_NAME" >&2
  exit 2
fi
if [[ -z "$RUNTIME_ROLE" ]]; then
  echo "could not read the runtime role from DATABASE_URL in .env" >&2
  exit 2
fi

if [[ -f "$OWNER_PASSWORD_FILE" ]]; then
  OWNER_PASSWORD="$(cat "$OWNER_PASSWORD_FILE")"
else
  OWNER_PASSWORD="$(openssl rand -hex 24)"
  printf '%s' "$OWNER_PASSWORD" >"$OWNER_PASSWORD_FILE"
  chmod 600 "$OWNER_PASSWORD_FILE"
fi

echo "creating owner role/database (runtime role: $RUNTIME_ROLE)"
RUNTIME_PASSWORD="$RUNTIME_PASSWORD" OWNER_PASSWORD="$OWNER_PASSWORD" \
  DB_NAME="$DB_NAME" OWNER_ROLE="$OWNER_ROLE" RUNTIME_ROLE="$RUNTIME_ROLE" \
  node - <<'NODE'
const { Client } = require(`${process.cwd()}/.arena-tools/pg/node_modules/pg`);

const literal = (value) => `'${value.replace(/'/g, "''")}'`;
const ident = (value) => `"${value.replace(/"/g, '""')}"`;

(async () => {
  const admin = new Client({ host: '127.0.0.1', port: 5432, user: 'shipping', database: 'postgres' });
  await admin.connect();
  const { rows } = await admin.query('select 1 from pg_roles where rolname = $1', [process.env.OWNER_ROLE]);
  if (rows.length === 0) {
    await admin.query(`create role ${ident(process.env.OWNER_ROLE)} with login password ${literal(process.env.OWNER_PASSWORD)}`);
  } else {
    await admin.query(`alter role ${ident(process.env.OWNER_ROLE)} with login password ${literal(process.env.OWNER_PASSWORD)}`);
  }
  await admin.query(`drop database if exists ${ident(process.env.DB_NAME)}`);
  await admin.query(`create database ${ident(process.env.DB_NAME)} owner ${ident(process.env.OWNER_ROLE)}`);
  await admin.end();

  const db = new Client({
    host: '127.0.0.1', port: 5432, user: process.env.OWNER_ROLE,
    password: process.env.OWNER_PASSWORD, database: process.env.DB_NAME,
  });
  await db.connect();
  await db.query(`grant usage on schema public to ${ident(process.env.RUNTIME_ROLE)}`);
  await db.end();
  console.log(`database ${process.env.DB_NAME} ready for migration by ${process.env.OWNER_ROLE}`);
})().catch((error) => { console.error(error.message); process.exit(1); });
NODE

export PRISMA_ENGINES_MIRROR="$(sed -n 's/^PRISMA_ENGINES_MIRROR=//p' .env | tail -1)"
OWNER_URL="postgresql://${OWNER_ROLE}:${OWNER_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public"

echo "applying migrations as the owner role"
DATABASE_URL="$OWNER_URL" pnpm db deploy >/dev/null
echo "seeding required reference data as the owner role"
DATABASE_URL="$OWNER_URL" pnpm db seed >/dev/null

echo "restricting the runtime role: append-only AuditLog"
RUNTIME_ROLE="$RUNTIME_ROLE" DB_NAME="$DB_NAME" OWNER_ROLE="$OWNER_ROLE" node - <<'NODE'
const { Client } = require(`${process.cwd()}/.arena-tools/pg/node_modules/pg`);
const fs = require('node:fs');

const ident = (value) => `"${value.replace(/"/g, '""')}"`;
const runtime = ident(process.env.RUNTIME_ROLE);

(async () => {
  const client = new Client({
    host: '127.0.0.1', port: 5432, user: process.env.OWNER_ROLE,
    password: fs.readFileSync('.arena-tools/owner-db-password', 'utf8'), database: process.env.DB_NAME,
  });
  await client.connect();
  await client.query(`revoke all on all tables in schema public from public`);
  await client.query(`grant all on all tables in schema public to ${runtime}`);
  await client.query(`grant all on all sequences in schema public to ${runtime}`);
  await client.query(`grant execute on all functions in schema public to ${runtime}`);
  // Append-only audit trail: the application role may read and append, never
  // update, delete or truncate. The triggers remain as a second line of defence.
  await client.query(`revoke update, delete, truncate, trigger, references on public."AuditLog" from ${runtime}`);
  const [check] = await client.query(`
    select pg_get_userbyid(c.relowner)::text as owner,
      has_table_privilege($1, c.oid, 'select') as can_select,
      has_table_privilege($1, c.oid, 'insert') as can_insert,
      has_table_privilege($1, c.oid, 'update') as can_update,
      has_table_privilege($1, c.oid, 'delete') as can_delete,
      (select count(*)::int from pg_trigger where tgrelid = c.oid and tgenabled = 'A'
         and tgname in ('phase11_audit_no_update_delete','phase11_audit_no_truncate')) as triggers
    from pg_class c where c.oid = 'public."AuditLog"'::regclass`, [process.env.RUNTIME_ROLE]).then((r) => r.rows);
  console.log(JSON.stringify(check));
  await client.end();
})().catch((error) => { console.error(error.message); process.exit(1); });
NODE

echo
echo "Run the gated suite with:"
echo "  DATABASE_URL=postgresql://${RUNTIME_ROLE}:<runtime password>@127.0.0.1:5432/${DB_NAME}?schema=public \\"
echo "  PHASE11_ISOLATED_TEST_DB_NAME=${DB_NAME} \\"
echo "  pnpm --filter @shipping/api exec jest --config test/jest-e2e.cjs test/phase11-security.e2e-spec.ts"
