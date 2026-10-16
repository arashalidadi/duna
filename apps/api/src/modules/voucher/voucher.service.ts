import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VoucherStatus, VoucherType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { NumberingService, nextSequenceAfter, periodicSequenceRequest } from '../../common/infrastructure/numbering';
import { CustomerPostingService } from '../finance/customer-posting.service';
import { ExchangeRateService } from '../finance/exchange-rate.service';
import { exactMoney, toBase, transactionDate } from '../finance/financial-money';
import type { LedgerEntry, LedgerSummary, Voucher } from '@shipping/shared';
import type { AdjustVoucherDto, CreateVoucherDto, ReallocateVoucherDto, UpdateVoucherDto } from './dto/voucher.dto';
import { VoucherAllocationService } from './voucher-allocation.service';
import { captureIssuedDocument } from '../document-output/document-issue-snapshot';

const PAGE_SIZE_MAX = 100;
const ZERO = new Prisma.Decimal(0);
const voucherInclude = {
  customer: true,
  invoice: true,
  allocations: {
    include: {
      invoice: { select: { id: true, invoiceNumber: true } },
      billOfLading: { select: { id: true, billNumber: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  adjustments: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.VoucherInclude;

type FullVoucher = Prisma.VoucherGetPayload<{ include: typeof voucherInclude }>;

@Injectable()
export class VoucherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly allocation: VoucherAllocationService,
    private readonly fx: ExchangeRateService,
    private readonly postings: CustomerPostingService,
    private readonly audit: AuditService,
  ) {}

  private toIso(d: Date | null | undefined): string | null {
    return d ? d.toISOString() : null;
  }

  private serialize(v: FullVoucher): Voucher {
    const active = v.status === 'POSTED' ? v.allocations.filter((a) => !a.reversedAt) : [];
    // Historical vouchers copied before allocation backfill keep their scalar
    // fallback. Once their join rows are present they are not double-counted.
    const allocated = active.length ? active.reduce((sum, a) => sum.plus(a.amount), ZERO)
      : v.invoiceId && v.allocations.length === 0 && v.status === 'POSTED' ? v.amount : ZERO;
    return {
      id: v.id,
      voucherNumber: v.voucherNumber,
      type: v.type,
      status: v.status,
      customerId: v.customerId,
      invoiceId: v.invoiceId,
      billOfLadingId: v.billOfLadingId,
      voyageId: v.voyageId,
      amount: v.amount.toFixed(2),
      currencyCode: v.currencyCode,
      exchangeRate: v.exchangeRate.toString(),
      baseCurrencyCode: v.baseCurrencyCode,
      baseAmount: v.baseAmount?.toFixed(2) ?? null,
      rateEffectiveAt: this.toIso(v.rateEffectiveAt),
      rateSource: v.rateSource,
      currencyRateId: v.currencyRateId,
      rateOverrideReason: v.rateOverrideReason,
      allocatedAmount: allocated.toFixed(2),
      unallocatedAmount: v.status === 'POSTED' ? v.amount.minus(allocated).toFixed(2) : '0.00',
      allocations: v.allocations.map((a) => ({
        id: a.id, invoiceId: a.invoiceId, billOfLadingId: a.billOfLadingId,
        amount: a.amount.toFixed(2), createdAt: a.createdAt.toISOString(), createdById: a.createdById,
        reversedAt: this.toIso(a.reversedAt), reversedById: a.reversedById,
        reversalReason: a.reversalReason, invoice: a.invoice, billOfLading: a.billOfLading,
      })),
      adjustments: v.adjustments.map((a) => ({
        id: a.id, previousAmount: a.previousAmount.toFixed(2), newAmount: a.newAmount.toFixed(2),
        previousBaseAmount: a.previousBaseAmount?.toFixed(2) ?? null,
        newBaseAmount: a.newBaseAmount?.toFixed(2) ?? null,
        reason: a.reason, createdById: a.createdById, createdAt: a.createdAt.toISOString(),
      })),
      method: v.method, reference: v.reference, description: v.description, note: v.note,
      voucherDate: v.voucherDate.toISOString(), cancelReason: v.cancelReason,
      createdById: v.createdById, cancelledById: v.cancelledById,
      cancelledAt: this.toIso(v.cancelledAt), createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      customer: v.customer ? { id: v.customer.id, name: v.customer.name } : null,
      invoice: v.invoice ? { id: v.invoice.id, invoiceNumber: v.invoice.invoiceNumber,
        status: v.invoice.status, totalAmount: v.invoice.totalAmount.toFixed(2),
        paidAmount: v.invoice.paidAmount.toFixed(2) } : null,
    };
  }

  async list(params: {
    page?: number; pageSize?: number; search?: string; type?: VoucherType; status?: VoucherStatus;
    customerId?: string; invoiceId?: string; method?: string; fromDate?: string; toDate?: string;
    sort?: string; order?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, params.pageSize ?? 20));
    const where: Prisma.VoucherWhereInput = { deletedAt: null };
    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { voucherNumber: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;
    if (params.customerId) where.customerId = params.customerId;
    if (params.invoiceId) where.AND = [{ OR: [
      { invoiceId: params.invoiceId },
      { allocations: { some: { invoiceId: params.invoiceId, reversedAt: null } } },
    ] }];
    if (params.method) where.method = params.method as Prisma.EnumVoucherMethodFilter['equals'];
    if (params.fromDate || params.toDate) {
      where.voucherDate = {};
      if (params.fromDate) where.voucherDate.gte = new Date(params.fromDate);
      if (params.toDate) where.voucherDate.lte = new Date(params.toDate);
    }
    const sortFields = ['voucherNumber', 'voucherDate', 'amount', 'createdAt'] as const;
    const sortBy = (sortFields as readonly string[]).includes(params.sort ?? '') ? params.sort! : 'voucherDate';
    const order = params.order ?? 'desc';
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.voucher.findMany({ where, include: voucherInclude, orderBy: { [sortBy]: order },
        skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.voucher.count({ where }),
    ]);
    return { data: rows.map((r) => this.serialize(r)),
      meta: { page, pageSize, totalItems: total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }

  async detail(id: string) {
    const v = await this.prisma.voucher.findFirst({ where: { id, deletedAt: null }, include: voucherInclude });
    if (!v) throw new NotFoundException('Voucher not found');
    return this.serialize(v);
  }

  async create(dto: CreateVoucherDto, actor: AuthenticatedUser) {
    const amount = exactMoney(dto.amount);
    const date = transactionDate(dto.voucherDate);
    if (dto.rateOverrideReason && dto.exchangeRate === undefined) {
      throw new BadRequestException('Rate override reason requires an overridden rate');
    }
    const created = await this.prisma.$transaction(async (tx) => {
      await this.allocation.lockCustomer(tx, dto.customerId);
      const invoice = dto.invoiceId ? await tx.invoice.findFirst({
        where: { id: dto.invoiceId, deletedAt: null, status: 'ISSUED' },
      }) : null;
      if (dto.invoiceId && !invoice) throw new ConflictException('Invoice must be ISSUED to settle');
      if (invoice && invoice.customerId !== dto.customerId) throw new ConflictException('Invoice belongs to another customer');
      const settings = await tx.companySettings.findFirst({ select: { defaultCurrency: true } });
      const currencyCode = dto.currencyCode ?? invoice?.currencyCode ?? settings?.defaultCurrency ?? 'USD';
      if (invoice && invoice.currencyCode !== currencyCode) {
        throw new ConflictException('Voucher currency must match invoice currency');
      }
      if (dto.billOfLadingId) {
        const bill = await tx.billOfLading.findFirst({ where: {
          id: dto.billOfLadingId, deletedAt: null, status: { notIn: ['DRAFT', 'CANCELLED'] },
        } });
        if (!bill) throw new ConflictException('B/L reference must be issued and live');
        const linked = await tx.invoice.count({ where: { customerId: dto.customerId, deletedAt: null,
          OR: [{ billOfLadingId: bill.id }, { billLinks: { some: { billOfLadingId: bill.id } } }] } });
        if (!linked) throw new ConflictException('B/L has no invoice for this customer');
      }
      const lines = await this.allocation.forCreate(tx, { customerId: dto.customerId, currencyCode,
        amount, type: dto.type, invoiceId: dto.invoiceId, allocations: dto.allocations,
        allocationMode: dto.allocationMode });
      // Validate BEFORE consuming a number. The customer lock protects the
      // availability check from concurrent allocations to this customer.
      await this.allocation.validate(tx, { id: '', customerId: dto.customerId, currencyCode,
        amount, type: dto.type, status: VoucherStatus.POSTED }, lines);
      const rate = await this.fx.resolve(tx, currencyCode, date, actor,
        dto.exchangeRate !== undefined ? { rate: dto.exchangeRate, reason: dto.rateOverrideReason ?? '' } : undefined);
      const req = periodicSequenceRequest(
        dto.type === VoucherType.RECEIPT ? 'VOUCHER_RECEIPT' : 'VOUCHER_PAYMENT', new Date());
      const { sequence: voucherNumber } = await this.numbering.allocateNumber({ ...req,
        seedNextSequence: async (seedTx) => nextSequenceAfter(req.prefix,
          (await seedTx.voucher.findFirst({ where: { voucherNumber: { startsWith: req.prefix } },
            orderBy: { voucherNumber: 'desc' }, select: { voucherNumber: true } }))?.voucherNumber ?? null),
        tx,
      });
      const voucher = await tx.voucher.create({ data: {
        voucherNumber, type: dto.type, customerId: dto.customerId,
        // Scalar invoiceId is set only by allocation.replace for a FULL one-to-one allocation.
        invoiceId: null, billOfLadingId: dto.billOfLadingId ?? null,
        voyageId: invoice?.voyageId ?? null, amount, currencyCode,
        exchangeRate: rate.exchangeRate, baseCurrencyCode: rate.baseCurrencyCode,
        baseAmount: rate.baseAmount(amount), rateEffectiveAt: rate.rateEffectiveAt,
        rateSource: rate.rateSource, currencyRateId: rate.currencyRateId,
        rateOverrideReason: rate.rateOverrideReason,
        method: dto.method ?? 'BANK_TRANSFER', reference: dto.reference,
        description: dto.description, note: dto.note, voucherDate: date,
        createdById: actor.id,
      } });
      const allocation = await this.allocation.replace(tx, voucher, lines, actor.id, 'Initial allocation', false);
      await this.postings.append(tx, this.postings.voucherSource(voucher), amount, 'POST');
      if (allocation.active.length) {
        await this.audit.recordIn(tx, { action: 'voucher.allocate', entityType: 'Voucher',
          entityId: voucher.id, actorId: actor.id, actorEmail: actor.email,
          beforeData: [], afterData: allocation.active,
          metadata: { reason: 'Initial allocation', voucherNumber } });
      }
      await this.audit.recordIn(tx, { action: 'voucher.post', entityType: 'Voucher', entityId: voucher.id,
        actorId: actor.id, actorEmail: actor.email,
        afterData: { voucherNumber, amount: amount.toFixed(2), currencyCode,
          baseAmount: rate.baseAmount(amount).toFixed(2), baseCurrencyCode: rate.baseCurrencyCode,
          rate: rate.exchangeRate.toString(), rateEffectiveAt: rate.rateEffectiveAt,
          rateSource: rate.rateSource, rateOverrideReason: rate.rateOverrideReason,
          allocations: lines, unallocatedAmount: amount.minus(allocation.allocatedAmount).toFixed(2) } });
      if (rate.rateOverrideReason) {
        await this.audit.recordIn(tx, { action: 'currency_rate.override', entityType: 'Voucher',
          entityId: voucher.id, actorId: actor.id, actorEmail: actor.email,
          afterData: { currencyCode, baseCurrencyCode: rate.baseCurrencyCode,
            rate: rate.exchangeRate.toString(), effectiveAt: rate.rateEffectiveAt },
          metadata: { reason: rate.rateOverrideReason, voucherNumber } });
      }
      // Separate catalog outputs for the generic Voucher and its payment/receipt
      // subtype are frozen together, after the allocation rows are committed.
      await captureIssuedDocument(tx, 'voucher', voucher.id, actor.id);
      await captureIssuedDocument(tx, dto.type === VoucherType.PAYMENT ? 'payment' : 'receipt', voucher.id, actor.id);
      return voucher;
    });
    return this.detail(created.id);
  }

  /** Metadata changes do not change financial history. Corrections are explicit. */
  async update(id: string, dto: UpdateVoucherDto, actor: AuthenticatedUser) {
    if (dto.amount !== undefined || dto.exchangeRate !== undefined || dto.voucherDate !== undefined) {
      throw new ConflictException('Posted amount/date/rate is frozen; use an audited adjustment or cancellation');
    }
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.voucher.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw new NotFoundException('Voucher not found');
      if (before.status === VoucherStatus.CANCELLED) throw new ConflictException('Cancelled voucher is frozen');
      const after = await tx.voucher.update({ where: { id }, data: {
        ...(dto.method !== undefined ? { method: dto.method } : {}),
        ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      } });
      await this.audit.recordIn(tx, { action: 'voucher.metadata_update', entityType: 'Voucher', entityId: id,
        actorId: actor.id, actorEmail: actor.email,
        beforeData: { method: before.method, reference: before.reference,
          description: before.description, note: before.note },
        afterData: { method: after.method, reference: after.reference,
          description: after.description, note: after.note } });
    });
    return this.detail(id);
  }

  async adjust(id: string, dto: AdjustVoucherDto, actor: AuthenticatedUser) {
    const newAmount = exactMoney(dto.amount);
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Adjustment reason is required');
    await this.prisma.$transaction(async (tx) => {
      const pre = await tx.voucher.findFirst({ where: { id, deletedAt: null }, select: { customerId: true } });
      if (!pre) throw new NotFoundException('Voucher not found');
      await this.allocation.lockCustomer(tx, pre.customerId);
      const before = await tx.voucher.findUniqueOrThrow({ where: { id }, include: {
        allocations: { where: { reversedAt: null } },
      } });
      if (before.status !== VoucherStatus.POSTED) throw new ConflictException('Cancelled voucher is frozen');
      if (newAmount.equals(before.amount)) throw new BadRequestException('Adjusted amount must differ');
      const allocated = before.allocations.reduce((sum, a) => sum.plus(a.amount), ZERO);
      if (allocated.greaterThan(newAmount)) throw new ConflictException('Reallocate first: current allocations exceed the new total');
      const baseAmount = before.baseCurrencyCode ? toBase(newAmount, before.exchangeRate) : null;
      const adjustment = await tx.voucherAmountAdjustment.create({ data: {
        voucherId: id, previousAmount: before.amount, newAmount,
        previousBaseAmount: before.baseAmount, newBaseAmount: baseAmount,
        reason, createdById: actor.id,
      } });
      await tx.voucher.update({ where: { id }, data: { amount: newAmount, baseAmount } });
      await this.postings.append(tx, this.postings.voucherSource(before),
        newAmount.minus(before.amount), this.postings.adjustmentKey());
      await this.audit.recordIn(tx, { action: 'voucher.amount_adjust', entityType: 'Voucher', entityId: id,
        actorId: actor.id, actorEmail: actor.email,
        beforeData: { amount: before.amount.toFixed(2), baseAmount: before.baseAmount?.toFixed(2) ?? null },
        afterData: { amount: newAmount.toFixed(2), baseAmount: baseAmount?.toFixed(2) ?? null },
        metadata: { adjustmentId: adjustment.id, reason } });
    });
    return this.detail(id);
  }

  async reallocate(id: string, dto: ReallocateVoucherDto, actor: AuthenticatedUser) {
    if (!dto.reason?.trim()) throw new BadRequestException('Reallocation reason is required');
    if (!Array.isArray(dto.allocations)) throw new BadRequestException('Allocations array is required');
    await this.prisma.$transaction(async (tx) => {
      const pre = await tx.voucher.findFirst({ where: { id, deletedAt: null }, select: { customerId: true } });
      if (!pre) throw new NotFoundException('Voucher not found');
      await this.allocation.lockCustomer(tx, pre.customerId);
      const voucher = await tx.voucher.findUniqueOrThrow({ where: { id } });
      if (voucher.status !== VoucherStatus.POSTED) throw new ConflictException('Cancelled voucher is frozen');
      const result = await this.allocation.replace(tx, voucher, dto.allocations, actor.id, dto.reason.trim(), true);
      await this.audit.recordIn(tx, { action: 'voucher.reallocate', entityType: 'Voucher', entityId: id,
        actorId: actor.id, actorEmail: actor.email,
        beforeData: result.previous.map((a) => ({ invoiceId: a.invoiceId,
          billOfLadingId: a.billOfLadingId, amount: a.amount.toFixed(2) })),
        afterData: result.active, metadata: { reason: dto.reason.trim(),
          remainingCredit: voucher.amount.minus(result.allocatedAmount).toFixed(2) } });
    });
    return this.detail(id);
  }

  async cancel(id: string, dto: { reason: string }, actor: AuthenticatedUser) {
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Cancellation reason is required');
    await this.prisma.$transaction(async (tx) => {
      const pre = await tx.voucher.findFirst({ where: { id, deletedAt: null }, select: { customerId: true } });
      if (!pre) throw new NotFoundException('Voucher not found');
      await this.allocation.lockCustomer(tx, pre.customerId);
      const v = await tx.voucher.findUniqueOrThrow({ where: { id }, include: {
        allocations: { where: { reversedAt: null }, select: { invoiceId: true } },
      } });
      if (v.status === VoucherStatus.CANCELLED) throw new ConflictException('Voucher already cancelled');
      const now = new Date();
      await tx.voucher.update({ where: { id }, data: {
        status: VoucherStatus.CANCELLED, cancelReason: reason, cancelledById: actor.id, cancelledAt: now,
      } });
      await tx.voucherAllocation.updateMany({ where: { voucherId: id, reversedAt: null },
        data: { reversedAt: now, reversedById: actor.id, reversalReason: reason } });
      for (const invoiceId of new Set(v.allocations.map((a) => a.invoiceId).filter((x): x is string => !!x))) {
        await this.allocation.recomputeInvoicePaid(tx, invoiceId);
      }
      await this.postings.append(tx, this.postings.voucherSource(v), v.amount.negated(), 'CANCEL');
      await this.audit.recordIn(tx, { action: 'voucher.cancel', entityType: 'Voucher', entityId: id,
        actorId: actor.id, actorEmail: actor.email,
        beforeData: { status: 'POSTED', amount: v.amount.toFixed(2),
          invoiceIds: v.allocations.map((a) => a.invoiceId) },
        afterData: { status: 'CANCELLED', cancelledAt: now, reason } });
    });
    return this.detail(id);
  }

  /** A posted financial record is never erased, including after cancellation. */
  async remove(id: string) {
    const v = await this.prisma.voucher.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!v) throw new NotFoundException('Voucher not found');
    throw new ConflictException('Vouchers are retained for financial history; cancel instead');
  }

  // ── derived ledger / customer statement ────────────────────────────────────

  /**
   * Customer statement over [fromDate, toDate]: ISSUED invoices (debit) and
   * POSTED vouchers (credit), sorted by date with a running balance. Entries
   * before fromDate collapse into openingBalance; toDate caps the window.
   */
  async ledger(params: { customerId: string; fromDate?: string; toDate?: string; currencyCode?: string; kind?: string },
    client: Prisma.TransactionClient | PrismaService = this.prisma): Promise<{ summary: LedgerSummary; entries: LedgerEntry[] }> {
    const customer = await client.customer.findFirst({ where: { id: params.customerId, deletedAt: null } });
    if (!customer) throw new NotFoundException('customer not found');

    const invoiceWhere: Prisma.InvoiceWhereInput = {
      customerId: params.customerId,
      deletedAt: null,
      status: 'ISSUED',
      ...(params.currencyCode ? { currencyCode: params.currencyCode } : {}),
    };
    const voucherWhere: Prisma.VoucherWhereInput = {
      customerId: params.customerId,
      deletedAt: null,
      status: VoucherStatus.POSTED,
      ...(params.currencyCode ? { currencyCode: params.currencyCode } : {}),
    };

    const [invoices, vouchers] = await Promise.all([
      client.invoice.findMany({
        where: invoiceWhere,
        select: { id: true, invoiceNumber: true, issueDate: true, createdAt: true, title: true, totalAmount: true, currencyCode: true, voyageId: true },
      }),
      client.voucher.findMany({
        where: voucherWhere,
        select: { id: true, voucherNumber: true, type: true, voucherDate: true, amount: true, currencyCode: true, description: true },
      }),
    ]);

    const kind = (params.kind ?? 'all') as 'invoice' | 'voucher' | 'all';
    const entries: (LedgerEntry & { sortKey: number })[] = [];

    if (kind === 'all' || kind === 'invoice') {
      for (const inv of invoices) {
        entries.push({
          sortKey: (inv.issueDate ?? inv.createdAt).getTime(),
          date: (inv.issueDate ?? inv.createdAt).toISOString(),
          kind: 'invoice',
          documentNumber: inv.invoiceNumber,
          documentId: inv.id,
          description: inv.title ?? 'Invoice issued',
          debit: inv.totalAmount.toFixed(2),
          credit: '0.00',
          balance: '0.00',
          currencyCode: inv.currencyCode,
          invoiceId: inv.id,
          voucherId: null,
        });
      }
    }
    if (kind === 'all' || kind === 'voucher') {
      for (const v of vouchers) {
        entries.push({
          sortKey: v.voucherDate.getTime(),
          date: v.voucherDate.toISOString(),
          kind: 'voucher',
          documentNumber: v.voucherNumber,
          documentId: v.id,
          description: v.description ?? (v.type === VoucherType.RECEIPT ? 'Receipt posted' : 'Payment posted'),
          debit: '0.00',
          credit: v.amount.toFixed(2),
          balance: '0.00',
          currencyCode: v.currencyCode,
          invoiceId: null,
          voucherId: v.id,
        });
      }
    }

    entries.sort((a, b) => a.sortKey - b.sortKey);

    const from = params.fromDate ? new Date(params.fromDate).getTime() : -Infinity;
    const to = params.toDate ? new Date(params.toDate).getTime() : Infinity;

    let opening = new Prisma.Decimal(0);
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    const window: LedgerEntry[] = [];
    const currencyTotals = new Map<string, { opening: Prisma.Decimal; debit: Prisma.Decimal; credit: Prisma.Decimal }>();

    for (const e of entries) {
      const debit = new Prisma.Decimal(e.debit);
      const credit = new Prisma.Decimal(e.credit);
      const currency = e.currencyCode!;
      const group = currencyTotals.get(currency) ?? { opening: ZERO, debit: ZERO, credit: ZERO };
      if (e.sortKey < from) {
        opening = opening.plus(debit).minus(credit);
        group.opening = group.opening.plus(debit).minus(credit);
        currencyTotals.set(currency, group);
        continue;
      }
      if (e.sortKey > to) break;
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
      group.debit = group.debit.plus(debit);
      group.credit = group.credit.plus(credit);
      currencyTotals.set(currency, group);
      window.push(e);
    }

    let running = opening;
    for (const e of window) {
      running = running.plus(new Prisma.Decimal(e.debit)).minus(new Prisma.Decimal(e.credit));
      e.balance = running.toFixed(2);
    }

    const closing = running;
    const summary: LedgerSummary = {
      customerId: customer.id,
      customerName: customer.name,
      fromDate: params.fromDate ?? null,
      toDate: params.toDate ?? null,
      openingBalance: opening.toFixed(2),
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      closingBalance: closing.toFixed(2),
      currencyCode: params.currencyCode ?? (new Set(entries.map((e) => e.currencyCode)).size > 1
        ? 'MIXED' : entries[0]?.currencyCode ?? 'USD'),
      currencyTotals: Object.fromEntries([...currencyTotals].map(([currency, t]) => [currency, {
        openingBalance: t.opening.toFixed(2), totalDebit: t.debit.toFixed(2),
        totalCredit: t.credit.toFixed(2), closingBalance: t.opening.plus(t.debit).minus(t.credit).toFixed(2),
      }])),
      ...(new Set(entries.map((e) => e.currencyCode)).size > 1 && !params.currencyCode ? {
        warning: 'Legacy numeric aggregate mixes currencies and is not money. Use currencyTotals or currencyCode; no FX conversion was applied.',
      } : {}),
    };

    return { summary, entries: window };
  }
}
