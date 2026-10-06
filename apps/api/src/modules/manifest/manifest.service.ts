import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ManifestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  AddManifestItemDto,
  CancelManifestDto,
  CreateManifestDto,
  ListManifestQueryDto,
  UpdateManifestDto,
  UpdateManifestItemDto,
} from './dto/manifest.dto';

// ---------------------------------------------------------------------------
// Manifest lifecycle (server-side).
//   DRAFT -> SUBMITTED -> APPROVED | CANCELLED
//   DRAFT -> CANCELLED
//   APPROVED and CANCELLED are terminal.
// ---------------------------------------------------------------------------
const MANIFEST_TRANSITIONS: Record<ManifestStatus, ManifestStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'CANCELLED'],
  APPROVED: [],
  CANCELLED: [],
};

// Only DRAFT manifests accept structural edits (header fields + items).
const EDITABLE_STATUSES: ManifestStatus[] = ['DRAFT'];

const voyageSelect = {
  id: true,
  voyageNumber: true,
  status: true,
  plannedDepartureAt: true,
  plannedArrivalAt: true,
  vessel: { select: { id: true, code: true, name: true, imo: true, vesselType: true } },
  originPort: { select: { id: true, code: true, name: true, country: true, city: true } },
  destinationPort: { select: { id: true, code: true, name: true, country: true, city: true } },
} satisfies Prisma.VoyageSelect;

const listSelect = {
  id: true,
  manifestNumber: true,
  voyageId: true,
  status: true,
  vesselName: true,
  vesselImo: true,
  polPortId: true,
  podPortId: true,
  shipperId: true,
  consigneeId: true,
  agentId: true,
  notifyParty: true,
  description: true,
  gasCost: true,
  lashingCost: true,
  shipperCost: true,
  podCost: true,
  polCost: true,
  currencyCode: true,
  totalWeight: true,
  totalQuantity: true,
  totalPackages: true,
  cancelReason: true,
  notes: true,
  createdById: true,
  submittedById: true,
  approvedById: true,
  cancelledById: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  approvedAt: true,
  cancelledAt: true,
  deletedAt: true,
  voyage: { select: voyageSelect },
  polPort: { select: { id: true, code: true, name: true, country: true } },
  podPort: { select: { id: true, code: true, name: true, country: true } },
  // Party relations now point at the masters (Shipper/Consignee/Agent), which
  // have no shortName — field dropped per party-cutover-plan.md §9.
  shipper: { select: { id: true, code: true, name: true } },
  consignee: { select: { id: true, code: true, name: true } },
  agent: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, email: true, fullName: true } },
  submittedBy: { select: { id: true, email: true, fullName: true } },
  approvedBy: { select: { id: true, email: true, fullName: true } },
  cancelledBy: { select: { id: true, email: true, fullName: true } },
  _count: { select: { items: true } },
} satisfies Prisma.ManifestSelect;

const cargoSelect = {
  id: true,
  reference: true,
  cargoType: true,
  status: true,
  inspectionStatus: true,
  loadingStatus: true,
  weight: true,
  weightUnit: true,
  quantity: true,
  packages: true,
  packageType: true,
  serialNumber: true,
  chassisNumber: true,
  vin: true,
  customer: { select: { id: true, code: true, name: true, shortName: true } },
  port: { select: { id: true, code: true, name: true } },
  destinationPort: { select: { id: true, code: true, name: true } },
} satisfies Prisma.CargoSelect;

const detailSelect = {
  ...listSelect,
  items: {
    select: {
      id: true,
      manifestId: true,
      cargoId: true,
      sequence: true,
      blNumber: true,
      weight: true,
      quantity: true,
      packages: true,
      packageType: true,
      notes: true,
      actualLoadingItemId: true,
      createdAt: true,
      updatedAt: true,
      // ADR-047 d3+d4 (P5-U2): consolidation reference + per-item parties
      billOfLadingItemId: true,
      shipperId: true,
      consigneeId: true,
      // ADR-047 d4 (P5-U3): per-row party objects (code + name) for the items
      // table cells — same shape the header relations use in listSelect.
      shipper: { select: { id: true, code: true, name: true } },
      consignee: { select: { id: true, code: true, name: true } },
      billOfLadingItem: {
        select: {
          id: true,
          billOfLadingId: true,
          cargoId: true,
          sequence: true,
          goodsDescription: true,
          marksAndNumbers: true,
          packages: true,
          packageType: true,
          grossWeight: true,
          volume: true,
          billOfLading: {
            select: {
              id: true,
              billNumber: true,
              status: true,
              shipperId: true,
              consigneeId: true,
            },
          },
        },
      },
      cargo: { select: cargoSelect },
    },
    orderBy: { sequence: 'asc' },
  },
} satisfies Prisma.ManifestSelect;

