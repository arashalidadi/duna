import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { VoucherService } from '../voucher/voucher.service';
import { bounded, currencySums, invoiceBaseNet, invoiceTax, money, pnlTotals,
  quarter, range, recognizedVat, REPORT_LIMIT, utcDay, type MoneyFact, type VatEvent } from './report-math';

const ZERO = new Prisma.Decimal(0);
const amtOrNull = (amount: Prisma.Decimal | null) => amount ? money(amount) : null;
const invoiceSource = {
  id: true, invoiceNumber: true, customerId: true, status: true, issueDate: true, createdAt: true,
  voyageId: true, currencyCode: true, totalAmount: true, taxAmount: true, dueDate: true, paidAmount: true,
  baseAmount: true, baseCurrencyCode: true, exchangeRate: true, rateEffectiveAt: true,
  rateSource: true, currencyRateId: true, rateOverrideReason: true,
  items: { select: { id: true, taxAmount: true } },
  correctionAsReplacement: { select: { id: true, originalInvoiceId: true, reason: true, appliedAt: true } },
  correctionsAsOriginal: { select: { id: true, replacementInvoiceId: true, reason: true, appliedAt: true } },
  billOfLading: { select: { id: true, billNumber: true, voyageId: true, manifestId: true, status: true } },
  billLinks: { select: { billOfLading: { select: { id: true, billNumber: true, voyageId: true, manifestId: true, status: true } } } },
} satisfies Prisma.InvoiceSelect;

type SourceInvoice = Prisma.InvoiceGetPayload<{ select: typeof invoiceSource }>;

@Injectable()
export class StandardReportsService {
  constructor(private readonly prisma: PrismaService, private readonly vouchers: VoucherService,
    private readonly audit: AuditService) {}

  private readonly snapshotOptions = { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    maxWait: 5000, timeout: 45000 };

  /** Operational, journal-backed cost + issued-invoice income summary. Not the
   * statutory general ledger: invoices only have a customer shadow posting.
   * Manifest-year filters group LIFETIME costs/income by manifest document date. */
  async pnl(query: { year?: number; voyageId?: string }) {
    return this.prisma.$transaction((tx) => this.pnlSnapshot(query, tx), this.snapshotOptions);
  }

