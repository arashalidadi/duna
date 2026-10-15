import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toBase } from '../finance/financial-money';

const D = Prisma.Decimal;
const ZERO = new D(0);
export const REPORT_LIMIT = 3000;
export const money = (value: Prisma.Decimal | string | number) => new D(value).toFixed(2);

/** UTC calendar day bounds; half-open. Reject rollovers such as 2026-02-30. */
export function utcDay(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Date must be YYYY-MM-DD (UTC)');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Invalid UTC calendar date');
  }
  return date;
}
export function range(from: string, to: string) {
  const gte = utcDay(from), lt = new Date(utcDay(to).getTime() + 86400000);
  if (gte >= lt) throw new BadRequestException('From date must be on or before to date');
  return { gte, lt };
}
export function quarter(year: number, q: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(q) || q < 1 || q > 4) {
    throw new BadRequestException('Year must be 2000..2100 and quarter 1..4');
  }
  return { gte: new Date(Date.UTC(year, (q - 1) * 3, 1)), lt: new Date(Date.UTC(year, q * 3, 1)) };
}
export function bounded<T>(rows: T[], label: string): T[] {
  if (rows.length > REPORT_LIMIT) throw new ConflictException(`${label} exceeds ${REPORT_LIMIT} rows; narrow the date range or filters. No partial totals were returned.`);
  return rows;
}

export type MoneyFact = {
  id: string;
  kind: 'invoice' | 'cost';
  currencyCode: string;
  gross: Prisma.Decimal;
  vat: Prisma.Decimal;
  net: Prisma.Decimal;
  baseCurrencyCode: string | null;
  baseNet: Prisma.Decimal | null;
};

/** Original currencies are NEVER summed across ISO codes. Base totals appear
 * only if EVERY source has a stored/derivable snapshot in the SAME base unit. */
export function pnlTotals(facts: MoneyFact[]) {
  const groups = new Map<string, { gross: Prisma.Decimal; billedVat: Prisma.Decimal; income: Prisma.Decimal;
    cost: Prisma.Decimal; profit: Prisma.Decimal }>();
  const baseCodes = new Set(facts.map((f) => f.baseCurrencyCode).filter((c): c is string => !!c));
  const baseCurrencyCode = facts.length && baseCodes.size === 1 && facts.every((f) => f.baseNet !== null && f.baseCurrencyCode)
    ? [...baseCodes][0] : null;
  let baseIncome = ZERO, baseCost = ZERO;
  for (const f of facts) {
    const row = groups.get(f.currencyCode) ?? { gross: ZERO, billedVat: ZERO, income: ZERO, cost: ZERO, profit: ZERO };
    if (f.kind === 'invoice') {
      row.gross = row.gross.plus(f.gross);
      row.billedVat = row.billedVat.plus(f.vat);
      row.income = row.income.plus(f.net);
      if (baseCurrencyCode) baseIncome = baseIncome.plus(f.baseNet!);
    } else {
      row.cost = row.cost.plus(f.net);
      if (baseCurrencyCode) baseCost = baseCost.plus(f.baseNet!);
    }
    row.profit = row.income.minus(row.cost);
    groups.set(f.currencyCode, row);
  }
  return {
    byCurrency: [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([currencyCode, row]) => ({
      currencyCode, grossInvoiced: money(row.gross), billedVat: money(row.billedVat),
      netIncome: money(row.income), netCost: money(row.cost), netProfit: money(row.profit),
    })),
    base: baseCurrencyCode ? { currencyCode: baseCurrencyCode, income: money(baseIncome),
      cost: money(baseCost), profit: money(baseIncome.minus(baseCost)) } : null,
    conversionRule: 'One original-currency unit times its transaction-time approved or audited overridden rate. Base gross is rounded once; base VAT is rounded once; the residual belongs to net. No current/spot rate is used.',
    ...(facts.length && !baseCurrencyCode ? { warning: 'Base conversion unavailable or has mixed base currencies for at least one source; no combined cross-currency profit is shown.' } : {}),
  };
}

