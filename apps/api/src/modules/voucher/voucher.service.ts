import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VoucherStatus, VoucherType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { LedgerEntry, LedgerSummary, Voucher } from '@shipping/shared';

const PAGE_SIZE_MAX = 100;

@Injectable()
export class VoucherService {
  constructor(private readonly prisma: PrismaService) {}

  // ── helpers ────────────────────────────────────────────────────────────────

  private money(n: number): Prisma.Decimal {
    return new Prisma.Decimal(n.toFixed(2));
  }

  private toIso(d: Date | null | undefined): string | null {
    return d ? d.toISOString() : null;
  }

  private serialize(v: Prisma.VoucherGetPayload<{ include: { customer: true; invoice: true } }>): Voucher & {
    customer: { id: string; name: string } | null;
    invoice: { id: string; invoiceNumber: string; status: string; totalAmount: string; paidAmount: string } | null;
  } {
    return {
      id: v.id,
      voucherNumber: v.voucherNumber,
      type: v.type,
      status: v.status,
      customerId: v.customerId,
      invoiceId: v.invoiceId,
      voyageId: v.voyageId,
      amount: v.amount.toFixed(2),
      currencyCode: v.currencyCode,
      exchangeRate: v.exchangeRate.toFixed(4),
      method: v.method,
      reference: v.reference,
      description: v.description,
      note: v.note,
      voucherDate: v.voucherDate.toISOString(),
      cancelReason: v.cancelReason,
      createdById: v.createdById,
      cancelledById: v.cancelledById,
      cancelledAt: this.toIso(v.cancelledAt),
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      customer: v.customer ? { id: v.customer.id, name: v.customer.name } : null,
      invoice: v.invoice
        ? {
            id: v.invoice.id,
            invoiceNumber: v.invoice.invoiceNumber,
            status: v.invoice.status,
            totalAmount: v.invoice.totalAmount.toFixed(2),
            paidAmount: v.invoice.paidAmount.toFixed(2),
          }
        : null,
    };
  }