  private async pnlSnapshot(query: { year?: number; voyageId?: string }, tx: Prisma.TransactionClient) {
    if (!query.voyageId && !query.year) throw new BadRequestException('Select a year or voyage');
    if (query.year && (!Number.isInteger(query.year) || query.year < 2000 || query.year > 2100)) {
      throw new BadRequestException('Year must be between 2000 and 2100');
    }
    const yearStart = query.year ? new Date(Date.UTC(query.year, 0, 1)) : null;
    const yearEnd = query.year ? new Date(Date.UTC(query.year + 1, 0, 1)) : null;
    const dateClause = yearStart && yearEnd ? { gte: yearStart, lt: yearEnd } : undefined;
    const manifests = bounded(await tx.manifest.findMany({
      where: {
        deletedAt: null, status: { not: 'CANCELLED' },
        ...(query.voyageId ? { voyageId: query.voyageId } : {}),
        ...(dateClause ? { OR: [
          { manifestDate: dateClause },
          { manifestDate: null, voyage: { plannedDepartureAt: dateClause } },
          { manifestDate: null, voyage: { plannedDepartureAt: null }, createdAt: dateClause },
        ] } : {}),
      },
      select: { id: true, manifestNumber: true, manifestDate: true, createdAt: true,
        voyageId: true, voyage: { select: { voyageNumber: true, plannedDepartureAt: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: REPORT_LIMIT + 1,
    }), 'Manifest P&L');
    if (query.voyageId && manifests.length === 0 && !query.year) {
      const voyage = await tx.voyage.findUnique({ where: { id: query.voyageId },
        select: { id: true, voyageNumber: true, plannedDepartureAt: true } });
      if (!voyage) throw new NotFoundException('Voyage not found');
      manifests.push({ id: '', manifestNumber: '', voyageId: voyage.id, manifestDate: null,
        createdAt: voyage.plannedDepartureAt ?? new Date(0), voyage: {
          voyageNumber: voyage.voyageNumber, plannedDepartureAt: voyage.plannedDepartureAt,
        } });
    }
    const voyageIds = [...new Set(manifests.map((m) => m.voyageId))];
    if (!voyageIds.length) return { kind: 'operational-pnl-summary', year: query.year ?? null, rows: [],
      annual: pnlTotals([]), complete: false,
      reconciliation: 'No matching manifests; no source amounts and no zero-profit assertion.' };
    const bills = bounded(await tx.billOfLading.findMany({
      where: { voyageId: { in: voyageIds } }, select: { id: true }, take: REPORT_LIMIT + 1,
    }), 'Voyage B/Ls');
    const billIds = bills.map((b) => b.id);
    const [invoices, costs] = await Promise.all([
      bounded(await tx.invoice.findMany({
        where: { status: 'ISSUED', deletedAt: null, OR: [
          { billOfLadingId: { in: billIds } },
          { billLinks: { some: { billOfLadingId: { in: billIds } } } },
        ] }, select: invoiceSource, orderBy: [{ issueDate: 'asc' }, { id: 'asc' }],
        take: REPORT_LIMIT + 1,
      }), 'P&L invoices'),
      bounded(await tx.voyageCost.findMany({
        where: { voyageId: { in: voyageIds } }, include: { journal: { include: {
          lines: { select: { id: true, accountId: true, debit: true, credit: true, baseDebit: true, baseCredit: true } },
          inputTax: true,
        } } }, take: REPORT_LIMIT + 1,
      }), 'P&L costs'),
    ]);
    const invoiceIds = invoices.map((i) => i.id);
    const [postings, allocations, unlinked] = await Promise.all([
      bounded(await tx.customerPosting.findMany({ where: {
        sourceType: 'invoice', sourceId: { in: invoiceIds },
      }, select: { id: true, sourceId: true, eventKey: true, debit: true }, take: REPORT_LIMIT + 1 }), 'P&L postings'),
      bounded(await tx.voucherAllocation.findMany({ where: { invoiceId: { in: invoiceIds } },
        select: { id: true, invoiceId: true, voucherId: true, amount: true, reversedAt: true },
        take: REPORT_LIMIT + 1 }), 'P&L allocations'),
      bounded(await tx.invoice.findMany({ where: { status: 'ISSUED', deletedAt: null,
        voyageId: { in: voyageIds }, billOfLadingId: null, billLinks: { none: {} } },
        select: { id: true, invoiceNumber: true, voyageId: true }, take: REPORT_LIMIT + 1 }), 'Unlinked P&L invoices'),
    ]);
    const byVoyage = new Map(voyageIds.map((id) => [id, { facts: [] as MoneyFact[],
      sources: [] as Record<string, unknown>[], warnings: [] as string[] }]));
    const sourcePosting = new Map(postings.map((p) => [p.sourceId, p]));
    for (const invoice of invoices) {
      const bs = [...invoice.billLinks.map((l) => l.billOfLading),
        ...(invoice.billOfLading ? [invoice.billOfLading] : [])];
      const uniqueBills = [...new Map(bs.map((b) => [b.id, b])).values()];
      const voyages = [...new Set(uniqueBills.map((b) => b.voyageId))];
      if (voyages.length !== 1 || (invoice.voyageId && invoice.voyageId !== voyages[0])) {
        throw new ConflictException(`Invoice ${invoice.invoiceNumber} has inconsistent voyage B/L links; P&L cannot be reconciled`);
      }
      const group = byVoyage.get(voyages[0]);
      if (!group) continue;
      const selectedManifest = manifests.find((m) => m.voyageId === voyages[0])?.id;
      const manifestLinks = [...new Set(uniqueBills.map((b) => b.manifestId).filter((id): id is string => !!id))];
      if (selectedManifest && manifestLinks.some((id) => id !== selectedManifest)) {
        group.warnings.push(`Invoice ${invoice.invoiceNumber} has a B/L attached to another manifest. Income is unassigned here; reconcile the B/L source before publishing P&L.`);
        continue;
      }
      const tax = invoiceTax(invoice);
      const net = invoice.totalAmount.minus(tax.amount);
      const baseNet = invoiceBaseNet(invoice, tax.amount);
      group.facts.push({ id: invoice.id, kind: 'invoice', currencyCode: invoice.currencyCode,
        gross: invoice.totalAmount, vat: tax.amount, net,
        baseCurrencyCode: invoice.baseCurrencyCode, baseNet });
      const posting = sourcePosting.get(invoice.id);
      if (!posting || !posting.debit.equals(invoice.totalAmount)) group.warnings.push(
        `Invoice ${invoice.invoiceNumber} has no matching customer shadow posting; it is NOT a general-journal entry.`);
      if (tax.source === 'historic-header') group.warnings.push(
        `Invoice ${invoice.invoiceNumber}: pre-line-tax issue; VAT uses its preserved header, not invented line tax.`);
      group.sources.push({ kind: 'invoice', id: invoice.id, number: invoice.invoiceNumber,
        billIds: uniqueBills.map((b) => b.id),
        gross: money(invoice.totalAmount), vat: money(tax.amount), net: money(net),
        taxSource: tax.source, currencyCode: invoice.currencyCode, baseCurrencyCode: invoice.baseCurrencyCode,
        baseNet: baseNet ? money(baseNet) : null, exchangeRate: invoice.exchangeRate?.toString() ?? null,
        rateEffectiveAt: invoice.rateEffectiveAt, rateSource: invoice.rateSource,
        currencyRateId: invoice.currencyRateId, rateOverrideReason: invoice.rateOverrideReason,
        customerPostingId: posting?.id ?? null, generalJournalId: null,
        correctedFrom: invoice.correctionAsReplacement?.originalInvoiceId ?? null,
        correctionIds: [...invoice.correctionsAsOriginal.map((c) => c.id),
          ...(invoice.correctionAsReplacement ? [invoice.correctionAsReplacement.id] : [])],
        allocationIds: allocations.filter((a) => a.invoiceId === invoice.id).map((a) => a.id) });
    }
    for (const missing of unlinked) byVoyage.get(missing.voyageId!)?.warnings.push(
      `Issued invoice ${missing.invoiceNumber} has no B/L link. Excluded from P&L until source attribution is corrected.`);
    for (const cost of costs) {
      const group = byVoyage.get(cost.voyageId)!;
      const j = cost.journal;
      const selectedManifest = manifests.find((m) => m.voyageId === cost.voyageId)?.id;
      if (selectedManifest && cost.manifestId && cost.manifestId !== selectedManifest) {
        group.warnings.push(`Cost journal ${j.journalNumber} belongs to another manifest; excluded from this manifest's P&L.`);
        continue;
      }
      if (j.reversedAt) {
        group.warnings.push(`Reversed cost journal ${j.journalNumber} excluded; see journal reversal and audit history.`);
        continue;
      }
      group.facts.push({ id: cost.id, kind: 'cost', currencyCode: j.currencyCode,
        gross: cost.netAmount.plus(j.inputTax?.amount ?? ZERO), vat: j.inputTax?.amount ?? ZERO,
        net: cost.netAmount, baseCurrencyCode: j.baseCurrencyCode, baseNet: cost.baseNetAmount });
      if (!j.inputTax) group.warnings.push(`Cost ${cost.id} has no input VAT classification; paid VAT is unknown, not zero.`);
      group.sources.push({ kind: 'cost', id: cost.id, journalId: j.id, journalNumber: j.journalNumber,
        journalLineIds: j.lines.map((line) => line.id), categoryId: cost.categoryId,
        categoryCode: cost.categoryCodeSnapshot, categoryName: cost.categoryNameSnapshot,
        gross: money(cost.netAmount.plus(j.inputTax?.amount ?? ZERO)),
        inputVat: j.inputTax ? money(j.inputTax.amount) : null, net: money(cost.netAmount),
        currencyCode: j.currencyCode, baseCurrencyCode: j.baseCurrencyCode,
        baseNet: money(cost.baseNetAmount), exchangeRate: j.exchangeRate.toString(),
        rateEffectiveAt: j.rateEffectiveAt, rateSource: j.rateSource,
        currencyRateId: j.currencyRateId, rateOverrideReason: j.rateOverrideReason,
        taxPaidAt: j.inputTax?.paidAt ?? null });
    }
    const rows = manifests.map((manifest) => {
      const group = byVoyage.get(manifest.voyageId)!;
      return { voyageId: manifest.voyageId, voyageNumber: manifest.voyage.voyageNumber,
        manifestId: manifest.id || null, manifestNumber: manifest.manifestNumber || null,
        periodDate: manifest.manifestDate ?? manifest.voyage.plannedDepartureAt ?? manifest.createdAt,
        dateBasis: manifest.manifestDate ? 'manifestDate' : manifest.voyage.plannedDepartureAt ? 'plannedDepartureAt' : 'manifestCreatedAt',
        ...pnlTotals(group.facts), sources: group.sources, warnings: group.warnings,
        reconciled: group.warnings.length === 0 && !pnlTotals(group.facts).warning };
    });
    // A second live manifest for the same voyage would double-count ALL income
    // and costs: fail closed instead of displaying duplicated annual totals.
    if (new Set(rows.map((r) => r.voyageId)).size !== rows.length) {
      throw new ConflictException('Multiple live manifests for one voyage; P&L blocked until source data is reconciled');
    }
    const allFacts = voyageIds.flatMap((id) => byVoyage.get(id)!.facts);
    return { kind: 'operational-pnl-summary', year: query.year ?? null, rows,
      annual: pnlTotals(allFacts),
      reconciliation: 'Gross invoiced minus preserved issued VAT = net income; journal-backed net costs (excluding recorded input VAT) = expenses; profit = net income minus net costs. Income is counted once per voyage even when linked to multiple B/Ls. Invoice shadow postings are NOT general ledger entries. This is a current-state snapshot, not a historical filing; reversals and corrections can restate prior manifest-year views. Warnings mark excluded or unknown facts.',
      complete: rows.every((r) => r.reconciled) };
  }

  /** Cash VAT on explicitly allocated receipts/refunds, plus billed VAT and
   * explicitly PAID input VAT on expense journals. Never called a tax return. */
  async vat(year: number, q: number) {
    return this.prisma.$transaction((tx) => this.vatSnapshot(year, q, tx), this.snapshotOptions);
  }

  private async vatSnapshot(year: number, q: number, tx: Prisma.TransactionClient) {
    const period = quarter(year, q);
    const [billed, allocations, legacy, input, unclassified, receipts] = await Promise.all([
      bounded(await tx.invoice.findMany({ where: { status: 'ISSUED', deletedAt: null,
        OR: [{ issueDate: period }, { issueDate: null, issuedAt: period },
          { issueDate: null, issuedAt: null, createdAt: period }] },
        select: invoiceSource, take: REPORT_LIMIT + 1 }), 'Billed VAT invoices'),
      bounded(await tx.voucherAllocation.findMany({ where: { reversedAt: null, invoiceId: { not: null },
        voucher: { status: 'POSTED', deletedAt: null, voucherDate: { lt: period.lt } } },
        select: { id: true, invoiceId: true, voucherId: true, amount: true,
          voucher: { select: { type: true, status: true, currencyCode: true, voucherDate: true,
            rateSource: true, rateEffectiveAt: true, currencyRateId: true, baseAmount: true,
            adjustments: { select: { id: true } } } },
          invoice: { select: invoiceSource } }, take: REPORT_LIMIT + 1 }), 'VAT voucher allocations'),
      bounded(await tx.voucher.findMany({ where: { invoiceId: { not: null }, allocations: { none: {} },
        status: 'POSTED', deletedAt: null, voucherDate: { lt: period.lt } },
        select: { id: true, invoiceId: true, amount: true, currencyCode: true, voucherDate: true, type: true,
          adjustments: { select: { id: true } }, invoice: { select: invoiceSource } },
        take: REPORT_LIMIT + 1 }), 'Historic direct voucher links'),
      bounded(await tx.expenseInputTax.findMany({ where: { paidAt: period,
        journal: { reversedAt: null } }, include: { journal: { select: { id: true, journalNumber: true,
          currencyCode: true, baseCurrencyCode: true, exchangeRate: true, currencyRateId: true,
          rateSource: true, rateEffectiveAt: true, lines: { select: { id: true } } } } }, take: REPORT_LIMIT + 1 }), 'Input VAT expenses'),
      tx.generalJournal.count({ where: { kind: { in: ['OFFICE_EXPENSE', 'VOYAGE_COST'] },
        reversedAt: null, journalDate: { lt: period.lt }, inputTax: null } }),
      bounded(await tx.voucher.findMany({ where: { status: 'POSTED', deletedAt: null, type: 'RECEIPT',
        voucherDate: period }, select: { id: true, currencyCode: true, amount: true,
        invoiceId: true, invoice: { select: { status: true } }, allocations: { where: { reversedAt: null },
          select: { invoiceId: true, amount: true, invoice: { select: { status: true } } } } },
        take: REPORT_LIMIT + 1 }), 'VAT receipts'),
    ]);
    const billedLines = billed.map((invoice) => {
      const tax = invoiceTax(invoice);
      return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber,
        amount: money(tax.amount), currencyCode: invoice.currencyCode, source: tax.source,
        lineIds: invoice.items.map((i) => i.id),
        correctedFrom: invoice.correctionAsReplacement?.originalInvoiceId ?? null,
        correctionIds: [...invoice.correctionsAsOriginal.map((c) => c.id),
          ...(invoice.correctionAsReplacement ? [invoice.correctionAsReplacement.id] : [])] };
    });
    const events: VatEvent[] = [];
    const allocationRefs: Record<string, unknown>[] = [];
    let skippedAllocations = 0;
    const insert = (invoice: SourceInvoice | null, row: { id: string; voucherId: string; amount: Prisma.Decimal;
      currencyCode: string; voucherDate: Date; type: 'RECEIPT' | 'PAYMENT'; rateSource?: string | null;
      rateEffectiveAt?: Date | null; currencyRateId?: string | null; baseAmount?: Prisma.Decimal | null;
      adjustmentIds?: string[] }) => {
      if (!invoice || invoice.status !== 'ISSUED') { skippedAllocations++; return; } // no tax on cancelled documents
      if (invoice.currencyCode !== row.currencyCode) {
        throw new ConflictException(`Voucher ${row.voucherId} currency disagrees with invoice ${invoice.id}`);
      }
      const tax = invoiceTax(invoice);
      events.push({ invoiceId: invoice.id, gross: invoice.totalAmount, tax: tax.amount,
        amount: row.type === 'RECEIPT' ? row.amount : row.amount.negated(), currencyCode: invoice.currencyCode,
        voucherDate: row.voucherDate, voucherId: row.voucherId, allocationId: row.id });
      allocationRefs.push({ allocationId: row.id, voucherId: row.voucherId, invoiceId: invoice.id,
        amount: money(row.amount), voucherType: row.type, rateSource: row.rateSource ?? null,
        rateEffectiveAt: row.rateEffectiveAt ?? null, currencyRateId: row.currencyRateId ?? null,
        baseAmount: row.baseAmount ? money(row.baseAmount) : null,
        adjustmentIds: row.adjustmentIds ?? [],
        correctedFrom: invoice.correctionAsReplacement?.originalInvoiceId ?? null });
    };
    for (const a of allocations) insert(a.invoice, { id: a.id, voucherId: a.voucherId, amount: a.amount,
      currencyCode: a.voucher.currencyCode, voucherDate: a.voucher.voucherDate, type: a.voucher.type,
      rateSource: a.voucher.rateSource, rateEffectiveAt: a.voucher.rateEffectiveAt,
      currencyRateId: a.voucher.currencyRateId, baseAmount: a.voucher.baseAmount,
      adjustmentIds: a.voucher.adjustments.map((adj) => adj.id) });
    for (const v of legacy) insert(v.invoice, { id: `legacy:${v.id}`, voucherId: v.id, amount: v.amount,
      currencyCode: v.currencyCode, voucherDate: v.voucherDate, type: v.type,
      adjustmentIds: v.adjustments.map((adj) => adj.id) });
    const recognized = recognizedVat(events).filter((e) => e.date >= period.gte && e.date < period.lt);
    const paid = input.filter((i) => i.amount.greaterThan(0)).map((i) => ({
      taxRecordId: i.id, journalId: i.journalId, journalNumber: i.journal.journalNumber,
      journalLineIds: i.journal.lines.map((l) => l.id), paidAt: i.paidAt,
      amount: money(i.amount), baseAmount: money(i.baseAmount), currencyCode: i.journal.currencyCode,
      baseCurrencyCode: i.journal.baseCurrencyCode, rateSource: i.journal.rateSource,
      rateEffectiveAt: i.journal.rateEffectiveAt, currencyRateId: i.journal.currencyRateId,
      exchangeRate: i.journal.exchangeRate.toString(),
    }));
    const unassigned = receipts.map((v) => ({ id: v.id, currencyCode: v.currencyCode,
      amount: v.amount.minus(v.allocations.filter((a) => a.invoiceId && a.invoice?.status === 'ISSUED')
        .reduce((sum, a) => sum.plus(a.amount), ZERO))
        .minus(v.allocations.length === 0 && v.invoiceId && v.invoice?.status === 'ISSUED' ? v.amount : ZERO) }))
      .filter((v) => v.amount.greaterThan(0));
    const billedTotals = currencySums(billedLines.map((line) => ({ currencyCode: line.currencyCode, amount: new Prisma.Decimal(line.amount) })));
    const collectedTotals = currencySums(recognized.map((line) => ({ currencyCode: line.currencyCode, amount: new Prisma.Decimal(line.vat) })));
    const paidTotals = currencySums(paid.map((line) => ({ currencyCode: line.currencyCode, amount: new Prisma.Decimal(line.amount) })));
    const codes = [...new Set([...billedTotals, ...collectedTotals, ...paidTotals].map((l) => l.currencyCode))].sort();
    const totals = codes.map((currencyCode) => {
      const collected = collectedTotals.find((r) => r.currencyCode === currencyCode)?.amount ?? '0.00';
      const paidAmount = paidTotals.find((r) => r.currencyCode === currencyCode)?.amount ?? '0.00';
      return { currencyCode, billed: billedTotals.find((r) => r.currencyCode === currencyCode)?.amount ?? '0.00',
        collected, paid: paidAmount, difference: money(new Prisma.Decimal(collected).minus(paidAmount)) };
    });
    return { kind: 'recorded-vat-reconciliation-not-tax-return', year, quarter: q,
      period, totals, billed: billedLines, collected: recognized, paid,
      allocationSources: allocationRefs.filter((a) => recognized.some((r) => r.allocationId === a.allocationId)),
      unassignedReceipts: currencySums(unassigned), unclassifiedExpenseCount: unclassified,
      skippedAllocations,
      complete: unassigned.length === 0 && unclassified === 0 && skippedAllocations === 0 &&
        billedLines.every((l) => l.source === 'preserved-lines'),
      basis: 'Collected VAT is invoice tax times cumulative active invoice-specific receipt allocations / issued gross, rounded per cumulative payment; refunds subtract. Allocation state is current (prior quarters may restate after reallocation). B/L-only and unallocated cash is not assumed to settle an invoice. Paid VAT is explicitly dated input VAT on unreversed expense journals; absent tax classifications are unknown (including earlier unclassified expenses). Amounts stay separated by original currency; no unsupported FX conversion or legal VAT liability asserted.' };
  }

  async overdue(asOf: string) {
    return this.prisma.$transaction((tx) => this.overdueSnapshot(asOf, tx), this.snapshotOptions);
  }

  private async overdueSnapshot(asOf: string, tx: Prisma.TransactionClient) {
    const cutoff = new Date(utcDay(asOf).getTime() + 86400000);
    const rows = bounded(await tx.invoice.findMany({ where: { status: 'ISSUED', deletedAt: null,
      dueDate: { lt: cutoff }, paidAmount: { lt: tx.invoice.fields.totalAmount } },
      select: { id: true, invoiceNumber: true, customerId: true, dueDate: true,
        currencyCode: true, totalAmount: true, paidAmount: true, voyageId: true,
        baseCurrencyCode: true, baseAmount: true, exchangeRate: true, rateEffectiveAt: true,
        rateSource: true, currencyRateId: true,
        allocations: { where: { reversedAt: null, voucher: { status: 'POSTED', deletedAt: null } },
          select: { id: true, voucherId: true, amount: true, voucher: { select: { type: true } } } },
      }, orderBy: [{ dueDate: 'asc' }, { id: 'asc' }], take: REPORT_LIMIT + 1 }), 'Overdue invoices');
    const ids = rows.map((r) => r.id);
    const [postings, legacy] = await Promise.all([
      bounded(await tx.customerPosting.findMany({ where: { sourceType: 'invoice', sourceId: { in: ids } },
        select: { id: true, sourceId: true }, take: REPORT_LIMIT + 1 }), 'Overdue source postings'),
      bounded(await tx.voucher.findMany({ where: { invoiceId: { in: ids }, status: 'POSTED',
        deletedAt: null, allocations: { none: {} } }, select: { id: true, invoiceId: true,
          amount: true, type: true }, take: REPORT_LIMIT + 1 }), 'Historic invoice vouchers'),
    ]);
    const output = rows.map((r) => {
      const old = legacy.filter((v) => v.invoiceId === r.id);
      const settled = [...r.allocations.map((a) => ({ amount: a.amount, type: a.voucher.type })), ...old]
        .reduce((sum, a) => a.type === 'RECEIPT' ? sum.plus(a.amount) : sum.minus(a.amount), ZERO);
      return { invoiceId: r.id, invoiceNumber: r.invoiceNumber, customerId: r.customerId,
        voyageId: r.voyageId, dueDate: r.dueDate, currencyCode: r.currencyCode,
        total: money(r.totalAmount), paid: money(r.paidAmount),
        unpaid: money(r.totalAmount.minus(r.paidAmount)),
        paidAmountReconciled: settled.equals(r.paidAmount),
        trace: { customerPostingIds: postings.filter((p) => p.sourceId === r.id).map((p) => p.id),
          allocationIds: r.allocations.map((a) => a.id), legacyVoucherIds: old.map((v) => v.id),
          baseCurrencyCode: r.baseCurrencyCode, baseAmount: amtOrNull(r.baseAmount),
          exchangeRate: r.exchangeRate?.toString() ?? null, rateEffectiveAt: r.rateEffectiveAt,
          rateSource: r.rateSource, currencyRateId: r.currencyRateId, generalJournalId: null },
      };
    });
    return { kind: 'overdue-as-of-current-balance', asOf, rows: output,
      totals: currencySums(rows.map((r) => ({ currencyCode: r.currencyCode,
        amount: r.totalAmount.minus(r.paidAmount) }))),
      reconciled: output.every((r) => r.paidAmountReconciled),
      basis: 'Due date before end of selected UTC day, compared to CURRENT paidAmount. Original currency only. Allocation/refund IDs and preserved FX snapshot are exposed; invoice customer postings are NOT general-journal entries. Mismatches are flagged, not silently adjusted. This is not a historic as-of receivables snapshot.' };
  }

  async releases(from: string, to: string, unpaidOnly = false) {
    return this.prisma.$transaction((tx) => this.releasesSnapshot(from, to, unpaidOnly, tx), this.snapshotOptions);
  }

  private async releasesSnapshot(from: string, to: string, unpaidOnly: boolean, tx: Prisma.TransactionClient) {
    const period = range(from, to);
    const releases = bounded(await tx.releaseOrder.findMany({ where: { status: 'ISSUED', deletedAt: null,
      releaseDate: period }, include: { billOfLading: { select: { id: true, billNumber: true, manifestId: true,
        voyageId: true, consigneeId: true, items: { select: { id: true, goodsDescription: true, packages: true } } } } },
      orderBy: [{ releaseDate: 'asc' }, { id: 'asc' }], take: REPORT_LIMIT + 1 }), 'Release report');
    const billIds = releases.map((r) => r.billOfLadingId);
    const invoices = bounded(await tx.invoice.findMany({ where: { status: 'ISSUED', deletedAt: null,
      OR: [{ billOfLadingId: { in: billIds } }, { billLinks: { some: { billOfLadingId: { in: billIds } } } }] },
      select: { id: true, invoiceNumber: true, currencyCode: true, totalAmount: true, paidAmount: true,
        baseAmount: true, baseCurrencyCode: true, exchangeRate: true, rateSource: true,
        rateEffectiveAt: true, currencyRateId: true,
        allocations: { where: { reversedAt: null }, select: { id: true, voucherId: true } },
        billOfLadingId: true, billLinks: { select: { billOfLadingId: true } } },
      take: REPORT_LIMIT + 1 }), 'Release invoices');
    const rows = releases.map((r) => {
      const linked = invoices.filter((i) => i.billOfLadingId === r.billOfLadingId ||
        i.billLinks.some((b) => b.billOfLadingId === r.billOfLadingId));
      const outstanding = linked.filter((i) => i.paidAmount.lessThan(i.totalAmount));
      return { releaseId: r.id, releaseNumber: r.docNumber, releaseDate: r.releaseDate,
        paymentStateAtRelease: r.paymentState, financialOverride: r.financialOverride,
        overrideReason: r.overrideReason, billId: r.billOfLadingId, billNumber: r.billOfLading.billNumber,
        manifestId: r.billOfLading.manifestId, voyageId: r.billOfLading.voyageId,
        consigneeId: r.billOfLading.consigneeId, items: r.billOfLading.items,
        invoiceBalances: linked.map((i) => ({ invoiceId: i.id, number: i.invoiceNumber,
          currencyCode: i.currencyCode, outstanding: money(i.totalAmount.minus(i.paidAmount)),
          total: money(i.totalAmount), paid: money(i.paidAmount),
          allocationIds: i.allocations.map((a) => a.id), baseAmount: amtOrNull(i.baseAmount),
          baseCurrencyCode: i.baseCurrencyCode, exchangeRate: i.exchangeRate?.toString() ?? null,
          rateSource: i.rateSource, rateEffectiveAt: i.rateEffectiveAt, currencyRateId: i.currencyRateId,
          generalJournalId: null })),
        unpaidNow: outstanding.length > 0, invoiceCount: linked.length,
        unidentifiedPayment: linked.length === 0 };
    });
    return { kind: unpaidOnly ? 'released-unpaid-now' : 'release-history', from, to,
      rows: unpaidOnly ? rows.filter((r) => r.unpaidNow || r.unidentifiedPayment) : rows,
      basis: 'Release payment state is the user-recorded state AT RELEASE. Linked issued-invoice balances are CURRENT; an unlinked B/L is flagged unknown, never labelled paid. Cancelled/deleted releases excluded.' };
  }

  async statement(customerId: string, currencyCode: string, from: string, to: string) {
    return this.prisma.$transaction((tx) => this.statementSnapshot(customerId, currencyCode, from, to, tx),
      this.snapshotOptions);
  }

  private async statementSnapshot(customerId: string, currencyCode: string, from: string, to: string,
    tx: Prisma.TransactionClient) {
    if (!/^[A-Z]{3}$/.test(currencyCode)) throw new BadRequestException('One currencyCode is required');
    const period = range(from, to);
    const [invoices, vouchers] = await Promise.all([
      tx.invoice.count({ where: { customerId, currencyCode, status: 'ISSUED', deletedAt: null,
        OR: [{ issueDate: { lt: period.lt } }, { issueDate: null, createdAt: { lt: period.lt } }] } }),
      tx.voucher.count({ where: { customerId, currencyCode, status: 'POSTED', deletedAt: null,
        voucherDate: { lt: period.lt } } }),
    ]);
    if (invoices + vouchers > REPORT_LIMIT) throw new ConflictException('Statement exceeds safe source limit; shorten range or use the dedicated statement endpoint. No partial totals returned.');
    // Existing derived statement preserves legacy voucher sign (including PAYMENT)
    // for Phase 6 parity. It is a balance statement, NEVER the general ledger.
    const [result, opening] = await Promise.all([
      this.vouchers.ledger({ customerId, currencyCode, fromDate: period.gte.toISOString(),
        toDate: new Date(period.lt.getTime() - 1).toISOString() }, tx),
      this.vouchers.ledger({ customerId, currencyCode,
        toDate: new Date(period.gte.getTime() - 1).toISOString() }, tx),
    ]);
    if (result.summary.openingBalance !== opening.summary.closingBalance) {
      throw new ConflictException('Opening statement balance changed during reporting; retry for a consistent view');
    }
    const all = [...opening.entries, ...result.entries];
    const invIds = all.flatMap((e) => e.invoiceId ? [e.invoiceId] : []);
    const vchIds = all.flatMap((e) => e.voucherId ? [e.voucherId] : []);
    const [invSources, voucherSources, postings] = await Promise.all([
      tx.invoice.findMany({ where: { id: { in: invIds } }, select: {
        id: true, invoiceNumber: true, currencyCode: true, totalAmount: true,
        baseAmount: true, baseCurrencyCode: true, exchangeRate: true,
        rateSource: true, rateEffectiveAt: true, currencyRateId: true,
        rateOverrideReason: true, allocations: { select: { id: true,
          voucherId: true, amount: true, reversedAt: true } },
      } }),
      tx.voucher.findMany({ where: { id: { in: vchIds } }, select: {
        id: true, voucherNumber: true, type: true, currencyCode: true, amount: true,
        baseAmount: true, baseCurrencyCode: true, exchangeRate: true,
        rateSource: true, rateEffectiveAt: true, currencyRateId: true,
        rateOverrideReason: true,
        allocations: { select: { id: true, invoiceId: true, billOfLadingId: true,
          amount: true, reversedAt: true, reversalReason: true } },
        adjustments: { select: { id: true, previousAmount: true,
          newAmount: true, reason: true, createdAt: true } },
      } }),
      tx.customerPosting.findMany({ where: { OR: [
        { sourceType: 'invoice', sourceId: { in: invIds } },
        { sourceType: 'voucher', sourceId: { in: vchIds } },
      ] }, select: { id: true, sourceType: true, sourceId: true, eventKey: true } }),
    ]);
    const trace = (e: typeof all[number]) => {
      const inv = invSources.find((i) => i.id === e.invoiceId);
      const v = voucherSources.find((item) => item.id === e.voucherId);
      const source = inv ?? v;
      return { ...e, trace: source ? {
        sourceType: inv ? 'invoice' : 'voucher', sourceId: source.id,
        originalAmount: money(inv?.totalAmount ?? v!.amount), currencyCode: source.currencyCode,
        baseCurrencyCode: source.baseCurrencyCode, baseAmount: source.baseAmount ? money(source.baseAmount) : null,
        exchangeRate: source.exchangeRate?.toString() ?? null,
        rateSource: source.rateSource, rateEffectiveAt: source.rateEffectiveAt,
        currencyRateId: source.currencyRateId, rateOverrideReason: source.rateOverrideReason,
        customerPostingIds: postings.filter((p) => p.sourceId === source.id).map((p) => p.id),
        allocationIds: source.allocations.map((a) => a.id),
        adjustmentIds: v?.adjustments.map((a) => a.id) ?? [], generalJournalId: null,
      } : { sourceType: e.kind, sourceId: e.documentId, missing: true } };
    };
    const entries = result.entries.map(trace);
    const openingEntries = opening.entries.map(trace);
    if ([...openingEntries, ...entries].some((e) => e.trace.missing)) {
      throw new ConflictException('Statement contains a missing source transaction; no untraceable balance returned');
    }
    const net = (items: typeof entries) => items.reduce((sum, e) =>
      sum.plus(e.debit).minus(e.credit), ZERO);
    if (!net(openingEntries).equals(result.summary.openingBalance) ||
        !net(entries).equals(new Prisma.Decimal(result.summary.totalDebit).minus(result.summary.totalCredit))) {
      throw new ConflictException('Statement opening or period source entries do not reconcile to the displayed balances');
    }
    const previous = await tx.customerStatementIssue.findFirst({
      where: { customerId, currencyCode }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, createdAt: true, periodFrom: true, periodTo: true },
    });
    return { kind: 'derived-customer-statement-not-general-ledger', period, ...result,
      entries, openingEntries, lastIssuedStatement: previous,
      daysSinceLastStatement: previous ? Math.max(0, Math.floor((Date.now() - previous.createdAt.getTime()) / 86400000)) : null,
      warning: 'Voucher credits preserve the pre-Phase-6 derived statement rule, including PAYMENT. Consult posted general-journal/account entries for accounting debit/credit. No mixed currencies are added. Time since last statement means since the last EXPLICITLY ISSUED snapshot, not the last preview.' };
  }

  async issueStatement(customerId: string, currencyCode: string, from: string, to: string,
    actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const statement = await this.statementSnapshot(customerId, currencyCode, from, to, tx);
      // Freeze exactly what the user issued. The live derived statement may
      // change later; the prior issued snapshot remains reconstructible.
      const snapshot = JSON.parse(JSON.stringify({ summary: statement.summary,
        openingEntries: statement.openingEntries, entries: statement.entries,
        warning: statement.warning })) as Prisma.InputJsonValue;
      const row = await tx.customerStatementIssue.create({ data: { customerId, currencyCode,
        periodFrom: statement.period.gte, periodTo: new Date(statement.period.lt.getTime() - 1),
        createdById: actor.id, snapshot } });
      await this.audit.recordIn(tx, { action: 'report.statement.issue', entityType: 'CustomerStatementIssue',
        entityId: row.id, actorId: actor.id, actorEmail: actor.email,
        afterData: { customerId, currencyCode, from, to, summary: statement.summary } });
      return row;
    }, this.snapshotOptions);
  }

  issuedStatements(customerId: string, currencyCode: string) {
    if (!/^[A-Z]{3}$/.test(currencyCode)) throw new BadRequestException('currencyCode is required');
    return this.prisma.customerStatementIssue.findMany({ where: { customerId, currencyCode },
      select: { id: true, periodFrom: true, periodTo: true, createdAt: true, createdById: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 });
  }

  async issuedStatement(id: string) {
    const row = await this.prisma.customerStatementIssue.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Issued statement not found');
    return { ...row, kind: 'issued-derived-statement-not-general-ledger' };
  }
}
