import { PrismaClient } from '@prisma/client';
import { seedCore } from './seed/core';
import { seedDemo } from './seed/demo';

const prisma = new PrismaClient();

/**
 * Phase 1 (A3) — demonstration data is OPT-IN.
 *
 * Before this change the seed unconditionally inserted fabricated vessels,
 * voyages, customers, cargo, inspections and load lists. Running `pnpm db:seed`
 * against production therefore created fake business records that are
 * afterwards indistinguishable from real ones, and that have to be hunted down
 * by hand.
 *
 * The default path now writes only reference/configuration data plus the
 * administrator account (see ./seed/core.ts). Sample business records are
 * written only when SEED_DEMO_DATA is exactly the string "true" — a deliberate,
 * explicit opt-in, never a default, and never inferred from NODE_ENV.
 */
function demoDataEnabled(): boolean {
  return process.env.SEED_DEMO_DATA === 'true';
}

async function main(): Promise<void> {
  console.log('Seeding database...');

  const core = await seedCore(prisma);

  if (!demoDataEnabled()) {
    console.log('  Demo data: SKIPPED (SEED_DEMO_DATA is not "true").');
    console.log('  No vessels, voyages, customers, cargo or load lists were created.');
    console.log('  For the sample dataset on a DEVELOPMENT database only:');
    console.log('    SEED_DEMO_DATA=true pnpm db:seed');
    console.log('Seeding complete.');
    return;
  }

  console.warn('');
  console.warn('  ================================================================');
  console.warn('  !!  SEED_DEMO_DATA=true — writing FABRICATED sample records.   !!');
  console.warn('  !!  Never use this against a production database: once the    !!');
  console.warn('  !!  rows exist they are indistinguishable from real records.  !!');
  console.warn('  ================================================================');
  console.warn('');

  await seedDemo(prisma, core);

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
