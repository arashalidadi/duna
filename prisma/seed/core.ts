import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Phase 1 (A3) — REQUIRED seed data.
 *
 * Everything in this module is reference/configuration data the application
 * cannot run without: currencies, the permission registry, roles, ports and
 * yards, company settings, and the administrator account.
 *
 * It contains NO fabricated business records. Sample cargo, customers, vessels,
 * voyages and load lists live in ./demo.ts and are only written when the
 * operator explicitly opts in with SEED_DEMO_DATA=true.
 */
export interface SeedCoreResult {
  adminUser: { id: string; email: string };
  ports: {
    jebelAli: { id: string; code: string };
    khalfan: { id: string; code: string };
  };
}

export async function seedCore(prisma: PrismaClient): Promise<SeedCoreResult> {

  // ==========================================================================
  // Currencies
  // ==========================================================================
  const usd = await prisma.currency.upsert({
    where: { code: 'USD' },
    update: { name: 'US Dollar', symbol: '$', isActive: true, sortOrder: 1 },
    create: { code: 'USD', name: 'US Dollar', symbol: '$', isActive: true, sortOrder: 1 },
  });
  const aed = await prisma.currency.upsert({
    where: { code: 'AED' },
    update: { name: 'UAE Dirham', symbol: 'د.إ', isActive: true, sortOrder: 2 },
    create: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', isActive: true, sortOrder: 2 },
  });
  console.log(`  Currencies seeded: ${usd.code}, ${aed.code}`);

  // ==========================================================================
  // Permissions (foundational RBAC vocabulary — Phase 2)
  // Conventions: `module:action`. Stable codes; future business modules extend
  // this registry via the same seeding mechanism (never arbitrary runtime edits).
  // ==========================================================================
  const permissionSeed = [
    { code: 'dashboard:read', module: 'dashboard', action: 'read' },
    // Auth & account access
    { code: 'auth:read', module: 'auth', action: 'read' },
    // Currency reference (read-only)
    { code: 'currency:read', module: 'currency', action: 'read' },
    // User management
    { code: 'user:read', module: 'user', action: 'read' },
    { code: 'user:create', module: 'user', action: 'create' },
    { code: 'user:update', module: 'user', action: 'update' },
    { code: 'user:delete', module: 'user', action: 'delete' },
    { code: 'user:activate', module: 'user', action: 'activate' },
    { code: 'user:roles', module: 'user', action: 'roles' },
    // Role management
    { code: 'role:read', module: 'role', action: 'read' },
    { code: 'role:create', module: 'role', action: 'create' },
    { code: 'role:update', module: 'role', action: 'update' },
    { code: 'role:delete', module: 'role', action: 'delete' },
    { code: 'role:permissions', module: 'role', action: 'permissions' },
    // Permission registry (view-only)
    { code: 'permission:read', module: 'permission', action: 'read' },
    // Geographies
    { code: 'port:read', module: 'port', action: 'read' },
    { code: 'port:create', module: 'port', action: 'create' },
    { code: 'port:update', module: 'port', action: 'update' },
    { code: 'yard:read', module: 'yard', action: 'read' },
    { code: 'yard:create', module: 'yard', action: 'create' },
    { code: 'yard:update', module: 'yard', action: 'update' },
    // Commercial master data
    { code: 'customer:read', module: 'customer', action: 'read' },
    { code: 'customer:create', module: 'customer', action: 'create' },
    { code: 'customer:update', module: 'customer', action: 'update' },
    // Cargo (Phase 4)
    { code: 'cargo:read', module: 'cargo', action: 'read' },
    { code: 'cargo:create', module: 'cargo', action: 'create' },
    { code: 'cargo:update', module: 'cargo', action: 'update' },
    { code: 'cargo:transition', module: 'cargo', action: 'transition' },
    { code: 'cargo:delete', module: 'cargo', action: 'delete' },
    // Yard Inventory (Phase 4)
    { code: 'yard-inventory:read', module: 'yard-inventory', action: 'read' },
    { code: 'yard-inventory:create', module: 'yard-inventory', action: 'create' },
    { code: 'yard-inventory:update', module: 'yard-inventory', action: 'update' },
    { code: 'yard-inventory:remove', module: 'yard-inventory', action: 'remove' },
    // Inspection (Phase 5)
    { code: 'inspection:read', module: 'inspection', action: 'read' },
    { code: 'inspection:create', module: 'inspection', action: 'create' },
    { code: 'inspection:update', module: 'inspection', action: 'update' },
    { code: 'inspection:approve', module: 'inspection', action: 'approve' },
    { code: 'inspection:reject', module: 'inspection', action: 'reject' },
    // Vessel (Phase 6)
    { code: 'vessel:read', module: 'vessel', action: 'read' },
    { code: 'vessel:create', module: 'vessel', action: 'create' },
    { code: 'vessel:update', module: 'vessel', action: 'update' },
    { code: 'vessel:activate', module: 'vessel', action: 'activate' },
    // Voyage (Phase 6)
    { code: 'voyage:read', module: 'voyage', action: 'read' },
    { code: 'voyage:create', module: 'voyage', action: 'create' },
    { code: 'voyage:update', module: 'voyage', action: 'update' },
    { code: 'voyage:schedule', module: 'voyage', action: 'schedule' },
    { code: 'voyage:start', module: 'voyage', action: 'start' },
    { code: 'voyage:complete', module: 'voyage', action: 'complete' },
    { code: 'voyage:cancel', module: 'voyage', action: 'cancel' },
// Load Planning (Phase 7)
  { code: 'load_list:read', module: 'load_list', action: 'read' },
  { code: 'load_list:create', module: 'load_list', action: 'create' },
  { code: 'load_list:update', module: 'load_list', action: 'update' },
  { code: 'load_list:delete', module: 'load_list', action: 'delete' },
  { code: 'load_list:finalize', module: 'load_list', action: 'finalize' },
  { code: 'load_list:cancel', module: 'load_list', action: 'cancel' },
  // Actual Loading (Phase 8)
  { code: 'actual_loading:read', module: 'actual_loading', action: 'read' },
  { code: 'actual_loading:create', module: 'actual_loading', action: 'create' },
  { code: 'actual_loading:update', module: 'actual_loading', action: 'update' },
  { code: 'actual_loading:delete', module: 'actual_loading', action: 'delete' },
  { code: 'actual_loading:complete', module: 'actual_loading', action: 'complete' },
  { code: 'actual_loading:cancel', module: 'actual_loading', action: 'cancel' },
  { code: 'discharge:read', module: 'discharge', action: 'read' },
  { code: 'discharge:create', module: 'discharge', action: 'create' },
  { code: 'discharge:update', module: 'discharge', action: 'update' },
  { code: 'discharge:delete', module: 'discharge', action: 'delete' },
  { code: 'discharge:complete', module: 'discharge', action: 'complete' },
  { code: 'discharge:cancel', module: 'discharge', action: 'cancel' },
  // DEC-044..048 / DEC-116 — audit review. The audit service could always WRITE
  // rows; `audit:read` gates the browse surface added for the primary
  // administrator to review relevant audit records.
  { code: 'audit:read', module: 'audit', action: 'read' },
  { code: 'portal:access', module: 'portal', action: 'read' },
  { code: 'booking:create', module: 'portal', action: 'create' },
  { code: 'booking:read', module: 'portal', action: 'read' },
  { code: 'booking:respond', module: 'portal', action: 'update' },
  // Manifest (Phase 9)
  { code: 'manifest:read', module: 'manifest', action: 'read' },
  { code: 'manifest:create', module: 'manifest', action: 'create' },
  { code: 'manifest:update', module: 'manifest', action: 'update' },
  { code: 'manifest:delete', module: 'manifest', action: 'delete' },
  { code: 'manifest:submit', module: 'manifest', action: 'submit' },
  { code: 'manifest:approve', module: 'manifest', action: 'approve' },
  { code: 'manifest:cancel', module: 'manifest', action: 'cancel' },
  { code: 'invoice:read', module: 'invoice', action: 'read' },
  { code: 'invoice:create', module: 'invoice', action: 'create' },
  { code: 'invoice:update', module: 'invoice', action: 'update' },
  { code: 'invoice:delete', module: 'invoice', action: 'delete' },
  { code: 'invoice:issue', module: 'invoice', action: 'issue' },
  { code: 'invoice:cancel', module: 'invoice', action: 'cancel' },
  // Phase 3 (DEC-020/022): controlled correction and its approval. ADMIN receives these
  // (see the EXPLICIT_GRANT_ONLY note below); other roles need an explicit grant.
  { code: 'invoice:correct', module: 'invoice', action: 'correct' },
  { code: 'invoice:approve_correction', module: 'invoice', action: 'approve_correction' },
  // Phase 4 (DEC-087..092): company settings and identity-document attachments.
  { code: 'settings:read', module: 'settings', action: 'read' },
  { code: 'settings:update', module: 'settings', action: 'update' },
  { code: 'attachment:read', module: 'attachment', action: 'read' },
  { code: 'attachment:create', module: 'attachment', action: 'create' },
  { code: 'attachment:delete', module: 'attachment', action: 'delete' },
  // Identity documents (DEC-092): required on top of the attachment codes above.
  { code: 'attachment:identity', module: 'attachment', action: 'identity' },
  { code: 'voucher:read', module: 'voucher', action: 'read' },
  { code: 'voucher:create', module: 'voucher', action: 'create' },
  { code: 'voucher:update', module: 'voucher', action: 'update' },
  { code: 'voucher:delete', module: 'voucher', action: 'delete' },
  { code: 'voucher:cancel', module: 'voucher', action: 'cancel' },
  // Phase 2: Shipper/Consignee/Agent master data
  { code: 'shipper:read', module: 'shipper', action: 'read' },
  { code: 'shipper:create', module: 'shipper', action: 'create' },
  { code: 'shipper:update', module: 'shipper', action: 'update' },
  { code: 'shipper:delete', module: 'shipper', action: 'delete' },
  { code: 'consignee:read', module: 'consignee', action: 'read' },
  { code: 'consignee:create', module: 'consignee', action: 'create' },
  { code: 'consignee:update', module: 'consignee', action: 'update' },
  { code: 'consignee:delete', module: 'consignee', action: 'delete' },
  { code: 'agent:read', module: 'agent', action: 'read' },
  { code: 'agent:create', module: 'agent', action: 'create' },
  { code: 'agent:update', module: 'agent', action: 'update' },
  { code: 'agent:delete', module: 'agent', action: 'delete' },
  { code: 'ledger:read', module: 'ledger', action: 'read' },
  { code: 'delivery:read', module: 'delivery', action: 'read' },
  { code: 'delivery:create', module: 'delivery', action: 'create' },
  { code: 'delivery:update', module: 'delivery', action: 'update' },
  { code: 'delivery:delete', module: 'delivery', action: 'delete' },
  { code: 'delivery:cancel', module: 'delivery', action: 'cancel' },
  { code: 'release:read', module: 'release', action: 'read' },
  { code: 'release:create', module: 'release', action: 'create' },
  { code: 'release:update', module: 'release', action: 'update' },
  { code: 'release:delete', module: 'release', action: 'delete' },
  { code: 'release:cancel', module: 'release', action: 'cancel' },
  { code: 'release:override', module: 'release', action: 'override' },
  { code: 'proforma:read', module: 'proforma', action: 'read' },
  { code: 'proforma:create', module: 'proforma', action: 'create' },
  { code: 'proforma:update', module: 'proforma', action: 'update' },
  { code: 'proforma:delete', module: 'proforma', action: 'delete' },
  { code: 'proforma:issue', module: 'proforma', action: 'issue' },
  { code: 'proforma:cancel', module: 'proforma', action: 'cancel' },
  { code: 'proforma:convert', module: 'proforma', action: 'convert' },
  { code: 'quotation:read', module: 'quotation', action: 'read' },
  { code: 'quotation:create', module: 'quotation', action: 'create' },
  { code: 'quotation:update', module: 'quotation', action: 'update' },
  { code: 'quotation:delete', module: 'quotation', action: 'delete' },
  { code: 'quotation:send', module: 'quotation', action: 'send' },
  { code: 'quotation:accept', module: 'quotation', action: 'accept' },
  { code: 'quotation:reject', module: 'quotation', action: 'reject' },
  { code: 'quotation:cancel', module: 'quotation', action: 'cancel' },
  { code: 'quotation:convert', module: 'quotation', action: 'convert' },
  { code: 'employee:read', module: 'salary', action: 'read' },
  { code: 'employee:create', module: 'salary', action: 'create' },
  { code: 'employee:update', module: 'salary', action: 'update' },
  { code: 'employee:delete', module: 'salary', action: 'delete' },
  { code: 'salary:read', module: 'salary', action: 'read' },
  { code: 'salary:create', module: 'salary', action: 'create' },
  { code: 'salary:update', module: 'salary', action: 'update' },
  { code: 'salary:approve', module: 'salary', action: 'approve' },
  { code: 'salary:pay', module: 'salary', action: 'pay' },
  { code: 'salary:cancel', module: 'salary', action: 'cancel' },
  { code: 'salary:delete', module: 'salary', action: 'delete' },
  { code: 'bill:read', module: 'bill', action: 'read' },
  { code: 'bill:create', module: 'bill', action: 'create' },
  { code: 'bill:update', module: 'bill', action: 'update' },
  { code: 'bill:delete', module: 'bill', action: 'delete' },
  { code: 'bill:issue', module: 'bill', action: 'issue' },
  { code: 'bill:cancel', module: 'bill', action: 'cancel' },
  // P4-U6 (ADR-046 ruling 2): release is its own permission concept (workflows §3.1
  // step 9). Seeded idempotently by code like every other permission; the ADMIN role
  // receives it via the all-permissions loop below. Other roles are unchanged —
  // role grants are configuration, assigned per deployment (recorded in the P4-U6 log).
  { code: 'bill:release', module: 'bill', action: 'release' },
  { code: 'letter:read', module: 'letters', action: 'read' },
  { code: 'letter:create', module: 'letters', action: 'create' },
  { code: 'letter:update', module: 'letters', action: 'update' },
  { code: 'letter:delete', module: 'letters', action: 'delete' },
  { code: 'letter:send', module: 'letters', action: 'send' },
  { code: 'letter:archive', module: 'letters', action: 'archive' },
  { code: 'job:read', module: 'jobs', action: 'read' },
  { code: 'job:create', module: 'jobs', action: 'create' },
  { code: 'job:update', module: 'jobs', action: 'update' },
  { code: 'job:delete', module: 'jobs', action: 'delete' },
  { code: 'job:start', module: 'jobs', action: 'start' },
  { code: 'job:complete', module: 'jobs', action: 'complete' },
  { code: 'job:cancel', module: 'jobs', action: 'cancel' },
];

  const createdPermissions: Record<string, string> = {};
  for (const p of permissionSeed) {
    const record = await prisma.permission.upsert({
      where: { code: p.code },
      update: { module: p.module, action: p.action },
      create: p,
    });
    createdPermissions[p.code] = record.id;
  }
  console.log(`  Permissions seeded: ${Object.keys(createdPermissions).length}`);

  // ==========================================================================
  // Roles
  // ==========================================================================
  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: { name: 'Administrator', description: 'Full system access', isSystem: true },
    create: {
      code: 'ADMIN',
      name: 'Administrator',
      description: 'Full system access',
      isSystem: true,
    },
  });

  const opsRole = await prisma.role.upsert({
    where: { code: 'OPERATIONS' },
    update: { name: 'Operations', description: 'Operational staff', isSystem: true },
    create: {
      code: 'OPERATIONS',
      name: 'Operations',
      description: 'Operational staff',
      isSystem: true,
    },
  });

  console.log(`  Roles seeded: ${adminRole.code}, ${opsRole.code}`);

  // ==========================================================================
  // DEC-116 / OQ-06 — release-exception authority is a BUSINESS delegation,
  // never a default grant.
  //
  // The ADMIN role is an ordinary administrative role. It must NOT receive
  // `release:override` automatically: the owner confirmed that ordinary managers
  // and administrators must not inherit release-exception approval authority
  // unless it is explicitly assigned. `release:override` is therefore withheld
  // here and may only be granted explicitly by the primary administrator
  // (enforced server-side in RolesService.assertCanGrantReleaseOverride).
  //
  // The primary administrator (company owner) is unaffected: their authority is
  // implicit via User.isPrimaryAdmin and does not depend on role grants.
  //
  // NOTE: this loop only ever ADDS grants (update: {}). It never revokes, so an
  // existing database is not modified by re-running the seed. Revoking an
  // inherited grant requires the separate, audited reconciliation procedure
  // (inspect -> snapshot -> classify -> revoke), which is deliberately NOT done
  // automatically here.
  // ==========================================================================
  // Only codes that a confirmed owner decision reserves for explicit grant belong here.
  // Invoice correction (`invoice:correct`, `invoice:approve_correction`) is NOT reserved
  // by any decision: ADMIN is the system administrator and receives every other
  // catalogue permission, including these two. Managers and other roles still get only
  // what the administrator assigns.
  const EXPLICIT_GRANT_ONLY = new Set<string>(['release:override']);

  for (const [code, permissionId] of Object.entries(createdPermissions)) {
    if (EXPLICIT_GRANT_ONLY.has(code)) {
      console.log(`  Skipped default ADMIN grant (explicit grant required): ${code}`);
      continue;
    }
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId } },
      update: {},
      create: { roleId: adminRole.id, permissionId },
    });
  }

  // ==========================================================================
  // Ports & Yards
  // ==========================================================================
  const jebelAli = await prisma.port.upsert({
    where: { code: 'JEBALI' },
    update: { name: 'Jebel Ali', country: 'UAE', city: 'Dubai', isActive: true },
    create: { code: 'JEBALI', name: 'Jebel Ali', country: 'UAE', city: 'Dubai', isActive: true },
  });

  const khalfan = await prisma.port.upsert({
    where: { code: 'KHALIFA' },
    update: { name: 'Khalifa Port', country: 'UAE', city: 'Abu Dhabi', isActive: true },
    create: {
      code: 'KHALIFA',
      name: 'Khalifa Port',
      country: 'UAE',
      city: 'Abu Dhabi',
      isActive: true,
    },
  });

  await prisma.yard.upsert({
    where: { code: 'JEBALI-Y1' },
    update: { name: 'Jebel Ali Yard 1', portId: jebelAli.id, isActive: true },
    create: { code: 'JEBALI-Y1', name: 'Jebel Ali Yard 1', portId: jebelAli.id, isActive: true },
  });

  await prisma.yard.upsert({
    where: { code: 'KHALIFA-Y1' },
    update: { name: 'Khalifa Yard 1', portId: khalfan.id, isActive: true },
    create: { code: 'KHALIFA-Y1', name: 'Khalifa Yard 1', portId: khalfan.id, isActive: true },
  });

  console.log(`  Ports seeded: ${jebelAli.code}, ${khalfan.code}`);
  console.log('  Yards seeded: JEBALI-Y1, KHALIFA-Y1');

  // ==========================================================================
  // Company settings
  // ==========================================================================
  await prisma.companySettings.upsert({
    where: { id: 'default-company' },
    update: {},
    create: {
      id: 'default-company',
      companyName: 'Shipping Operations ERP',
      timezone: 'Asia/Dubai',
      defaultCurrency: 'USD',
    },
  });
  console.log('  Company settings seeded');

  // ==========================================================================
  // Admin user (Phase 2 will harden this)
  // ==========================================================================
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@shipping.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  // DEC-116 — designate the primary administrator (the company owner).
  //
  // The seed designates the owner's account ONLY when no primary administrator
  // exists yet (idempotent, never overwrites). The account to designate is the
  // SEED_ADMIN_EMAIL address; because the partial unique index permits at most
  // one holder, a second seed run cannot create a second owner.
  const existingPrimary = await prisma.user.findFirst({
    where: { isPrimaryAdmin: true },
    select: { id: true, email: true },
  });
  const shouldDesignatePrimary = existingPrimary === null;

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: 'System Administrator',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      // Never remove the flag from an existing owner; only set it if unclaimed.
      ...(shouldDesignatePrimary ? { isPrimaryAdmin: true } : {}),
    },
    create: {
      email: adminEmail,
      passwordHash,
      fullName: 'System Administrator',
      isActive: true,
      isPrimaryAdmin: shouldDesignatePrimary,
      passwordChangedAt: new Date(),
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });
  console.log(`  Admin user seeded: ${adminEmail}`);

  // Phase 5 (DEC-059/060/061): B/L lifecycle labels. Add-only. An existing row is never
  // updated, so owner-supplied wording survives re-runs. The label defaults to the status code.
  const blLifecycleCodes = ['DRAFT', 'FINAL', 'APPROVED', 'RELEASED', 'ISSUED', 'CANCELLED'] as const;
  for (const [sortOrder, code] of blLifecycleCodes.entries()) {
    await prisma.blLifecycleLabel.upsert({
      where: { code },
      update: {},
      create: { code, label: code, sortOrder },
    });
  }
  console.log(`  B/L lifecycle labels seeded (add-only): ${blLifecycleCodes.length}`);

  return {
    adminUser: { id: adminUser.id, email: adminUser.email },
    ports: {
      jebelAli: { id: jebelAli.id, code: jebelAli.code },
      khalfan: { id: khalfan.id, code: khalfan.code },
    },
  };
}
