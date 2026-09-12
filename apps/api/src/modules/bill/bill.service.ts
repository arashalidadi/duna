import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, BlStatus, BlType, FreightTerms } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
//   DRAFT -> ISSUED | CANCELLED
//   ISSUED -> CANCELLED (surrender; releases the manifest lines)
//   CANCELLED is terminal.
// ---------------------------------------------------------------------------
const BILL_TRANSITIONS: Record<BlStatus, BlStatus[]> = {
  DRAFT: ['ISSUED', 'CANCELLED'],
  ISSUED: ['CANCELLED'],
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
  manifestId: true,
  voyageId: true,
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
  shipper: { select: { id: true, code: true, name: true, shortName: true } },
  consignee: { select: { id: true, code: true, name: true, shortName: true } },
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

@Injectable()
export class BillService {
  constructor(private readonly prisma: PrismaService) {}

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
   * Create a B/L against an APPROVED Manifest.
   * Snapshots vessel + voyageId + parties (defaults from the manifest) so the
   * document stays stable even if the manifest is later edited. Creates in
   * DRAFT state. Generates billNumber: BOL-YYMM-#####.
   */
  async create(dto: CreateBillDto, actor?: AuthenticatedUser) {
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

    const billNumber = await this.generateReference();

    try {
      return await this.prisma.billOfLading.create({
        data: {
          billNumber,
          manifestId: dto.manifestId,
          voyageId: manifest.voyageId,
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
        (e.code === 'P2002' || e.code === 'P2018')
      ) {
        throw new ConflictException('Could not create B/L: duplicate reference');
      }
      throw e;
    }
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

    return this.prisma.billOfLading.update({
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
      select: { id: true, status: true, manifestId: true, deletedAt: true },
    });
    await this.assertEditable(bill, 'modified');

    const manifestItem = await this.prisma.manifestItem.findUnique({
      where: { id: dto.manifestItemId },
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
        manifestItemId: dto.manifestItemId,
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
          manifestItemId: dto.manifestItemId,
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
   * Manifest lines eligible for a B/L: items of the given manifest not claimed
   * by any live (non-cancelled, non-deleted) B/L — including the given bill's
   * own lines (a line already on a bill, even this one, is not eligible).
   */
  async eligibleItems(manifestId: string) {
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
   * DRAFT -> ISSUED. Requires at least one line. Stamps
   * ManifestItem.blNumber with the B/L number (the link shown in the
   * manifest UI) and freezes the document.
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
    this.assertTransition(existing.status, 'ISSUED');
    if (existing._count.items === 0) {
      throw new BadRequestException('Cannot issue a B/L with no cargo lines');
    }

    return this.prisma.$transaction(async (tx) => {
      // Re-check nothing claimed our lines meanwhile (paranoia under tx).
      const items = await tx.billOfLadingItem.findMany({
        where: { billOfLadingId: id },
        select: { manifestItemId: true },
      });
      const itemIds = items.map((i) => i.manifestItemId);
      await tx.manifestItem.updateMany({
        where: { id: { in: itemIds } },
        data: { blNumber: existing.billNumber },
      });

      return tx.billOfLading.update({
        where: { id },
        data: {
          status: 'ISSUED',
          issuedAt: new Date(),
          issuedById: actor?.id,
          dateOfIssue: existing.dateOfIssue ?? new Date(),
        },
        select: detailSelect,
      });
    });
  }

  /** DRAFT|ISSUED -> CANCELLED. Reason required. Releases the manifest lines. */
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
      const itemIds = items.map((i) => i.manifestItemId);
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

  /** Stable, ordered B/L number: BOL-YYMM-##### (mirrors MAN/AL/LL/VOY). */
  private async generateReference(): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(
      now.getUTCMonth() + 1
    ).padStart(2, '0')}`;
    const prefix = `BOL-${yymm}-`;

    const latest = await this.prisma.billOfLading.findFirst({
      where: { billNumber: { startsWith: prefix } },
      orderBy: { billNumber: 'desc' },
      select: { billNumber: true },
    });

    const lastSeq = latest ? Number(latest.billNumber.slice(prefix.length)) : 0;
    const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }
}
