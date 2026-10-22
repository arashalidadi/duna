import type { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedDocumentDemo } from './documents';
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
  const { adminUser } = ctx;
  // Only the explicit demo opt-in creates the legacy Khalifa fixture. Existing
  // administrator-edited rows are NEVER overwritten/reactivated by the seed.
  const jebelAli = await prisma.port.upsert({ where: { code: 'JEBALI' }, update: {},
    create: { code: 'JEBALI', name: 'Jebel Ali', country: 'UAE', city: 'Dubai' } });
  const khalfan = await prisma.port.upsert({ where: { code: 'KHALIFA' }, update: {},
    create: { code: 'KHALIFA', name: 'Khalifa Port (DEMO)', country: 'UAE', city: 'Abu Dhabi', isActive: true } });
  const demoCtx = { ...ctx, ports: { jebelAli: { id: jebelAli.id, code: jebelAli.code },
    khalfan: { id: khalfan.id, code: khalfan.code } } };
  // ==========================================================================
  // Phase 7: Load Planning Sample Data
  // ==========================================================================
  // Create a vessel and voyage for testing load planning. All legacy demo
  // upserts below are add-only: reruns must preserve developers' edited states.
  const vessel = await prisma.vessel.upsert({
    where: { code: 'MV-HORIZON' },
    update: {},
    create: { code: 'MV-HORIZON', name: 'MV Horizon', flag: 'UAE', vesselType: 'CONTAINER', capacityTeu: 1500, isActive: true },
  });

  const voyage = await prisma.voyage.upsert({
    where: { voyageNumber: 'VOY-2401-00001' },
    update: {},
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
        // Required since the leg-vessel scope migration (DEC-026): the vessel whose counter issued
        // the leg number. The app sets this to the voyage's vessel on leg creation (voyages.service).
        numberingVesselId: voyage.vesselId,
        legNumber: 1,
        voyageNumber: voyage.voyageNumber,
      },
    });
  }

  // Create sample customers
  const customer1 = await prisma.customer.upsert({
    where: { code: 'CUS-GLOBAL' },
    update: {},
    create: { code: 'CUS-GLOBAL', name: 'Global Shipping Co', personKind: 'LEGAL', email: 'ops@globalship.example', isActive: true },
  });

  const customer2 = await prisma.customer.upsert({
    where: { code: 'CUS-AUTO' },
    update: {},
    create: { code: 'CUS-AUTO', name: 'Auto Logistics Ltd', personKind: 'LEGAL', email: 'ops@autolog.example', isActive: true },
  });

  // Create sample cargo with different inspection statuses
  const cargoApproved = await prisma.cargo.upsert({
    where: { reference: 'CRG-2401-APPROVED' },
    update: {},
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
    update: {},
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
    update: {},
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
    update: {},
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
    update: {},
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
    update: {},
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
    update: {},
    create: { loadListId: loadList.id, cargoId: cargoApproved.id, plannedQuantity: 20, sequence: 1, notes: 'Approved electronics containers' },
  });

  console.log('  Phase 7 sample data seeded: vessel, voyage, 3 cargo (approved/pending/rejected), inspections, 1 load list');

  // Phase 5 / Agent Portal demo records are opt-in along with the other
  // fabricated business data. Portal setup is atomic and self-contained; the
  // older API-driven portal seed script has been removed.
  await seedPortalDemo(prisma, demoCtx);

  // Phase X — document-shaped fixtures: CARGO MANIFEST DSMAN/KHO-26-006
  // (voyage 02/26, BARGE - MEHDI 11 + TUG - LAYAN GULF, Hamriya → Khorramshahr,
  // 45 cargo rows on 32 B/L numbers) and B/L KHS/26-110, mirroring the company's
  // real documents as clearly-marked DEMO data (names carry an " (DEMO)" mark).
  await seedDocumentDemo(prisma, demoCtx);
}

const PORTAL_ROLE_PERMISSIONS = new Set(['portal:access', 'booking:create']);
const portalDate = new Date('2026-10-14T09:00:00Z');

