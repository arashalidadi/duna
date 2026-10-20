import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import { seedPhase9Permissions } from '../../../prisma/seed/phase9-permissions';
import {
  Phase10PermissionConflict,
  seedPhase10Permissions,
} from '../../../prisma/seed/phase10-permissions';
import {
  Phase10PortConflict,
  seedPhase10Ports as seedPhase10PortRows,
} from '../../../prisma/seed/phase10-ports';

/**
 * Additive reference/permission seed, one entry point for every set.
 *
 * Consolidates the five former per-phase wrappers (seed-phase6-reference.ts,
 * seed-phase7-reference.ts, seed-phase9-permissions.ts,
 * seed-phase10-permissions.ts, seed-phase10-ports.ts). Behaviour is unchanged:
 * every set is upsert-only and idempotent, never writes business or demo
 * records, never updates an existing row, and never revokes a grant.
 *
 * Deliberately NOT part of this script: the Phase 11 and Phase 12 permission
 * seeds. Those are identity-verified *deployment* operations with their own
 * database/owner/trigger preconditions and are invoked by explicit path from
 * the phase11/phase12 server workflows, so they stay as separate files.
 *
 * Usage:
 *   tsx apps/api/scripts/seed-reference.ts            # every set, in order
 *   tsx apps/api/scripts/seed-reference.ts --set phase7
 */

/** Additive Phase 6 financial vocabulary: currencies + permission codes. */
const phase6Currencies = [
  { code: 'USD', name: 'US Dollar', symbol: '$', sortOrder: 1 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', sortOrder: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', sortOrder: 3 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', sortOrder: 4 },
  { code: 'IRR', name: 'Iranian Rial', symbol: '﷼', sortOrder: 5 },
];

const phase6Permissions = [
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

/** Additive Phase 7 vocabulary: reporting permissions + voyage cost categories. */
const phase7Permissions = [
  { code: 'expense:read', module: 'expense', action: 'read' },
  { code: 'report:read', module: 'report', action: 'read' },
  { code: 'report:design', module: 'report', action: 'design' },
  { code: 'report:export', module: 'report', action: 'export' },
  { code: 'report:cost_manage', module: 'report', action: 'cost_manage' },
  { code: 'report:statement_issue', module: 'report', action: 'statement_issue' },
] as const;

const phase7CostCategories = [
  { code: 'VESSEL_HIRE', name: 'Vessel Hire' },
  { code: 'PORT_USE', name: 'Port Use' },
  { code: 'PORT_HANDLING', name: 'Port Handling' },
  { code: 'LASHING', name: 'Lashing' },
  { code: 'OTHER', name: 'Other voyage-related costs' },
] as const;

/** Upsert permission codes and grant any newly created code to ADMIN. */
async function upsertPermissions(
  tx: Prisma.TransactionClient,
  permissions: ReadonlyArray<{ code: string; module: string; action: string }>,
): Promise<void> {
  const admin = await tx.role.findUnique({ where: { code: 'ADMIN' }, select: { id: true } });
  for (const permission of permissions) {
    const row = await tx.permission.upsert({
      where: { code: permission.code },
      update: {},
      create: permission,
    });
    if (admin) {
      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: admin.id, permissionId: row.id } },
        update: {},
        create: { roleId: admin.id, permissionId: row.id },
      });
    }
  }
}

async function runPhase6(prisma: PrismaClient): Promise<string> {
  const adminRolePresent = await prisma.$transaction(async (tx) => {
    const admin = await tx.role.findUnique({ where: { code: 'ADMIN' }, select: { id: true } });
    for (const currency of phase6Currencies) {
      await tx.currency.upsert({ where: { code: currency.code }, update: {}, create: currency });
    }
    await upsertPermissions(tx, phase6Permissions);
    return !!admin;
  }, { timeout: 30_000 });
  return `Phase 6 currencies and permissions upserted; ADMIN grants: ${
    adminRolePresent ? 'additive' : 'skipped (no ADMIN role)'
  }. Existing records were not updated.`;
}

async function runPhase7(prisma: PrismaClient): Promise<string> {
  await prisma.$transaction(async (tx) => {
    await upsertPermissions(tx, phase7Permissions);
    for (const category of phase7CostCategories) {
      await tx.voyageCostCategory.upsert({
        where: { code: category.code },
        update: {},
        create: { ...category, createdById: 'system:phase7-seed' },
      });
    }
  }, { timeout: 30_000 });
  return 'Phase 7 permissions and cost categories added if absent; existing rows and grants retained.';
}

async function runPhase9(prisma: PrismaClient): Promise<string> {
  const result = await prisma.$transaction(seedPhase9Permissions);
  return `Phase 9 permission registry: ${result.created} new codes, ${result.granted} new ADMIN grants; 0 business records touched.`;
}

async function runPhase10(prisma: PrismaClient): Promise<string> {
  const result = await prisma.$transaction(seedPhase10Permissions);
  return `Phase 10: ${result.created} permission code(s), ${result.granted} ADMIN grant(s); no other records touched.`;
}

async function runPhase10Ports(prisma: PrismaClient): Promise<string> {
  const result = await seedPhase10PortRows(prisma);
  const missing = result.incomplete.map((p) => p.code).join(', ') || '(none)';
  return (
    `Phase 10 reference ports: ${result.canonical} canonical names, ${result.created} created, ` +
    `${result.backfilled} verified blanks completed, Rajaee alias created: ${result.aliasCreated}.\n` +
    `  Still missing city/verified abbreviation (review before activation/NOT NULL): ${missing}`
  );
}

const SETS = {
  phase6: runPhase6,
  phase7: runPhase7,
  phase9: runPhase9,
  phase10: runPhase10,
  'phase10-ports': runPhase10Ports,
} as const;

type SetName = keyof typeof SETS;
const SET_NAMES = Object.keys(SETS) as SetName[];

/** Known guard classes whose message is safe (and useful) to surface. */
const KNOWN_CONFLICTS = [Phase10PermissionConflict, Phase10PortConflict];

function requestedSets(argv: string[]): SetName[] {
  const index = argv.indexOf('--set');
  if (index < 0) return SET_NAMES;
  const value = argv[index + 1];
  if (!value || !(value in SETS)) {
    throw new Error(`Unknown --set "${value ?? ''}". Expected one of: ${SET_NAMES.join(', ')}`);
  }
  return [value as SetName];
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required for the additive reference seed.');
    process.exitCode = 2;
    return;
  }
  const sets = requestedSets(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    for (const name of sets) {
      try {
        console.log(await SETS[name](prisma));
      } catch (error: unknown) {
        // Same reporting contract as the former per-phase scripts: a known
        // conflict prints its message, anything else is summarised so no
        // credential or connection-string detail can leak into a log.
        console.error(
          `Reference seed stopped (${name}):`,
          KNOWN_CONFLICTS.some((kind) => error instanceof kind)
            ? (error as Error).message
            : 'database or schema error (details omitted to protect credentials)',
        );
        process.exitCode = 1;
        return;
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unexpected seed failure');
  process.exitCode = 2;
});
