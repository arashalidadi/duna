'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { PGlite } = require('../../apps/api/node_modules/pglite-pg16');
const { ROOT } = require('./config.cjs');
const { bootstrapSql } = require('./setup.cjs');
const { expectedMigrations } = require('./verify-db.cjs');
const { checkCatalog, grantStatements } = require('./grants.cjs');
const { reviewedPlan } = require('../../apps/api/scripts/phase11-runtime-privileges.cjs');

test(
  'all committed SQL migrations replay on isolated in-memory PG16; fresh role grants remain narrow',
  { timeout: 90_000 },
  async () => {
    const db = new PGlite(); // no dataDir, no TCP socket, never the owner/application DB
    try {
      const [{ server_version_num: version }] = (await db.query('SHOW server_version_num')).rows;
      assert.match(version, /^16\d{4}$/);
      const [{ name }] = (await db.query('SELECT current_database()::text AS name')).rows;
      // Execute the SAME new-instance role/ownership transaction before replay;
      // fixture secrets live only in memory and are never printed or saved.
      await db.exec(
        bootstrapSql({
          FRESH_DATABASE_NAME: name,
          FRESH_DB_OWNER_PASSWORD: randomBytes(32).toString('base64url'),
          FRESH_DB_RUNTIME_PASSWORD: randomBytes(32).toString('base64url'),
        })
      );
      await db.exec('SET ROLE shipping;');
      const migrations = expectedMigrations();
      for (const { name } of migrations) {
        await db.exec(
          fs.readFileSync(path.join(ROOT, 'prisma/migrations', name, 'migration.sql'), 'utf8')
        );
      }
      // Prisma migrate deploy owns this journal, not an application model.
      await db.exec('CREATE TABLE public._prisma_migrations (migration_name text);');
      const plan = reviewedPlan(ROOT);
      const tables = (
        await db.query(`SELECT c.relname::text AS name,
        pg_get_userbyid(c.relowner)::text AS owner FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r','p')`)
      ).rows;
      const sequences = (
        await db.query(`SELECT seq.relname::text AS name,
        pg_get_userbyid(seq.relowner)::text AS owner, tab.relname::text AS "table"
        FROM pg_class seq JOIN pg_namespace n ON n.oid = seq.relnamespace
        LEFT JOIN pg_depend dep ON dep.objid = seq.oid AND dep.classid = 'pg_class'::regclass
          AND dep.refclassid = 'pg_class'::regclass AND dep.deptype IN ('a','i')
        LEFT JOIN pg_class tab ON tab.oid = dep.refobjid
        WHERE n.nspname = 'public' AND seq.relkind = 'S'`)
      ).rows;
      const required = checkCatalog(plan, tables, sequences, []);
      for (const statement of grantStatements(plan, required)) await db.exec(statement + ';');
      const [rights] = (
        await db.query(`SELECT
        has_table_privilege('shipping_runtime_p11', 'public."AuditLog"', 'SELECT') AS read,
        has_table_privilege('shipping_runtime_p11', 'public."AuditLog"', 'INSERT') AS write,
        has_table_privilege('shipping_runtime_p11', 'public."AuditLog"', 'UPDATE') AS mutate,
        has_table_privilege('shipping_runtime_p11', 'public._prisma_migrations', 'SELECT') AS journal,
        has_table_privilege('shipping_audit_export_p11', 'public."AuditLog"', 'SELECT') AS export,
        has_table_privilege('shipping_audit_export_p11', 'public."User"', 'SELECT') AS users`)
      ).rows;
      assert.deepEqual(rights, {
        read: true,
        write: true,
        mutate: false,
        journal: false,
        export: true,
        users: false,
      });
      assert.equal(tables.length, 95);
      assert.ok(migrations.length >= 48);
    } finally {
      await db.close();
    }
  }
);
