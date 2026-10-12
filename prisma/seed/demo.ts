import type { PrismaClient } from '@prisma/client';
import type { SeedCoreResult } from './core';

/**
 * Phase 1 (A3) — OPTIONAL demonstration data. Never written unless the operator
 * sets SEED_DEMO_DATA=true.
 *
 * These rows are fabricated examples (vessels, voyages, customers, cargo,
 * inspections, load lists) and must not reach a production database: they would
 * be indistinguishable from real business records once created.
 */
export async function seedDemo(prisma: PrismaClient, ctx: SeedCoreResult): Promise<void> {
  const { adminUser, ports } = ctx;
  const { jebelAli, khalfan } = ports;
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

  // Backfill safety for fresh installs: the migration's leg backfill runs
  // before seed, so a voyage created here directly would otherwise have no
  // destination leg. Idempotent — existing legs are left untouched.
  const voyageLegCount = await prisma.voyageDestination.count({
    where: { voyageId: voyage.id },
  });
  if (voyageLegCount === 0) {
    await prisma.voyageDestination.create({
      data: {
        voyageId: voyage.id,
        destinationPortId: voyage.destinationPortId,
        legNumber: 1,
        voyageNumber: voyage.voyageNumber,
      },
    });
  }

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
      inspectionStatus: 'DONE',
      status: 'READY_FOR_LOADING',
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
      inspectionStatus: 'DONE',
      status: 'READY_FOR_LOADING',
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
      inspectionStatus: 'FAILED',
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
      inspectionStatus: 'FAILED',
      status: 'AT_YARD',
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
      status: 'FAILED',
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
      status: 'FAILED',
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

  // Phase 2 — portal agent linkage (party-cutover-plan.md §3 addendum / §8 item 0).
  // Idempotent: links the demo portal user to the demo Agent master ONLY when
  // both rows exist (both are demo/out-of-band data); re-running is a no-op and
  // databases without them are skipped without error.
  const demoPortalUser = await prisma.user.findUnique({
    where: { email: 'agent@portal.local' },
    select: { id: true, portalAgentId: true },
  });
  const demoAgent = await prisma.agent.findUnique({
    where: { code: 'AGT-001' },
    select: { id: true },
  });
  if (demoPortalUser && demoAgent && demoPortalUser.portalAgentId !== demoAgent.id) {
    await prisma.user.update({
      where: { id: demoPortalUser.id },
      data: { portalAgentId: demoAgent.id },
    });
    console.log('  Portal user agent@portal.local linked to Agent AGT-001');
  }

  // Phase 2 party cutover (party-cutover-plan.md §8 item 1 / task-unit 1):
  // the cutover migration nulls manifests.agentId (Customer -> masters); reseed
  // the DEMO portal manifest with the demo Agent-master id so the portal's
  // Agent-based scoping keeps showing it. Idempotent — only fills agentId when
  // NULL, and no-ops when the manifest or AGT-001 do not exist (fresh DBs).
  const demoManifestAgent = await prisma.agent.findUnique({
    where: { code: 'AGT-001' },
    select: { id: true },
  });
  if (demoManifestAgent) {
    const demoManifestRow = await prisma.manifest.findUnique({
      where: { manifestNumber: 'MAN-2609-00004' },
      select: { id: true, agentId: true },
    });
    if (demoManifestRow && demoManifestRow.agentId === null) {
      await prisma.manifest.update({
        where: { id: demoManifestRow.id },
        data: { agentId: demoManifestAgent.id },
      });
      console.log('  Demo manifest MAN-2609-00004 reseeded with Agent AGT-001');
    }
  }
}
