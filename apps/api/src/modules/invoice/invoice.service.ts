import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  AddInvoiceItemDto,
  CancelInvoiceDto,
  CreateInvoiceDto,
  ListInvoiceQueryDto,
  UpdateInvoiceDto,
  UpdateInvoiceItemDto,
} from './dto/invoice.dto';

// ---------------------------------------------------------------------------
// Invoice lifecycle (server-side).
//   DRAFT -> ISSUED | CANCELLED
//   ISSUED -> CANCELLED (with reason; frees nothing — payments belong to Fin)
//   CANCELLED is terminal.
// PAID is NOT a stored status: Phase 12 (Fin vouchers) maintains paidAmount,
// and "paid" is derived (paidAmount >= totalAmount) at read time — the legacy
// system mutated PAID/UNPAID through Fin records anyway.
// ---------------------------------------------------------------------------
const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['ISSUED', 'CANCELLED'],
  ISSUED: ['CANCELLED'],
  CANCELLED: [],
};

// Only DRAFT invoices accept structural edits (header + items).
const EDITABLE_STATUSES: InvoiceStatus[] = ['DRAFT'];

const listSelect = {
  id: true,
  invoiceNumber: true,
  customerId: true,
  status: true,
  title: true,
  description: true,
  currencyCode: true,
  issueDate: true,
  dueDate: true,
  subtotal: true,
  taxRate: true,
  taxAmount: true,
  discountAmount: true,
  totalAmount: true,
  paidAmount: true,
  billOfLadingId: true,
  manifestId: true,
  voyageId: true,
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
  customer: { select: { id: true, code: true, name: true, shortName: true } },
  billOfLading: { select: { id: true, billNumber: true } },
  manifest: { select: { id: true, manifestNumber: true } },
  createdBy: { select: { id: true, email: true, fullName: true } },
  issuedBy: { select: { id: true, email: true, fullName: true } },
  cancelledBy: { select: { id: true, email: true, fullName: true } },
  _count: { select: { items: true } },
} satisfies Prisma.InvoiceSelect;

