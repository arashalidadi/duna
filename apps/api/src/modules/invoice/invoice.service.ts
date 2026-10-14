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
import { NumberingService } from '../../common/infrastructure/numbering';
import { allocateInvoiceNumber } from './invoice-number';
import { ExchangeRateService } from '../finance/exchange-rate.service';
import { CustomerPostingService } from '../finance/customer-posting.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { recomputeInvoiceTax } from './invoice-tax';
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
// Phase 3: an ISSUED invoice is corrected through InvoiceCorrectionService (DEC-020); its
// money fields are never recomputed (DEC-023).
// ---------------------------------------------------------------------------
const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['ISSUED', 'CANCELLED'],
  ISSUED: ['CANCELLED'],
  CANCELLED: [],
};

// Only DRAFT invoices accept structural edits (header + items + links).
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
  baseCurrencyCode: true,
  baseAmount: true,
  exchangeRate: true,
  rateEffectiveAt: true,
  rateSource: true,
  currencyRateId: true,
  rateOverrideReason: true,
  billOfLadingId: true,
  manifestId: true,
  voyageId: true,
  trn: true,
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
      taxRate: true,
      taxAmount: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { sequence: 'asc' as const },
  },
  // DEC-071 / DEC-105 — every Job and B/L this invoice covers.
  jobLinks: {
    select: {
      jobId: true,
      job: { select: { id: true, jobNumber: true, title: true, status: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  billLinks: {
    select: {
      billOfLadingId: true,
      billOfLading: { select: { id: true, billNumber: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  // DEC-020/021 — correction history on both sides of the link.
  correctionAsReplacement: {
    select: { id: true, originalInvoiceId: true, status: true, reason: true, appliedAt: true },
  },
  correctionsAsOriginal: {
    select: {
      id: true,
      replacementInvoiceId: true,
      status: true,
      reason: true,
      requestedAt: true,
      decidedAt: true,
      decisionNote: true,
      appliedAt: true,
    },
    orderBy: { requestedAt: 'desc' as const },
  },
} satisfies Prisma.InvoiceSelect;

/** Boolean query-string filter (ADR-017: typed as string). */
function parseBool(v: string | undefined): boolean | undefined {
  if (v === undefined || v === '') return undefined;
  return v === 'true';
}

/** De-duplicate and drop empty ids. A null/undefined list means "none". */
function normalizeIds(list?: string[] | null, single?: string | null): string[] {
  const source = list ?? (single ? [single] : []);
  return [...new Set(source.filter((id) => typeof id === 'string' && id.trim() !== ''))];
}

interface AnchorResult {
  billOfLadingId: string | null;
  billOfLadingIds: string[];
  manifestId: string | null;
  voyageId: string | null;
}

/** Client shape shared by PrismaService and transaction clients. */
type Db = Pick<Prisma.TransactionClient, 'companySettings'>;

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
    private readonly fx: ExchangeRateService,
    private readonly postings: CustomerPostingService,
  ) {}

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
   * preferred — it carries the manifest's voyage). Phase 3: B/Ls and Jobs may be
   * given as lists (DEC-105, DEC-071); the single billOfLadingId still works.
   */
  async create(dto: CreateInvoiceDto, actor?: AuthenticatedUser) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const billIds = normalizeIds(dto.billOfLadingIds, dto.billOfLadingId);
    const anchors = await this.resolveAnchors(billIds, dto.manifestId ?? null);
    const jobIds = normalizeIds(dto.jobIds);
    await this.assertJobsExist(jobIds);

    // The number and the invoice are created in ONE transaction (DEC-027): concurrent creates
    // receive distinct INV numbers from the row-locked sequence, and a failed insert rolls the
    // counter back, so no number is consumed without a document.
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoiceNumber = await allocateInvoiceNumber(this.numbering, tx, new Date());
        const trn = dto.trn?.trim() || (await this.companyTrn(tx));
        const invoice = await tx.invoice.create({
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
            trn,
            notes: dto.notes,
            createdById: actor?.id,
          },
          select: { id: true },
        });
        await this.replaceBillLinks(tx, invoice.id, anchors.billOfLadingIds);
        await this.replaceJobLinks(tx, invoice.id, jobIds);
        return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, select: detailSelect });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === 'P2002' || e.code === 'P2018')
      ) {
        throw new ConflictException('Could not create invoice: duplicate reference');
      }
      throw e;
    }
  }

  /**
   * Update invoice header fields. DRAFT only. Money fields (taxRate,
   * discountAmount) recompute the derived totals. A header taxRate is applied to every
   * line (bulk default, kept for compatibility); per-line rates are set with updateItem.
   */
  async update(id: string, dto: UpdateInvoiceDto) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    this.assertEditable(existing, 'edited');

    const touchesAnchors =
      dto.billOfLadingIds !== undefined ||
      dto.billOfLadingId !== undefined ||
      dto.manifestId !== undefined;

    let anchors: AnchorResult | null = null;
    let billIds: string[] | undefined;
    if (touchesAnchors) {
      const current = await this.prisma.invoice.findUniqueOrThrow({
        where: { id },
        select: { manifestId: true, billLinks: { select: { billOfLadingId: true } } },
      });
      billIds =
        dto.billOfLadingIds !== undefined
          ? normalizeIds(dto.billOfLadingIds)
          : dto.billOfLadingId !== undefined
            ? normalizeIds(undefined, dto.billOfLadingId)
            : current.billLinks.map((l) => l.billOfLadingId);
      const manifestId = dto.manifestId !== undefined ? dto.manifestId || null : current.manifestId;
      anchors = await this.resolveAnchors(billIds, manifestId);
    }

    let jobIds: string[] | undefined;
    if (dto.jobIds !== undefined) {
      jobIds = normalizeIds(dto.jobIds);
      await this.assertJobsExist(jobIds);
    }

    const trnValue = dto.trn !== undefined ? dto.trn?.trim() || null : undefined;

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
          ...(trnValue !== undefined ? { trn: trnValue } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });
      if (billIds !== undefined) {
        await this.replaceBillLinks(tx, id, billIds);
      }
      if (jobIds !== undefined) {
        await this.replaceJobLinks(tx, id, jobIds);
      }
      if (dto.taxRate !== undefined) {
        await tx.invoiceItem.updateMany({
          where: { invoiceId: id },
          data: { taxRate: dto.taxRate ?? 0 },
        });
      }
      await recomputeInvoiceTax(tx, id);
      return tx.invoice.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  /** Soft delete. DRAFT only — issued invoices are audit records. */
  async remove(id: string) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    this.assertEditable(existing, 'deleted');

    await this.prisma.invoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return this.prisma.invoice.findUniqueOrThrow({ where: { id }, select: detailSelect });
  }

  // -------------------------------------------------------------------------
  // Invoice Items
  // -------------------------------------------------------------------------

  /**
   * Add a line (DRAFT only). amount = quantity x unitPrice, server-side. The line VAT rate
   * defaults to the header rate when omitted (existing single-rate clients are unchanged).
   */
  async addItem(id: string, dto: AddInvoiceItemDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true, taxRate: true },
    });
    this.assertEditable(invoice, 'modified');

    const maxSeq = await this.prisma.invoiceItem.aggregate({
      where: { invoiceId: id },
      _max: { sequence: true },
    });
    const sequence = (maxSeq._max.sequence ?? 0) + 1;
    const quantity = dto.quantity ?? 1;
    const taxRate = dto.taxRate ?? Number(invoice.taxRate);

    return this.prisma.$transaction(async (tx) => {
      await tx.invoiceItem.create({
        data: {
          invoiceId: id,
          sequence,
          description: dto.description,
          quantity,
          unitPrice: dto.unitPrice,
          amount: new Prisma.Decimal(dto.unitPrice * quantity),
          taxRate,
          notes: dto.notes,
        },
      });
      await recomputeInvoiceTax(tx, id);
      return tx.invoice.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  /** Update a line (DRAFT only). amount maintained server-side; taxRate only when given. */
  async updateItem(id: string, itemId: string, dto: UpdateInvoiceItemDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    this.assertEditable(invoice, 'modified');

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
          ...(dto.taxRate !== undefined ? { taxRate: dto.taxRate ?? 0 } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });
      await recomputeInvoiceTax(tx, id);
      return tx.invoice.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  /** Remove a line (DRAFT only) and recompute totals. */
  async removeItem(id: string, itemId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    this.assertEditable(invoice, 'modified');

    const item = await this.prisma.invoiceItem.findFirst({
      where: { id: itemId, invoiceId: id },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('Invoice item not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.invoiceItem.delete({ where: { id: itemId } });
      await recomputeInvoiceTax(tx, id);
      return tx.invoice.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * DRAFT -> ISSUED. Requires >= 1 line. Freezes the document (edits become
   * 409); sets issueDate default now. Snapshots the TRN from company settings if the
   * draft has none. New issued invoices snapshot an approved dated rate (or
   * a permitted, reasoned override); historical invoices remain untouched.
   */
  async issue(id: string, actor: AuthenticatedUser, rateOverride?: { rate: string; reason: string }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.invoice.findUnique({
        where: { id },
        select: { id: true, status: true, deletedAt: true, issueDate: true, trn: true,
          currencyCode: true, totalAmount: true, _count: { select: { items: true } } },
      });
      if (!existing || existing.deletedAt) throw new NotFoundException('Invoice not found');
      this.assertTransition(existing.status, 'ISSUED');
      if (existing._count.items === 0) throw new BadRequestException('Cannot issue an invoice with no lines');
      const now = new Date();
      const issueDate = existing.issueDate ?? now;
      // Do not invent a conversion for a new invoice: all new transactions
      // require an approved effective-dated rate or a permitted override.
      const rate = await this.fx.resolve(tx, existing.currencyCode, issueDate, actor, rateOverride);
      const changed = await tx.invoice.updateMany({ where: { id, status: 'DRAFT', deletedAt: null }, data: {
        status: 'ISSUED', issuedAt: now, issuedById: actor.id, issueDate,
        trn: existing.trn ?? (await this.companyTrn(tx)),
        baseCurrencyCode: rate.baseCurrencyCode, baseAmount: rate.baseAmount(existing.totalAmount),
        exchangeRate: rate.exchangeRate, rateEffectiveAt: rate.rateEffectiveAt,
        rateSource: rate.rateSource, currencyRateId: rate.currencyRateId,
        rateOverrideReason: rate.rateOverrideReason,
      } });
      if (changed.count !== 1) throw new ConflictException('Invoice changed while being issued');
      const issued = await tx.invoice.findUniqueOrThrow({ where: { id }, select: detailSelect });
      await this.postings.append(tx, this.postings.invoiceSource(issued), issued.totalAmount, 'ISSUE');
      await this.audit.recordIn(tx, {
        action: 'invoice.issue', entityType: 'Invoice', entityId: id, actorId: actor.id, actorEmail: actor.email,
        afterData: { status: 'ISSUED', invoiceNumber: issued.invoiceNumber,
          currencyCode: issued.currencyCode, totalAmount: issued.totalAmount.toFixed(2),
          baseCurrencyCode: rate.baseCurrencyCode,
          baseAmount: rate.baseAmount(existing.totalAmount).toFixed(2),
          exchangeRate: rate.exchangeRate.toString(),
          rateEffectiveAt: rate.rateEffectiveAt, rateSource: rate.rateSource,
          rateOverrideReason: rate.rateOverrideReason },
      });
      return issued;
    });
  }

  /** DRAFT|ISSUED -> CANCELLED. The shadow posting reverses the issued amount. */
  async cancel(id: string, dto: CancelInvoiceDto, actor: AuthenticatedUser) {
    if (!dto.cancelReason?.trim()) throw new BadRequestException('A cancellation reason is required');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.invoice.findUnique({ where: { id } });
      if (!existing || existing.deletedAt) throw new NotFoundException('Invoice not found');
      this.assertTransition(existing.status, 'CANCELLED');
      const now = new Date();
      const changed = await tx.invoice.updateMany({ where: { id, status: existing.status, deletedAt: null }, data: {
        status: 'CANCELLED', cancelReason: dto.cancelReason.trim(), cancelledAt: now, cancelledById: actor.id,
      } });
      if (changed.count !== 1) throw new ConflictException('Invoice changed while being cancelled');
      if (existing.status === 'ISSUED') {
        await this.postings.append(tx, this.postings.invoiceSource(existing), existing.totalAmount.negated(), 'CANCEL');
      }
      const cancelled = await tx.invoice.findUniqueOrThrow({ where: { id }, select: detailSelect });
      await this.audit.recordIn(tx, {
        action: 'invoice.cancel', entityType: 'Invoice', entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { status: existing.status, totalAmount: existing.totalAmount.toFixed(2) },
        afterData: { status: 'CANCELLED', reason: dto.cancelReason.trim(), cancelledAt: now },
      });
      return cancelled;
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Validate the B/L list and optional Manifest anchor, and derive voyageId.
   * Every B/L and the manifest must belong to the same voyage: an invoice can only bill one
   * shipment. The first B/L is the legacy primary anchor (billOfLadingId).
   */
  private async resolveAnchors(billIds: string[], manifestId?: string | null): Promise<AnchorResult> {
    let voyageId: string | null = null;
    const voyages = new Set<string>();

    if (billIds.length > 0) {
      const bills = await this.prisma.billOfLading.findMany({
        where: { id: { in: billIds } },
        select: { id: true, voyageId: true, deletedAt: true },
      });
      if (bills.length !== billIds.length || bills.some((b) => b.deletedAt)) {
        throw new NotFoundException('Bill of Lading not found');
      }
      for (const b of bills) {
        voyages.add(b.voyageId);
      }
      voyageId = bills[0]?.voyageId ?? null;
    }

    if (manifestId) {
      const manifest = await this.prisma.manifest.findUnique({
        where: { id: manifestId },
        select: { id: true, voyageId: true, deletedAt: true },
      });
      if (!manifest || manifest.deletedAt) {
        throw new NotFoundException('Manifest not found');
      }
      voyages.add(manifest.voyageId);
      voyageId = voyageId ?? manifest.voyageId;
    }

    // Consistency guard: all anchors must belong to the same voyage.
    if (voyages.size > 1) {
      throw new ConflictException(
        'The selected B/L and Manifest belong to different voyages; an invoice can only bill one shipment',
      );
    }

    return {
      billOfLadingId: billIds[0] ?? null,
      billOfLadingIds: billIds,
      manifestId: manifestId ?? null,
      voyageId,
    };
  }

  /** Every Job id must exist and not be soft-deleted (DEC-071). */
  private async assertJobsExist(jobIds: string[]): Promise<void> {
    if (jobIds.length === 0) return;
    const found = await this.prisma.job.findMany({
      where: { id: { in: jobIds }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== jobIds.length) {
      throw new NotFoundException('Job not found');
    }
  }

  /** Replace the B/L join rows (DEC-105). Caller validated the ids. */
  private async replaceBillLinks(tx: Prisma.TransactionClient, invoiceId: string, billIds: string[]) {
    await tx.invoiceBill.deleteMany({ where: { invoiceId } });
    if (billIds.length > 0) {
      await tx.invoiceBill.createMany({
        data: billIds.map((billOfLadingId) => ({ invoiceId, billOfLadingId })),
        skipDuplicates: true,
      });
    }
  }

  /** Replace the Job join rows (DEC-071). Caller validated the ids. */
  private async replaceJobLinks(tx: Prisma.TransactionClient, invoiceId: string, jobIds: string[]) {
    await tx.invoiceJob.deleteMany({ where: { invoiceId } });
    if (jobIds.length > 0) {
      await tx.invoiceJob.createMany({
        data: jobIds.map((jobId) => ({ invoiceId, jobId })),
        skipDuplicates: true,
      });
    }
  }

  /**
   * Tax Registration Number from company settings (REQ-147). Null when settings have no TRN;
   * the TRN is never invented.
   */
  async companyTrn(db: Db): Promise<string | null> {
    const settings = await db.companySettings.findFirst({
      select: { taxNumber: true },
    });
    const trn = settings?.taxNumber?.trim();
    return trn ? trn : null;
  }

  /** Narrowing check: throws unless the invoice exists, is live, and is DRAFT. */
  private assertEditable(
    row: { status: InvoiceStatus; deletedAt: Date | null } | null,
    verb: string,
  ): asserts row is { status: InvoiceStatus; deletedAt: Date | null } {
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
}
