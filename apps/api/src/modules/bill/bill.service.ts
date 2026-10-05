import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, BlStatus, BlType, FreightTerms } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NumberingService } from '../../common/infrastructure/numbering/numbering.service';
import { CreateRevisionDto } from './dto/bill.dto';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  AddBillItemDto,
  CancelBillDto,
  CreateBillDto,
  ListBillQueryDto,
  UpdateBillDto,
  UpdateBillItemDto,
} from './dto/bill.dto';

// ---------------------------------------------------------------------------
// B/L lifecycle (server-side).
//   (pre-P4-U4 shipped shape: DRAFT -> ISSUED | CANCELLED — superseded, live rows
//    backfilled ISSUED -> APPROVED by migration 20261004000001)
//   P4-U4 / ADR-045 decision 2 + ADR-046 ruling 1 — four-state lifecycle:
//     DRAFT   -> FINAL | CANCELLED
//     FINAL   -> APPROVED | CANCELLED   (mandatory cancel reason preserved)
//     APPROVED-> RELEASED                (dispatched by POST /:id/release — P4-U6,
//                                         gated by `bill:release` + AuditLog row)
//     RELEASED, CANCELLED                -> terminal
//   ISSUED is retained in the enum (additive migration; backfill mapped live rows to
//   APPROVED) but is not a source or target of any transition. Note the shipped
//   surrender edge (ISSUED -> CANCELLED) is NOT carried forward: ADR-046 ruling 1
//   defines "exactly this set", so APPROVED bills cannot be cancelled.
// ---------------------------------------------------------------------------
const BILL_TRANSITIONS: Record<BlStatus, BlStatus[]> = {
  DRAFT: ['FINAL', 'CANCELLED'],
  FINAL: ['APPROVED', 'CANCELLED'],
  APPROVED: ['RELEASED'],
  RELEASED: [],
  ISSUED: [],
  CANCELLED: [],
};

// Only DRAFT bills accept structural edits (header fields + items).
const EDITABLE_STATUSES: BlStatus[] = ['DRAFT'];

const manifestSummarySelect = {
  id: true,
  manifestNumber: true,
  status: true,
  polPort: { select: { id: true, code: true, name: true } },
  podPort: { select: { id: true, code: true, name: true } },
} satisfies Prisma.ManifestSelect;

const voyageSummarySelect = {
  id: true,
  voyageNumber: true,
  status: true,
} satisfies Prisma.VoyageSelect;

const listSelect = {
  id: true,
  billNumber: true,
  revision: true, // P4-U5: next revision label (ADR-045 decision 4)
  manifestId: true,
  voyageId: true,
  destinationPortId: true,
  status: true,
  billType: true,
  vesselName: true,
  vesselImo: true,
  shipperId: true,
  consigneeId: true,
  notifyParty: true,
  freightTerms: true,
  carrierName: true,
  placeOfIssue: true,
  dateOfIssue: true,
  originals: true,
  freightAmount: true,
  currencyCode: true,
  goodsDescription: true,
  shipmentMarks: true,
  totalPackages: true,
  totalGrossWeight: true,
  totalVolume: true,
  cancelReason: true,
  notes: true,
  createdById: true,
  issuedById: true,
  cancelledById: true,
  createdAt: true,
  updatedAt: true,
  issuedAt: true,
  cancelledAt: true,
  deletedAt: true,
  manifest: { select: manifestSummarySelect },
  voyage: { select: voyageSummarySelect },
  // Party relations now point at the masters (Shipper/Consignee), which have
  // no shortName — field dropped per party-cutover-plan.md §9.
  shipper: { select: { id: true, code: true, name: true } },
  consignee: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, email: true, fullName: true } },
  issuedBy: { select: { id: true, email: true, fullName: true } },
  cancelledBy: { select: { id: true, email: true, fullName: true } },
  _count: { select: { items: true } },
} satisfies Prisma.BillOfLadingSelect;

const cargoLiteSelect = {
  id: true,
  reference: true,
  specification: true,
  cargoType: true,
} satisfies Prisma.CargoSelect;

const billItemSelect = {
  id: true,
  billOfLadingId: true,
  manifestItemId: true,
  cargoId: true,
  sequence: true,
  goodsDescription: true,
  marksAndNumbers: true,
  packages: true,
  packageType: true,
  grossWeight: true,
  volume: true,
  createdAt: true,
  updatedAt: true,
  cargo: { select: cargoLiteSelect },
  manifestItem: { select: { id: true, blNumber: true, sequence: true } },
} satisfies Prisma.BillOfLadingItemSelect;

const detailSelect = {
  ...listSelect,
  items: {
    select: billItemSelect,
    orderBy: { sequence: 'asc' as const },
  },
} satisfies Prisma.BillOfLadingSelect;

/**
 * Shape of a frozen detailSelect snapshot (P4-U5): detailSelect always emits these
 * keys, so restore reads them back defensively (`?? null` for nullable columns).
 * Decimals arrive as strings, dates as ISO strings (JSON.stringify round-trip).
 */
interface RevisionSnapshot {
  billType?: string;
  shipperId?: string | null;
  consigneeId?: string | null;
  notifyParty?: string | null;
  freightTerms?: string | null;
  carrierName?: string | null;
  placeOfIssue?: string | null;
  dateOfIssue?: string | null;
  originals?: number | null;
  freightAmount?: string | null;
  currencyCode?: string | null;
  goodsDescription?: string | null;
  shipmentMarks?: string | null;
  notes?: string | null;
  items?: Array<{
    manifestItemId?: string | null;
    cargoId: string; // NOT NULL column — always present in a detailSelect snapshot
    sequence?: number;
    goodsDescription?: string | null;
    marksAndNumbers?: string | null;
    packages?: number | null;
    packageType?: string | null;
    grossWeight?: string | null;
    volume?: string | null;
  }>;
}

/** A cargo line eligible for a voyage-mode B/L (ADR-045 decision 1). */
interface EligibleCargoLine {
  cargoId: string;
  sequence: number;
  goodsDescription: string | null;
  marksAndNumbers: string | null;
  packages: number | null;
  packageType: string | null;
  grossWeight: Prisma.Decimal | null;
  volume: Prisma.Decimal | null;
  cargo: { id: string; reference: string; shipperId: string | null; consigneeId: string | null };
}

