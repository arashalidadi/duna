import { PrismaClient } from '@prisma/client';

/** Phase-6-only additive reference seed. Unlike the full core seed it never
 * updates an existing currency, port, account, setting, user or financial row. */
const currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$', sortOrder: 1 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', sortOrder: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', sortOrder: 3 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', sortOrder: 4 },
  { code: 'IRR', name: 'Iranian Rial', symbol: '﷼', sortOrder: 5 },
];

const permissions = [
  { code: 'currency:manage', module: 'currency', action: 'manage' },
  { code: 'currency_rate:read', module: 'currency_rate', action: 'read' },
  { code: 'currency_rate:create', module: 'currency_rate', action: 'create' },
  { code: 'currency_rate:update', module: 'currency_rate', action: 'update' },
  { code: 'currency_rate:approve', module: 'currency_rate', action: 'approve' },
  { code: 'currency_rate:override', module: 'currency_rate', action: 'override' },
  { code: 'account:manage', module: 'account', action: 'manage' },
  { code: 'journal:read', module: 'journal', action: 'read' },
  { code: 'journal:post', module: 'journal', action: 'post' },
  { code: 'journal:reverse', module: 'journal', action: 'reverse' },
  { code: 'expense:post', module: 'expense', action: 'post' },
  { code: 'ledger:reconcile', module: 'ledger', action: 'reconcile' },
  { code: 'voucher:allocate', module: 'voucher', action: 'allocate' },
  { code: 'voucher:adjust', module: 'voucher', action: 'adjust' },
] as const;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required for the additive Phase 6 reference seed.');
    process.exitCode = 2;
    return;
  }
  const prisma = new PrismaClient();
  try {
    const adminRolePresent = await prisma.$transaction(async (tx) => {
      const admin = await tx.role.findUnique({ where: { code: 'ADMIN' }, select: { id: true } });
      for (const currency of currencies) {
        await tx.currency.upsert({ where: { code: currency.code }, update: {}, create: currency });
      }
      for (const permission of permissions) {
        const row = await tx.permission.upsert({
          where: { code: permission.code }, update: {}, create: permission,
        });
        if (admin) {
          await tx.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: admin.id, permissionId: row.id } },
            update: {}, create: { roleId: admin.id, permissionId: row.id },
          });
        }
      }
      return !!admin;
    }, { timeout: 30_000 });
    console.log(`Phase 6 reference currencies and permissions upserted; ADMIN grants: ${adminRolePresent ? 'additive' : 'skipped (no ADMIN role)'}. Existing records were not updated.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 2; });
