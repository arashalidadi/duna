'use strict';

const { ROOT, OWNER_ROLE, RUNTIME_ROLE, EXPORT_ROLE } = require('./config.cjs');
const { reviewedPlan } = require('../../apps/api/scripts/phase11-runtime-privileges.cjs');

function quoteId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z_0-9]*$/.test(value)) {
    throw new Error('Unreviewed database identifier in fresh privilege plan');
  }
  return `"${value}"`;
}
function checkCatalog(plan, tables, sequences, defaults) {
  const names = new Set(Object.keys(plan));
  const expected = new Set([...names, '_prisma_migrations']);
  if (
    new Set(tables.map((row) => row.name)).size !== expected.size ||
    tables.some((row) => !expected.has(row.name) || row.owner !== OWNER_ROLE)
  ) {
    throw new Error(
      'Fresh migration catalog does not match the reviewed 94-table owner-owned schema'
    );
  }
  const bySequence = new Set();
  for (const row of sequences) {
    if (
      bySequence.has(row.name) ||
      row.owner !== OWNER_ROLE ||
      !row.table ||
      !names.has(row.table) ||
      !/^[A-Za-z_][A-Za-z_0-9]*$/.test(row.name)
    ) {
      throw new Error('Unreviewed or unowned public sequence; stop before runtime grants');
    }
    bySequence.add(row.name);
  }
  for (const row of defaults) {
    if (
      plan[row.table]?.INSERT &&
      !sequences.some((seq) => seq.name === row.sequence && seq.table === row.table)
    ) {
      throw new Error(
        'Unmapped nextval default on an INSERT-enabled table; review sequence privileges'
      );
    }
  }
  return sequences
    .filter((row) => plan[row.table].INSERT)
    .map((row) => row.name)
    .sort();
}
function grantStatements(plan, sequenceNames) {
  if (
    Object.keys(plan).length !== 94 ||
    plan.AuditLog?.UPDATE ||
    plan.AuditLog?.DELETE ||
    plan.Permission?.INSERT ||
    plan._prisma_migrations
  ) {
    throw new Error('Runtime privilege review is out of date');
  }
  const statements = [
    `GRANT USAGE ON SCHEMA public TO ${quoteId(RUNTIME_ROLE)}`,
    `GRANT USAGE ON SCHEMA public TO ${quoteId(EXPORT_ROLE)}`,
    `GRANT SELECT ON TABLE public.${quoteId('AuditLog')} TO ${quoteId(EXPORT_ROLE)}`,
  ];
  for (const [table, rights] of Object.entries(plan)) {
    const ops = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].filter((op) => rights[op]);
    if (!ops.length) throw new Error('Empty reviewed table privilege');
    statements.push(
      `GRANT ${ops.join(', ')} ON TABLE public.${quoteId(table)} TO ${quoteId(RUNTIME_ROLE)}`
    );
  }
  if (sequenceNames.length) {
    statements.push(
      `GRANT USAGE ON SEQUENCE ${sequenceNames.map((name) => 'public.' + quoteId(name)).join(', ')} TO ${quoteId(RUNTIME_ROLE)}`
    );
  }
  return statements;
}

async function applyGrants() {
  const { PrismaClient } = require('@prisma/client');
  const { assertDatabaseIdentity } = require('./verify-db.cjs');
  const db = new PrismaClient();
  try {
    await assertDatabaseIdentity(db, OWNER_ROLE, 'db');
    const plan = reviewedPlan(ROOT); // static source-aware 94-model gate
    const tables = await db.$queryRawUnsafe(`
      SELECT c.relname::text AS name, pg_get_userbyid(c.relowner)::text AS owner
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p')`);
    const sequences = await db.$queryRawUnsafe(`
      SELECT seq.relname::text AS name, pg_get_userbyid(seq.relowner)::text AS owner,
        tab.relname::text AS "table"
      FROM pg_class seq JOIN pg_namespace n ON n.oid = seq.relnamespace
      LEFT JOIN pg_depend dep ON dep.objid = seq.oid AND dep.classid = 'pg_class'::regclass
        AND dep.refclassid = 'pg_class'::regclass AND dep.deptype IN ('a','i')
      LEFT JOIN pg_class tab ON tab.oid = dep.refobjid
      WHERE n.nspname = 'public' AND seq.relkind = 'S'`);
    const defaults = await db.$queryRawUnsafe(`
      SELECT tab.relname::text AS "table",
        pg_get_serial_sequence(format('public.%I', tab.relname), att.attname)::regclass::text AS sequence
      FROM pg_attrdef def JOIN pg_attribute att ON att.attrelid = def.adrelid AND att.attnum = def.adnum
      JOIN pg_class tab ON tab.oid = def.adrelid JOIN pg_namespace n ON n.oid = tab.relnamespace
      WHERE n.nspname = 'public' AND pg_get_expr(def.adbin, def.adrelid) LIKE '%nextval(%'`);
    // regclass renders public sequences without the schema in some sessions;
    // extract the bare catalog identifier from pg_get_serial_sequence.
    const mappedDefaults = defaults.map((row) => ({
      table: row.table,
      sequence: row.sequence?.replace(/^public\./, '').replace(/^"|"$/g, ''),
    }));
    const needed = checkCatalog(plan, tables, sequences, mappedDefaults);
    const statements = grantStatements(plan, needed);
    await db.$transaction(
      async (tx) => {
        for (const statement of statements) await tx.$executeRawUnsafe(statement);
      },
      { timeout: 60_000 }
    );
    console.log(
      `Fresh runtime privileges: ${Object.keys(plan).length} reviewed tables, ${needed.length} required sequences; unassigned NOLOGIN exporter read-only on AuditLog; no journal/table wildcard grants`
    );
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  applyGrants().catch(() => {
    // Never print Prisma errors: they can include a URL or an SQL statement.
    console.error(
      'Fresh runtime privilege stage failed (details suppressed); review catalog and credentials privately'
    );
    process.exitCode = 1;
  });
}
module.exports = { quoteId, checkCatalog, grantStatements, applyGrants };
