import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface PostingSource {
  id: string;
  customerId: string;
  currencyCode: string;
  amount: Prisma.Decimal;
  date: Date;
  kind: 'invoice' | 'voucher';
}

function key(source: PostingSource): string {
  return JSON.stringify([source.customerId, source.currencyCode, source.kind, source.id, source.date.toISOString()]);
}

/**
 * Shadow subledger, NOT the customer statement read path. Reversals use the
 * source's original effective date to reproduce the existing derived statement
 * (which omits cancelled sources even in earlier date windows). createdAt is the
 * real posting/reversal time; the audit records the actor and reason atomically.
 */
@Injectable()
export class CustomerPostingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  async append(tx: Prisma.TransactionClient, source: PostingSource, delta: Prisma.Decimal, action: string) {
    if (delta.isZero()) return;
    const positive = delta.greaterThan(0);
    await tx.customerPosting.create({ data: {
      eventKey: `${source.kind}:${source.id}:${action}`,
      sourceType: source.kind, sourceId: source.id,
      customerId: source.customerId, currencyCode: source.currencyCode,
      effectiveAt: source.date,
      debit: source.kind === 'invoice' ? (positive ? delta : 0) : (positive ? 0 : delta.negated()),
      credit: source.kind === 'voucher' ? (positive ? delta : 0) : (positive ? 0 : delta.negated()),
    } });
  }

  invoiceSource(inv: { id: string; customerId: string; currencyCode: string; totalAmount: Prisma.Decimal; issueDate: Date | null; createdAt: Date }): PostingSource {
    return { id: inv.id, customerId: inv.customerId, currencyCode: inv.currencyCode,
      amount: inv.totalAmount, date: inv.issueDate ?? inv.createdAt, kind: 'invoice' };
  }

  voucherSource(v: { id: string; customerId: string; currencyCode: string; amount: Prisma.Decimal; voucherDate: Date }): PostingSource {
    return { id: v.id, customerId: v.customerId, currencyCode: v.currencyCode,
      amount: v.amount, date: v.voucherDate, kind: 'voucher' };
  }

  /** A financial correction needs a unique, auditable adjustment, never a rewrite. */
  adjustmentKey(): string { return `ADJUST:${randomUUID()}`; }

  /** Read-only posted customer statement, for dual-run comparison only. */
  async postedStatement(params: { customerId: string; currencyCode?: string; fromDate?: string; toDate?: string }) {
    const customer = await this.prisma.customer.findUnique({ where: { id: params.customerId },
      select: { id: true, name: true } });
    if (!customer) throw new NotFoundException('Customer not found');
    const postings = await this.prisma.customerPosting.findMany({
      where: { customerId: params.customerId,
        ...(params.currencyCode ? { currencyCode: params.currencyCode } : {}) },
      orderBy: [{ effectiveAt: 'asc' }, { id: 'asc' }],
    });
    const entries = new Map<string, { sourceType: string; sourceId: string; currencyCode: string;
      date: Date; amount: Prisma.Decimal }>();
    for (const p of postings) {
      const k = JSON.stringify([p.sourceType, p.sourceId, p.currencyCode, p.effectiveAt.toISOString()]);
      const item = entries.get(k) ?? { sourceType: p.sourceType, sourceId: p.sourceId,
        currencyCode: p.currencyCode, date: p.effectiveAt, amount: new Prisma.Decimal(0) };
      item.amount = item.amount.plus(p.sourceType === 'invoice' ? p.debit.minus(p.credit) : p.credit.minus(p.debit));
      entries.set(k, item);
    }
    const sorted = [...entries.values()].filter((e) => !e.amount.isZero()).sort((a, b) => a.date.getTime() - b.date.getTime());
    const from = params.fromDate ? new Date(params.fromDate).getTime() : -Infinity;
    const to = params.toDate ? new Date(params.toDate).getTime() : Infinity;
    const totals = new Map<string, { opening: Prisma.Decimal; debit: Prisma.Decimal; credit: Prisma.Decimal }>();
    const zero = () => new Prisma.Decimal(0);
    const result: Array<{ date: string; kind: string; documentId: string; currencyCode: string;
      debit: string; credit: string }> = [];
    for (const e of sorted) {
      const bucket = totals.get(e.currencyCode) ?? { opening: zero(), debit: zero(), credit: zero() };
      const debit = e.sourceType === 'invoice' ? e.amount : zero();
      const credit = e.sourceType === 'voucher' ? e.amount : zero();
      if (e.date.getTime() < from) bucket.opening = bucket.opening.plus(debit).minus(credit);
      else if (e.date.getTime() <= to) {
        bucket.debit = bucket.debit.plus(debit);
        bucket.credit = bucket.credit.plus(credit);
        result.push({ date: e.date.toISOString(), kind: e.sourceType, documentId: e.sourceId,
          currencyCode: e.currencyCode, debit: debit.toFixed(2), credit: credit.toFixed(2) });
      }
      totals.set(e.currencyCode, bucket);
    }
    return { customer, readPath: 'SHADOW_POSTED_NOT_LIVE',
      totals: Object.fromEntries([...totals].map(([currency, t]) => [currency, {
        openingBalance: t.opening.toFixed(2), totalDebit: t.debit.toFixed(2),
        totalCredit: t.credit.toFixed(2), closingBalance: t.opening.plus(t.debit).minus(t.credit).toFixed(2),
      }])), entries: result };
  }

  /**
   * Read-only snapshot reconciliation for EVERY customer, including inactive
   * and soft-deleted customers. Compare source, currency and effective date, as
   * well as per-currency debit/credit/closing totals; no currencies are mixed.
   * Repeatable-read makes the two reads represent one database instant.
   */
  async reconcileAll() {
    return this.prisma.$transaction(async (tx) => {
      const customerIds = new Set<string>();
      const persistedCustomers = new Set<string>();
      const expected = new Map<string, Prisma.Decimal>();
      const actual = new Map<string, Prisma.Decimal>();
      const sources = new Map<string, PostingSource>();
      const zeros = () => new Prisma.Decimal(0);
      const accumulate = (target: Map<string, Prisma.Decimal>, source: PostingSource, amount: Prisma.Decimal) => {
        const k = key(source);
        sources.set(k, source);
        target.set(k, (target.get(k) ?? zeros()).plus(amount));
        customerIds.add(source.customerId);
      };

      // Cursor pagination avoids arbitrary row limits while keeping memory usage
      // proportional to distinct sources. This is deliberately read-only.
      let cursor = '';
      for (;;) {
        const rows = await tx.customer.findMany({ where: { id: { gt: cursor } }, select: { id: true }, orderBy: { id: 'asc' }, take: 500 });
        for (const row of rows) { customerIds.add(row.id); persistedCustomers.add(row.id); }
        if (rows.length < 500) break;
        cursor = rows[rows.length - 1].id;
      }
      cursor = '';
      for (;;) {
        const rows = await tx.invoice.findMany({ where: { id: { gt: cursor }, status: 'ISSUED', deletedAt: null },
          select: { id: true, customerId: true, currencyCode: true, totalAmount: true, issueDate: true, createdAt: true },
          orderBy: { id: 'asc' }, take: 500 });
        for (const row of rows) { const s = this.invoiceSource(row); accumulate(expected, s, s.amount); }
        if (rows.length < 500) break;
        cursor = rows[rows.length - 1].id;
      }
      cursor = '';
      for (;;) {
        const rows = await tx.voucher.findMany({ where: { id: { gt: cursor }, status: 'POSTED', deletedAt: null },
          select: { id: true, customerId: true, currencyCode: true, amount: true, voucherDate: true },
          orderBy: { id: 'asc' }, take: 500 });
        for (const row of rows) { const s = this.voucherSource(row); accumulate(expected, s, s.amount); }
        if (rows.length < 500) break;
        cursor = rows[rows.length - 1].id;
      }
      cursor = '';
      for (;;) {
        const rows = await tx.customerPosting.findMany({ where: { id: { gt: cursor } },
          select: { id: true, customerId: true, sourceType: true, sourceId: true, currencyCode: true, effectiveAt: true, debit: true, credit: true },
          orderBy: { id: 'asc' }, take: 500 });
        for (const row of rows) {
          if (row.sourceType !== 'invoice' && row.sourceType !== 'voucher') {
            throw new Error(`Unexpected customer posting source: ${row.sourceType} (${row.id})`);
          }
          const s: PostingSource = { id: row.sourceId, customerId: row.customerId,
            currencyCode: row.currencyCode, kind: row.sourceType, date: row.effectiveAt, amount: zeros() };
          accumulate(actual, s, s.kind === 'invoice' ? row.debit.minus(row.credit) : row.credit.minus(row.debit));
        }
        if (rows.length < 500) break;
        cursor = rows[rows.length - 1].id;
      }

      type Total = { debit: Prisma.Decimal; credit: Prisma.Decimal };
      const totals = (values: Map<string, Prisma.Decimal>) => {
        const result = new Map<string, Total>();
        for (const [k, value] of values) {
          const s = sources.get(k)!;
          const bucket = JSON.stringify([s.customerId, s.currencyCode]);
          const sum = result.get(bucket) ?? { debit: zeros(), credit: zeros() };
          // Normalize adjustment/reversal rows to their source's net effect.
          // This matches the legacy derived statement's debit/credit columns.
          if (s.kind === 'invoice') sum.debit = sum.debit.plus(value);
          else sum.credit = sum.credit.plus(value);
          result.set(bucket, sum);
        }
        return result;
      };
      const expectedTotals = totals(expected);
      const postedTotals = totals(actual);
      const mismatches: Array<{ customerId: string; currencyCode: string; sourceType?: string; sourceId?: string; field: string; derived: string; posted: string }> = [];
      const sourceKeys = new Set([...expected.keys(), ...actual.keys()]);
      for (const k of sourceKeys) {
        const a = expected.get(k) ?? zeros();
        const b = actual.get(k) ?? zeros();
        if (!a.equals(b)) {
          const s = sources.get(k)!;
          mismatches.push({ customerId: s.customerId, currencyCode: s.currencyCode,
            sourceType: s.kind, sourceId: s.id, field: `source@${s.date.toISOString()}`,
            derived: a.toFixed(2), posted: b.toFixed(2) });
        }
      }
      for (const bucket of new Set([...expectedTotals.keys(), ...postedTotals.keys()])) {
        const [customerId, currencyCode] = JSON.parse(bucket) as [string, string];
        const a = expectedTotals.get(bucket) ?? { debit: zeros(), credit: zeros() };
        const b = postedTotals.get(bucket) ?? { debit: zeros(), credit: zeros() };
        for (const [field, left, right] of [
          ['totalDebit', a.debit, b.debit], ['totalCredit', a.credit, b.credit],
          ['closingBalance', a.debit.minus(a.credit), b.debit.minus(b.credit)],
        ] as const) {
          if (!left.equals(right)) mismatches.push({ customerId, currencyCode, field,
            derived: left.toFixed(2), posted: right.toFixed(2) });
        }
      }
      for (const s of sources.values()) {
        if (!persistedCustomers.has(s.customerId)) mismatches.push({
          customerId: s.customerId, currencyCode: s.currencyCode, sourceType: s.kind, sourceId: s.id,
          field: 'orphanCustomer', derived: 'customer exists', posted: 'customer missing',
        });
      }
      const affected = new Set(mismatches.map((m) => m.customerId).filter((id) => persistedCustomers.has(id)));
      return { checkedCustomers: persistedCustomers.size, matchedCustomers: persistedCustomers.size - affected.size,
        orphanCustomerIds: [...customerIds].filter((id) => !persistedCustomers.has(id)),
        checkedSources: sourceKeys.size, passed: mismatches.length === 0, mismatches };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000 });
  }
}