/** Demo-only Agent masters, portal accounts, and read fixtures for Phase 5. */
export async function seedPortalDemo(prisma: PrismaClient, ctx: SeedCoreResult & { ports: { jebelAli: { id: string }; khalfan: { id: string } } }): Promise<void> {
  const password = process.env.SEED_PORTAL_PASSWORD ?? 'ChangeMe123!';
  if (password.length < 8 || password.length > 200) {
    throw new Error('SEED_PORTAL_PASSWORD must be 8–200 characters (login DTO limit)');
  }
  const resetPasswords: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      const role = await tx.role.findUnique({
        where: { id: ctx.portalRole.id },
        select: { code: true, permissions: { select: { permission: { select: { code: true } } } } },
      });
      const actualPermissions = role?.permissions.map(({ permission }) => permission.code) ?? [];
      if (
        role?.code !== 'PORTAL_AGENT' ||
        actualPermissions.length !== PORTAL_ROLE_PERMISSIONS.size ||
        actualPermissions.some((code) => !PORTAL_ROLE_PERMISSIONS.has(code))
      ) {
        // Do not quietly give an external portal account office privileges, and
        // never revoke existing grants as a side effect of seeding.
        throw new Error(
          'PORTAL_AGENT needs only portal:access and booking:create; inspect its grants before demo seeding'
        );
      }

      const agent = async (code: string, name: string) => {
        const row = await tx.agent.upsert({
          where: { code },
          update: {},
          create: { code, name, notes: 'Agent Portal development fixture' },
        });
        if (!row.isActive || row.deletedAt) {
          throw new Error(
            `${code} is inactive or deleted; demo seed will not silently reactivate it`
          );
        }
        return row;
      };
      const agentD = await agent('AGT-001', 'Meridian Freight Co. (Portal Demo)');
      const agentE = await agent('AGT-DEMO-E', 'Portal isolation agent E (Demo)');

      const destination = async (agentId: string, portId: string) => {
        const row = await tx.agentDestination.upsert({
          where: { agentId_portId: { agentId, portId } },
          update: {},
          create: { agentId, portId, isActive: true },
        });
        if (!row.isActive || row.deletedAt) {
          throw new Error(
            'A demo agent destination is inactive or deleted; inspect it before reseeding'
          );
        }
      };
      await destination(agentD.id, ctx.ports.khalfan.id);
      await destination(agentE.id, ctx.ports.jebelAli.id);

      // The Customer link is for the existing bookings/statement flow, NOT the
      // Agent master. Document access uses portalAgentId + active destinations.
      const customer = await tx.customer.upsert({
        where: { code: 'AGT-P20DEMO' },
        update: {},
        create: {
          code: 'AGT-P20DEMO',
          name: 'Meridian Freight Co. (Portal Demo)',
          personKind: 'LEGAL', // company Customer link for bookings/statement only
          email: 'ops@meridian-freight.example',
        },
      });
      if (!customer.isActive || customer.deletedAt) {
        throw new Error('Demo portal Customer AGT-P20DEMO is inactive or deleted');
      }

      const portalUser = async (
        email: string,
        fullName: string,
        agentId: string,
        customerId: string | null
      ) => {
        const linkedAgent = await tx.user.findUnique({
          where: { portalAgentId: agentId },
          select: { email: true },
        });
        if (linkedAgent && linkedAgent.email !== email) {
          throw new Error(
            `Agent for ${email} is already linked to another portal user; no link was changed`
          );
        }
        if (customerId) {
          const linkedCustomer = await tx.user.findUnique({
            where: { portalCustomerId: customerId },
            select: { email: true },
          });
          if (linkedCustomer && linkedCustomer.email !== email) {
            throw new Error(
              `Customer for ${email} is already linked to another portal user; no link was changed`
            );
          }
        }
        const existing = await tx.user.findUnique({
          where: { email },
          include: { roles: { include: { role: { select: { code: true } } } } },
        });
        if (existing) {
          if (
            existing.deletedAt ||
            existing.isPrimaryAdmin ||
            (existing.portalAgentId && existing.portalAgentId !== agentId) ||
            (existing.portalCustomerId && existing.portalCustomerId !== customerId) ||
            existing.roles.some(({ role }) => role.code !== 'PORTAL_AGENT')
          ) {
            throw new Error(
              `${email} has a conflicting identity or role; demo seed will not take over this account`
            );
          }
          const patch: Prisma.UserUncheckedUpdateInput = {};
          if (!existing.portalAgentId) patch.portalAgentId = agentId;
          if (customerId && !existing.portalCustomerId) patch.portalCustomerId = customerId;
          if (!existing.isActive) patch.isActive = true;
          if (existing.lockedUntil) patch.lockedUntil = null;
          if (existing.failedLoginAttempts) patch.failedLoginAttempts = 0;
          if (!(await bcrypt.compare(password, existing.passwordHash))) {
            // Only these exact, non-admin demo identities are repaired. Never
            // change the owner/admin password or arbitrary user credentials.
            patch.passwordHash = await bcrypt.hash(password, 12);
            patch.passwordChangedAt = new Date();
            resetPasswords.push(email);
          }
          if (Object.keys(patch).length) {
            await tx.user.update({ where: { id: existing.id }, data: patch });
          }
          await tx.userRole.upsert({
            where: { userId_roleId: { userId: existing.id, roleId: ctx.portalRole.id } },
            update: {},
            create: { userId: existing.id, roleId: ctx.portalRole.id },
          });
          return existing.id;
        }
        const created = await tx.user.create({
          data: {
            email,
            fullName,
            passwordHash: await bcrypt.hash(password, 12),
            passwordChangedAt: new Date(),
            portalAgentId: agentId,
            portalCustomerId: customerId,
          },
        });
        await tx.userRole.create({ data: { userId: created.id, roleId: ctx.portalRole.id } });
        return created.id;
      };
      const userDId = await portalUser(
        'agent@portal.local',
        'Meridian Portal Demo',
        agentD.id,
        customer.id
      );
      await portalUser('agent2@portal.local', 'Agent E Portal Demo', agentE.id, null);

      // Each Agent has a different destination. The return voyage belongs to a
      // dedicated demo vessel, so it does not overlap the original load-list voyage.
      const vessel = await tx.vessel.upsert({
        where: { code: 'MV-PORTAL-DEMO' },
        update: {},
        create: {
          code: 'MV-PORTAL-DEMO',
          name: 'MV Portal Demo',
          flag: 'UAE',
          vesselType: 'GENERAL',
        },
      });
      if (!vessel.isActive || vessel.deletedAt)
        throw new Error('MV-PORTAL-DEMO is inactive or deleted');
      const voyage = async (
        voyageNumber: string,
        originPortId: string,
        destinationPortId: string,
        departure: string,
        arrival: string
      ) => {
        const row = await tx.voyage.upsert({
          where: { voyageNumber },
          update: {},
          create: {
            voyageNumber,
            vesselId: vessel.id,
            originPortId,
            destinationPortId,
            status: 'SCHEDULED',
            plannedDepartureAt: new Date(departure),
            plannedArrivalAt: new Date(arrival),
            createdById: ctx.adminUser.id,
          },
        });
        if (
          row.vesselId !== vessel.id ||
          row.originPortId !== originPortId ||
          row.destinationPortId !== destinationPortId
        ) {
          throw new Error(
            `${voyageNumber} belongs to different master records; no demo document was changed`
          );
        }
        const leg = await tx.voyageDestination.findFirst({
          where: { voyageId: row.id, deletedAt: null },
        });
        if (!leg) {
          await tx.voyageDestination.create({
            data: {
              voyageId: row.id,
              destinationPortId,
              numberingVesselId: vessel.id,
              legNumber: 1,
              voyageNumber,
            },
          });
        } else if (
          leg.destinationPortId !== destinationPortId ||
          leg.numberingVesselId !== vessel.id
        ) {
          throw new Error(`${voyageNumber} has a conflicting destination leg`);
        }
        return row;
      };
      const voyageD = await voyage(
        'VOY-DEMO-PORTAL-D',
        ctx.ports.jebelAli.id,
        ctx.ports.khalfan.id,
        '2026-10-18T08:00:00Z',
        '2026-10-25T08:00:00Z'
      );
      const voyageE = await voyage(
        'VOY-DEMO-PORTAL-E',
        ctx.ports.khalfan.id,
        ctx.ports.jebelAli.id,
        '2026-11-01T08:00:00Z',
        '2026-11-08T08:00:00Z'
      );

      const manifest = async (
        manifestNumber: string,
        voyageId: string,
        agentId: string,
        polPortId: string,
        podPortId: string
      ) => {
        const row = await tx.manifest.upsert({
          where: { manifestNumber },
          update: {},
          create: {
            manifestNumber,
            voyageId,
            agentId,
            polPortId,
            podPortId,
            vesselName: vessel.name,
            status: 'DRAFT',
            createdById: ctx.adminUser.id,
            notes: 'Agent Portal development fixture — not an approved cargo manifest',
          },
        });
        if (row.voyageId !== voyageId || row.agentId !== agentId) {
          throw new Error(`${manifestNumber} is linked to a different voyage or Agent`);
        }
      };
      await manifest(
        'MAN-DEMO-AGT001',
        voyageD.id,
        agentD.id,
        ctx.ports.jebelAli.id,
        ctx.ports.khalfan.id
      );
      await manifest(
        'MAN-DEMO-AGENT-E',
        voyageE.id,
        agentE.id,
        ctx.ports.khalfan.id,
        ctx.ports.jebelAli.id
      );

      const bill = async (
        billNumber: string,
        voyageId: string,
        destinationPortId: string,
        status: 'APPROVED' | 'DRAFT'
      ) => {
        const row = await tx.billOfLading.upsert({
          where: { billNumber },
          update: {},
          create: {
            billNumber,
            voyageId,
            destinationPortId,
            status,
            vesselName: vessel.name,
            createdById: ctx.adminUser.id,
            notes: 'Agent Portal demo read fixture — not issued via document workflow',
          },
        });
        if (
          row.voyageId !== voyageId ||
          row.destinationPortId !== destinationPortId ||
          row.deletedAt
        ) {
          throw new Error(`${billNumber} has a conflicting scope or is deleted`);
        }
        return row;
      };
      const billD = await bill('BOL-DEMO-AGT001', voyageD.id, ctx.ports.khalfan.id, 'APPROVED');
      const cancelledReleaseBill = await bill(
        'BOL-DEMO-AGT001-HISTORY',
        voyageD.id,
        ctx.ports.khalfan.id,
        'APPROVED'
      );
      await bill('BOL-DEMO-AGT001-DRAFT', voyageD.id, ctx.ports.khalfan.id, 'DRAFT');
      const billE = await bill('BOL-DEMO-AGENT-E', voyageE.id, ctx.ports.jebelAli.id, 'APPROVED');

      const release = async (
        docNumber: string,
        billOfLadingId: string,
        status: 'ISSUED' | 'CANCELLED',
        paymentState: 'PAID' | 'PARTIAL'
      ) => {
        const row = await tx.releaseOrder.upsert({
          where: { docNumber },
          update: {},
          create: {
            docNumber,
            billOfLadingId,
            status,
            paymentState,
            createdById: ctx.adminUser.id,
            releaseDate: portalDate,
            cancelledAt: status === 'CANCELLED' ? portalDate : null,
            cancelledById: status === 'CANCELLED' ? ctx.adminUser.id : null,
            cancelReason: status === 'CANCELLED' ? 'Cancelled demo release' : null,
            notes: 'Development read fixture — not a release eligibility/audit test',
          },
        });
        if (row.billOfLadingId !== billOfLadingId || row.deletedAt) {
          throw new Error(`${docNumber} is linked to a different B/L or is deleted`);
        }
      };
      await release('RO-DEMO-AGT001', billD.id, 'ISSUED', 'PAID');
      await release('RO-DEMO-AGT001-CANCELLED', cancelledReleaseBill.id, 'CANCELLED', 'PARTIAL');
      await release('RO-DEMO-AGENT-E', billE.id, 'ISSUED', 'PAID');

      const destinationPort = await tx.port.findUnique({
        where: { id: ctx.ports.khalfan.id },
        select: { name: true },
      });
      if (!destinationPort) throw new Error('Demo destination port is missing');
      const delivery = await tx.deliveryOrder.upsert({
        where: { docNumber: 'DO-DEMO-AGT001' },
        update: {},
        create: {
          docNumber: 'DO-DEMO-AGT001',
          billOfLadingId: billD.id,
          createdById: ctx.adminUser.id,
          recipient: 'Demo recipient',
          portId: ctx.ports.khalfan.id,
          portName: destinationPort.name,
          notes: 'Development fixture — port name snapshotted at creation',
        },
      });
      if (delivery.billOfLadingId !== billD.id)
        throw new Error('Demo delivery order belongs to another B/L');

      const booking = async (bookingNumber: string, status: 'PENDING' | 'ACCEPTED') => {
        const row = await tx.bookingRequest.upsert({
          where: { bookingNumber },
          update: {},
          create: {
            bookingNumber,
            customerId: customer.id,
            status,
            submittedById: userDId,
            originPortId: ctx.ports.jebelAli.id,
            destinationPortId: ctx.ports.khalfan.id,
            cargoDescription: 'Demo shipment for Agent Portal bookings',
            responseNote: status === 'ACCEPTED' ? 'Accepted demo booking' : null,
            handledById: status === 'ACCEPTED' ? ctx.adminUser.id : null,
            handledAt: status === 'ACCEPTED' ? portalDate : null,
          },
        });
        if (row.customerId !== customer.id)
          throw new Error(`${bookingNumber} belongs to another Customer`);
      };
      await booking('BRK-DEMO-PORTAL-001', 'PENDING');
      await booking('BRK-DEMO-PORTAL-002', 'ACCEPTED');

      // An unanchored invoice populates the Customer-scoped statement without
      // inventing an unpaid B/L that would require a financial release override.
      const invoice = await tx.invoice.upsert({
        where: { invoiceNumber: 'INV-DEMO-PORTAL-001' },
        update: {},
        create: {
          invoiceNumber: 'INV-DEMO-PORTAL-001',
          customerId: customer.id,
          status: 'ISSUED',
          title: 'Demo portal handling fee',
          currencyCode: 'USD',
          issueDate: portalDate,
          issuedAt: portalDate,
          dueDate: new Date('2026-11-14T09:00:00Z'),
          subtotal: 100,
          totalAmount: 100,
          createdById: ctx.adminUser.id,
          issuedById: ctx.adminUser.id,
          notes: 'Development statement fixture — not issued via audited invoice workflow',
        },
      });
      if (invoice.customerId !== customer.id)
        throw new Error('Demo invoice belongs to another Customer');
      const item = await tx.invoiceItem.findFirst({
        where: { invoiceId: invoice.id, sequence: 1 },
      });
      if (!item) {
        await tx.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            sequence: 1,
            description: 'Demo portal handling',
            quantity: 1,
            unitPrice: 100,
            amount: 100,
          },
        });
      }

      // Retain the original party-cutover repair: fill only a NULL Agent link on
      // this known demo manifest. Never reassign one already linked to an Agent.
      const legacyManifest = await tx.manifest.findUnique({
        where: { manifestNumber: 'MAN-2609-00004' },
        select: { id: true, agentId: true },
      });
      if (legacyManifest?.agentId === null) {
        await tx.manifest.update({
          where: { id: legacyManifest.id },
          data: { agentId: agentD.id },
        });
      }
    },
    { timeout: 120_000 }
  );

  for (const email of resetPasswords) console.log(`  Repaired demo login password: ${email}`);
  console.log(
    '  Agent Portal demo: AGT-001 and AGT-DEMO-E; two portal users, destinations, bookings, manifests, B/Ls, R/Os, DO and statement invoice'
  );
}
