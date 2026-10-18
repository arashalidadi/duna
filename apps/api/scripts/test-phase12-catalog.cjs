'use strict';
// Isolated, in-memory PostgreSQL 16.3. NEVER connects to the owner database.
// Read the SAME catalog projections as phase12-db-deploy.ts after executing the
// reviewed migration. A mock of POLICY_COLUMNS alone missed the typmod defect.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { PGlite } = require('pglite-pg16');
const { DbStop, TARGET, checkStructure } = require('../../../scripts/phase12/db-policy.cjs');
const migration = readFileSync(resolve(__dirname, '../../../prisma/migrations', TARGET, 'migration.sql'), 'utf8');

test('real PostgreSQL 16 catalog accepts the reviewed Phase 12 migration and rejects timestamp typmod drift', async () => {
  const db = new PGlite(); // no dataDir: SQL and data remain in-memory only
  try {
    const q = async (sql) => (await db.query(sql)).rows;
    const [{ server_version_num: version }] = await q('SHOW server_version_num');
    assert.match(version, /^16\d{4}$/, 'the fixture must actually run PostgreSQL 16');
    // Synthetic prerequisites, never an owner database and never production rows.
    await db.exec(`CREATE ROLE shipping LOGIN;
      CREATE ROLE shipping_runtime_p11 LOGIN;
      GRANT USAGE, CREATE ON SCHEMA public TO shipping;
      SET ROLE shipping;
      CREATE TYPE public."LetterStatus" AS ENUM ('DRAFT', 'SENT', 'RECEIVED', 'ARCHIVED');
      CREATE TABLE public."letters" ("id" text PRIMARY KEY, "status" public."LetterStatus" NOT NULL,
        "deletedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3), "letterDate" TIMESTAMP(3));
      CREATE TABLE public."AuditLog" ("id" text PRIMARY KEY, "entityType" text, "entityId" text,
        "action" text);`);
    await db.exec(migration);
    const [presence] = await q(`SELECT to_regclass('public."RetentionPolicy"') IS NOT NULL AS "retentionExists",
      EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public."letters"'::regclass
        AND attname = 'archivedFromStatus' AND NOT attisdropped) AS "letterColumnPresent",
      EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public."letters"'::regclass
        AND attname = 'archivedFromStatus' AND NOT attisdropped AND NOT attnotnull
        AND atttypid = 'public."LetterStatus"'::regtype) AS "letterColumn",
      (SELECT count(*)::int FROM pg_trigger WHERE tgrelid = to_regclass('public."RetentionPolicy"')
        AND tgenabled = 'A' AND tgname IN ('phase12_retention_no_reduction',
          'phase12_retention_no_truncate')) AS "retentionTriggers",
      (SELECT count(*)::int FROM pg_trigger WHERE tgrelid = 'public."letters"'::regclass
        AND tgenabled = 'A' AND tgname = 'phase12_letter_no_archive_delete_bypass') AS "letterGuard"`);
    const who = {
      ...presence,
      policyColumns: await q(`SELECT a.attname::text AS name, a.atttypid::regtype::text AS type,
        a.atttypmod::int AS modifier, a.attnotnull AS required
        FROM pg_attribute a WHERE a.attrelid = to_regclass('public."RetentionPolicy"')
        AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`),
      policyConstraints: await q(`SELECT conname::text AS name, convalidated AS validated
        FROM pg_constraint WHERE conrelid = to_regclass('public."RetentionPolicy"') ORDER BY conname`),
      phase12Functions: await q(`SELECT p.proname::text AS name,
        pg_get_userbyid(p.proowner)::text AS owner, p.prosecdef AS "securityDefiner",
        p.proconfig AS config, pg_get_functiondef(p.oid)::text AS definition
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname LIKE 'phase12_%' ORDER BY p.proname`),
      phase12Triggers: await q(`SELECT t.tgname::text AS name, c.relname::text AS "table",
        t.tgenabled::text AS enabled, t.tgisinternal AS internal,
        pg_get_triggerdef(t.oid)::text AS definition
        FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND t.tgname LIKE 'phase12_%' ORDER BY t.tgname`),
    };
    assert.equal(who.policyColumns.find((c) => c.name === 'scope').modifier, 44);
    assert.equal(who.policyColumns.find((c) => c.name === 'authority').modifier, 504);
    assert.deepEqual(who.policyColumns.filter((c) => ['createdAt', 'updatedAt'].includes(c.name))
      .map((c) => [c.name, c.modifier]), [['createdAt', 3], ['updatedAt', 3]]);
    assert.doesNotThrow(() => checkStructure(who, true));
    const stale = structuredClone(who);
    stale.policyColumns.find((c) => c.name === 'updatedAt').modifier = 7;
    assert.throws(() => checkStructure(stale, true), (error) => error instanceof DbStop &&
      /RetentionPolicy column updatedAt position\/type\/precision\/nullability/.test(error.message));
    const [{ count }] = await q('SELECT count(*)::int FROM public."RetentionPolicy"');
    assert.equal(count, 0, 'fixture has no invented retention periods');
  } finally {
    await db.close();
  }
});
