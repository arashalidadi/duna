import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

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
  { code: 'voucher:read', module: 'voucher', action: 'read' },
  { code: 'voucher:create', module: 'voucher', action: 'create' },
  { code: 'voucher:update', module: 'voucher', action: 'update' },
  { code: 'voucher:delete', module: 'voucher', action: 'delete' },
  { code: 'voucher:cancel', module: 'voucher', action: 'cancel' },
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

  // Assign all permissions to ADMIN
  for (const permissionId of Object.values(createdPermissions)) {
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
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: 'System Administrator',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email: adminEmail,
      passwordHash,
      fullName: 'System Administrator',
      isActive: true,
      passwordChangedAt: new Date(),
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });
  console.log(`  Admin user seeded: ${adminEmail}`);

  // ==========================================================================
  // Phase 7: Load Planning Sample Data
  // ==========================================================================
  // Create a vessel and voyage for testing load planning.
  const vessel = await prisma.vessel.upsert({
    where: { code: 'MV-HORIZON' },
    update: { name: 'MV Horizon', flag: 'UAE', vesselType: 'CONTAINER', capacityTeu: 1500, isActive: true },
    create: { code: 'MV-HORIZON', name: 'MV Horizon', flag: 'UAE', vesselType: 'CONTAINER', capacityTeu: 1500, isActive: true },
  });

  const voyage = await prisma.voyage.upsert({
    where: { voyageNumber: 'VOY-2401-00001' },
    update: {
      vesselId: vessel.id,
      status: 'SCHEDULED',
      originPortId: jebelAli.id,
      destinationPortId: khalfan.id,
      plannedDepartureAt: new Date('2026-10-15T08:00:00Z'),
      plannedArrivalAt: new Date('2026-10-22T08:00:00Z'),
    },
    create: {
      voyageNumber: 'VOY-2401-00001',
      vesselId: vessel.id,
      status: 'SCHEDULED',
      originPortId: jebelAli.id,
      destinationPortId: khalfan.id,
      plannedDepartureAt: new Date('2026-10-15T08:00:00Z'),
      plannedArrivalAt: new Date('2026-10-22T08:00:00Z'),
      createdById: adminUser.id,
    },
  });

  // Create sample customers
  const customer1 = await prisma.customer.upsert({
    where: { code: 'CUS-GLOBAL' },
    update: { name: 'Global Shipping Co', shortName: 'GSC', type: 'SHIPPER', email: 'ops@globalship.example', isActive: true },
    create: { code: 'CUS-GLOBAL', name: 'Global Shipping Co', shortName: 'GSC', type: 'SHIPPER', email: 'ops@globalship.example', isActive: true },
  });

  const customer2 = await prisma.customer.upsert({
    where: { code: 'CUS-AUTO' },
    update: { name: 'Auto Logistics Ltd', shortName: 'ALL', type: 'SHIPPER', email: 'ops@autolog.example', isActive: true },
    create: { code: 'CUS-AUTO', name: 'Auto Logistics Ltd', shortName: 'ALL', type: 'SHIPPER', email: 'ops@autolog.example', isActive: true },
  });

  // Create sample cargo with different inspection statuses
  const cargoApproved = await prisma.cargo.upsert({
    where: { reference: 'CRG-2401-APPROVED' },
    update: {
      customerId: customer1.id,
      portId: jebelAli.id,
      yardId: null,
      cargoType: 'CONTAINER',
      specification: 'Standard 20ft container, electronics',
      quantity: 20,
      weight: 5000,
      weightUnit: 'KG',
      inspectionStatus: 'APPROVED',
      status: 'READY',
      createdById: adminUser.id,
    },
    create: {
      reference: 'CRG-2401-APPROVED',
      customerId: customer1.id,
      portId: jebelAli.id,
      cargoType: 'CONTAINER',
      specification: 'Standard 20ft container, electronics',
      quantity: 20,
      weight: 5000,
      weightUnit: 'KG',
      inspectionStatus: 'APPROVED',
      status: 'READY',
      createdById: adminUser.id,
    },
  });

  const cargoPending = await prisma.cargo.upsert({
    where: { reference: 'CRG-2401-PENDING' },
    update: {
      customerId: customer2.id,
      portId: jebelAli.id,
      yardId: null,
      cargoType: 'VEHICLE',
      specification: '2025 SUV units, 50 units',
      quantity: 50,
      weight: 12000,
      weightUnit: 'KG',
      inspectionStatus: 'PENDING',
      status: 'AT_YARD',
      createdById: adminUser.id,
    },
    create: {
      reference: 'CRG-2401-PENDING',
      customerId: customer2.id,
      portId: jebelAli.id,
      cargoType: 'VEHICLE',
      specification: '2025 SUV units, 50 units',
      quantity: 50,
      weight: 12000,
      weightUnit: 'KG',
      inspectionStatus: 'PENDING',
      status: 'AT_YARD',
      createdById: adminUser.id,
    },
  });

  const cargoRejected = await prisma.cargo.upsert({
    where: { reference: 'CRG-2401-REJECTED' },
    update: {
      customerId: customer1.id,
      portId: khalfan.id,
      yardId: null,
      cargoType: 'GENERAL',
      specification: 'General cargo, palletized',
      quantity: 100,
      weight: 8000,
      weightUnit: 'KG',
      inspectionStatus: 'REJECTED',
      status: 'AT_YARD',
      createdById: adminUser.id,
    },
    create: {
      reference: 'CRG-2401-REJECTED',
      customerId: customer1.id,
      portId: khalfan.id,
      cargoType: 'GENERAL',
      specification: 'General cargo, palletized',
      quantity: 100,
      weight: 8000,
      weightUnit: 'KG',
      inspectionStatus: 'REJECTED',
      status: 'AT_YARD',
      createdById: adminUser.id,
    },
  });

  // Create inspections matching the cargo statuses
  await prisma.inspection.upsert({
    where: { inspectionNumber: 'INS-2401-00001' },
    update: {
      cargoId: cargoApproved.id,
      status: 'APPROVED',
      inspectionDate: new Date('2026-09-01T10:00:00Z'),
      inspectorName: 'John Inspector',
      findings: 'All items verified, no damage.',
      verificationNotes: 'Serial numbers match, quantity confirmed.',
      approvedById: adminUser.id,
      approvedAt: new Date('2026-09-01T12:00:00Z'),
      createdById: adminUser.id,
    },
    create: {
      inspectionNumber: 'INS-2401-00001',
      cargoId: cargoApproved.id,
      status: 'APPROVED',
      inspectionDate: new Date('2026-09-01T10:00:00Z'),
      inspectorName: 'John Inspector',
      findings: 'All items verified, no damage.',
      verificationNotes: 'Serial numbers match, quantity confirmed.',
      approvedById: adminUser.id,
      approvedAt: new Date('2026-09-01T12:00:00Z'),
      createdById: adminUser.id,
    },
  });

  await prisma.inspection.upsert({
    where: { inspectionNumber: 'INS-2401-00002' },
    update: {
      cargoId: cargoPending.id,
      status: 'PENDING',
      inspectionDate: new Date('2026-09-01T14:00:00Z'),
      inspectorName: 'Jane Inspector',
      findings: 'Awaiting documentation review.',
      verificationNotes: 'Pending bill of lading copies.',
      createdById: adminUser.id,
    },
    create: {
      inspectionNumber: 'INS-2401-00002',
      cargoId: cargoPending.id,
      status: 'PENDING',
      inspectionDate: new Date('2026-09-01T14:00:00Z'),
      inspectorName: 'Jane Inspector',
      findings: 'Awaiting documentation review.',
      verificationNotes: 'Pending bill of lading copies.',
      createdById: adminUser.id,
    },
  });

  await prisma.inspection.upsert({
    where: { inspectionNumber: 'INS-2401-00003' },
    update: {
      cargoId: cargoRejected.id,
      status: 'REJECTED',
      inspectionDate: new Date('2026-09-01T16:00:00Z'),
      inspectorName: 'Bob Inspector',
      findings: 'Packaging damage on 5 units, missing documentation.',
      verificationNotes: 'Damage exceeds threshold.',
      rejectionReason: 'Packaging damage exceeds acceptable limits; documentation incomplete.',
      rejectedById: adminUser.id,
      rejectedAt: new Date('2026-09-01T18:00:00Z'),
      createdById: adminUser.id,
    },
    create: {
      inspectionNumber: 'INS-2401-00003',
      cargoId: cargoRejected.id,
      status: 'REJECTED',
      inspectionDate: new Date('2026-09-01T16:00:00Z'),
      inspectorName: 'Bob Inspector',
      findings: 'Packaging damage on 5 units, missing documentation.',
      verificationNotes: 'Damage exceeds threshold.',
      rejectionReason: 'Packaging damage exceeds acceptable limits; documentation incomplete.',
      rejectedById: adminUser.id,
      rejectedAt: new Date('2026-09-01T18:00:00Z'),
      createdById: adminUser.id,
    },
  });

  // Create a sample Load List with the approved cargo
  const loadList = await prisma.loadList.upsert({
    where: { loadListNumber: 'LL-2401-00001' },
    update: {
      voyageId: voyage.id,
      status: 'DRAFT',
      notes: 'Sample load list for Phase 7 testing',
      createdById: adminUser.id,
    },
    create: {
      loadListNumber: 'LL-2401-00001',
      voyageId: voyage.id,
      status: 'DRAFT',
      notes: 'Sample load list for Phase 7 testing',
      createdById: adminUser.id,
    },
  });

  // Add the approved cargo to the load list
  await prisma.loadListItem.upsert({
    where: { loadListId_cargoId: { loadListId: loadList.id, cargoId: cargoApproved.id } },
    update: { plannedQuantity: 20, sequence: 1, notes: 'Approved electronics containers' },
    create: { loadListId: loadList.id, cargoId: cargoApproved.id, plannedQuantity: 20, sequence: 1, notes: 'Approved electronics containers' },
  });

  console.log('  Phase 7 sample data seeded: vessel, voyage, 3 cargo (approved/pending/rejected), inspections, 1 load list');

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
