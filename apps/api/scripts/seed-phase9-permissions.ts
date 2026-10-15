import { PrismaClient } from '@prisma/client';
import { seedPhase9Permissions } from '../../../prisma/seed/phase9-permissions';

/** Add only the Phase 9 permission codes and ADMIN role grants. No demo data,
 * master-data upsert, owner-account changes or destructive reconciliation. */
async function main() {
  const db = new PrismaClient();
  try {
    const result = await db.$transaction(seedPhase9Permissions);
    console.log(`Phase 9 permission registry: ${result.created} new codes, ${result.granted} new ADMIN grants; 0 business records touched.`);
  } finally { await db.$disconnect(); }
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
