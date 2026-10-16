import { PrismaClient } from '@prisma/client';
import { Phase10PortConflict, seedPhase10Ports } from '../../../prisma/seed/phase10-ports';

/** Explicit reference seed; NEVER run demo data or silently merge port rows. */
async function main() {
  const db = new PrismaClient();
  try {
    const result = await seedPhase10Ports(db);
    console.log(`Phase 10 reference ports: ${result.canonical} canonical names, ${result.created} created, ${result.backfilled} verified blanks completed, Rajaee alias created: ${result.aliasCreated}.`);
    console.log('Still missing city/verified abbreviation (review before activation/NOT NULL):',
      result.incomplete.map((p) => p.code).join(', ') || '(none)');
  } finally { await db.$disconnect(); }
}
main().catch((error: unknown) => { console.error('Phase 10 port seed stopped safely:',
  error instanceof Phase10PortConflict ? error.message : 'database or schema error (details omitted to protect credentials)'); process.exitCode = 1; });