@Injectable()
export class BillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // B/L CRUD
  // -------------------------------------------------------------------------

  async list(query: ListBillQueryDto) {
    const pagination = parsePagination(query);
    const sortField = (query.sort ?? 'createdAt') as
      | 'billNumber'
      | 'status'
      | 'createdAt'
      | 'issuedAt';
    const sortOrder = (query.order ?? 'desc') as Prisma.SortOrder;

    const where: Prisma.BillOfLadingWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status as BlStatus } : {}),
      ...(query.billType ? { billType: query.billType as BlType } : {}),
      ...(query.manifestId ? { manifestId: query.manifestId } : {}),
      ...(query.voyageId ? { voyageId: query.voyageId } : {}),
      ...(query.shipperId ? { shipperId: query.shipperId } : {}),
      ...(query.consigneeId ? { consigneeId: query.consigneeId } : {}),
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
              { billNumber: { contains: query.search, mode: 'insensitive' } },
              { vesselName: { contains: query.search, mode: 'insensitive' } },
              { carrierName: { contains: query.search, mode: 'insensitive' } },
              { notifyParty: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
              { manifest: { manifestNumber: { contains: query.search, mode: 'insensitive' } } },
              { voyage: { voyageNumber: { contains: query.search, mode: 'insensitive' } } },
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
      this.prisma.billOfLading.count({ where }),
      this.prisma.billOfLading.findMany({
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
    const row = await this.prisma.billOfLading.findUnique({ where: { id }, select: detailSelect });
    if (!row || row.deletedAt) {
      throw new NotFoundException('Bill of Lading not found');
    }
    return row;
  }

  /**
   * Party ids written onto a B/L must resolve to live (existing,
   * non-soft-deleted) master rows since the Customer -> masters cutover
   * (party-cutover-plan.md §3).
   *  - explicit dto ids are payload -> unknown/deleted id is 400;
   *  - ids derived from the manifest are a document-state problem -> 409
   *    (the manifest itself references a dead master).
   */
  private async assertLiveParty(
    kind: 'shipper' | 'consignee',
    id: string,
    fromManifest: boolean,
  ) {
    const row =
      kind === 'shipper'
        ? await this.prisma.shipper.findUnique({ where: { id }, select: { deletedAt: true } })
        : await this.prisma.consignee.findUnique({ where: { id }, select: { deletedAt: true } });
    if (row && !row.deletedAt) return;
    const label = kind === 'shipper' ? 'Shipper' : 'Consignee';
    if (fromManifest) {
      throw new ConflictException(
        `Cannot issue B/L: manifest ${kind} does not reference a live ${label}`,
      );
    }
    throw new BadRequestException(`Unknown ${kind}Id: no live ${label} with id ${id}`);
  }

  /**
   * Create a B/L — two input modes (transition contract A; ADR-045 decision 1 / P4-U2):
   *  - legacy `{ manifestId }` — kept accepted until P4-U7 switches the shipped web page
   *    (the page REQUIRES manifestId today; transitional, marked here and in the DTO);
   *  - target `{ voyageId, cargoIds? }` — standalone from voyage + actually-loaded cargo
   *    (ADR-029/042 predicate: COMPLETED Actual Loading with actualQuantity > 0);
   *    no manifest involved, `manifestId` stored null, vessel snapshot from the voyage,
   *    destinationPortId stored as the P4-U3 numbering scope key.
   * Both modes allocate a per-destination number `BOL-{DEST}-YYMM-#####` via
   * NumberingService (ADR-045 decision 5, P4-U3) and create in DRAFT.
   */
  async create(dto: CreateBillDto, actor?: AuthenticatedUser) {
    if (dto.manifestId && dto.voyageId) {
      throw new BadRequestException(
        'Provide either manifestId (legacy transitional input) or voyageId, not both',
      );
    }
    if (!dto.manifestId && !dto.voyageId) {
      throw new BadRequestException('manifestId (legacy) or voyageId is required');
    }
    if (dto.cargoIds?.length && !dto.voyageId) {
      throw new BadRequestException('cargoIds requires voyageId');
    }
    if (dto.manifestId) {
      return this.createFromManifest(dto, actor);
    }
    return this.createFromCargo(dto, actor);
  }

  /** Legacy transitional path — unchanged behaviour; retires at P4-U7. */
  private async createFromManifest(dto: CreateBillDto, actor?: AuthenticatedUser) {
    const manifest = await this.prisma.manifest.findUnique({
      where: { id: dto.manifestId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        voyageId: true,
        vesselName: true,
        vesselImo: true,
        shipperId: true,
        consigneeId: true,
        notifyParty: true,
        voyage: { select: { destinationPortId: true } },
      },
    });
    if (!manifest || manifest.deletedAt) {
      throw new NotFoundException('Manifest not found');
    }
    if (manifest.status !== 'APPROVED') {
      throw new ConflictException(
        'Bills of Lading can only be issued against an APPROVED manifest',
      );
    }

    // Effective parties = dto override ?? manifest derivation — each must be a
    // live master before it is frozen onto the B/L (plan §3).
    if (dto.shipperId) {
      await this.assertLiveParty('shipper', dto.shipperId, false);
    } else if (manifest.shipperId) {
      await this.assertLiveParty('shipper', manifest.shipperId, true);
    }
    if (dto.consigneeId) {
      await this.assertLiveParty('consignee', dto.consigneeId, false);
    } else if (manifest.consigneeId) {
      await this.assertLiveParty('consignee', manifest.consigneeId, true);
    }

    // Per-destination numbering (ADR-045 decision 5): the legacy path also stores the
    // destination scope key derived from the manifest's voyage.
    const destinationPortId = manifest.voyage.destinationPortId;
    if (!destinationPortId) {
      throw new BadRequestException(
        'destinationPortId is required to number a B/L per destination (ADR-045 decision 5)',
      );
    }

    // Number allocation is now transactional (NumberingService, SELECT ... FOR UPDATE), so
    // the historical billNumber read-then-write race no longer exists; the bounded-retry
    // loop is retained for other unique/reference conflicts (P2002/P2018/P2003 mapping
    // unchanged). Any sequence number consumed by a failed attempt simply leaves a gap.
    const MAX_BILL_ATTEMPTS = 10;
    for (let attempt = 1; ; attempt += 1) {
      const billNumber = await this.allocateBillNumber(destinationPortId);
      try {
        return await this.prisma.billOfLading.create({
          data: {
            billNumber,
          manifestId: dto.manifestId,
          voyageId: manifest.voyageId,
          destinationPortId: manifest.voyage.destinationPortId,
          vesselName: manifest.vesselName,
          vesselImo: manifest.vesselImo,
          billType: (dto.billType as BlType) ?? 'HOUSE',
          shipperId: dto.shipperId ?? manifest.shipperId,
          consigneeId: dto.consigneeId ?? manifest.consigneeId,
          notifyParty: dto.notifyParty ?? manifest.notifyParty,
          freightTerms: dto.freightTerms as FreightTerms | undefined,
          carrierName: dto.carrierName,
          placeOfIssue: dto.placeOfIssue,
          dateOfIssue: dto.dateOfIssue ? new Date(dto.dateOfIssue) : undefined,
          originals: dto.originals,
          freightAmount: dto.freightAmount ?? undefined,
          currencyCode: dto.currencyCode,
          goodsDescription: dto.goodsDescription,
          shipmentMarks: dto.shipmentMarks,
            notes: dto.notes,
            createdById: actor?.id,
          },
          select: detailSelect,
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          attempt < MAX_BILL_ATTEMPTS &&
          String((e.meta as { target?: unknown } | undefined)?.target ?? '').includes(
            'billNumber'
          )
        ) {
          continue; // lost the number race: re-read the committed max and retry
        }
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (e.code === 'P2002' || e.code === 'P2018')
        ) {
          throw new ConflictException('Could not create B/L: duplicate reference');
        }
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
          throw new BadRequestException(
            'Invalid reference: party ids must reference existing master records',
          );
        }
        throw e;
      }
    }
  }


  /**
   * Target path (ADR-045 decision 1): standalone B/L from voyage + cargo lines.
   * Vessel snapshot derives from the voyage; parties = explicit DTO ids first
   * (Phase-2 masters), else derived from the selected cargo lines — never a manifest.
   * Item snapshots default from cargo/loading facts. Totals computed from the lines.
   */
  private async createFromCargo(dto: CreateBillDto, actor?: AuthenticatedUser) {
    const voyage = await this.prisma.voyage.findUnique({
      where: { id: dto.voyageId! },
      select: {
        id: true,
        destinationPortId: true,
        vessel: { select: { name: true, imo: true } },
      },
    });
    if (!voyage) {
      throw new NotFoundException('Voyage not found');
    }

    const cargoIds = dto.cargoIds ?? [];
    const lines: EligibleCargoLine[] = [];
    for (let i = 0; i < cargoIds.length; i += 1) {
      lines.push(await this.loadEligibleCargoLine(voyage.id, cargoIds[i], undefined, i + 1));
    }

    // Parties: explicit DTO (masters) win; otherwise first non-null per field across the
    // selected lines, in the order given (deterministic). Every chosen id must be live.
    const shipperId = dto.shipperId ?? lines.map((l) => l.cargo.shipperId).find((x) => x);
    const consigneeId = dto.consigneeId ?? lines.map((l) => l.cargo.consigneeId).find((x) => x);
    if (shipperId) await this.assertLiveParty('shipper', shipperId, false);
    if (consigneeId) await this.assertLiveParty('consignee', consigneeId, false);

    const totalPackages = lines.reduce((s, l) => s + (l.packages ?? 0), 0);
    const totalGrossWeight = lines.reduce(
      (s, l) => s + Number(l.grossWeight ?? new Prisma.Decimal(0)),
      0,
    );
    const totalVolume = lines.reduce((s, l) => s + Number(l.volume ?? new Prisma.Decimal(0)), 0);

    if (!voyage.destinationPortId) {
      throw new BadRequestException(
        'destinationPortId is required to number a B/L per destination (ADR-045 decision 5)',
      );
    }

    const MAX_BILL_ATTEMPTS = 10;
    for (let attempt = 1; ; attempt += 1) {
      const billNumber = await this.allocateBillNumber(voyage.destinationPortId);
      try {
        return await this.prisma.billOfLading.create({
          data: {
            billNumber,
            manifestId: null,
            voyageId: voyage.id,
            destinationPortId: voyage.destinationPortId,
            vesselName: voyage.vessel.name,
            vesselImo: voyage.vessel.imo,
            billType: (dto.billType as BlType) ?? 'HOUSE',
            shipperId: shipperId ?? null,
            consigneeId: consigneeId ?? null,
            notifyParty: dto.notifyParty,
            freightTerms: dto.freightTerms as FreightTerms | undefined,
            carrierName: dto.carrierName,
            placeOfIssue: dto.placeOfIssue,
            dateOfIssue: dto.dateOfIssue ? new Date(dto.dateOfIssue) : undefined,
            originals: dto.originals,
            freightAmount: dto.freightAmount ?? undefined,
            currencyCode: dto.currencyCode,
            goodsDescription: dto.goodsDescription,
            shipmentMarks: dto.shipmentMarks,
            notes: dto.notes,
            createdById: actor?.id,
            totalPackages,
            totalGrossWeight: new Prisma.Decimal(totalGrossWeight.toFixed(3)),
            totalVolume: new Prisma.Decimal(totalVolume.toFixed(3)),
            items: {
              create: lines.map((l) => ({
                cargoId: l.cargoId,
                sequence: l.sequence,
                goodsDescription: l.goodsDescription,
                marksAndNumbers: l.marksAndNumbers,
                packages: l.packages,
                packageType: l.packageType,
                grossWeight: l.grossWeight,
                volume: l.volume,
              })),
            },
          },
          select: detailSelect,
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          attempt < MAX_BILL_ATTEMPTS &&
          String((e.meta as { target?: unknown } | undefined)?.target ?? '').includes('billNumber')
        ) {
          continue; // lost the number race: re-read and retry (same pattern as legacy)
        }
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (e.code === 'P2002' || e.code === 'P2018')
        ) {
          throw new ConflictException('Could not create B/L: duplicate reference');
        }
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
          throw new BadRequestException(
            'Invalid reference: party ids must reference existing master records',
          );
        }
        throw e;
      }
    }
  }

  /**
   * The ADR-045/042 eligibility predicate, shared by create-from-cargo, addItem { cargoId }
   * and eligible-items?voyageId= — cargo must sit in a COMPLETED Actual Loading of this
   * voyage with actualQuantity > 0 (ADR-029 "actually loaded", ADR-042 positive quantity,
   * ADR-039 keeps not-loaded lines out) and must not already sit on a live (non-cancelled,
   * non-deleted) B/L of the SAME voyage — one live bill per cargo line per voyage,
   * application-level, same soft-delete rationale as ADR-030/029.
   */
  private async loadEligibleCargoLine(
    voyageId: string,
    cargoId: string,
    excludeBillId?: string,
    sequence = 1,
  ): Promise<EligibleCargoLine> {
    const cargo = await this.prisma.cargo.findUnique({
      where: { id: cargoId },
      select: {
        id: true,
        reference: true,
        deletedAt: true,
        specification: true,
        serialNumber: true,
        vin: true,
        packages: true,
        packageType: true,
        weight: true,
        shipperId: true,
        consigneeId: true,
      },
    });
    if (!cargo || cargo.deletedAt) {
      throw new NotFoundException(`Cargo not found: ${cargoId}`);
    }
    const loaded = await this.prisma.actualLoadingItem.findFirst({
      where: {
        cargoId,
        actualQuantity: { gt: 0 },
        actualLoading: {
          status: 'COMPLETED',
          deletedAt: null,
          loadList: { voyageId, deletedAt: null },
        },
      },
      select: { id: true },
    });
    if (!loaded) {
      throw new ConflictException(
        `Cargo ${cargo.reference} is not eligible for this voyage's B/L ` +
          '(requires a COMPLETED Actual Loading with a recorded quantity greater than 0)',
      );
    }
    const claimed = await this.prisma.billOfLadingItem.findFirst({
      where: {
        cargoId,
        ...(excludeBillId ? { NOT: { billOfLadingId: excludeBillId } } : {}),
        billOfLading: { voyageId, deletedAt: null, status: { not: 'CANCELLED' } },
      },
      select: { billOfLading: { select: { billNumber: true } } },
    });
    if (claimed) {
      throw new ConflictException(
        `Cargo ${cargo.reference} is already on live B/L ${claimed.billOfLading.billNumber}`,
      );
    }
    return {
      cargoId: cargo.id,
      sequence,
      goodsDescription: cargo.specification,
      marksAndNumbers: cargo.serialNumber ?? cargo.vin,
      packages: cargo.packages,
      packageType: cargo.packageType,
      grossWeight: cargo.weight,
      volume: null, // Cargo has no volume column; line keeps its own editable value
      cargo: {
        id: cargo.id,
        reference: cargo.reference,
        shipperId: cargo.shipperId,
        consigneeId: cargo.consigneeId,
      },
    };
  }

  /**
   * Update B/L header fields. Only DRAFT bills may be edited.
   */
  async update(id: string, dto: UpdateBillDto) {
    const existing = await this.prisma.billOfLading.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    await this.assertEditable(existing, 'edited');
    if (dto.shipperId) await this.assertLiveParty('shipper', dto.shipperId, false);
    if (dto.consigneeId) await this.assertLiveParty('consignee', dto.consigneeId, false);

    try {
      return await this.prisma.billOfLading.update({
      where: { id },
      data: {
        ...(dto.billType !== undefined ? { billType: dto.billType as BlType } : {}),
        ...(dto.shipperId !== undefined ? { shipperId: dto.shipperId || null } : {}),
        ...(dto.consigneeId !== undefined ? { consigneeId: dto.consigneeId || null } : {}),
        ...(dto.notifyParty !== undefined ? { notifyParty: dto.notifyParty } : {}),
        ...(dto.freightTerms !== undefined
          ? { freightTerms: (dto.freightTerms as FreightTerms) || null }
          : {}),
        ...(dto.carrierName !== undefined ? { carrierName: dto.carrierName } : {}),
        ...(dto.placeOfIssue !== undefined ? { placeOfIssue: dto.placeOfIssue } : {}),
        ...(dto.dateOfIssue !== undefined
          ? { dateOfIssue: dto.dateOfIssue ? new Date(dto.dateOfIssue) : null }
          : {}),
        ...(dto.originals !== undefined ? { originals: dto.originals ?? null } : {}),
        ...(dto.freightAmount !== undefined ? { freightAmount: dto.freightAmount ?? null } : {}),
        ...(dto.currencyCode !== undefined ? { currencyCode: dto.currencyCode } : {}),
        ...(dto.goodsDescription !== undefined ? { goodsDescription: dto.goodsDescription } : {}),
        ...(dto.shipmentMarks !== undefined ? { shipmentMarks: dto.shipmentMarks } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
        select: detailSelect,
      });
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
   * Soft delete a B/L. Only DRAFT bills may be deleted; issued and cancelled
   * documents are preserved for audit.
   */
  async remove(id: string) {
    const existing = await this.prisma.billOfLading.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    await this.assertEditable(existing, 'deleted');

    await this.prisma.billOfLading.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return this.prisma.billOfLading.findUniqueOrThrow({ where: { id }, select: detailSelect });
  }

  // -------------------------------------------------------------------------
  // B/L Items (manifest cargo lines)
  // -------------------------------------------------------------------------

  /**
   * Add a manifest line to the B/L.
   * Enforces: bill is DRAFT; the manifest item belongs to the bill's manifest;
   * the line is not already claimed by another live (non-cancelled,
   * non-deleted) B/L. Snapshots packages/type/weight from the manifest line.
   */
  async addItem(id: string, dto: AddBillItemDto) {
    const bill = await this.prisma.billOfLading.findUnique({
      where: { id },
      select: { id: true, status: true, manifestId: true, voyageId: true, deletedAt: true },
    });
    await this.assertEditable(bill, 'modified');

    if (dto.manifestItemId && dto.cargoId) {
      throw new BadRequestException('Provide either manifestItemId (legacy) or cargoId, not both');
    }
    if (!dto.manifestItemId && !dto.cargoId) {
      throw new BadRequestException('manifestItemId (legacy) or cargoId is required');
    }

    // Voyage-mode bill (manifestId null): add by cargoId under the ADR-045 predicate.
    if (dto.cargoId) {
      if (bill!.manifestId) {
        throw new ConflictException(
          'This B/L was created from a manifest (legacy); add lines with manifestItemId',
        );
      }
      const line = await this.loadEligibleCargoLine(bill!.voyageId, dto.cargoId, id);
      const maxSeq = await this.prisma.billOfLadingItem.aggregate({
        where: { billOfLadingId: id },
        _max: { sequence: true },
      });
      line.sequence = (maxSeq._max.sequence ?? 0) + 1;
      return this.prisma.$transaction(async (tx) => {
        await tx.billOfLadingItem.create({
          data: {
            billOfLadingId: id,
            cargoId: line.cargoId,
            manifestItemId: null,
            sequence: line.sequence,
            goodsDescription: dto.goodsDescription ?? line.goodsDescription ?? undefined,
            marksAndNumbers: dto.marksAndNumbers ?? line.marksAndNumbers ?? undefined,
            packages: dto.packages ?? line.packages ?? undefined,
            packageType: dto.packageType ?? line.packageType ?? undefined,
            grossWeight: line.grossWeight ?? undefined,
            volume: dto.volume ?? undefined,
          },
        });
        await this.recomputeTotals(tx, id);
        return tx.billOfLading.findUniqueOrThrow({ where: { id }, select: detailSelect });
      });
    }

    // Legacy transitional path (manifest-linked bills until P4-U7).
    if (!bill!.manifestId) {
      throw new ConflictException(
        'This B/L has no manifest (created from voyage+cargo); add lines with cargoId',
      );
    }
    const manifestItem = await this.prisma.manifestItem.findUnique({
      where: { id: dto.manifestItemId! },
      select: {
        id: true,
        manifestId: true,
        cargoId: true,
        weight: true,
        packages: true,
        packageType: true,
        quantity: true,
        cargo: { select: { specification: true, serialNumber: true } },
      },
    });
    if (!manifestItem) {
      throw new NotFoundException('Manifest item not found');
    }
    if (manifestItem.manifestId !== bill!.manifestId) {
      throw new ConflictException(
        'Manifest item does not belong to this manifest; a B/L can only document lines of its own manifest',
      );
    }

    const claimed = await this.prisma.billOfLadingItem.findFirst({
      where: {
        manifestItemId: dto.manifestItemId!, // narrow: legacy branch guarantees presence
        billOfLading: { deletedAt: null, status: { not: 'CANCELLED' } },
      },
      select: { id: true, billOfLading: { select: { billNumber: true } } },
    });
    if (claimed) {
      throw new ConflictException(
        `This manifest line is already assigned to B/L ${claimed.billOfLading.billNumber}`,
      );
    }

    const maxSeq = await this.prisma.billOfLadingItem.aggregate({
      where: { billOfLadingId: id },
      _max: { sequence: true },
    });
    const sequence = (maxSeq._max.sequence ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      await tx.billOfLadingItem.create({
        data: {
          billOfLadingId: id,
          manifestItemId: dto.manifestItemId!, // narrow: legacy branch guarantees presence
          cargoId: manifestItem.cargoId,
          sequence,
          goodsDescription: dto.goodsDescription ?? manifestItem.cargo.specification ?? undefined,
          marksAndNumbers: dto.marksAndNumbers ?? manifestItem.cargo.serialNumber ?? undefined,
          packages: dto.packages ?? manifestItem.packages ?? undefined,
          packageType: dto.packageType ?? manifestItem.packageType ?? undefined,
          grossWeight: dto.grossWeight ?? manifestItem.weight
            ? new Prisma.Decimal(dto.grossWeight ?? Number(manifestItem.weight))
            : undefined,
          volume: dto.volume ?? undefined,
        },
      });
      await this.recomputeTotals(tx, id);
      return tx.billOfLading.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  /** Update a B/L line (document text + figures). DRAFT only. */
  async updateItem(id: string, itemId: string, dto: UpdateBillItemDto) {
    const bill = await this.prisma.billOfLading.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    await this.assertEditable(bill, 'modified');

    const item = await this.prisma.billOfLadingItem.findFirst({
      where: { id: itemId, billOfLadingId: id },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('B/L item not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.billOfLadingItem.update({
        where: { id: itemId },
        data: {
          ...(dto.goodsDescription !== undefined ? { goodsDescription: dto.goodsDescription } : {}),
          ...(dto.marksAndNumbers !== undefined ? { marksAndNumbers: dto.marksAndNumbers } : {}),
          ...(dto.packages !== undefined ? { packages: dto.packages ?? null } : {}),
          ...(dto.packageType !== undefined ? { packageType: dto.packageType } : {}),
          ...(dto.grossWeight !== undefined
            ? { grossWeight: dto.grossWeight === null ? null : new Prisma.Decimal(dto.grossWeight) }
            : {}),
          ...(dto.volume !== undefined
            ? { volume: dto.volume === null ? null : new Prisma.Decimal(dto.volume) }
            : {}),
        },
      });
      await this.recomputeTotals(tx, id);
      return tx.billOfLading.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  /** Remove a B/L line and recompute totals. DRAFT only. */
  async removeItem(id: string, itemId: string) {
    const bill = await this.prisma.billOfLading.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    await this.assertEditable(bill, 'modified');

    const item = await this.prisma.billOfLadingItem.findFirst({
      where: { id: itemId, billOfLadingId: id },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('B/L item not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.billOfLadingItem.delete({ where: { id: itemId } });
      await this.recomputeTotals(tx, id);
      return tx.billOfLading.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  /**
   * Two picker modes (transition contract A; ADR-045 decision 1):
   *  - `?manifestId=` — legacy transitional path, kept for the shipped web page
   *    (bills/page.tsx) until P4-U7;
   *  - `?voyageId=` — target path: actually-loaded cargo (ADR-029/042 predicate)
   *    minus cargo already on a live B/L of this voyage.
   */
  async eligibleItems(manifestId?: string, voyageId?: string) {
    if (manifestId && voyageId) {
      throw new BadRequestException('Provide either manifestId or voyageId, not both');
    }
    if (!manifestId && !voyageId) {
      throw new BadRequestException('manifestId (legacy) or voyageId is required');
    }
    if (voyageId) {
      return this.eligibleCargoForVoyage(voyageId);
    }
    return this.eligibleItemsFromManifest(manifestId!);
  }

  /** Target picker rows: loaded cargo of the voyage not yet claimed by a live B/L. */
  private async eligibleCargoForVoyage(voyageId: string) {
    const voyage = await this.prisma.voyage.findUnique({
      where: { id: voyageId },
      select: { id: true },
    });
    if (!voyage) {
      throw new NotFoundException('Voyage not found');
    }
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
        cargoId: true,
        cargo: {
          select: {
            id: true,
            reference: true,
            specification: true,
            serialNumber: true,
            vin: true,
            packages: true,
            packageType: true,
            weight: true,
            cargoType: true,
          },
        },
      },
    });
    const claimed = await this.prisma.billOfLadingItem.findMany({
      where: {
        cargoId: { in: loaded.map((l) => l.cargoId) },
        billOfLading: { voyageId, deletedAt: null, status: { not: 'CANCELLED' } },
      },
      select: { cargoId: true },
    });
    const claimedCargos = new Set(claimed.map((r) => r.cargoId));
    return loaded
      .filter((row) => !claimedCargos.has(row.cargoId))
      .map((row) => ({
        id: row.cargoId, // cargo-keyed row (voyage mode has no manifest line id)
        manifestId: null,
        cargoId: row.cargoId,
        sequence: null,
        blNumber: null,
        weight: row.cargo.weight,
        quantity: null,
        packages: row.cargo.packages,
        packageType: row.cargo.packageType,
        cargo: {
          id: row.cargo.id,
          reference: row.cargo.reference,
          specification: row.cargo.specification,
          cargoType: row.cargo.cargoType,
        },
        marksAndNumbers: row.cargo.serialNumber ?? row.cargo.vin,
      }));
  }

  /**
   * Manifest lines eligible for a B/L: items of the given manifest not claimed
   * by any live (non-cancelled, non-deleted) B/L — including the given bill's
   * own lines (a line already on a bill, even this one, is not eligible).
   * LEGACY transitional path (kept for the shipped page until P4-U7).
   */
  private async eligibleItemsFromManifest(manifestId: string) {
    const manifest = await this.prisma.manifest.findUnique({
      where: { id: manifestId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!manifest || manifest.deletedAt) {
      throw new NotFoundException('Manifest not found');
    }

    const claimed = await this.prisma.billOfLadingItem.findMany({
      where: {
        manifestItem: { manifestId },
        billOfLading: { deletedAt: null, status: { not: 'CANCELLED' } },
      },
      select: { manifestItemId: true },
    });
    const claimedIds = new Set(claimed.map((r) => r.manifestItemId));

    const items = await this.prisma.manifestItem.findMany({
      where: { manifestId },
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
        cargo: { select: cargoLiteSelect },
      },
      orderBy: { sequence: 'asc' },
    });

    return items
      .filter((row) => !claimedIds.has(row.id))
      .map((row) => ({
        id: row.id,
        manifestId: row.manifestId,
        cargoId: row.cargoId,
        sequence: row.sequence,
        blNumber: row.blNumber,
        weight: row.weight,
        quantity: row.quantity,
        packages: row.packages,
        packageType: row.packageType,
        cargo: row.cargo,
      }));
  }

  // -------------------------------------------------------------------------
  // Lifecycle Transitions
  // -------------------------------------------------------------------------

  /**
   * ISSUE ENDPOINT — recorded alias per ADR-045 decision 2 ("aliased during
   * transition, then renamed"): the shipped UI's single Issue click implements the
   * two table edges DRAFT -> FINAL -> APPROVED atomically (FINAL -> APPROVED when the
   * bill is already FINAL), landing on the issued-equivalent APPROVED state
   * (workflows §3.1 step 7's single "finalized/approved and issued" moment; ADR-046
   * ruling 1). Requires at least one line. Stamps
   * ManifestItem.blNumber with the B/L number and freezes the document (now at
   * APPROVED). Any other source state -> 409 from the transition table.
   */
  async issue(id: string, actor?: AuthenticatedUser) {
    const existing = await this.prisma.billOfLading.findUnique({
      where: { id },
      select: {
        id: true,
        billNumber: true,
        status: true,
        deletedAt: true,
        dateOfIssue: true,
        _count: { select: { items: true } },
      },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Bill of Lading not found');
    }
    // Composite alias: walk the table's own edges so no direct DRAFT -> APPROVED
    // entry is ever required. DRAFT: finalize step, then approve step. FINAL: approve.
    if (existing.status === 'DRAFT') {
      this.assertTransition(existing.status, 'FINAL');
      this.assertTransition('FINAL', 'APPROVED');
    } else {
      this.assertTransition(existing.status, 'APPROVED');
    }
    if (existing._count.items === 0) {
      throw new BadRequestException('Cannot issue a B/L with no cargo lines');
    }

    return this.approveCore(existing, actor);
  }

  /**
   * DRAFT -> FINAL (P4-U4): the explicit finalize step, exposed for API/automation.
   * The shipped page reaches its issued-equivalent through the issue alias instead
   * (single Issue click = DRAFT -> FINAL -> APPROVED), so the web never strands a bill:
   * FINAL bills still expose Issue (alias from FINAL) and Cancel. No stamp at FINAL —
   * lines are stamped when the bill reaches APPROVED. Guarded by bill:issue (same
   * operational permission as the alias; no new permission codes in this unit).
   */
  async finalize(id: string) {
    const existing = await this.prisma.billOfLading.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Bill of Lading not found');
    }
    this.assertTransition(existing.status, 'FINAL');
    return this.prisma.billOfLading.update({
      where: { id },
      data: { status: 'FINAL' },
      select: detailSelect,
    });
  }

  /**
   * FINAL -> APPROVED (P4-U4): the explicit edge behind the issue alias, with the
   * identical stamp/freeze semantics (shared approveCore). Guarded by bill:issue.
   */
  async approve(id: string, actor?: AuthenticatedUser) {
    const existing = await this.prisma.billOfLading.findUnique({
      where: { id },
      select: {
        id: true,
        billNumber: true,
        status: true,
        deletedAt: true,
        dateOfIssue: true,
        _count: { select: { items: true } },
      },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Bill of Lading not found');
    }
    this.assertTransition(existing.status, 'APPROVED');
    if (existing._count.items === 0) {
      throw new BadRequestException('Cannot approve a B/L with no cargo lines');
    }
    return this.approveCore(existing, actor);
  }

  /** Shared APPROVED write used by both the issue alias and the explicit approve edge. */
  private async approveCore(
    existing: {
      id: string;
      billNumber: string;
      dateOfIssue: Date | null;
    },
    actor?: AuthenticatedUser,
  ) {
    const id = existing.id;
    return this.prisma.$transaction(async (tx) => {
      // Re-check nothing claimed our lines meanwhile (paranoia under tx).
      const items = await tx.billOfLadingItem.findMany({
        where: { billOfLadingId: id },
        select: { manifestItemId: true },
      });
      // ADR-045/P4-U2: only legacy manifest-linked lines get stamped; voyage-mode items
      // have manifestItemId null (the stamp direction reverses in Phase 5).
      const itemIds = items
        .map((i) => i.manifestItemId)
        .filter((x): x is string => x !== null);
      if (itemIds.length > 0) {
        await tx.manifestItem.updateMany({
          where: { id: { in: itemIds } },
          data: { blNumber: existing.billNumber },
        });
      }

      return tx.billOfLading.update({
        where: { id },
        data: {
          // issued-equivalent state per ADR-046 ruling 1 (alias lands DRAFT|FINAL -> APPROVED)
          status: 'APPROVED',
          issuedAt: new Date(),
          issuedById: actor?.id,
          dateOfIssue: existing.dateOfIssue ?? new Date(),
        },
        select: detailSelect,
      });
    });
  }

  /** DRAFT|FINAL -> CANCELLED (ADR-046 ruling 1). Reason required. Releases the manifest lines. */
  async cancel(id: string, dto: CancelBillDto, actor?: AuthenticatedUser) {
    const existing = await this.prisma.billOfLading.findUnique({
      where: { id },
      select: { id: true, billNumber: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Bill of Lading not found');
    }
    this.assertTransition(existing.status, 'CANCELLED');
    if (!dto.cancelReason?.trim()) {
      throw new BadRequestException('A cancellation reason is required');
    }

    return this.prisma.$transaction(async (tx) => {
      // Release manifest lines that this bill stamped (only ours).
      const items = await tx.billOfLadingItem.findMany({
        where: { billOfLadingId: id },
        select: { manifestItemId: true },
      });
      const itemIds = items
        .map((i) => i.manifestItemId)
        .filter((x): x is string => x !== null); // voyage-mode lines never stamped (P4-U2)
      if (itemIds.length > 0) {
        await tx.manifestItem.updateMany({
          where: { id: { in: itemIds }, blNumber: existing.billNumber },
          data: { blNumber: null },
        });
      }

      return tx.billOfLading.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelReason: dto.cancelReason.trim(),
          cancelledAt: new Date(),
          cancelledById: actor?.id,
        },
        select: detailSelect,
      });
    });
  }

  // -------------------------------------------------------------------------
  // P4-U6 — release separation (ADR-045 decision 3 + ADR-046 ruling 2)
  // -------------------------------------------------------------------------

  /**
   * APPROVED -> RELEASED: the edge U4 left inert, now dispatched behind its own
   * `bill:release` permission (workflows §3.1 step 9 — a separate permission
   * concept). Writes an ADR-010 AuditLog row IN THE SAME TRANSACTION
   * (action `bill:release`, shape recorded in the P4-U6 log). RELEASED stays
   * terminal via BILL_TRANSITIONS; any other source status is 409 from the table
   * (recorded message: `B/L transition {status} -> RELEASED is not allowed`).
   * The two axes stay independent: approval never releases, release never re-opens
   * (no status change other than APPROVED -> RELEASED happens here).
   */
  async release(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockBill(tx, id);
      const bill = await tx.billOfLading.findUnique({
        where: { id },
        select: { id: true, billNumber: true, status: true, deletedAt: true },
      });
      if (!bill || bill.deletedAt) {
        throw new NotFoundException('Bill of Lading not found');
      }
      this.assertTransition(bill.status, 'RELEASED');
      const released = await tx.billOfLading.update({
        where: { id },
        data: { status: 'RELEASED' },
        select: detailSelect,
      });
      await this.audit.recordIn(tx, {
        action: 'bill:release',
        entityType: 'BillOfLading',
        entityId: id,
        actorId: actor.id,
        actorEmail: actor.email,
        beforeData: { status: bill.status },
        afterData: { status: 'RELEASED' },
        metadata: { billNumber: bill.billNumber },
      });
      return released;
    });
  }

  // -------------------------------------------------------------------------
  // P4-U5 — revisions (ADR-045 decision 4)
  // -------------------------------------------------------------------------
  //
  // Recorded decisions (the details decision 4 left to this unit):
  //  - SNAPSHOT SHAPE: the verbatim `detailSelect` row — header scalars + party/
  //    voyage/manifest summaries + item snapshots — via JSON.stringify (Decimal ->
  //    string, Date -> ISO). No parallel serializer: it is exactly what
  //    GET /bills/:id returns, i.e. the document state the customer reviews.
  //  - PERMISSION: `bill:update` — freezing is bookkeeping inside the draft-editing
  //    loop (customer-review corrections = edit -> next revision); `bill:issue` stays
  //    the forward-transition gate. No new permission codes.
  //  - CONCURRENCY: `SELECT ... FOR UPDATE` row lock inside one interactive tx, with
  //    the snapshot read performed UNDER the lock; @@unique(billId, revisionNumber)
  //    is the DB backstop.
  //  - NUMBERING: `bill.revision` is the label the NEXT freeze receives (snapshots
  //    come out 1, 2, 3, ...). billNumber is never re-allocated or changed.
  //  - RESTORE: read-back into the DRAFT (not a new data path) — the current state
  //    is captured as the NEXT revision first, then the target snapshot's document
  //    fields + items overwrite the draft. billNumber/status/stamps/audit/totals are
  //    never restored (totals recompute from the restored items).
  //  - Binding exclusions NOT built (decision 4): field diffs/compare, per-item
  //    version trees, multi-approver workflow engine, revision deletion/editing,
  //    branching.

  /** P4-U5 list-only history: ascending, immutable; no PUT/DELETE route exists. */
  async listRevisions(id: string) {
    const bill = await this.prisma.billOfLading.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!bill || bill.deletedAt) {
      throw new NotFoundException('Bill of Lading not found');
    }
    return this.prisma.billOfLadingRevision.findMany({
      where: { billId: id },
      orderBy: { revisionNumber: 'asc' },
      select: {
        id: true,
        revisionNumber: true,
        note: true,
        snapshot: true,
        createdAt: true,
        createdById: true,
        createdBy: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  /** Freeze the CURRENT document as the next immutable revision (lock held by caller). */
  private async freezeRevision(
    tx: Prisma.TransactionClient,
    row: { id: string; revision: number } & Record<string, unknown>,
    note: string | null,
    actor: AuthenticatedUser
  ) {
    const revisionNumber = row.revision;
    const snapshot = JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue;
    const created = await tx.billOfLadingRevision.create({
      data: {
        billId: row.id,
        revisionNumber,
        note,
        snapshot,
        createdById: actor.id,
      },
      select: {
        id: true,
        revisionNumber: true,
        note: true,
        createdAt: true,
        createdById: true,
        createdBy: { select: { id: true, email: true, fullName: true } },
      },
    });
    await tx.billOfLading.update({
      where: { id: row.id },
      data: { revision: revisionNumber + 1 },
    });
    return created;
  }

  /** Serialize snapshot writes against concurrent edits/issue (P4-U5 concurrency). */
  private async lockBill(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "bills_of_lading" WHERE "id" = ${id} FOR UPDATE`;
  }

  /**
   * POST /bills/:id/revisions — freeze the current DRAFT as the next revision.
   * Every non-DRAFT status (FINAL/APPROVED/RELEASED/CANCELLED/ISSUED) is frozen:
   * 409 with the recorded message.
   */
  async createRevision(id: string, dto: CreateRevisionDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockBill(tx, id);
      const bill = await tx.billOfLading.findUnique({ where: { id }, select: detailSelect });
      if (!bill || bill.deletedAt) {
        throw new NotFoundException('Bill of Lading not found');
      }
      if (bill.status !== 'DRAFT') {
        throw new ConflictException(
          `B/L revisions can only be created while DRAFT (current: ${bill.status})`
        );
      }
      return this.freezeRevision(tx, bill, dto.note?.trim() || null, actor);
    });
  }

  /**
   * POST /bills/:id/revisions/:n/restore — read-back into the DRAFT per ADR-045:
   * current state captured as the next revision first (nothing is lost), then the
   * target snapshot's document fields + items overwrite the draft, atomically.
   */
  async restoreRevision(id: string, revisionParam: string, actor: AuthenticatedUser) {
    const n = Number(revisionParam);
    if (!Number.isInteger(n) || n < 1) {
      throw new BadRequestException('revision must be a positive integer');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockBill(tx, id);
        const bill = await tx.billOfLading.findUnique({ where: { id }, select: detailSelect });
        if (!bill || bill.deletedAt) {
          throw new NotFoundException('Bill of Lading not found');
        }
        if (bill.status !== 'DRAFT') {
          throw new ConflictException(
            `B/L can only be restored into a DRAFT document (current: ${bill.status})`
          );
        }
        const target = await tx.billOfLadingRevision.findFirst({
          where: { billId: id, revisionNumber: n },
        });
        if (!target) {
          throw new NotFoundException(`Revision ${n} not found for this B/L`);
        }

        // 1) capture CURRENT state first — the pre-restore revision keeps everything
        await this.freezeRevision(
          tx,
          bill,
          `Pre-restore capture before restoring revision ${n}`,
          actor
        );

        // 2) read-back: only document-owned fields (UpdateBillDto set). Never restored:
        //    billNumber, status, revision, voyage/manifest/destination linkage, audit
        //    stamps (issued*/cancelled*), totals (recomputed below).
        const s = target.snapshot as unknown as RevisionSnapshot;
        await tx.billOfLading.update({
          where: { id },
          data: {
            billType: (s.billType as BlType | undefined) ?? bill.billType,
            shipperId: s.shipperId ?? null,
            consigneeId: s.consigneeId ?? null,
            notifyParty: s.notifyParty ?? null,
            freightTerms: (s.freightTerms as FreightTerms | null | undefined) ?? null,
            carrierName: s.carrierName ?? null,
            placeOfIssue: s.placeOfIssue ?? null,
            dateOfIssue: s.dateOfIssue ? new Date(s.dateOfIssue) : null,
            originals: s.originals ?? null,
            freightAmount: s.freightAmount ?? null,
            currencyCode: s.currencyCode ?? null,
            goodsDescription: s.goodsDescription ?? null,
            shipmentMarks: s.shipmentMarks ?? null,
            notes: s.notes ?? null,
          },
        });

        // 3) items read-back: replace the collection with the snapshot's rows (ids are
        //    intentionally NOT restored — new rows, same document identity), then
        //    recompute totals the way every other item write does.
        await tx.billOfLadingItem.deleteMany({ where: { billOfLadingId: id } });
        const snapItems = Array.isArray(s.items) ? s.items : [];
        for (const it of snapItems) {
          await tx.billOfLadingItem.create({
            data: {
              billOfLadingId: id,
              manifestItemId: it.manifestItemId ?? null,
              cargoId: it.cargoId,
              sequence: it.sequence ?? 1,
              goodsDescription: it.goodsDescription ?? null,
              marksAndNumbers: it.marksAndNumbers ?? null,
              packages: it.packages ?? null,
              packageType: it.packageType ?? null,
              grossWeight: it.grossWeight ?? null,
              volume: it.volume ?? null,
            },
          });
        }
        await this.recomputeTotals(tx, id);

        return tx.billOfLading.findUnique({ where: { id }, select: detailSelect });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new BadRequestException(
          'Invalid reference: party ids must reference existing master records'
        );
      }
      throw e;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async assertEditable(
    row: { status: BlStatus; deletedAt: Date | null } | null,
    verb: string
  ) {
    if (!row || row.deletedAt) {
      throw new NotFoundException('Bill of Lading not found');
    }
    if (!EDITABLE_STATUSES.includes(row.status)) {
      throw new ConflictException(`B/L is ${row.status}; only DRAFT bills can be ${verb}`);
    }
  }

  private assertTransition(current: BlStatus, target: BlStatus) {
    if (!BILL_TRANSITIONS[current]?.includes(target)) {
      throw new ConflictException(`B/L transition ${current} -> ${target} is not allowed`);
    }
  }

  /** Recompute aggregated totals from the bill's cargo lines. */
  private async recomputeTotals(tx: Prisma.TransactionClient, billId: string) {
    const items = await tx.billOfLadingItem.findMany({
      where: { billOfLadingId: billId },
      select: { packages: true, grossWeight: true, volume: true },
    });

    let packages = 0;
    let weight = 0;
    let volume = 0;
    for (const item of items) {
      packages += item.packages ?? 0;
      weight += item.grossWeight ? Number(item.grossWeight) : 0;
      volume += item.volume ? Number(item.volume) : 0;
    }

    await tx.billOfLading.update({
      where: { id: billId },
      data: {
        totalPackages: packages,
        totalGrossWeight: new Prisma.Decimal(Number(weight.toFixed(3))),
        totalVolume: new Prisma.Decimal(Number(volume.toFixed(3))),
      },
    });
  }

  /**
   * Per-destination B/L number (ADR-045 decision 5; recorded details in the P4-U3 log):
   *  - format `BOL-{DEST}-YYMM-#####` — the destination segment is what keeps the existing
   *    global `billNumber @unique` intact (no constraint change);
   *  - `{DEST}` = Port `abbreviation` when present, else `code` (decision b);
   *  - counter scope = per destination PER MONTH: NumberingSequence name embeds the
   *    destination id + YYYYMM (decision a; the same name-embeds-period pattern voyages
   *    uses), `period: 'YYYYMM'`, so each (destination, month) starts at 00001 — matching
   *    the legacy monthly cadence. Rows are created lazily by allocateNumber (decision d),
   *    so no seed/migration is needed;
   *  - allocation is transactional under SELECT ... FOR UPDATE — concurrent creates cannot
   *    collide (regression-tested).
   * Existing `BOL-YYMM-#####` numbers are never renumbered (decision: immutability) and
   * coexist with the new format under the same @unique index.
   */
  private async allocateBillNumber(destinationPortId: string): Promise<string> {
    if (!destinationPortId) {
      // Defensive (decision c): unreachable with legal data — both source columns
      // (voyage.destinationPortId, and the manifest's voyage by extension) are NOT NULL.
      throw new BadRequestException(
        'destinationPortId is required to number a B/L per destination (ADR-045 decision 5)',
      );
    }
    const port = await this.prisma.port.findUnique({
      where: { id: destinationPortId },
      select: { code: true, abbreviation: true },
    });
    if (!port) {
      throw new BadRequestException(`Unknown destination port: ${destinationPortId}`);
    }
    const destinationSegment = port.abbreviation || port.code;
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0')}`;
    const allocated = await this.numbering.allocateNumber({
      name: `bill-${destinationPortId}-${yymm}`,
      documentType: 'BILL',
      scopeType: 'DESTINATION',
      scopeValue: destinationPortId,
      prefix: `BOL-${destinationSegment}-${yymm}-`,
      padding: 5,
      format: '{prefix}{sequence}',
      period: 'YYYYMM',
    });
    return allocated.sequence;
  }
}
