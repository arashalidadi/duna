import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/** Add-only Phase 7 reference seed. No sample documents, costs, roles revoked,
 * balances updated, or existing category names changed. Safe to repeat. */
const permissions = [
  { code: 'expense:read', module: 'expense', action: 'read' },
  { code: 'report:read', module: 'report', action: 'read' },
  { code: 'report:design', module: 'report', action: 'design' },
  { code: 'report:export', module: 'report', action: 'export' },
  { code: 'report:cost_manage', module: 'report', action: 'cost_manage' },
  { code: 'report:statement_issue', module: 'report', action: 'statement_issue' },
] as const;
const categories = [
  { code: 'VESSEL_HIRE', name: 'Vessel Hire' },
  { code: 'PORT_USE', name: 'Port Use' },
  { code: 'PORT_HANDLING', name: 'Port Handling' },
  { code: 'LASHING', name: 'Lashing' },
  { code: 'OTHER', name: 'Other voyage-related costs' },
] as const;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      const admin = await tx.role.findUnique({ where: { code: 'ADMIN' }, select: { id: true } });
      for (const permission of permissions) {
        const row = await tx.permission.upsert({ where: { code: permission.code }, update: {}, create: permission });
        if (admin) await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: admin.id, permissionId: row.id } },
          update: {}, create: { roleId: admin.id, permissionId: row.id },
        });
      }
      for (const category of categories) await tx.voyageCostCategory.upsert({
        where: { code: category.code }, update: {},
        create: { ...category, createdById: 'system:phase7-seed' },
      });
    }, { timeout: 30_000 });
    console.log('Phase 7 permissions and cost categories added if absent; existing rows and grants retained.');
  } finally { await prisma.$disconnect(); }
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 2; });
