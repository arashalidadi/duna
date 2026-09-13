import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuotationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  AddQuotationItemDto,
  CancelQuotationDto,
  CreateQuotationDto,
  ListQuotationQueryDto,
  RejectQuotationDto,
  UpdateQuotationDto,
  UpdateQuotationItemDto,
} from './dto/quotation.dto';

// ---------------------------------------------------------------------------
// Quotation lifecycle (server-side, ADR-035).
//   DRAFT -> SENT | CANCELLED
//   SENT  -> ACCEPTED | REJECTED | CANCELLED
//   ACCEPTED -> (convert) -> Proforma   [one-time; stays ACCEPTED]
//   REJECTED / CANCELLED are terminal.
// Only DRAFT accepts structural edits; SENT freezes the commercial offer.
// ---------------------------------------------------------------------------
const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: [],
  REJECTED: [],
  CANCELLED: [],
};

const listSelect = {
  id: true,
  quotationNumber: true,
  customerId: true,
  status: true,
  title: true,
  description: true,
  currencyCode: true,
  issueDate: true,
  validUntil: true,
  subtotal: true,
  taxRate: true,
  taxAmount: true,
  discountAmount: true,
  totalAmount: true,
  linkedProformaId: true,
  rejectReason: true,
  cancelReason: true,
  notes: true,
  createdById: true,
  sentById: true,
  acceptedById: true,
  rejectedById: true,
  cancelledById: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  acceptedAt: true,
  rejectedAt: true,
  cancelledAt: true,
  deletedAt: true,
  customer: { select: { id: true, code: true, name: true, shortName: true } },
  proforma: { select: { id: true, proformaNumber: true, status: true } },
  createdBy: { select: { id: true, email: true, fullName: true } },
  sentBy: { select: { id: true, email: true, fullName: true } },
  acceptedBy: { select: { id: true, email: true, fullName: true } },
  rejectedBy: { select: { id: true, email: true, fullName: true } },
  cancelledBy: { select: { id: true, email: true, fullName: true } },
  _count: { select: { items: true } },
} satisfies Prisma.QuotationSelect;

