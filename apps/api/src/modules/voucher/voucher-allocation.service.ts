import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AllocationPolicy, Prisma, VoucherStatus, VoucherType } from '@prisma/client';
import { exactMoney } from '../finance/financial-money';
import type { AllocationLineDto } from './dto/voucher.dto';

export interface VoucherForAllocation {
  id: string;
  customerId: string;
  currencyCode: string;
  amount: Prisma.Decimal;
  type: VoucherType;
  status: VoucherStatus;
}

const ZERO = new Prisma.Decimal(0);

/** One customer row lock serializes voucher creation/reallocation per customer. */
@Injectable()
export class VoucherAllocationService {
  async lockCustomer(tx: Prisma.TransactionClient, customerId: string): Promise<void> {
    const found = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Customer" WHERE "id" = ${customerId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (!found.length) throw new NotFoundException('Customer not found');
  }

  async forCreate(
    tx: Prisma.TransactionClient,
    input: { customerId: string; currencyCode: string; amount: Prisma.Decimal; type: VoucherType;
      invoiceId?: string; allocations?: AllocationLineDto[]; allocationMode?: 'MANUAL' | 'AUTO' | 'NONE' },
  ): Promise<AllocationLineDto[]> {
    if (input.invoiceId && input.allocations !== undefined) {
      throw new BadRequestException('Use either invoiceId or allocations, not both');
    }
    if (input.allocationMode === 'NONE') {
      if (input.invoiceId || input.allocations?.length) throw new BadRequestException('NONE requires no allocations');
      return [];
    }
    if (input.invoiceId) {
      if (input.allocationMode === 'AUTO') throw new BadRequestException('Explicit invoiceId cannot use AUTO');
      return [{ invoiceId: input.invoiceId, amount: input.amount.toFixed(2) }];
    }
    if (input.allocations !== undefined) {
      if (input.allocationMode === 'AUTO') throw new BadRequestException('Explicit allocations cannot use AUTO');
      return input.allocations;
    }
    const settings = await tx.companySettings.findFirst({ select: { allocationPolicy: true } });
    const policy = settings?.allocationPolicy ?? AllocationPolicy.MANUAL;
    if (input.allocationMode === 'MANUAL' || (input.allocationMode !== 'AUTO' && policy === AllocationPolicy.MANUAL)) return [];
    if (input.type !== VoucherType.RECEIPT) throw new BadRequestException('Automatic allocation is only for receipts');
    if (policy === AllocationPolicy.MANUAL) throw new ConflictException('Administrator must configure an automatic allocation policy first');
    // Ordering is CONFIGURATION, not an assumed company practice. Same-currency
    // ISSUED invoices only; with no open invoice the entire receipt is credit.
    const invoices = await tx.invoice.findMany({
      where: { customerId: input.customerId, currencyCode: input.currencyCode, status: 'ISSUED', deletedAt: null },
      orderBy: policy === AllocationPolicy.OLDEST_DUE
        ? [{ dueDate: 'asc' }, { issueDate: 'asc' }, { id: 'asc' }]
        : [{ issueDate: 'asc' }, { id: 'asc' }],
      select: { id: true, totalAmount: true, paidAmount: true },
    });
    let remaining = input.amount;
    const lines: AllocationLineDto[] = [];
    for (const inv of invoices) {
      const due = Prisma.Decimal.max(ZERO, inv.totalAmount.minus(inv.paidAmount));
      const applied = Prisma.Decimal.min(due, remaining);
      if (applied.greaterThan(0)) {
        lines.push({ invoiceId: inv.id, amount: applied.toFixed(2) });
        remaining = remaining.minus(applied);
      }
      if (remaining.isZero()) break;
    }
    return lines;
  }

