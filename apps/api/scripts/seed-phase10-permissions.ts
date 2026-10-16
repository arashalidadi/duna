import { PrismaClient } from '@prisma/client';
import { Phase10PermissionConflict, seedPhase10Permissions } from '../../../prisma/seed/phase10-permissions';

/** Add only Phase 10 permission codes / ADMIN grants (no business/demo data). */
async function main() {
  const db = new PrismaClient();
  try {
    const result = await db.$transaction(seedPhase10Permissions);
    console.log(`Phase 10: ${result.created} permission code(s), ${result.granted} ADMIN grant(s); no other records touched.`);
  } finally { await db.$disconnect(); }
}
main().catch((error: unknown) => { console.error('Phase 10 permission seed stopped:',
  error instanceof Phase10PermissionConflict ? error.message : 'database or schema error (details omitted to protect credentials)');
  process.exitCode = 1; });