  /** Next voucher number per type: RCP-YYMM-##### / PMT-YYMM-#####. */
  private async nextNumber(tx: Prisma.TransactionClient, type: VoucherType): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear() % 100).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `${type === VoucherType.RECEIPT ? 'RCP' : 'PMT'}-${yy}${mm}-`;
    for (let seq = 1; seq <= 9999; seq++) {
      const candidate = `${prefix}${String(seq).padStart(5, '0')}`;
      const exists = await tx.voucher.findUnique({ where: { voucherNumber: candidate }, select: { id: true } });
      if (!exists) return candidate;
    }
    throw new ConflictException(`voucher number space exhausted for ${prefix}`);
  }

  /**
   * Recompute invoice.paidAmount from live (POSTED, not deleted) vouchers.
   * RECEIPT increases, PAYMENT decreases; clamped at >= 0 (no negative overpay).
   */
  private async recomputeInvoicePaid(tx: Prisma.TransactionClient, invoiceId: string | null | undefined): Promise<void> {
    if (!invoiceId) return;
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { id: true } });
    if (!invoice) return;
    const live = await tx.voucher.findMany({
      where: { invoiceId, status: VoucherStatus.POSTED, deletedAt: null },
      select: { type: true, amount: true },
    });
    let paid = new Prisma.Decimal(0);
    for (const v of live) {
      paid = v.type === VoucherType.RECEIPT ? paid.plus(v.amount) : paid.minus(v.amount);
    }
    if (paid.lessThan(0)) paid = new Prisma.Decimal(0);
    await tx.invoice.update({ where: { id: invoiceId }, data: { paidAmount: paid } });
  }

  // ── list / detail ──────────────────────────────────────────────────────────

  async list(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    type?: VoucherType;
    status?: VoucherStatus;
    customerId?: string;
    invoiceId?: string;
    method?: string;
    fromDate?: string;
    toDate?: string;
    sort?: string;
    order?: 'asc' | 'desc';
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
    if (params.invoiceId) where.invoiceId = params.invoiceId;
    if (params.method) where.method = params.method as Prisma.EnumVoucherMethodFilter['equals'];
    if (params.fromDate || params.toDate) {
      where.voucherDate = {};
      if (params.fromDate) where.voucherDate.gte = new Date(params.fromDate);
      if (params.toDate) where.voucherDate.lte = new Date(params.toDate);
    }

    const sortFields = ['voucherNumber', 'voucherDate', 'amount', 'createdAt'] as const;
    const sortBy = (sortFields as readonly string[]).includes(params.sort ?? '') ? (params.sort as string) : 'voucherDate';
    const order = params.order ?? 'desc';

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.voucher.findMany({
        where,
        include: { customer: true, invoice: true },
        orderBy: { [sortBy]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.voucher.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.serialize(r)),
      meta: { page, pageSize, totalItems: total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async detail(id: string) {
    const v = await this.prisma.voucher.findFirst({
      where: { id, deletedAt: null },
      include: { customer: true, invoice: true, createdBy: true, cancelledBy: true },
    });
    if (!v) throw new NotFoundException('voucher not found');
    return this.serialize(v);
  }

  // ── create / update / cancel / delete ─────────────────────────────────────

  async create(dto: { type: VoucherType; customerId: string; invoiceId?: string; amount: number; currencyCode?: string; exchangeRate?: number; method?: any; reference?: string; description?: string; note?: string; voucherDate?: string }, user?: { id: string }) {
    if (dto.amount <= 0) throw new BadRequestException('amount must be positive');

    const created = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: dto.customerId, deletedAt: null } });
      if (!customer) throw new NotFoundException('customer not found');

      let invoice: Prisma.InvoiceGetPayload<null> | null = null;
      let voyageId: string | null = null;
      if (dto.invoiceId) {
        invoice = await tx.invoice.findFirst({
          where: { id: dto.invoiceId, deletedAt: null, status: 'ISSUED' },
        });
        if (!invoice) throw new ConflictException('invoice must be ISSUED to settle');
        voyageId = invoice.voyageId;
      }

      const currencyCode = dto.currencyCode ?? invoice?.currencyCode ?? 'USD';
      if (invoice && invoice.currencyCode !== currencyCode) {
        throw new ConflictException('voucher currency must match invoice currency');
      }

      const voucher = await tx.voucher.create({
        data: {
          voucherNumber: await this.nextNumber(tx, dto.type),
          type: dto.type,
          customerId: dto.customerId,
          invoiceId: invoice?.id ?? null,
          voyageId,
          amount: this.money(dto.amount),
          currencyCode,
          exchangeRate: new Prisma.Decimal(String(dto.exchangeRate ?? 1)),
          method: dto.method ?? 'BANK_TRANSFER',
          reference: dto.reference,
          description: dto.description,
          note: dto.note,
          voucherDate: dto.voucherDate ? new Date(dto.voucherDate) : new Date(),
          createdById: user?.id ?? null,
        },
      });

      if (invoice) await this.recomputeInvoicePaid(tx, invoice.id);
      return voucher;
    });

    return this.detail(created.id);
  }

  async update(id: string, dto: { method?: any; reference?: string; description?: string; note?: string; voucherDate?: string; amount?: number; exchangeRate?: number }) {
    await this.prisma.$transaction(async (tx) => {
      const v = await tx.voucher.findFirst({ where: { id, deletedAt: null } });
      if (!v) throw new NotFoundException('voucher not found');
      if (v.status === VoucherStatus.CANCELLED) throw new ConflictException('cancelled voucher is frozen');

      const data: Prisma.VoucherUpdateInput = {};
      if (dto.method !== undefined) data.method = dto.method;
      if (dto.reference !== undefined) data.reference = dto.reference;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.note !== undefined) data.note = dto.note;
      if (dto.voucherDate !== undefined) data.voucherDate = new Date(dto.voucherDate);
      if (dto.amount !== undefined) {
        if (dto.amount <= 0) throw new BadRequestException('amount must be positive');
        data.amount = this.money(dto.amount);
      }
      if (dto.exchangeRate !== undefined) data.exchangeRate = new Prisma.Decimal(String(dto.exchangeRate));

      await tx.voucher.update({ where: { id }, data });
      if (v.invoiceId) await this.recomputeInvoicePaid(tx, v.invoiceId);
    });
    return this.detail(id);
  }

  async cancel(id: string, dto: { reason: string }, user?: { id: string }) {
    await this.prisma.$transaction(async (tx) => {
      const v = await tx.voucher.findFirst({ where: { id, deletedAt: null } });
      if (!v) throw new NotFoundException('voucher not found');
      if (v.status === VoucherStatus.CANCELLED) throw new ConflictException('voucher already cancelled');

      await tx.voucher.update({
        where: { id },
        data: {
          status: VoucherStatus.CANCELLED,
          cancelReason: dto.reason,
          cancelledById: user?.id ?? null,
          cancelledAt: new Date(),
        },
      });
      if (v.invoiceId) await this.recomputeInvoicePaid(tx, v.invoiceId);
    });
    return this.detail(id);
  }

  /** Soft-delete only for CANCELLED vouchers (hard audit trail keeps POSTED rows). */
  async remove(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const v = await tx.voucher.findFirst({ where: { id, deletedAt: null } });
      if (!v) throw new NotFoundException('voucher not found');
      if (v.status === VoucherStatus.POSTED) throw new ConflictException('cancel the voucher before deleting it');
      await tx.voucher.delete({ where: { id } });
    });
    return { id };
  }

  // ── derived ledger / customer statement ────────────────────────────────────

  /**
   * Customer statement over [fromDate, toDate]: ISSUED invoices (debit) and
   * POSTED vouchers (credit), sorted by date with a running balance. Entries
   * before fromDate collapse into openingBalance; toDate caps the window.
   */
  async ledger(params: { customerId: string; fromDate?: string; toDate?: string; currencyCode?: string; kind?: string }): Promise<{ summary: LedgerSummary; entries: LedgerEntry[] }> {
    const customer = await this.prisma.customer.findFirst({ where: { id: params.customerId, deletedAt: null } });
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
      this.prisma.invoice.findMany({
        where: invoiceWhere,
        select: { id: true, invoiceNumber: true, issueDate: true, createdAt: true, title: true, totalAmount: true, currencyCode: true, voyageId: true },
      }),
      this.prisma.voucher.findMany({
        where: voucherWhere,
        select: { id: true, voucherNumber: true, type: true, voucherDate: true, amount: true, currencyCode: true, description: true },
      }),
    ]);

    const kind = (params.kind ?? 'all') as 'invoice' | 'voucher' | 'all';
    let entries: (LedgerEntry & { sortKey: number })[] = [];

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

    for (const e of entries) {
      const debit = new Prisma.Decimal(e.debit);
      const credit = new Prisma.Decimal(e.credit);
      if (e.sortKey < from) {
        opening = opening.plus(debit).minus(credit);
        continue;
      }
      if (e.sortKey > to) break;
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
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
      currencyCode: params.currencyCode ?? 'USD',
    };

    return { summary, entries: window };
  }
}
