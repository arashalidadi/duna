import { Prisma } from '@prisma/client';

/**
 * Phase 3 — per-line VAT (REQ-144, DEC-101, DEC-103).
 *
 * Money is computed in integer minor units (cents) so the arithmetic is exact:
 *   subtotal   = SUM(line.amount)
 *   taxable    = max(subtotal - discount, 0)            (unchanged formula, DEC-103)
 *   base_i     = taxable allocated to line i in proportion to its amount; the last line
 *                absorbs rounding so SUM(base_i) === taxable exactly
 *   tax_i      = line VAT: base_i x rate_i
 *   taxAmount  = SUM(tax_i)                             (header VAT = sum of line VAT)
 *   total      = taxable + taxAmount                    (unchanged formula)
 *
 * Rounding is per rate group: for lines that share one rate the group total is
 * round(taxable x rate), exactly the header figure the pre-Phase-3 code produced, and the
 * line VATs are adjusted to sum to it. Mixed-rate invoices round per group.
 */

export interface TaxLineInput {
  id: string;
  /** Line amount (quantity x unit price), 2 dp. */
  amount: number;
  /** Line VAT rate in percent, 0..100, 2 dp. */
  taxRate: number;
}

export interface TaxLineResult {
  id: string;
  taxAmount: number;
}

export interface InvoiceTaxResult {
  subtotal: number;
  taxable: number;
  taxAmount: number;
  total: number;
  lines: TaxLineResult[];
}

const toCents = (v: number): number => Math.round(v * 100);
const fromCents = (c: number): number => c / 100;

/** Percent with 2 dp -> basis points (integer). */
const toBasisPoints = (rate: number): number => Math.round(rate * 100);

/** cents x basis points / 10000 -> cents, rounded half-up for non-negative values. */
const applyRateCents = (baseCents: number, rateBp: number): number =>
  Math.round((baseCents * rateBp) / 10000);

export function computeInvoiceTax(lines: TaxLineInput[], discount: number): InvoiceTaxResult {
  const amountsC = lines.map((l) => toCents(l.amount));
  const subtotalC = amountsC.reduce((s, a) => s + a, 0);
  const discountC = toCents(discount);
  const taxableC = Math.max(subtotalC - discountC, 0);

  // 1) Allocate the taxable base to lines.
  const baseC: number[] = [];
  let allocated = 0;
  lines.forEach((_, i) => {
    const isLast = i === lines.length - 1;
    const b = isLast
      ? taxableC - allocated
      : subtotalC > 0
        ? Math.floor((amountsC[i] * taxableC) / subtotalC)
        : 0;
    baseC.push(b);
    allocated += b;
  });

  // 2) Group by rate. Group VAT = round(group base x rate); line VATs are adjusted to match.
  const rateBp = lines.map((l) => toBasisPoints(l.taxRate));
  const groups = new Map<number, number[]>();
  lines.forEach((_, i) => {
    const idx = groups.get(rateBp[i]) ?? [];
    idx.push(i);
    groups.set(rateBp[i], idx);
  });

  const taxC: number[] = lines.map(() => 0);
  for (const [bp, idxs] of groups) {
    const groupBase = idxs.reduce((s, i) => s + baseC[i], 0);
    const groupTax = applyRateCents(groupBase, bp);
    let assigned = 0;
    idxs.forEach((i, k) => {
      if (k === idxs.length - 1) {
        taxC[i] = groupTax - assigned;
      } else {
        taxC[i] = applyRateCents(baseC[i], bp);
        assigned += taxC[i];
      }
    });
  }

  const taxAmountC = taxC.reduce((s, t) => s + t, 0);
  return {
    subtotal: fromCents(subtotalC),
    taxable: fromCents(taxableC),
    taxAmount: fromCents(taxAmountC),
    total: fromCents(taxableC + taxAmountC),
    lines: lines.map((l, i) => ({ id: l.id, taxAmount: fromCents(taxC[i]) })),
  };
}

const money = (v: number): Prisma.Decimal => new Prisma.Decimal(v.toFixed(2));

/**
 * Recompute a DRAFT invoice's line VAT and header money from its lines and writes them.
 * Callers must only use this on DRAFT invoices: issued money is never re-derived (DEC-023).
 * Line rates that are NULL fall back to the header rate (legacy single-rate invoices).
 */
export async function recomputeInvoiceTax(
  tx: Prisma.TransactionClient,
  invoiceId: string,
): Promise<InvoiceTaxResult> {
  const header = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { taxRate: true, discountAmount: true },
  });
  const items = await tx.invoiceItem.findMany({
    where: { invoiceId },
    select: { id: true, amount: true, taxRate: true },
    orderBy: { sequence: 'asc' },
  });

  const headerRate = Number(header.taxRate ?? 0);
  const result = computeInvoiceTax(
    items.map((it) => ({
      id: it.id,
      amount: Number(it.amount),
      taxRate: it.taxRate === null ? headerRate : Number(it.taxRate),
    })),
    Number(header.discountAmount ?? 0),
  );

  for (const line of result.lines) {
    await tx.invoiceItem.update({
      where: { id: line.id },
      data: { taxAmount: money(line.taxAmount) },
    });
  }

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      subtotal: money(result.subtotal),
      taxAmount: money(result.taxAmount),
      totalAmount: money(result.total),
    },
  });

  return result;
}