const detailSelect = {
  ...listSelect,
  items: {
    select: {
      id: true,
      invoiceId: true,
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
} satisfies Prisma.InvoiceSelect;

/** Boolean query-string filter (ADR-017: typed as string). */
function parseBool(v: string | undefined): boolean | undefined {
  if (v === undefined || v === '') return undefined;
  return v === 'true';
}

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Invoice CRUD
  // -------------------------------------------------------------------------

  async list(query: ListInvoiceQueryDto) {
    const pagination = parsePagination(query);
    const sortField = (query.sort ?? 'createdAt') as
      | 'invoiceNumber'
      | 'status'
      | 'totalAmount'
      | 'issueDate'
      | 'dueDate'
      | 'createdAt';
    const sortOrder = (query.order ?? 'desc') as Prisma.SortOrder;

    const unpaid = parseBool(query.unpaid);
    const overdue = parseBool(query.overdue);
    const now = new Date();

    const where: Prisma.InvoiceWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status as InvoiceStatus } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.voyageId ? { voyageId: query.voyageId } : {}),
      ...(unpaid !== undefined || overdue !== undefined
        ? {
            status: 'ISSUED' as InvoiceStatus,
            paidAmount: { lt: this.prisma.invoice.fields.totalAmount },
            ...(overdue ? { dueDate: { lt: now } } : {}),
          }
        : {}),
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
              { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
              { customer: { name: { contains: query.search, mode: 'insensitive' } } },
              { customer: { code: { contains: query.search, mode: 'insensitive' } } },
              { billOfLading: { billNumber: { contains: query.search, mode: 'insensitive' } } },
              { manifest: { manifestNumber: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
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
    const row = await this.prisma.invoice.findUnique({ where: { id }, select: detailSelect });
    if (!row || row.deletedAt) {
      throw new NotFoundException('Invoice not found');
    }
    return row;
  }

  /**
   * Create a DRAFT invoice for a customer. Optional B/L / Manifest anchors are
   * validated; voyageId is denormalized from whichever anchor exists (B/L
   * preferred — it carries the manifest's voyage).
   */
  async create(dto: CreateInvoiceDto, actor?: AuthenticatedUser) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const anchors = await this.resolveAnchors(dto.billOfLadingId, dto.manifestId);

    // Atomic number allocation by BOUNDED RETRY (same pattern as Cargo.reference): invoice,
    // voucher, proforma-convert and delivery-release suites create invoices in parallel and
    // generateReference() is read-then-write, so the loser of an INV-YYMM-##### race hits the
    // unique number index. Re-read the committed max and retry; other P2002/P2018 keep the
    // existing 409 semantics.
    const MAX_INVOICE_ATTEMPTS = 10;
    for (let attempt = 1; ; attempt += 1) {
      const invoiceNumber = await this.generateReference();
      try {
        return await this.prisma.invoice.create({
          data: {
            invoiceNumber,
            customerId: dto.customerId,
            title: dto.title,
            description: dto.description,
            taxRate: dto.taxRate ?? 0,
            discountAmount: dto.discountAmount ?? 0,
            currencyCode: dto.currencyCode ?? 'USD',
            issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
            billOfLadingId: anchors.billOfLadingId,
            manifestId: anchors.manifestId,
            voyageId: anchors.voyageId,
            notes: dto.notes,
            createdById: actor?.id,
          },
          select: detailSelect,
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          attempt < MAX_INVOICE_ATTEMPTS &&
          String((e.meta as { target?: unknown } | undefined)?.target ?? '').includes(
            'invoiceNumber'
          )
        ) {
          continue; // lost the number race: re-read the committed max and retry
        }
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (e.code === 'P2002' || e.code === 'P2018')
        ) {
          throw new ConflictException('Could not create invoice: duplicate reference');
        }
        throw e;
      }
    }
  }

  /**
   * Update invoice header fields. DRAFT only. Money fields (taxRate,
   * discountAmount) recompute the derived totals.
   */
  async update(id: string, dto: UpdateInvoiceDto) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    await this.assertEditable(existing, 'edited');

    let anchors: { billOfLadingId: string | null; manifestId: string | null; voyageId: string | null } | null = null;
    if (dto.billOfLadingId !== undefined || dto.manifestId !== undefined) {
      const current = await this.prisma.invoice.findUniqueOrThrow({
        where: { id },
        select: { billOfLadingId: true, manifestId: true },
      });
      anchors = await this.resolveAnchors(
        dto.billOfLadingId !== undefined ? dto.billOfLadingId || null : current.billOfLadingId,
        dto.manifestId !== undefined ? dto.manifestId || null : current.manifestId,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data: {
          ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.taxRate !== undefined ? { taxRate: dto.taxRate ?? 0 } : {}),
          ...(dto.discountAmount !== undefined ? { discountAmount: dto.discountAmount ?? 0 } : {}),
          ...(dto.currencyCode !== undefined ? { currencyCode: dto.currencyCode } : {}),
          ...(dto.issueDate !== undefined
            ? { issueDate: dto.issueDate ? new Date(dto.issueDate) : null }
            : {}),
          ...(dto.dueDate !== undefined
            ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
            : {}),
          ...(anchors
            ? {
                billOfLadingId: anchors.billOfLadingId,
                manifestId: anchors.manifestId,
                voyageId: anchors.voyageId,
              }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });
      await this.recomputeTotals(tx, id);
      return tx.invoice.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  /** Soft delete. DRAFT only — issued invoices are audit records. */
  async remove(id: string) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    await this.assertEditable(existing, 'deleted');

    await this.prisma.invoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return this.prisma.invoice.findUniqueOrThrow({ where: { id }, select: detailSelect });
  }

  // -------------------------------------------------------------------------
  // Invoice Items
  // -------------------------------------------------------------------------

  /** Add a line (DRAFT only). amount = quantity x unitPrice, server-side. */
  async addItem(id: string, dto: AddInvoiceItemDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    await this.assertEditable(invoice, 'modified');

    const maxSeq = await this.prisma.invoiceItem.aggregate({
      where: { invoiceId: id },
      _max: { sequence: true },
    });
    const sequence = (maxSeq._max.sequence ?? 0) + 1;
    const quantity = dto.quantity ?? 1;

    return this.prisma.$transaction(async (tx) => {
      await tx.invoiceItem.create({
        data: {
          invoiceId: id,
          sequence,
          description: dto.description,
          quantity,
          unitPrice: dto.unitPrice,
          amount: new Prisma.Decimal(dto.unitPrice * quantity),
          notes: dto.notes,
        },
      });
      await this.recomputeTotals(tx, id);
      return tx.invoice.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  /** Update a line (DRAFT only). amount maintained server-side. */
  async updateItem(id: string, itemId: string, dto: UpdateInvoiceItemDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    await this.assertEditable(invoice, 'modified');

    const item = await this.prisma.invoiceItem.findFirst({
      where: { id: itemId, invoiceId: id },
      select: { id: true, quantity: true, unitPrice: true },
    });
    if (!item) {
      throw new NotFoundException('Invoice item not found');
    }

    const quantity = dto.quantity !== undefined ? dto.quantity : item.quantity;
    const unitPrice = dto.unitPrice !== undefined ? dto.unitPrice : Number(item.unitPrice);

    return this.prisma.$transaction(async (tx) => {
      await tx.invoiceItem.update({
        where: { id: itemId },
        data: {
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          quantity,
          unitPrice,
          amount: new Prisma.Decimal(unitPrice * quantity),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });
      await this.recomputeTotals(tx, id);
      return tx.invoice.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  /** Remove a line (DRAFT only) and recompute totals. */
  async removeItem(id: string, itemId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    await this.assertEditable(invoice, 'modified');

    const item = await this.prisma.invoiceItem.findFirst({
      where: { id: itemId, invoiceId: id },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('Invoice item not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.invoiceItem.delete({ where: { id: itemId } });
      await this.recomputeTotals(tx, id);
      return tx.invoice.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * DRAFT -> ISSUED. Requires >= 1 line. Freezes the document (edits become
   * 409); sets issueDate default now. Payments (paidAmount) are Phase 12.
   */
  async issue(id: string, actor?: AuthenticatedUser) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        issueDate: true,
        _count: { select: { items: true } },
      },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Invoice not found');
    }
    this.assertTransition(existing.status, 'ISSUED');
    if (existing._count.items === 0) {
      throw new BadRequestException('Cannot issue an invoice with no lines');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'ISSUED',
        issuedAt: new Date(),
        issuedById: actor?.id,
        issueDate: existing.issueDate ?? new Date(),
      },
      select: detailSelect,
    });
  }

  /** DRAFT|ISSUED -> CANCELLED. Reason required. Terminal. */
  async cancel(id: string, dto: CancelInvoiceDto, actor?: AuthenticatedUser) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Invoice not found');
    }
    this.assertTransition(existing.status, 'CANCELLED');
    if (!dto.cancelReason?.trim()) {
      throw new BadRequestException('A cancellation reason is required');
    }

    return this.prisma.invoice.update({
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

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Validate optional B/L / Manifest anchors and derive voyageId.
   * The B/L carries its manifest's voyage; a manifest carries its own voyage.
   */
  private async resolveAnchors(billOfLadingId?: string | null, manifestId?: string | null) {
    let voyageId: string | null = null;

    let billOfLading: { id: string; voyageId: string; deletedAt: Date | null } | null = null;
    if (billOfLadingId) {
      billOfLading = await this.prisma.billOfLading.findUnique({
        where: { id: billOfLadingId },
        select: { id: true, voyageId: true, deletedAt: true },
      });
      if (!billOfLading || billOfLading.deletedAt) {
        throw new NotFoundException('Bill of Lading not found');
      }
      voyageId = billOfLading.voyageId;
    }

    let manifest: { id: string; voyageId: string; deletedAt: Date | null } | null = null;
    if (manifestId) {
      manifest = await this.prisma.manifest.findUnique({
        where: { id: manifestId },
        select: { id: true, voyageId: true, deletedAt: true },
      });
      if (!manifest || manifest.deletedAt) {
        throw new NotFoundException('Manifest not found');
      }
      voyageId = voyageId ?? manifest.voyageId;
    }

    // Consistency guard: if both anchors are given, they must belong to the
    // same voyage — an invoice cannot bill two different shipments.
    if (billOfLading && manifest && billOfLading.voyageId !== manifest.voyageId) {
      throw new ConflictException(
        'The selected B/L and Manifest belong to different voyages; an invoice can only bill one shipment',
      );
    }

    return {
      billOfLadingId: billOfLadingId ?? null,
      manifestId: manifestId ?? null,
      voyageId,
    };
  }

  private async assertEditable(
    row: { status: InvoiceStatus; deletedAt: Date | null } | null,
    verb: string
  ) {
    if (!row || row.deletedAt) {
      throw new NotFoundException('Invoice not found');
    }
    if (!EDITABLE_STATUSES.includes(row.status)) {
      throw new ConflictException(`Invoice is ${row.status}; only DRAFT invoices can be ${verb}`);
    }
  }

  private assertTransition(current: InvoiceStatus, target: InvoiceStatus) {
    if (!INVOICE_TRANSITIONS[current]?.includes(target)) {
      throw new ConflictException(`Invoice transition ${current} -> ${target} is not allowed`);
    }
  }

  /**
   * Recompute money aggregates from the lines:
   *   subtotal       = SUM(item.amount)          (amount = qty x unitPrice)
   *   taxAmount      = (subtotal - discount) x taxRate / 100, floored at 0
   *   totalAmount    = subtotal - discount + tax
   * paidAmount is untouched (owned by Phase 12).
   */
  private async recomputeTotals(tx: Prisma.TransactionClient, invoiceId: string) {
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: { taxRate: true, discountAmount: true },
    });

    const agg = await tx.invoiceItem.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    });
    const subtotal = Number(agg._sum.amount ?? 0);
    const discount = Number(invoice.discountAmount ?? 0);
    const rate = Number(invoice.taxRate ?? 0);
    const taxable = Math.max(subtotal - discount, 0);
    const tax = Number(((taxable * rate) / 100).toFixed(2));
    const total = Number((taxable + tax).toFixed(2));

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
        taxAmount: new Prisma.Decimal(tax.toFixed(2)),
        totalAmount: new Prisma.Decimal(total.toFixed(2)),
      },
    });
  }

  /** Stable, ordered invoice number: INV-YYMM-##### (mirrors MAN/BOL/AL/LL). */
  private async generateReference(): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(
      now.getUTCMonth() + 1
    ).padStart(2, '0')}`;
    const prefix = `INV-${yymm}-`;

    const latest = await this.prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    const lastSeq = latest ? Number(latest.invoiceNumber.slice(prefix.length)) : 0;
    const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }
}