/** ADR-047 d4: party master as rendered by per-row cells (code + name). */
type PartyRef = { id: string; code: string; name: string };

/** Derived shape: a detail row plus its distinct-parties summary. */
type DetailWithPartySummary<T> = T & {
  partySummary: { shippers: PartyRef[]; consignees: PartyRef[] };
};

@Injectable()
export class ManifestService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Manifest CRUD
  // -------------------------------------------------------------------------

  async list(query: ListManifestQueryDto) {
    const pagination = parsePagination(query);
    const sortField = (query.sort ?? 'createdAt') as
      | 'manifestNumber'
      | 'status'
      | 'createdAt'
      | 'approvedAt';
    const sortOrder = (query.order ?? 'desc') as Prisma.SortOrder;

    const where: Prisma.ManifestWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status as ManifestStatus } : {}),
      ...(query.voyageId ? { voyageId: query.voyageId } : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { manifestNumber: { contains: query.search, mode: 'insensitive' } },
              { vesselName: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
              { voyage: { voyageNumber: { contains: query.search, mode: 'insensitive' } } },
              {
                items: {
                  some: { blNumber: { contains: query.search, mode: 'insensitive' } },
                },
              },
              {
                items: {
                  some: {
                    cargo: { reference: { contains: query.search, mode: 'insensitive' } },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.manifest.count({ where }),
      this.prisma.manifest.findMany({
        where,
        select: listSelect,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { [sortField]: sortOrder },
      }),
    ]);

    return buildPaginated(items, total, pagination);
  }

  async findById(id: string) {
    const row = await this.prisma.manifest.findUnique({ where: { id }, select: detailSelect });
    if (!row || row.deletedAt) {
      throw new NotFoundException('Manifest not found');
    }
    return this.withPartySummary(row);
  }

  /**
   * Create a Manifest for a Voyage.
   * Validates: voyage exists, is not CANCELLED, and has no live manifest yet
   * (one manifest per voyage). Snapshots vessel + POL/POD from the voyage so the
   * document stays stable even if the voyage is later edited.
   * Creates in DRAFT state. Generates manifestNumber: MAN-YYMM-#####.
   */
  async create(dto: CreateManifestDto, actor?: AuthenticatedUser) {
    const voyage = await this.prisma.voyage.findUnique({
      where: { id: dto.voyageId },
      select: {
        id: true,
        status: true,
        vessel: { select: { name: true, imo: true } },
        originPortId: true,
        destinationPortId: true,
      },
    });
    if (!voyage) {
      throw new NotFoundException('Voyage not found');
    }
    if (voyage.status === 'CANCELLED') {
      throw new ConflictException('Cannot create a Manifest for a cancelled Voyage');
    }

    const existing = await this.prisma.manifest.findFirst({
      where: { voyageId: dto.voyageId, deletedAt: null },
      select: { id: true, manifestNumber: true },
    });
    if (existing) {
      throw new ConflictException(
        `A Manifest already exists for this Voyage (${existing.manifestNumber}). One manifest per voyage.`,
      );
    }

    // ADR-047 d1 (P5-U2): consolidation path.
    // When billIds are supplied, create a manifest from APPROVED B/Ls on the same voyage.
    const billIds = dto.billIds ?? [];

    // ADR-047 d4 (P5-U3): a consolidated manifest carries no header parties — each line
    // carries its own B/L's parties (the consolidation create writes them null). Header
    // party fields submitted alongside billIds could not take effect, so they are now
    // REJECTED instead of being validated and then silently dropped.
    if (billIds.length > 0 && (dto.shipperId || dto.consigneeId || dto.agentId)) {
      throw new BadRequestException(
        'shipperId/consigneeId/agentId are not accepted when consolidating with billIds: each manifest line carries its own B/L parties (ADR-047 d4)',
      );
    }

    await this.validatePartyRefs({
      shipperId: dto.shipperId,
      consigneeId: dto.consigneeId,
      agentId: dto.agentId,
    });

    if (billIds.length > 0) {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Validate all billIds exist, are APPROVED, and belong to the same voyage
        const bills = await tx.billOfLading.findMany({
          where: {
            id: { in: billIds },
            status: 'APPROVED',
            voyageId: dto.voyageId,
          },
          select: { id: true, status: true, voyageId: true },
        });
        if (bills.length !== billIds.length) {
          throw new BadRequestException(
            'One or more billIds are not APPROVED or do not belong to the specified voyage',
          );
        }
        if (bills.length === 0) {
          throw new BadRequestException('No matching APPROVED B/Ls found');
        }

        // 2. Enforce one-manifest-per-B/L claim guard:
        // An APPROVED B/L's items may appear on at most one live (non-deleted) manifest.
        // Guard direction: query the NEW ManifestItem.billOfLadingItemId column through a
        // live owner manifest (ADR-047 d3). The legacy BillOfLadingItem.manifestItemId stamp
        // is never written by the consolidation path, so it cannot back this guard. A
        // soft-deleted owner manifest frees its claims (no DB @unique for that reason).
        const claimed = await tx.manifestItem.findMany({
          where: {
            billOfLadingItem: { billOfLadingId: { in: billIds } },
            manifest: { deletedAt: null },
          },
          select: { manifest: { select: { manifestNumber: true } } },
        });
        if (claimed.length > 0) {
          const ownerNumbers = [...new Set(claimed.map((c) => c.manifest.manifestNumber))];
          throw new ConflictException(
            `One or more B/Ls are already consolidated onto manifests: ${ownerNumbers.join(', ')}`,
          );
        }

        // 3. Generate manifest number and create the manifest.
        // A consolidated manifest has no header-level parties — each line carries its own
        // (ADR-047 d4; distinct summary + validation land in U3).
        const manifestNumber = await this.generateReference();
        const manifest = await tx.manifest.create({
          data: {
            manifestNumber,
            voyageId: dto.voyageId,
            vesselName: voyage.vessel.name,
            vesselImo: voyage.vessel.imo,
            polPortId: voyage.originPortId,
            podPortId: voyage.destinationPortId,
            shipperId: null,
            consigneeId: null,
            agentId: null,
            notifyParty: null,
            description: null,
            notes: null,
            createdById: actor?.id,
          },
          select: detailSelect,
        });

        // 4. For each APPROVED B/L: pull its items' frozen snapshot and build one manifest
        //    line per B/L item — billOfLadingItemId + per-item parties COPIED from the B/L
        //    (ADR-047 d2+d4 — mechanical copy; U3 owns DTO validation + distinct summary).
        //    No blNumber stamp: the manifest reads the bill number through the reference.
        const maxSeq = await tx.manifestItem.aggregate({
          where: { manifestId: manifest.id },
          _max: { sequence: true },
        });
        let sequence = maxSeq._max.sequence ?? 0;

        const billItems = await tx.billOfLadingItem.findMany({
          where: { billOfLadingId: { in: billIds } },
          select: {
            id: true,
            cargoId: true,
            sequence: true,
            packages: true,
            packageType: true,
            grossWeight: true,
            volume: true,
            goodsDescription: true,
            marksAndNumbers: true,
            billOfLading: {
              select: { id: true, billNumber: true, shipperId: true, consigneeId: true },
            },
          },
          orderBy: { sequence: 'asc' },
        });

        for (const item of billItems) {
          sequence += 1;
          await tx.manifestItem.create({
            data: {
              manifestId: manifest.id,
              cargoId: item.cargoId,
              sequence,
              blNumber: null,
              weight: item.grossWeight ?? null,
              quantity: null,
              packages: item.packages ?? null,
              packageType: item.packageType ?? null,
              notes: null,
              actualLoadingItemId: null,
              billOfLadingItemId: item.id,
              // Per-item parties copied from the B/L (mechanical copy, ADR-047 d4).
              shipperId: item.billOfLading.shipperId,
              consigneeId: item.billOfLading.consigneeId,
            },
          });
        }

        return this.withPartySummary(
          await tx.manifest.findUniqueOrThrow({
            where: { id: manifest.id },
            select: detailSelect,
          }),
        );
      });
    }

    // 5. Legacy cargo path (unchanged, runs when billIds absent)
    const MAX_MANIFEST_ATTEMPTS = 10;
    for (let attempt = 1; ; attempt += 1) {
      const manifestNumber = await this.generateReference();
      try {
        return this.withPartySummary(
          await this.prisma.manifest.create({
            data: {
              manifestNumber,
              voyageId: dto.voyageId,
              vesselName: voyage.vessel.name,
              vesselImo: voyage.vessel.imo,
              polPortId: voyage.originPortId,
              podPortId: voyage.destinationPortId,
              shipperId: dto.shipperId,
              consigneeId: dto.consigneeId,
              agentId: dto.agentId,
              notifyParty: dto.notifyParty,
              description: dto.description,
              notes: dto.notes,
              createdById: actor?.id,
            },
            select: detailSelect,
          }),
        );
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          attempt < MAX_MANIFEST_ATTEMPTS &&
          String((e.meta as { target?: unknown } | undefined)?.target ?? '').includes(
            'manifestNumber'
          )
        ) {
          continue; // lost the number race: re-read the committed max and retry
        }
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (e.code === 'P2002' || e.code === 'P2018')
        ) {
          throw new ConflictException('Could not create Manifest: duplicate reference');
        }
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
          throw new BadRequestException(
            'Invalid reference: party ids must reference existing master records'
          );
        }
        throw e;
      }
    }
  }

  /**
   * Update Manifest header fields (parties, costs, description, notes).
   * Only DRAFT manifests may be edited.
   */
  async update(id: string, dto: UpdateManifestDto) {
    const existing = await this.prisma.manifest.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    await this.assertEditable(existing, 'edited');
    await this.validatePartyRefs({
      shipperId: dto.shipperId || undefined,
      consigneeId: dto.consigneeId || undefined,
      agentId: dto.agentId || undefined,
    });

    try {
      return this.withPartySummary(
        await this.prisma.manifest.update({
          where: { id },
          data: {
            ...(dto.shipperId !== undefined ? { shipperId: dto.shipperId || null } : {}),
            ...(dto.consigneeId !== undefined ? { consigneeId: dto.consigneeId || null } : {}),
            ...(dto.agentId !== undefined ? { agentId: dto.agentId || null } : {}),
            ...(dto.notifyParty !== undefined ? { notifyParty: dto.notifyParty } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.gasCost !== undefined ? { gasCost: dto.gasCost ?? null } : {}),
            ...(dto.lashingCost !== undefined ? { lashingCost: dto.lashingCost ?? null } : {}),
            ...(dto.shipperCost !== undefined ? { shipperCost: dto.shipperCost ?? null } : {}),
            ...(dto.podCost !== undefined ? { podCost: dto.podCost ?? null } : {}),
            ...(dto.polCost !== undefined ? { polCost: dto.polCost ?? null } : {}),
            ...(dto.currencyCode !== undefined ? { currencyCode: dto.currencyCode } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          },
          select: detailSelect,
        }),
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new BadRequestException(
          'Invalid reference: party ids must reference existing master records',
        );
      }
      throw e;
    }
  }

  /**
   * Soft delete a Manifest. Only DRAFT manifests may be deleted; submitted and
   * approved documents are preserved for audit.
   */
  async remove(id: string) {
    const existing = await this.prisma.manifest.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    await this.assertEditable(existing, 'deleted');

    await this.prisma.manifest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return this.withPartySummary(
      await this.prisma.manifest.findUniqueOrThrow({ where: { id }, select: detailSelect }),
    );
  }

  // -------------------------------------------------------------------------
  // Manifest Items (cargo lines)
  // -------------------------------------------------------------------------

  /**
   * Add a cargo line to the manifest.
   * Enforces: manifest is DRAFT; the cargo was actually loaded on this voyage
   * (present in a COMPLETED Actual Loading for the voyage); cargo not cancelled;
   * not already on this manifest. Snapshots weight/quantity/packages from cargo.
   */
  async addItem(id: string, dto: AddManifestItemDto, _actor?: AuthenticatedUser) {
    const manifest = await this.prisma.manifest.findUnique({
      where: { id },
      select: { id: true, status: true, voyageId: true, deletedAt: true },
    });
    await this.assertEditable(manifest, 'modified');

    const cargo = await this.prisma.cargo.findUnique({
      where: { id: dto.cargoId },
      select: {
        id: true,
        status: true,
        loadingStatus: true,
        weight: true,
        quantity: true,
        packages: true,
        packageType: true,
        deletedAt: true,
      },
    });
    if (!cargo || cargo.deletedAt) {
      throw new NotFoundException('Cargo not found');
    }
    if (cargo.status === 'CANCELLED') {
      throw new ConflictException('Cargo is cancelled; cannot add to manifest');
    }

    const duplicate = await this.prisma.manifestItem.findFirst({
      where: { manifestId: id, cargoId: dto.cargoId },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Cargo is already on this manifest');
    }

    // The cargo must have been actually loaded on this voyage — a POSITIVE recorded
    // quantity, not merely a materialized line: ADR-029 "the manifest reflects what was
    // actually loaded"; ADR-028 — NOT_LOADED cargo stays in the yard and remains eligible
    // for later planning. (NULL/0 lines only exist since ADR-042 copy-on-create.)
    const loadedOnVoyage = await this.prisma.actualLoadingItem.findFirst({
      where: {
        cargoId: dto.cargoId,
        actualQuantity: { gt: 0 },
        actualLoading: {
          status: 'COMPLETED',
          deletedAt: null,
          loadList: { voyageId: manifest!.voyageId, deletedAt: null },
        },
      },
      select: { id: true, actualQuantity: true },
    });
    if (!loadedOnVoyage) {
      throw new ConflictException(
        'Cargo was not actually loaded on this voyage; only cargo from a completed Actual Loading may be manifested',
      );
    }

    const maxSeq = await this.prisma.manifestItem.aggregate({
      where: { manifestId: id },
      _max: { sequence: true },
    });
    const sequence = (maxSeq._max.sequence ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      await tx.manifestItem.create({
        data: {
          manifestId: id,
          cargoId: dto.cargoId,
          sequence,
          blNumber: dto.blNumber,
          weight: cargo.weight,
          // Manifest reflects the ACTUAL loaded quantity, not the cargo's nominal quantity.
          quantity: loadedOnVoyage.actualQuantity ?? cargo.quantity,
          packages: cargo.packages,
          packageType: cargo.packageType,
          notes: dto.notes,
          actualLoadingItemId: loadedOnVoyage.id,
        },
      });
      await this.recomputeTotals(tx, id);
      return this.withPartySummary(
        await tx.manifest.findUniqueOrThrow({ where: { id }, select: detailSelect }),
      );
    });
  }

  /** Update a manifest line's B/L number / notes. DRAFT only. */
  async updateItem(id: string, itemId: string, dto: UpdateManifestItemDto) {
    const manifest = await this.prisma.manifest.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    await this.assertEditable(manifest, 'modified');

    const item = await this.prisma.manifestItem.findFirst({
      where: { id: itemId, manifestId: id },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('Manifest item not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.manifestItem.update({
        where: { id: itemId },
        data: {
          ...(dto.blNumber !== undefined ? { blNumber: dto.blNumber } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });
      return this.withPartySummary(
        await tx.manifest.findUniqueOrThrow({ where: { id }, select: detailSelect }),
      );
    });
  }

  /** Remove a manifest line and recompute totals. DRAFT only. */
  async removeItem(id: string, itemId: string) {
    const manifest = await this.prisma.manifest.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    await this.assertEditable(manifest, 'modified');

    const item = await this.prisma.manifestItem.findFirst({
      where: { id: itemId, manifestId: id },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('Manifest item not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.manifestItem.delete({ where: { id: itemId } });
      await this.recomputeTotals(tx, id);
      return this.withPartySummary(
        await tx.manifest.findUniqueOrThrow({ where: { id }, select: detailSelect }),
      );
    });
  }

  /**
   * Cargo eligible to be manifested for a voyage: every cargo line from a
   * COMPLETED Actual Loading of the voyage, minus those already on this
   * manifest (when a manifestId is supplied).
   */
  async eligibleCargo(voyageId: string, manifestId?: string) {
    const voyage = await this.prisma.voyage.findUnique({
      where: { id: voyageId },
      select: { id: true },
    });
    if (!voyage) {
      throw new NotFoundException('Voyage not found');
    }

    // Only lines with a POSITIVE recorded quantity are "actually loaded" for manifesting
    // (ADR-029 "the manifest reflects what was actually loaded"; ADR-028 — NOT_LOADED lines
    // stay in the yard and remain eligible for later planning). NULL/0 lines materialized by
    // ADR-042 copy-on-create are excluded.
    const loaded = await this.prisma.actualLoadingItem.findMany({
      where: {
        actualQuantity: { gt: 0 },
        actualLoading: {
          status: 'COMPLETED',
          deletedAt: null,
          loadList: { voyageId, deletedAt: null },
        },
      },
      select: {
        id: true,
        cargoId: true,
        cargo: { select: cargoSelect },
      },
    });

    const onManifest = manifestId
      ? await this.prisma.manifestItem.findMany({
          where: { manifestId },
          select: { cargoId: true },
        })
      : [];
    const takenIds = new Set(onManifest.map((r) => r.cargoId));

    return loaded
      .filter((row) => !takenIds.has(row.cargoId))
      .map((row) => ({ ...row.cargo, actualLoadingItemId: row.id }));
  }

  // -------------------------------------------------------------------------
  // Lifecycle Transitions
  // -------------------------------------------------------------------------

  /** DRAFT -> SUBMITTED. Requires at least one cargo line. */
  async submit(id: string, actor?: AuthenticatedUser) {
    const existing = await this.prisma.manifest.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true, _count: { select: { items: true } } },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Manifest not found');
    }
    this.assertTransition(existing.status, 'SUBMITTED');
    if (existing._count.items === 0) {
      throw new BadRequestException('Cannot submit a manifest with no cargo lines');
    }

    return this.withPartySummary(
      await this.prisma.manifest.update({
        where: { id },
        data: { status: 'SUBMITTED', submittedAt: new Date(), submittedById: actor?.id },
        select: detailSelect,
      }),
    );
  }

  /** SUBMITTED -> APPROVED. Terminal. */
  async approve(id: string, actor?: AuthenticatedUser) {
    const existing = await this.prisma.manifest.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Manifest not found');
    }
    this.assertTransition(existing.status, 'APPROVED');

    return this.withPartySummary(
      await this.prisma.manifest.update({
        where: { id },
        data: { status: 'APPROVED', approvedAt: new Date(), approvedById: actor?.id },
        select: detailSelect,
      }),
    );
  }

  /** DRAFT|SUBMITTED -> CANCELLED. Reason required. Terminal. */
  async cancel(id: string, dto: CancelManifestDto, actor?: AuthenticatedUser) {
    const existing = await this.prisma.manifest.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Manifest not found');
    }
    this.assertTransition(existing.status, 'CANCELLED');
    if (!dto.cancelReason?.trim()) {
      throw new BadRequestException('A cancellation reason is required');
    }

    return this.withPartySummary(
      await this.prisma.manifest.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelReason: dto.cancelReason.trim(),
          cancelledAt: new Date(),
          cancelledById: actor?.id,
        },
        select: detailSelect,
      }),
    );
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * ADR-047 d4 (P5-U3): derived distinct-parties summary for the manifest detail.
   * Rows stay one line per B/L/cargo — grouping is display-time aggregation only
   * ("not a schema group"). The EFFECTIVE party of a row is its own party with
   * fallback to the manifest header when the row is null, i.e. the exact rule the
   * items table uses for its per-row cells, so the summary always matches what the
   * table shows. Distinct by master id; insertion order follows item sequence.
   * Applied to every detail-shaped response (GET detail, create, update, item and
   * lifecycle read-backs) so consumers see one consistent shape.
   */
  private withPartySummary<
    T extends {
      shipper: PartyRef | null;
      consignee: PartyRef | null;
      items: Array<{ shipper: PartyRef | null; consignee: PartyRef | null }>;
    },
  >(row: T): DetailWithPartySummary<T> {
    const shippers = new Map<string, PartyRef>();
    const consignees = new Map<string, PartyRef>();
    for (const item of row.items) {
      const shipper = item.shipper ?? row.shipper;
      const consignee = item.consignee ?? row.consignee;
      if (shipper) shippers.set(shipper.id, shipper);
      if (consignee) consignees.set(consignee.id, consignee);
    }
    return {
      ...row,
      partySummary: { shippers: [...shippers.values()], consignees: [...consignees.values()] },
    };
  }

  /**
   * Party references must resolve to live (existing, non-soft-deleted) master
   * rows since the Customer -> masters cutover (party-cutover-plan.md §3).
   * Unknown / soft-deleted ids -> 400 with a clear message. Empty string or
   * undefined means "clear / unchanged" and needs no validation.
   */
  private async validatePartyRefs(refs: {
    shipperId?: string | null;
    consigneeId?: string | null;
    agentId?: string | null;
  }) {
    if (refs.shipperId) {
      const row = await this.prisma.shipper.findUnique({
        where: { id: refs.shipperId },
        select: { deletedAt: true },
      });
      if (!row || row.deletedAt) {
        throw new BadRequestException(
          `Unknown shipperId: no live Shipper with id ${refs.shipperId}`,
        );
      }
    }
    if (refs.consigneeId) {
      const row = await this.prisma.consignee.findUnique({
        where: { id: refs.consigneeId },
        select: { deletedAt: true },
      });
      if (!row || row.deletedAt) {
        throw new BadRequestException(
          `Unknown consigneeId: no live Consignee with id ${refs.consigneeId}`,
        );
      }
    }
    if (refs.agentId) {
      const row = await this.prisma.agent.findUnique({
        where: { id: refs.agentId },
        select: { deletedAt: true },
      });
      if (!row || row.deletedAt) {
        throw new BadRequestException(
          `Unknown agentId: no live Agent with id ${refs.agentId}`,
        );
      }
    }
  }

  private async assertEditable(
    row: { status: ManifestStatus; deletedAt: Date | null } | null,
    verb: string
  ) {
    if (!row || row.deletedAt) {
      throw new NotFoundException('Manifest not found');
    }
    if (!EDITABLE_STATUSES.includes(row.status)) {
      throw new ConflictException(`Manifest is ${row.status}; only DRAFT manifests can be ${verb}`);
    }
  }

  private assertTransition(current: ManifestStatus, target: ManifestStatus) {
    if (!MANIFEST_TRANSITIONS[current]?.includes(target)) {
      throw new ConflictException(`Manifest transition ${current} -> ${target} is not allowed`);
    }
  }

  /** Recompute aggregated totals from the manifest's cargo lines. */
  private async recomputeTotals(tx: Prisma.TransactionClient, manifestId: string) {
    const items = await tx.manifestItem.findMany({
      where: { manifestId },
      select: { weight: true, quantity: true, packages: true },
    });

    let weight = 0;
    let quantity = 0;
    let packages = 0;
    for (const item of items) {
      weight += item.weight ? Number(item.weight) : 0;
      quantity += item.quantity ?? 0;
      packages += item.packages ?? 0;
    }

    await tx.manifest.update({
      where: { id: manifestId },
      data: {
        totalWeight: Number(weight.toFixed(3)),
        totalQuantity: quantity,
        totalPackages: packages,
      },
    });
  }

  /** Stable, ordered manifest number: MAN-YYMM-##### (mirrors AL/LL/VOY/INS/CRG). */
  private async generateReference(): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(
      now.getUTCMonth() + 1
    ).padStart(2, '0')}`;
    const prefix = `MAN-${yymm}-`;

    const latest = await this.prisma.manifest.findFirst({
      where: { manifestNumber: { startsWith: prefix } },
      orderBy: { manifestNumber: 'desc' },
      select: { manifestNumber: true },
    });

    const lastSeq = latest ? Number(latest.manifestNumber.slice(prefix.length)) : 0;
    const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }
}