export function invoiceTax(invoice: {
  id: string; taxAmount: Prisma.Decimal; totalAmount?: Prisma.Decimal;
  items: { taxAmount: Prisma.Decimal | null }[];
}) {
  if (invoice.taxAmount.isNegative() ||
      (invoice.totalAmount && invoice.taxAmount.greaterThan(invoice.totalAmount)) ||
      invoice.items.some((line) => line.taxAmount?.isNegative())) {
    throw new ConflictException(`Invoice ${invoice.id}: VAT is outside its issued gross amount`);
  }
  const lined = invoice.items.length > 0 && invoice.items.every((i) => i.taxAmount !== null);
  if (!lined) return { amount: invoice.taxAmount, source: 'historic-header' as const };
  const amount = invoice.items.reduce((sum, line) => sum.plus(line.taxAmount!), ZERO);
  if (!amount.equals(invoice.taxAmount)) {
    throw new ConflictException(`Invoice ${invoice.id}: line VAT differs from issued header. Reporting blocked until reconciled.`);
  }
  return { amount, source: 'preserved-lines' as const };
}

/** Produces a base net amount from the ACTUAL gross snapshot, not a spot FX
 * lookup. Null historical snapshots remain unknown, even for same currency. */
export function invoiceBaseNet(invoice: {
  baseAmount: Prisma.Decimal | null; exchangeRate: Prisma.Decimal | null; baseCurrencyCode: string | null;
}, vat: Prisma.Decimal): Prisma.Decimal | null {
  if (!invoice.baseCurrencyCode || !invoice.baseAmount || !invoice.exchangeRate) return null;
  return invoice.baseAmount.minus(toBase(vat, invoice.exchangeRate));
}

export type VatEvent = {
  invoiceId: string; gross: Prisma.Decimal; tax: Prisma.Decimal; amount: Prisma.Decimal;
  currencyCode: string; voucherDate: Date; voucherId: string; allocationId: string;
};
/** Cash basis for identified invoice allocations: cumulative rounding ensures
 * part-payments sum to exactly the invoiced VAT at full payment. Refunds undo it.
 * B/L-only or unallocated cash must NEVER be inferred to settle an invoice. */
export function recognizedVat(events: VatEvent[]) {
  const sorted = [...events].sort((a, b) => a.voucherDate.getTime() - b.voucherDate.getTime() ||
    a.voucherId.localeCompare(b.voucherId) || a.allocationId.localeCompare(b.allocationId));
  const cumulative = new Map<string, Prisma.Decimal>();
  const lines = [] as Array<{ invoiceId: string; voucherId: string; allocationId: string; date: Date;
    currencyCode: string; paid: string; vat: string }>;
  for (const e of sorted) {
    if (e.gross.lessThanOrEqualTo(0)) throw new ConflictException(`Invoice ${e.invoiceId} has no positive total for VAT allocation`);
    const before = cumulative.get(e.invoiceId) ?? ZERO;
    const after = before.plus(e.amount);
    if (after.lessThan(0) || after.greaterThan(e.gross)) {
      throw new ConflictException(`Invoice ${e.invoiceId} settlement leaves the 0..gross range; VAT reporting blocked`);
    }
    const round = (paid: Prisma.Decimal) => paid.times(e.tax).div(e.gross).toDecimalPlaces(2, D.ROUND_HALF_UP);
    lines.push({ invoiceId: e.invoiceId, voucherId: e.voucherId, allocationId: e.allocationId,
      date: e.voucherDate, currencyCode: e.currencyCode, paid: money(e.amount), vat: money(round(after).minus(round(before))) });
    cumulative.set(e.invoiceId, after);
  }
  return lines;
}

export function currencySums(lines: { currencyCode: string; amount: Prisma.Decimal }[]) {
  const totals = new Map<string, Prisma.Decimal>();
  for (const line of lines) totals.set(line.currencyCode, (totals.get(line.currencyCode) ?? ZERO).plus(line.amount));
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currencyCode, amount]) => ({ currencyCode, amount: money(amount) }));
}