const detailSelect = {
  ...listSelect,
  items: {
    select: {
      id: true,
      quotationId: true,
      sequence: true,
      description: true,
      quantity: true,
      unitPrice: true,
      amount: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { sequence: 'asc' as const },
  },
} satisfies Prisma.QuotationSelect;

function parseBool(v: string | undefined): boolean | undefined {
  if (v === undefined || v === '') return undefined;
  return v === 'true';
}

@Injectable()
export class QuotationService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async list(query: ListQuotationQueryDto) {
    const pagination = parsePagination(query);
    const sortField = (query.sort ?? 'createdAt') as
      | 'quotationNumber'
      | 'status'
      | 'totalAmount'
      | 'issueDate'
      | 'validUntil'
      | 'createdAt';
    const sortOrder = (query.order ?? 'desc') as Prisma.SortOrder;
    const convertible = parseBool(query.convertible);

    const where: Prisma.QuotationWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status as QuotationStatus;
    if (query.customerId) where.customerId = query.customerId;
    if (convertible === true) {
      where.status = 'ACCEPTED';
      where.linkedProformaId = null;
    } else if (convertible === false) {
      where.OR = [{ linkedProformaId: { not: null } }];
    }
    if (query.search) {
      const s = query.search.trim();
      where.AND = {
        OR: [
          { quotationNumber: { contains: s, mode: 'insensitive' } },
          { title: { contains: s, mode: 'insensitive' } },
          { description: { contains: s, mode: 'insensitive' } },
          { notes: { contains: s, mode: 'insensitive' } },
          { customer: { name: { contains: s, mode: 'insensitive' } } },
          { customer: { code: { contains: s, mode: 'insensitive' } } },
        ],
      };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.quotation.count({ where }),
      this.prisma.quotation.findMany({
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
    const row = await this.prisma.quotation.findUnique({ where: { id }, select: detailSelect });
    if (!row || row.deletedAt) throw new NotFoundException('Quotation not found');
    return row;
  }

  // -------------------------------------------------------------------------
  // CRUD (DRAFT-only edits)
  // -------------------------------------------------------------------------

  async create(dto: CreateQuotationDto, actor?: AuthenticatedUser) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const quotationNumber = await this.generateReference();

    // Pre-compute line amounts + header totals in memory (same math as invoice).
    const items = (dto.items ?? []).map((it, idx) => {
      const quantity = it.quantity ?? 1;
      const unitPrice = Number(it.unitPrice);
      return {
        sequence: idx + 1,
        description: it.description,
        quantity,
        unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
        amount: new Prisma.Decimal((quantity * unitPrice).toFixed(2)),
        notes: it.notes,
      };
    });

    const totals = this.computeTotals(
      items.reduce((sum, it) => sum + Number(it.amount), 0),
      dto.taxRate ? Number(dto.taxRate) : 0,
      dto.discountAmount ? Number(dto.discountAmount) : 0,
    );

    try {
      return await this.prisma.quotation.create({
        data: {
          quotationNumber,
          customerId: dto.customerId,
          title: dto.title,
          description: dto.description,
          currencyCode: dto.currencyCode ?? 'USD',
          issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          taxRate: dto.taxRate ?? 0,
          discountAmount: dto.discountAmount ?? 0,
          subtotal: totals.subtotal,
          taxAmount: totals.tax,
          totalAmount: totals.total,
          notes: dto.notes,
          createdById: actor?.id,
          items: { create: items },
        },
        select: detailSelect,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === 'P2002' || e.code === 'P2018')
      ) {
        throw new ConflictException('Could not create quotation: duplicate reference');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateQuotationDto) {
    const existing = await this.assertEditable(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.quotation.update({
        where: { id: existing.id },
        data: {
          title: dto.title,
          description: dto.description,
          currencyCode: dto.currencyCode,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          taxRate: dto.taxRate,
          discountAmount: dto.discountAmount,
          notes: dto.notes,
        },
      });
      await this.recomputeTotals(tx, id);
      return tx.quotation.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  /** Hard delete — DRAFT only (SENT+ rows keep their audit trail; cancel instead). */
  async remove(id: string) {
    const existing = await this.assertExists(id);
    if (existing.status !== 'DRAFT') {
      throw new ConflictException(
        'Only DRAFT quotations can be deleted — cancel SENT ones instead to keep the audit trail',
      );
    }
    await this.prisma.quotation.delete({ where: { id } });
    return { deleted: true, id };
  }

  // -------------------------------------------------------------------------
  // Line items (DRAFT only)
  // -------------------------------------------------------------------------

  async addItem(id: string, dto: AddQuotationItemDto) {
    await this.assertEditable(id);
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.quotationItem.aggregate({
        where: { quotationId: id },
        _max: { sequence: true },
      });
      const quantity = dto.quantity ?? 1;
      const unitPrice = Number(dto.unitPrice);
      const created = await tx.quotationItem.create({
        data: {
          quotationId: id,
          sequence: (last._max.sequence ?? 0) + 1,
          description: dto.description,
          quantity,
          unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
          amount: new Prisma.Decimal((quantity * unitPrice).toFixed(2)),
          notes: dto.notes,
        },
        select: { id: true },
      });
      await this.recomputeTotals(tx, id);
      return tx.quotation.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  async updateItem(id: string, itemId: string, dto: UpdateQuotationItemDto) {
    await this.assertEditable(id);
    await this.findItemOrThrow(id, itemId);
    return this.prisma.$transaction(async (tx) => {
      // Merge partial fields over current values, then write amount atomically.
      const current = await tx.quotationItem.findUniqueOrThrow({
        where: { id: itemId },
        select: { quantity: true, unitPrice: true },
      });
      const quantity = dto.quantity ?? current.quantity;
      const unitPrice = dto.unitPrice !== undefined ? Number(dto.unitPrice) : Number(current.unitPrice);
      await tx.quotationItem.update({
        where: { id: itemId },
        data: {
          description: dto.description,
          quantity,
          unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
          amount: new Prisma.Decimal((quantity * unitPrice).toFixed(2)),
          notes: dto.notes,
        },
      });
      await this.recomputeTotals(tx, id);
      return tx.quotation.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  async removeItem(id: string, itemId: string) {
    await this.assertEditable(id);
    await this.findItemOrThrow(id, itemId);
    return this.prisma.$transaction(async (tx) => {
      await tx.quotationItem.delete({ where: { id: itemId } });
      await this.recomputeTotals(tx, id);
      return tx.quotation.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** DRAFT -> SENT. At least one line required; stamps sentAt/sentBy. */
  async send(id: string, actor?: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    this.assertTransition(existing.status, 'SENT');
    if (existing._count.items === 0) {
      throw new BadRequestException('Cannot send a quotation with no lines');
    }
    return this.prisma.quotation.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        sentById: actor?.id,
        issueDate: existing.issueDate ?? new Date(),
      },
      select: detailSelect,
    });
  }

  /** SENT -> ACCEPTED (customer said yes; conversion unlocks). */
  async accept(id: string, actor?: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    this.assertTransition(existing.status, 'ACCEPTED');
    return this.prisma.quotation.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedById: actor?.id },
      select: detailSelect,
    });
  }

  /** SENT -> REJECTED with a reason. Terminal. */
  async reject(id: string, dto: RejectQuotationDto, actor?: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    this.assertTransition(existing.status, 'REJECTED');
    if (!dto.rejectReason?.trim()) {
      throw new BadRequestException('A rejection reason is required');
    }
    return this.prisma.quotation.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectReason: dto.rejectReason.trim(),
        rejectedAt: new Date(),
        rejectedById: actor?.id,
      },
      select: detailSelect,
    });
  }

  /** DRAFT|SENT -> CANCELLED with a reason. Terminal. */
  async cancel(id: string, dto: CancelQuotationDto, actor?: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    this.assertTransition(existing.status, 'CANCELLED');
    if (!dto.cancelReason?.trim()) {
      throw new BadRequestException('A cancellation reason is required');
    }
    return this.prisma.quotation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelReason: dto.cancelReason.trim(),
        cancelledAt: new Date(),
        cancelledById: actor?.id,
      },
      select: detailSelect,
    });
  }

  /**
   * ACCEPTED -> new DRAFT proforma (one-time, ADR-035). Header + lines copied;
   * totals recomputed server-side from the copied lines; linkedProformaId
   * unique stamp is the double-conversion guard.
   */
  async convert(id: string, actor?: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    if (existing.status !== 'ACCEPTED') {
      throw new ConflictException('Only an ACCEPTED quotation can be converted');
    }
    if (existing.linkedProformaId) {
      throw new ConflictException('This quotation has already been converted to a proforma');
    }

    const src = await this.prisma.quotation.findUniqueOrThrow({
      where: { id },
      select: { items: { select: { sequence: true, description: true, quantity: true, unitPrice: true, notes: true } } },
    });

    return this.prisma.$transaction(async (tx) => {
      const proformaNumber = await this.generateProformaReference(tx);
      const proforma = await tx.proforma.create({
        data: {
          proformaNumber,
          customerId: existing.customerId,
          title: existing.title,
          description: existing.description,
          currencyCode: existing.currencyCode,
          taxRate: existing.taxRate,
          discountAmount: existing.discountAmount,
          validUntil: existing.validUntil,
          notes: existing.notes,
          createdById: actor?.id,
          items: {
            // ProformaItem has no per-line notes column (unlike QuotationItem);
            // line notes are intentionally dropped when copying across.
            create: src.items.map((it) => ({
              sequence: it.sequence,
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              amount: new Prisma.Decimal(it.quantity * Number(it.unitPrice)).toFixed(2),
            })),
          },
        },
      });
      await this.recomputeProformaTotals(tx, proforma.id);
      const refreshed = await tx.proforma.findUniqueOrThrow({
        where: { id: proforma.id },
        select: { id: true, proformaNumber: true, status: true, totalAmount: true },
      });

      const quotation = await tx.quotation.update({
        where: { id },
        data: { linkedProformaId: proforma.id },
        select: detailSelect,
      });

      return { quotation, proforma: refreshed };
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private computeTotals(subtotal: number, taxRate: number, discount: number) {
    const taxable = Math.max(subtotal - discount, 0);
    const tax = Number(((taxable * taxRate) / 100).toFixed(2));
    const total = Number((taxable + tax).toFixed(2));
    return {
      subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
      tax: new Prisma.Decimal(tax.toFixed(2)),
      total: new Prisma.Decimal(total.toFixed(2)),
    };
  }

  private assertTransition(from: QuotationStatus, to: QuotationStatus) {
    if (!QUOTATION_TRANSITIONS[from].includes(to)) {
      throw new ConflictException(`Cannot move quotation from ${from} to ${to}`);
    }
  }

  private async assertExists(id: string) {
    const row = await this.prisma.quotation.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        customerId: true,
        currencyCode: true,
        title: true,
        description: true,
        taxRate: true,
        discountAmount: true,
        validUntil: true,
        notes: true,
        issueDate: true,
        linkedProformaId: true,
        _count: { select: { items: true } },
      },
    });
    if (!row || row.deletedAt) throw new NotFoundException('Quotation not found');
    return row;
  }

  /** Editable = DRAFT only; anything else 409s. */
  private async assertEditable(id: string) {
    const row = await this.assertExists(id);
    if (row.status !== 'DRAFT') {
      throw new ConflictException('Only DRAFT quotations are editable');
    }
    return row;
  }

  private async findItemOrThrow(quotationId: string, itemId: string) {
    const item = await this.prisma.quotationItem.findFirst({
      where: { id: itemId, quotationId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Quotation line not found');
    return item;
  }

  /** subtotal = SUM(amount); tax = (subtotal - discount) * rate / 100. */
  private async recomputeTotals(tx: Prisma.TransactionClient, quotationId: string) {
    const quotation = await tx.quotation.findUniqueOrThrow({
      where: { id: quotationId },
      select: { taxRate: true, discountAmount: true },
    });
    const agg = await tx.quotationItem.aggregate({
      where: { quotationId },
      _sum: { amount: true },
    });
    const totals = this.computeTotals(
      Number(agg._sum.amount ?? 0),
      Number(quotation.taxRate ?? 0),
      Number(quotation.discountAmount ?? 0),
    );
    await tx.quotation.update({
      where: { id: quotationId },
      data: {
        subtotal: totals.subtotal,
        taxAmount: totals.tax,
        totalAmount: totals.total,
      },
    });
  }

  private async recomputeProformaTotals(tx: Prisma.TransactionClient, proformaId: string) {
    const proforma = await tx.proforma.findUniqueOrThrow({
      where: { id: proformaId },
      select: { taxRate: true, discountAmount: true },
    });
    const agg = await tx.proformaItem.aggregate({
      where: { proformaId },
      _sum: { amount: true },
    });
    const totals = this.computeTotals(
      Number(agg._sum.amount ?? 0),
      Number(proforma.taxRate ?? 0),
      Number(proforma.discountAmount ?? 0),
    );
    await tx.proforma.update({
      where: { id: proformaId },
      data: {
        subtotal: totals.subtotal,
        taxAmount: totals.tax,
        totalAmount: totals.total,
      },
    });
  }

  private async generateReference(): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0')}`;
    const prefix = `QT-${yymm}-`;
    const latest = await this.prisma.quotation.findFirst({
      where: { quotationNumber: { startsWith: prefix } },
      orderBy: { quotationNumber: 'desc' },
      select: { quotationNumber: true },
    });
    const lastSeq = latest ? Number(latest.quotationNumber.slice(prefix.length)) : 0;
    const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }

  private async generateProformaReference(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0')}`;
    const prefix = `PRF-${yymm}-`;
    const latest = await tx.proforma.findFirst({
      where: { proformaNumber: { startsWith: prefix } },
      orderBy: { proformaNumber: 'desc' },
      select: { proformaNumber: true },
    });
    const lastSeq = latest ? Number(latest.proformaNumber.slice(prefix.length)) : 0;
    const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }
}
