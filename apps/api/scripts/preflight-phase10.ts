import { PrismaClient } from '@prisma/client';

/** Read-only inspection of the configured TARGET database. No URLs, row data,
 * credentials or personally identifiable fields are ever printed.
 * Use --after after migration/seed to verify the archived copies and alias.
 */
const db = new PrismaClient();
const after = process.argv.includes('--after');
function halt(message: string): never { throw new Error(`PHASE10_PREFLIGHT:${message}`); }
const sum = async (query: string) => {
  // Only constant SQL from THIS module; this function accepts no user SQL.
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(query);
  return Number(rows[0]?.count ?? 0);
};
async function columns(table: string): Promise<Set<string>> {
  // Table is bound, not interpolated into SQL identifiers.
  const rows = await db.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema()
      AND table_name = ${table}`;
  return new Set(rows.map((r) => r.column_name));
}
async function main() {
  const c = await columns('Customer');
  const cargo = await columns('Cargo');
  const port = await columns('Port');
  const phase9 = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*) AS count FROM "_prisma_migrations"
    WHERE migration_name = '20261016010000_phase9_configuration'
      AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  console.log('Phase 9 migration applied:', Number(phase9[0]?.count ?? 0) === 1);
  const phase10 = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*) AS count FROM "_prisma_migrations"
    WHERE migration_name = '20261016090000_phase10_notifications_master_data'
      AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  const deployed = Number(phase10[0]?.count ?? 0) === 1;
  console.log('Phase 10 migration applied:', deployed);
  if (!Number(phase9[0]?.count ?? 0)) halt('Phase 9 is not applied; complete Phase 9 first.');
  if (!after && deployed) halt('Phase 10 is already applied; use --after for postflight.');
  if (after && !deployed) halt('Phase 10 is not applied; do not call this a postflight.');
  if (!after && !['type', 'shortName', 'taxId', 'currency'].every((v) => c.has(v))) {
    halt('Expected legacy Customer columns are missing; inspect target schema before deploy.');
  }
  if (after && (c.has('type') || !c.has('personKind'))) {
    halt('Customer cutover incomplete; inspect migration state.');
  }
  if (!['chassis', 'serial', 'comment', 'units', 'chassisNumber', 'serialNumber', 'comments', 'quantity'].every((v) => cargo.has(v))) {
    halt('Expected Cargo source/canonical columns are missing; inspect target schema before continuing.');
  }
  if (after && !port.has('displayName')) halt('Port schema cutover incomplete.');
  const states = await db.$queryRaw<Array<{ status: string; count: bigint }>>`
    SELECT "status"::text AS status, count(*) AS count FROM "LoadList" GROUP BY "status"::text ORDER BY status`;
  console.log('Load List statuses (all six historical enum values retained):',
    Object.fromEntries(states.map((s) => [s.status, Number(s.count)])));
  const historical = states.filter((s) => !['DRAFT', 'FINALIZED', 'CANCELLED'].includes(s.status));
  if (historical.length) console.log('Historical Load List states retained (ADR-041; row-level mapping deferred):',
    Object.fromEntries(historical.map((s) => [s.status, Number(s.count)])));
  console.log('Port rows missing city/region:', await sum('SELECT count(*) AS count FROM "Port" WHERE "deletedAt" IS NULL AND ("city" IS NULL OR btrim("city") = \'\')'));
  console.log('Port rows missing abbreviation:', await sum('SELECT count(*) AS count FROM "Port" WHERE "deletedAt" IS NULL AND ("abbreviation" IS NULL OR btrim("abbreviation") = \'\')'));
  console.log('Standalone Rajaee port rows (must not auto-merge):', await sum("SELECT count(*) AS count FROM \"Port\" WHERE upper(btrim(\"name\")) = 'RAJAEE'"));
  console.log('Existing Khalifa Port rows (preserved, not evidence for reference seed):', await sum("SELECT count(*) AS count FROM \"Port\" WHERE upper(btrim(\"name\")) = 'KHALIFA PORT'"));
  if (c.has('type')) {
    console.log('Customer rows holding legacy prohibited values (to be archived):',
      await sum('SELECT count(*) AS count FROM "Customer" WHERE "type" IS NOT NULL OR "shortName" IS NOT NULL OR "taxId" IS NOT NULL OR "currency" IS NOT NULL'));
  } else if (c.has('personKind')) {
    console.log('Customer legacy archive rows:', await sum('SELECT count(*) AS count FROM "CustomerLegacyAttribute"'));
  }
  if (cargo.has('chassis') && cargo.has('units')) {
    console.log('Cargo rows with old columns (to be archived, not dropped on deploy):',
      await sum('SELECT count(*) AS count FROM "Cargo" WHERE "chassis" IS NOT NULL OR "serial" IS NOT NULL OR "comment" IS NOT NULL OR "units" IS NOT NULL'));
    console.log('Cargo conflicting old/new nonblank values (both retained):',
      await sum(`SELECT count(*) AS count FROM "Cargo" WHERE
        (nullif(btrim("chassis"),'') IS NOT NULL AND nullif(btrim("chassisNumber"),'') IS NOT NULL AND btrim("chassis") <> btrim("chassisNumber"))
        OR (nullif(btrim("serial"),'') IS NOT NULL AND nullif(btrim("serialNumber"),'') IS NOT NULL AND btrim("serial") <> btrim("serialNumber"))
        OR (nullif(btrim("comment"),'') IS NOT NULL AND nullif(btrim("comments"),'') IS NOT NULL AND btrim("comment") <> btrim("comments"))
        OR ("units" IS NOT NULL AND "quantity" IS NOT NULL AND "units" <> "quantity")`));
    if (after) {
      console.log('Cargo archive rows:', await sum('SELECT count(*) AS count FROM "CargoLegacyAttribute"'));
      const mismatches = await sum(`SELECT count(*) AS count FROM "Cargo" c
        LEFT JOIN "CargoLegacyAttribute" a ON a."cargoId" = c."id"
        WHERE (c."chassis" IS NOT NULL OR c."serial" IS NOT NULL OR c."comment" IS NOT NULL OR c."units" IS NOT NULL)
          AND (a."cargoId" IS NULL OR a."chassis" IS DISTINCT FROM c."chassis"
            OR a."serial" IS DISTINCT FROM c."serial" OR a."comment" IS DISTINCT FROM c."comment"
            OR a."units" IS DISTINCT FROM c."units")`);
      console.log('Cargo legacy archive mismatches:', mismatches);
      if (mismatches) halt('Cargo copy differs; stop and investigate, do not contract.');
    }
  }
  if (after && port.has('displayName')) {
    const aliases = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) AS count FROM "PortAlias" a JOIN "Port" p ON p."id" = a."portId"
      WHERE a."key" = 'RAJAEE' AND p."abbreviation" = 'RJS'`;
    const aliasCount = Number(aliases[0]?.count ?? 0);
    console.log('Rajaee alias on canonical RJS port:', aliasCount);
    if (aliasCount !== 1) halt('Reference port alias missing/ambiguous; inspect seed and target rows.');
  }
  console.log(after ? 'Postflight archival checks passed. NOT NULL/legacy contraction still require verified owner-data reconciliation.'
    : 'Preflight read-only checks passed (data review still required).');
}
main().catch((error: unknown) => { console.error('Phase 10 inspection stopped:',
  error instanceof Error && error.message.startsWith('PHASE10_PREFLIGHT:')
    ? error.message.slice('PHASE10_PREFLIGHT:'.length)
    : 'Database connection or schema error (details omitted to protect credentials).');
  process.exitCode = 1; })
  .finally(async () => { await db.$disconnect(); });
