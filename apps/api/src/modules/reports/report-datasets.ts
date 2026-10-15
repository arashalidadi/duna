import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { bounded, invoiceBaseNet, invoiceTax, money, REPORT_LIMIT, range } from './report-math';
import type { ReportSpec } from './report-catalogue';

export type DataRow = Record<string, string | null>;
const iso = (v: Date | null | undefined) => v?.toISOString() ?? null;
const str = (v: string | null | undefined) => v ?? null;
const amt = (v: Prisma.Decimal | null | undefined) => v === null || v === undefined ? null : money(v);

/** No user-provided SQL, relation paths, Prisma orderBy or Prisma where.
 * Each source is mapped explicitly; a hard bound precedes all in-memory filters
 * so totals cannot be silently computed on a truncated page. */
@Injectable()
export class ReportDatasets {
  constructor(private readonly prisma: PrismaService) {}

  async load(spec: ReportSpec): Promise<DataRow[]> {
    return this.prisma.$transaction((tx) => this.loadSnapshot(spec, tx), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 5000, timeout: 45000,
    });
  }

  private async loadSnapshot(spec: ReportSpec, tx: Prisma.TransactionClient): Promise<DataRow[]> {
    const dates = spec.from && spec.to ? range(spec.from, spec.to) : undefined;
    const take = REPORT_LIMIT + 1;
    switch (spec.source) {
      case 'invoices': {
        const rows = bounded(await tx.invoice.findMany({ where: { deletedAt: null,
          ...(dates ? { OR: [{ issueDate: dates }, { issueDate: null, createdAt: dates }] } : {}) },
          select: { id: true, invoiceNumber: true, status: true, customerId: true, customer: { select: { name: true } },
            voyageId: true, voyage: { select: { voyageNumber: true } }, issueDate: true, createdAt: true,
            dueDate: true, currencyCode: true, totalAmount: true, taxAmount: true, paidAmount: true,
            baseAmount: true, baseCurrencyCode: true, exchangeRate: true,
            rateSource: true, rateEffectiveAt: true, currencyRateId: true, rateOverrideReason: true,
            items: { select: { taxAmount: true } },
            billOfLading: { select: { billNumber: true } },
            billLinks: { select: { billOfLading: { select: { billNumber: true } } } },
            jobLinks: { select: { job: { select: { jobNumber: true } } } },
            allocations: { select: { id: true } },
          }, take }), 'Invoice dataset');
        const postings = bounded(await tx.customerPosting.findMany({ where: { sourceType: 'invoice',
          sourceId: { in: rows.map((r) => r.id) } }, select: { id: true, sourceId: true }, take }), 'Invoice postings');
        const bySource = new Map(postings.map((p) => [p.sourceId, p.id]));
        return rows.map((r) => {
          const tax = r.status === 'ISSUED' ? invoiceTax(r) :
            { amount: r.taxAmount, source: 'non-issued-header' };
          return { id: r.id, invoiceNumber: r.invoiceNumber, status: r.status,
            customerId: r.customerId, customerName: str(r.customer?.name), voyageId: r.voyageId,
            voyageNumber: str(r.voyage?.voyageNumber), billNumbers: [...new Set([
              ...r.billLinks.map((l) => l.billOfLading.billNumber),
              ...(r.billOfLading ? [r.billOfLading.billNumber] : []),
            ])].join(', '), jobNumbers: r.jobLinks.map((l) => l.job.jobNumber).join(', '),
            issueDate: iso(r.issueDate ?? r.createdAt), dueDate: iso(r.dueDate),
            currencyCode: r.currencyCode, gross: amt(r.totalAmount), tax: amt(tax.amount),
            taxSource: tax.source,
            netIncome: r.status === 'ISSUED' ? amt(r.totalAmount.minus(tax.amount)) : '0.00',
            paid: r.status === 'ISSUED' ? amt(r.paidAmount) : '0.00',
            outstanding: r.status === 'ISSUED' ? amt(r.totalAmount.minus(r.paidAmount)) : '0.00',
            baseAmount: amt(r.baseAmount), baseNetIncome: r.status === 'ISSUED'
              ? amt(invoiceBaseNet(r, tax.amount)) : null,
            baseCurrencyCode: r.baseCurrencyCode, exchangeRate: r.exchangeRate?.toString() ?? null,
            rateSource: r.rateSource, rateEffectiveAt: iso(r.rateEffectiveAt),
            currencyRateId: r.currencyRateId, rateOverrideReason: r.rateOverrideReason,
            customerPostingId: bySource.get(r.id) ?? null,
            allocationIds: r.allocations.map((a) => a.id).join(', ') };
        });
      }
      case 'vouchers': {
        const rows = bounded(await tx.voucher.findMany({ where: { status: 'POSTED', deletedAt: null,
          ...(dates ? { voucherDate: dates } : {}) }, select: {
          id: true, voucherNumber: true, type: true, customerId: true,
          customer: { select: { name: true } }, invoice: { select: { invoiceNumber: true } },
          voucherDate: true, currencyCode: true, amount: true, baseAmount: true,
          baseCurrencyCode: true, exchangeRate: true, rateSource: true,
          rateEffectiveAt: true, currencyRateId: true, rateOverrideReason: true,
          allocations: { where: { reversedAt: null }, select: { id: true, amount: true, invoiceId: true } },
        }, take }), 'Voucher dataset');
        return rows.map((r) => {
          const allocated = r.allocations.reduce((sum, a) => sum.plus(a.amount), new Prisma.Decimal(0));
          const invoiceAllocated = r.allocations.filter((a) => a.invoiceId)
            .reduce((sum, a) => sum.plus(a.amount), new Prisma.Decimal(0));
          return { id: r.id, voucherNumber: r.voucherNumber, type: r.type,
            customerId: r.customerId, customerName: str(r.customer?.name),
            invoiceNumber: str(r.invoice?.invoiceNumber), voucherDate: iso(r.voucherDate),
            currencyCode: r.currencyCode, amount: amt(r.amount), baseAmount: amt(r.baseAmount),
            baseCurrencyCode: r.baseCurrencyCode, exchangeRate: r.exchangeRate?.toString() ?? null,
            rateSource: r.rateSource, rateEffectiveAt: iso(r.rateEffectiveAt),
            currencyRateId: r.currencyRateId, rateOverrideReason: r.rateOverrideReason,
            allocated: money(allocated), invoiceAllocated: money(invoiceAllocated),
            unallocated: money(r.amount.minus(allocated)), allocationIds: r.allocations.map((a) => a.id).join(', ') };
        });
      }
      case 'customers': {
        const rows = bounded(await tx.customer.findMany({ where: { deletedAt: null,
          ...(dates ? { createdAt: dates } : {}) }, select: { id: true, code: true, name: true,
            type: true, currency: true, isActive: true, createdAt: true }, take }), 'Customer dataset');
        return rows.map((r) => ({ id: r.id, code: r.code, name: r.name, type: r.type,
          currencyCode: r.currency, active: String(r.isActive), createdAt: iso(r.createdAt) }));
      }
      case 'jobs': {
        const rows = bounded(await tx.job.findMany({ where: { deletedAt: null,
          ...(dates ? { openingDate: dates } : {}) }, select: { id: true, jobNumber: true, title: true,
            status: true, jobType: true, customerId: true, customer: { select: { name: true } },
            voyageId: true, voyage: { select: { voyageNumber: true } },
            openingDate: true, completedAt: true, currencyCode: true }, take }), 'Job dataset');
        return rows.map((r) => ({ id: r.id, jobNumber: r.jobNumber, title: r.title,
          status: r.status, jobType: r.jobType, customerId: r.customerId,
          customerName: str(r.customer?.name), voyageId: r.voyageId,
          voyageNumber: str(r.voyage?.voyageNumber), openingDate: iso(r.openingDate),
          completedAt: iso(r.completedAt), currencyCode: r.currencyCode }));
      }
      case 'job_cost_items': {
        const rows = bounded(await tx.jobCostItem.findMany({ where: { job: { deletedAt: null },
          ...(dates ? { OR: [{ itemDate: dates }, { itemDate: null, job: { openingDate: dates } }] } : {}) },
          select: { id: true, jobId: true, kind: true, category: true, description: true,
            amount: true, itemDate: true, job: { select: { jobNumber: true, currencyCode: true, openingDate: true } } },
          take }), 'Job cost items');
        return rows.map((r) => ({ id: r.id, jobId: r.jobId, jobNumber: r.job.jobNumber,
          kind: r.kind, category: r.category, description: r.description,
          itemDate: iso(r.itemDate ?? r.job.openingDate), currencyCode: r.job.currencyCode,
          amount: amt(r.amount) }));
      }
      case 'journal_lines': {
        const rows = bounded(await tx.journalLine.findMany({ where: dates ? {
          journal: { journalDate: dates } } : {},
          select: { id: true, journalId: true, accountId: true, customerId: true,
            debit: true, credit: true, baseDebit: true, baseCredit: true,
            account: { select: { code: true, name: true, type: true } },
            journal: { select: { journalNumber: true, journalDate: true, kind: true,
              currencyCode: true, baseCurrencyCode: true, exchangeRate: true,
              rateSource: true, rateEffectiveAt: true, currencyRateId: true,
              rateOverrideReason: true, reversalOfId: true } }, }, take }), 'Journal lines');
        return rows.map((r) => ({ id: r.id, journalId: r.journalId,
          journalNumber: r.journal.journalNumber, journalDate: iso(r.journal.journalDate),
          kind: r.journal.kind, accountId: r.accountId, accountCode: r.account.code,
          accountName: r.account.name, accountType: r.account.type, customerId: r.customerId,
          currencyCode: r.journal.currencyCode, debit: amt(r.debit), credit: amt(r.credit),
          netDebit: amt(r.debit.minus(r.credit)), baseCurrencyCode: r.journal.baseCurrencyCode,
          baseDebit: amt(r.baseDebit), baseCredit: amt(r.baseCredit),
          baseNetDebit: amt(r.baseDebit.minus(r.baseCredit)),
          exchangeRate: r.journal.exchangeRate.toString(), rateSource: r.journal.rateSource,
          rateEffectiveAt: iso(r.journal.rateEffectiveAt), currencyRateId: r.journal.currencyRateId,
          rateOverrideReason: r.journal.rateOverrideReason, reversalOfId: r.journal.reversalOfId }));
      }
      case 'voyage_costs': {
        const rows = bounded(await tx.voyageCost.findMany({ where: { journal: { reversedAt: null,
          ...(dates ? { journalDate: dates } : {}) } }, select: { id: true, voyageId: true, manifestId: true,
          voyage: { select: { voyageNumber: true } }, manifest: { select: { manifestNumber: true } },
          categoryCodeSnapshot: true, categoryNameSnapshot: true, journalId: true,
          netAmount: true, baseNetAmount: true,
          journal: { select: { journalNumber: true, journalDate: true, currencyCode: true,
            baseCurrencyCode: true, exchangeRate: true, rateSource: true,
            rateEffectiveAt: true, currencyRateId: true, rateOverrideReason: true,
            inputTax: { select: { amount: true } } } } }, take }), 'Voyage cost dataset');
        return rows.map((r) => ({ id: r.id, voyageId: r.voyageId,
          voyageNumber: r.voyage.voyageNumber, manifestId: r.manifestId,
          manifestNumber: str(r.manifest?.manifestNumber), categoryCode: r.categoryCodeSnapshot,
          categoryName: r.categoryNameSnapshot, journalId: r.journalId,
          journalNumber: r.journal.journalNumber, journalDate: iso(r.journal.journalDate),
          currencyCode: r.journal.currencyCode, baseCurrencyCode: r.journal.baseCurrencyCode,
          netAmount: amt(r.netAmount), inputVat: amt(r.journal.inputTax?.amount),
          baseNetAmount: amt(r.baseNetAmount), exchangeRate: r.journal.exchangeRate.toString(),
          rateSource: r.journal.rateSource, rateEffectiveAt: iso(r.journal.rateEffectiveAt),
          currencyRateId: r.journal.currencyRateId,
          rateOverrideReason: r.journal.rateOverrideReason }));
      }
      case 'bills': {
        const rows = bounded(await tx.billOfLading.findMany({ where: { deletedAt: null,
          ...(dates ? { createdAt: dates } : {}) }, select: { id: true, billNumber: true, status: true,
            manifestId: true, manifest: { select: { manifestNumber: true } }, voyageId: true,
            voyage: { select: { voyageNumber: true } }, createdAt: true, issuedAt: true,
            currencyCode: true, freightAmount: true }, take }), 'B/L dataset');
        return rows.map((r) => ({ id: r.id, billNumber: r.billNumber, status: r.status,
          manifestId: r.manifestId, manifestNumber: str(r.manifest?.manifestNumber),
          voyageId: r.voyageId, voyageNumber: r.voyage.voyageNumber, createdAt: iso(r.createdAt),
          issuedAt: iso(r.issuedAt), currencyCode: r.currencyCode,
          freightAmount: amt(r.freightAmount) }));
      }
      case 'manifests': {
        const rows = bounded(await tx.manifest.findMany({ where: { deletedAt: null,
          ...(dates ? { createdAt: dates } : {}) }, select: { id: true, manifestNumber: true,
            status: true, voyageId: true, voyage: { select: { voyageNumber: true } },
            vesselName: true, manifestDate: true, createdAt: true, totalQuantity: true,
            totalPackages: true }, take }), 'Manifest dataset');
        return rows.map((r) => ({ id: r.id, manifestNumber: r.manifestNumber, status: r.status,
          voyageId: r.voyageId, voyageNumber: r.voyage.voyageNumber, vesselName: r.vesselName,
          manifestDate: iso(r.manifestDate), createdAt: iso(r.createdAt),
          totalQuantity: String(r.totalQuantity), totalPackages: String(r.totalPackages) }));
      }
      case 'releases': {
        const rows = bounded(await tx.releaseOrder.findMany({ where: { status: 'ISSUED', deletedAt: null,
          ...(dates ? { releaseDate: dates } : {}) }, select: { id: true, docNumber: true,
            releaseDate: true, billOfLadingId: true, billOfLading: { select: { billNumber: true, manifestId: true } },
            paymentState: true, financialOverride: true, overrideReason: true }, take }), 'Release dataset');
        return rows.map((r) => ({ id: r.id, releaseNumber: r.docNumber,
          releaseDate: iso(r.releaseDate), billId: r.billOfLadingId,
          billNumber: r.billOfLading.billNumber, manifestId: r.billOfLading.manifestId,
          paymentState: r.paymentState, financialOverride: String(r.financialOverride),
          overrideReason: r.overrideReason }));
      }
      case 'deliveries': {
        const rows = bounded(await tx.deliveryOrder.findMany({ where: { status: 'ISSUED', deletedAt: null,
          ...(dates ? { issueDate: dates } : {}) }, select: { id: true, docNumber: true,
            issueDate: true, billOfLadingId: true, billOfLading: { select: { billNumber: true } },
            recipient: true, portName: true }, take }), 'Delivery dataset');
        return rows.map((r) => ({ id: r.id, docNumber: r.docNumber,
          issueDate: iso(r.issueDate), billId: r.billOfLadingId,
          billNumber: r.billOfLading.billNumber, recipient: r.recipient, portName: r.portName }));
      }
      case 'proformas': {
        const rows = bounded(await tx.proforma.findMany({ where: { deletedAt: null,
          ...(dates ? { OR: [{ issueDate: dates }, { issueDate: null, createdAt: dates }] } : {}) },
          select: { id: true, proformaNumber: true, status: true, customerId: true,
            customer: { select: { name: true } }, issueDate: true, createdAt: true,
            validUntil: true, currencyCode: true, totalAmount: true, taxAmount: true,
            linkedInvoiceId: true }, take }), 'Proforma dataset');
        return rows.map((r) => ({ id: r.id, proformaNumber: r.proformaNumber,
          status: r.status, customerId: r.customerId, customerName: str(r.customer?.name),
          issueDate: iso(r.issueDate ?? r.createdAt), validUntil: iso(r.validUntil),
          currencyCode: r.currencyCode, total: amt(r.totalAmount), tax: amt(r.taxAmount),
          linkedInvoiceId: r.linkedInvoiceId }));
      }
      case 'quotations': {
        const rows = bounded(await tx.quotation.findMany({ where: { deletedAt: null,
          ...(dates ? { OR: [{ issueDate: dates }, { issueDate: null, createdAt: dates }] } : {}) },
          select: { id: true, quotationNumber: true, status: true, customerId: true,
            customer: { select: { name: true } }, issueDate: true, createdAt: true,
            validUntil: true, currencyCode: true, totalAmount: true, taxAmount: true,
            linkedProformaId: true }, take }), 'Quotation dataset');
        return rows.map((r) => ({ id: r.id, quotationNumber: r.quotationNumber,
          status: r.status, customerId: r.customerId, customerName: str(r.customer?.name),
          issueDate: iso(r.issueDate ?? r.createdAt), validUntil: iso(r.validUntil),
          currencyCode: r.currencyCode, total: amt(r.totalAmount), tax: amt(r.taxAmount),
          linkedProformaId: r.linkedProformaId }));
      }
      case 'customer_history': {
        // This union is intentionally NOT a monetary balance; source IDs retain
        // direct drill-through and different document types remain labelled.
        const [invoices, vouchers, jobs] = await Promise.all([
          bounded(await tx.invoice.findMany({ where: { status: 'ISSUED', deletedAt: null,
            ...(dates ? { OR: [{ issueDate: dates }, { issueDate: null, createdAt: dates }] } : {}) },
            select: { id: true, customerId: true, customer: { select: { name: true } },
              invoiceNumber: true, issueDate: true, createdAt: true, currencyCode: true,
              totalAmount: true, voyageId: true }, take }), 'History invoices'),
          bounded(await tx.voucher.findMany({ where: { status: 'POSTED', deletedAt: null,
            ...(dates ? { voucherDate: dates } : {}) }, select: { id: true, customerId: true,
              customer: { select: { name: true } }, voucherNumber: true, type: true,
              voucherDate: true, currencyCode: true, amount: true, voyageId: true }, take }), 'History vouchers'),
          bounded(await tx.job.findMany({ where: { deletedAt: null, customerId: { not: null },
            ...(dates ? { openingDate: dates } : {}) }, select: { id: true, customerId: true,
              customer: { select: { name: true } }, jobNumber: true, status: true,
              openingDate: true, currencyCode: true, voyageId: true }, take }), 'History jobs'),
        ]);
        return bounded<DataRow>([
          ...invoices.map((r) => ({ id: r.id, customerId: r.customerId, customerName: str(r.customer?.name),
            kind: 'invoice', documentNumber: r.invoiceNumber, status: 'ISSUED',
            date: iso(r.issueDate ?? r.createdAt), currencyCode: r.currencyCode,
            amount: amt(r.totalAmount), voyageId: r.voyageId })),
          ...vouchers.map((r) => ({ id: r.id, customerId: r.customerId, customerName: str(r.customer?.name),
            kind: 'voucher', documentNumber: r.voucherNumber, status: r.type,
            date: iso(r.voucherDate), currencyCode: r.currencyCode,
            amount: amt(r.amount), voyageId: r.voyageId })),
          ...jobs.map((r) => ({ id: r.id, customerId: r.customerId, customerName: str(r.customer?.name),
            kind: 'job', documentNumber: r.jobNumber, status: r.status,
            date: iso(r.openingDate), currencyCode: r.currencyCode, amount: null,
            voyageId: r.voyageId })),
        ], 'Customer operational history');
      }
    }
  }
}