  async validate(
    tx: Prisma.TransactionClient, voucher: VoucherForAllocation, lines: AllocationLineDto[],
    before: Array<{ invoiceId: string | null; amount: Prisma.Decimal }> = [],
  ) {
    let total = ZERO;
    const unique = new Set<string>();
    const invoices = new Set<string>();
    const bills = new Set<string>();
    for (const line of lines) {
      if (!!line.invoiceId === !!line.billOfLadingId) {
        throw new BadRequestException('Exactly one invoiceId or billOfLadingId is required per allocation');
      }
      const id = line.invoiceId ?? line.billOfLadingId!;
      const ref = line.invoiceId ? `invoice:${id}` : `bill:${id}`;
      if (unique.has(ref)) throw new BadRequestException('Duplicate allocation reference');
      unique.add(ref);
      if (line.invoiceId) invoices.add(id);
      else bills.add(id);
      total = total.plus(exactMoney(line.amount, 'allocation amount'));
    }
    if (total.greaterThan(voucher.amount)) throw new BadRequestException('Allocations exceed voucher amount');
    if (lines.length === 0) return;
    const rows = await tx.invoice.findMany({ where: { id: { in: [...invoices] }, status: 'ISSUED', deletedAt: null },
      select: { id: true, customerId: true, currencyCode: true, totalAmount: true, paidAmount: true } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const line of lines) {
      if (!line.invoiceId) continue;
      const inv = byId.get(line.invoiceId);
      if (!inv) throw new ConflictException('Allocation requires an ISSUED invoice');
      if (inv.customerId !== voucher.customerId) throw new ConflictException('Invoice belongs to a different customer');
      if (inv.currencyCode !== voucher.currencyCode) throw new ConflictException('Allocation invoice currency must match voucher currency');
      const old = before.filter((a) => a.invoiceId === inv.id).reduce((sum, a) => sum.plus(a.amount), ZERO);
      const paidBeforeThisVoucher = voucher.type === VoucherType.RECEIPT
        ? inv.paidAmount.minus(old) : inv.paidAmount.plus(old);
      const room = voucher.type === VoucherType.RECEIPT
        ? inv.totalAmount.minus(paidBeforeThisVoucher) : paidBeforeThisVoucher;
      if (exactMoney(line.amount).greaterThan(Prisma.Decimal.max(ZERO, room))) {
        throw new ConflictException('Allocation exceeds this invoice’s available balance');
      }
    }
    if (bills.size) {
      const linked = await tx.billOfLading.findMany({
        where: { id: { in: [...bills] }, deletedAt: null, status: { notIn: ['DRAFT', 'CANCELLED'] } },
        select: { id: true },
      });
      if (linked.length !== bills.size) throw new ConflictException('B/L allocation requires a live issued B/L');
      // A B/L does not itself store a Customer. Require an invoice link to
      // establish that this customer owns the reference; B/L allocations do NOT
      // settle that invoice unless it is also allocated separately.
      for (const billId of bills) {
        const count = await tx.invoice.count({ where: { customerId: voucher.customerId, deletedAt: null,
          OR: [{ billOfLadingId: billId }, { billLinks: { some: { billOfLadingId: billId } } }] } });
        if (!count) throw new ConflictException('B/L has no invoice for this customer');
      }
    }
  }

  /** Replace live allocations only; old rows stay as reversed historical facts. */
  async replace(
    tx: Prisma.TransactionClient, voucher: VoucherForAllocation, lines: AllocationLineDto[],
    actorId: string, reason: string, isReallocation: boolean,
  ) {
    const previous = await tx.voucherAllocation.findMany({ where: { voucherId: voucher.id, reversedAt: null },
      select: { id: true, invoiceId: true, billOfLadingId: true, amount: true } });
    if (isReallocation && !reason.trim()) throw new BadRequestException('Reallocation reason is required');
    await this.validate(tx, voucher, lines, previous);
    if (previous.length) {
      const now = new Date();
      await tx.voucherAllocation.updateMany({ where: { voucherId: voucher.id, reversedAt: null },
        data: { reversedAt: now, reversedById: actorId, reversalReason: reason } });
    }
    for (const line of lines) {
      await tx.voucherAllocation.create({ data: { voucherId: voucher.id,
        invoiceId: line.invoiceId ?? null, billOfLadingId: line.billOfLadingId ?? null,
        amount: exactMoney(line.amount), createdById: actorId } });
    }
    // Keep the legacy scalar only for a full allocation to one invoice. New
    // multi/partial allocations use the join table; reads include both paths.
    const single = lines.length === 1 && lines[0].invoiceId && exactMoney(lines[0].amount).equals(voucher.amount)
      ? lines[0].invoiceId : null;
    await tx.voucher.update({ where: { id: voucher.id }, data: { invoiceId: single } });
    for (const id of new Set([...previous.map((a) => a.invoiceId), ...lines.map((a) => a.invoiceId)].filter((s): s is string => !!s))) {
      await this.recomputeInvoicePaid(tx, id);
    }
    return { previous, active: lines, allocatedAmount: lines.reduce((sum, l) => sum.plus(exactMoney(l.amount)), ZERO) };
  }

  async recomputeInvoicePaid(tx: Prisma.TransactionClient, invoiceId: string) {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { id: true } });
    if (!invoice) return;
    const [linked, legacy] = await Promise.all([
      tx.voucherAllocation.findMany({ where: { invoiceId, reversedAt: null,
        voucher: { status: 'POSTED', deletedAt: null } }, select: { amount: true, voucher: { select: { type: true } } } }),
      tx.voucher.findMany({ where: { invoiceId, status: 'POSTED', deletedAt: null,
        allocations: { none: {} } }, select: { type: true, amount: true } }),
    ]);
    let paid = ZERO;
    for (const item of [...linked.map((a) => ({ type: a.voucher.type, amount: a.amount })), ...legacy]) {
      paid = item.type === VoucherType.RECEIPT ? paid.plus(item.amount) : paid.minus(item.amount);
    }
    if (paid.lessThan(0)) paid = ZERO; // preserve the legacy paidAmount rule
    await tx.invoice.update({ where: { id: invoiceId }, data: { paidAmount: paid } });
  }
}
