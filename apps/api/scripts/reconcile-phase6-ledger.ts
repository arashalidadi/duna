import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { CustomerPostingService } from '../src/modules/finance/customer-posting.service';

/**
 * READ ONLY. Run after deploying the additive P6 migration, against the owner's
 * existing duna_seed_test connection (DATABASE_URL). Compares every customer,
 * including inactive/deleted, by source/date/currency and debit/credit/closing.
 * Exit 0 = exact match, 1 = drift, 2 = missing URL or query failure.
 * Does not enable or switch the customer statement read path.
 */
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required (read-only reconciliation).');
    process.exitCode = 2;
    return;
  }
  const prisma = new PrismaClient();
  try {
    const result = await new CustomerPostingService(prisma).reconcileAll();
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.passed ? 0 : 1;
  } catch (error) {
    console.error('Reconciliation could not complete:', error);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 2; });
