import 'reflect-metadata';
import assert from 'node:assert/strict';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StandardReportsService } from '../src/modules/reports/standard-reports.service';
import { ReportBuilderService } from '../src/modules/reports/report-builder.service';
import { ReportExportService } from '../src/modules/reports/report-export.service';
import type { Response } from 'express';
import { ReportsController } from '../src/modules/reports/reports.controller';
import { ReportDownloadController } from '../src/modules/reports/report-download.controller';
import { AccountingService } from '../src/modules/accounting/accounting.service';
import { ExchangeRateService } from '../src/modules/finance/exchange-rate.service';
import { REQUIRED_PERMISSIONS_KEY } from '../src/common/auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../src/common/auth/types';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { VoucherService } from '../src/modules/voucher/voucher.service';
import type { AuditService } from '../src/common/infrastructure/audit/audit.service';
import type { NumberingService } from '../src/common/infrastructure/numbering';
import { ReportDatasets } from '../src/modules/reports/report-datasets';

const D = (x: string) => new Prisma.Decimal(x);
const at = (s: string) => new Date(`${s}T12:00:00.000Z`);
const owner: AuthenticatedUser = { id: 'owner', email: 'owner@example.test', isPrimaryAdmin: true, roles: [], permissions: [] };
const reader: AuthenticatedUser = { ...owner, id: 'reader', isPrimaryAdmin: false,
  permissions: ['report:read', 'invoice:read'] };
const snapshot = (tx: object) => ({ $transaction: async (fn: (client: object) => Promise<unknown>,
  options?: { isolationLevel?: string }) => {
  assert.equal(options?.isolationLevel, 'RepeatableRead');
  return fn(tx);
} });

async function vatCases() {
  const issued = { id: 'i1', invoiceNumber: 'I-1', status: 'ISSUED', currencyCode: 'USD',
    totalAmount: D('110'), taxAmount: D('10'), items: [{ id: 'line1', taxAmount: D('10') }],
    correctionsAsOriginal: [], correctionAsReplacement: null };
  const cancelled = { ...issued, id: 'cancelled', status: 'CANCELLED' };
  const receipt = (id: string, amount: string, day: string, invoice = issued) => ({
    id, amount: D(amount), currencyCode: 'USD', voucherDate: at(day), invoiceId: invoice.id,
    invoice, type: 'RECEIPT', status: 'POSTED', rateSource: 'BASE', rateEffectiveAt: at(day),
    currencyRateId: null, baseAmount: D(amount), adjustments: [] as { id: string }[],
  });
  const first = receipt('r1', '55', '2026-01-01');
  const second = receipt('r2', '33', '2026-02-01');
  const direct = receipt('direct', '22', '2026-02-02');
  const refund = { ...receipt('refund', '22', '2026-03-01'), type: 'PAYMENT' };
  const cancelledReceipt = receipt('cancelled-receipt', '11', '2026-02-12', cancelled);
  const allocated = [first, second, refund, cancelledReceipt].map((voucher) => ({
    id: `a-${voucher.id}`, invoiceId: voucher.invoiceId, voucherId: voucher.id,
    amount: voucher.amount, voucher, invoice: voucher.invoice,
  }));
  const detached = [{ ...receipt('bill-only', '7', '2026-03-02'), invoiceId: null, invoice: null,
    allocations: [{ invoiceId: null, amount: D('7'), invoice: null }] },
  { ...receipt('unassigned', '5', '2026-03-04'), invoiceId: null, invoice: null, allocations: [] }];
  const cashRows = [first, second, direct, cancelledReceipt, ...detached].map((v) => ({
    ...v, allocations: v.id === 'direct' ? [] : v.id === 'cancelled-receipt'
      ? [{ invoiceId: cancelled.id, amount: v.amount, invoice: cancelled }]
      : v.id === 'bill-only' ? detached[0].allocations
        : v.id === 'unassigned' ? [] : [{ invoiceId: issued.id, amount: v.amount, invoice: issued }],
  }));
  let queryChecked = false;
  const tx = {
    invoice: { findMany: async () => [issued] },
    voucherAllocation: { findMany: async (q: { where: { reversedAt: unknown; voucher: { voucherDate: { lt: Date } } } }) => {
      assert.equal(q.where.reversedAt, null, 'reversed allocations cannot settle VAT');
      assert.equal(q.where.voucher.voucherDate.lt.toISOString(), '2026-04-01T00:00:00.000Z');
      queryChecked = true;
      return allocated;
    } },
    voucher: { findMany: async (q: { where: { allocations?: { none: object }; type?: string } }) =>
      q.where.allocations?.none ? [direct] : q.where.type === 'RECEIPT' ? cashRows : [] },
    expenseInputTax: { findMany: async (q: { where: { journal: { reversedAt: unknown } } }) => {
      assert.equal(q.where.journal.reversedAt, null, 'reversed expense journals cannot count as paid VAT');
      return [{ id: 'tax1', journalId: 'j1', amount: D('2'), baseAmount: D('2'), paidAt: at('2026-03-04'),
        journal: { id: 'j1', journalNumber: 'J-1', currencyCode: 'USD', baseCurrencyCode: 'USD',
          exchangeRate: D('1'), rateSource: 'BASE', rateEffectiveAt: at('2026-03-04'),
          currencyRateId: null, lines: [{ id: 'vat-line' }] } }];
    } },
    generalJournal: { count: async () => 1 }, // an earlier, unclassified office expense
  };
  const service = new StandardReportsService({ ...tx, ...snapshot(tx) } as unknown as PrismaService,
    {} as VoucherService, {} as AuditService);
  const report = await service.vat(2026, 1);
  assert.equal(queryChecked, true);
  assert.deepEqual(report.totals, [{ currencyCode: 'USD', billed: '10.00',
    collected: '8.00', paid: '2.00', difference: '6.00' }]);
  assert.deepEqual(report.collected.map((r) => r.vat), ['5.00', '3.00', '2.00', '-2.00']);
  assert.equal(report.collected.some((r) => r.invoiceId === cancelled.id), false);
  assert.equal(report.skippedAllocations, 1);
  assert.deepEqual(report.unassignedReceipts, [{ currencyCode: 'USD', amount: '23.00' }]);
  assert.equal(report.unclassifiedExpenseCount, 1);
  assert.equal(report.complete, false, 'unassigned cash, cancelled allocations and unknown historical expense VAT fail closed');
  assert.deepEqual(report.paid[0].journalLineIds, ['vat-line']);
  assert.equal(report.allocationSources.some((r) => r.allocationId === 'legacy:direct'), true);
}

async function statementCases() {
  const start = at('2026-01-05');
  const e = (id: string, kind: 'invoice' | 'voucher', amount: string) => ({
    date: start.toISOString(), kind, documentNumber: id, documentId: id, currencyCode: 'USD',
    invoiceId: kind === 'invoice' ? id : null, voucherId: kind === 'voucher' ? id : null,
    debit: kind === 'invoice' ? amount : '0.00', credit: kind === 'voucher' ? amount : '0.00',
    balance: '0.00', description: id,
  });
  const before = [e('inv-old', 'invoice', '100.00'), e('v-old', 'voucher', '20.00')];
  const during = [e('inv-now', 'invoice', '50.00'), e('v-now', 'voucher', '10.00')];
  let opening = '80.00';
  let omitInvoice = false;
  const issued: { snapshot?: { openingEntries: unknown[]; entries: unknown[]; summary: { openingBalance: string } } } = {};
  const tx = {
    invoice: { count: async () => 2, findMany: async () => ['inv-old', 'inv-now'].filter((id) => !omitInvoice || id !== 'inv-old')
      .map((id) => ({ id, totalAmount: D(id === 'inv-old' ? '100' : '50'), currencyCode: 'USD',
        exchangeRate: D('1'), baseAmount: D(id === 'inv-old' ? '100' : '50'),
        baseCurrencyCode: 'USD', rateSource: 'BASE', rateEffectiveAt: start, currencyRateId: null,
        rateOverrideReason: null, allocations: [] })) },
    voucher: { count: async () => 2, findMany: async () => ['v-old', 'v-now'].map((id) => ({ id,
      amount: D(id === 'v-old' ? '20' : '10'), currencyCode: 'USD', exchangeRate: D('1'),
      baseAmount: D(id === 'v-old' ? '20' : '10'), baseCurrencyCode: 'USD', rateSource: 'BASE',
      rateEffectiveAt: start, currencyRateId: null, rateOverrideReason: null, allocations: [], adjustments: [] })) },
    customerPosting: { findMany: async () => [...before, ...during].map((r) => ({
      id: `posting-${r.documentId}`, sourceId: r.documentId,
      sourceType: r.kind, eventKey: `${r.kind}:${r.documentId}:POST`,
    })) },
    customerStatementIssue: {
      findFirst: async () => ({ id: 'prior-issue', createdAt: new Date(Date.now() - 3 * 86400000) }),
      create: async ({ data }: { data: { snapshot: NonNullable<typeof issued.snapshot> } }) => {
        issued.snapshot = data.snapshot;
        return { id: 'new-issue', ...data };
      },
      findUnique: async () => ({ id: 'new-issue', snapshot: issued.snapshot }),
    },
  };
  const vouchers = { ledger: async (params: { fromDate?: string }, client: object) => {
    assert.equal(client, tx, 'both derived reads must use the same repeatable-read snapshot');
    return params.fromDate ? { summary: { openingBalance: opening, totalDebit: '50.00',
      totalCredit: '10.00', closingBalance: '120.00' }, entries: during }
      : { summary: { openingBalance: '0.00', totalDebit: '100.00', totalCredit: '20.00',
        closingBalance: opening }, entries: before };
  } } as unknown as VoucherService;
  const audit = { recordIn: async (client: object) => assert.equal(client, tx) } as unknown as AuditService;
  const service = new StandardReportsService({ ...tx, ...snapshot(tx) } as unknown as PrismaService, vouchers, audit);
  const preview = await service.statement('customer', 'USD', '2026-02-01', '2026-02-28');
  assert.equal(preview.summary.openingBalance, '80.00');
  assert.equal(preview.openingEntries.length, 2);
  assert.deepEqual(preview.openingEntries[0].trace.customerPostingIds, ['posting-inv-old']);
  assert.equal(preview.daysSinceLastStatement, 3);
  await service.issueStatement('customer', 'USD', '2026-02-01', '2026-02-28', owner);
  assert.equal(issued.snapshot?.openingEntries.length, 2, 'issued snapshot preserves traced opening sources');
  assert.equal(issued.snapshot?.summary.openingBalance, '80.00');
  assert.equal((await service.issuedStatement('new-issue')).snapshot, issued.snapshot);
  opening = '79.00';
  await assert.rejects(service.statement('customer', 'USD', '2026-02-01', '2026-02-28'), ConflictException);
  opening = '80.00';
  omitInvoice = true;
  await assert.rejects(service.statement('customer', 'USD', '2026-02-01', '2026-02-28'), ConflictException,
    'missing source must not produce an untraceable issued or preview balance');
}

async function overdueCases() {
  const rows = [
    { id: 'i1', invoiceNumber: 'I-1', customerId: 'c', dueDate: at('2026-01-01'),
      currencyCode: 'USD', totalAmount: D('100'), paidAmount: D('30'), voyageId: 'v',
      baseAmount: D('100'), baseCurrencyCode: 'USD', exchangeRate: D('1'), rateSource: 'BASE',
      rateEffectiveAt: at('2026-01-01'), currencyRateId: null,
      allocations: [{ id: 'a1', amount: D('30'), voucherId: 'r1', voucher: { type: 'RECEIPT' } }] },
    { id: 'i2', invoiceNumber: 'I-2', customerId: 'c', dueDate: at('2026-01-02'),
      currencyCode: 'USD', totalAmount: D('100'), paidAmount: D('50'), voyageId: 'v',
      baseAmount: D('100'), baseCurrencyCode: 'USD', exchangeRate: D('1'), rateSource: 'BASE',
      rateEffectiveAt: at('2026-01-02'), currencyRateId: null,
      allocations: [{ id: 'a2', amount: D('20'), voucherId: 'r2', voucher: { type: 'RECEIPT' } }] },
  ];
  const tx = { invoice: { fields: { totalAmount: {} },
    findMany: async (q: { where: { allocations?: unknown; status: string; paidAmount: unknown } }) => {
      assert.equal(q.where.status, 'ISSUED');
      assert(q.where.paidAmount);
      return rows;
    } },
  voucher: { findMany: async () => [{ id: 'legacy', invoiceId: 'i2', amount: D('10'), type: 'RECEIPT' }] },
  customerPosting: { findMany: async () => rows.map((r) => ({ id: `posting-${r.id}`, sourceId: r.id })) } };
  const service = new StandardReportsService({ ...tx, ...snapshot(tx) } as unknown as PrismaService,
    {} as VoucherService, {} as AuditService);
  const report = await service.overdue('2026-03-01');
  assert.equal(report.reconciled, false);
  assert.deepEqual(report.rows.map((r) => r.paidAmountReconciled), [true, false]);
  assert.deepEqual(report.rows[1].trace.legacyVoucherIds, ['legacy']);
  assert.deepEqual(report.rows[1].trace.allocationIds, ['a2']);
  assert.deepEqual(report.totals, [{ currencyCode: 'USD', amount: '120.00' }]);
}

async function datasetCases() {
  const tx = {
    invoice: { findMany: async () => [{ id: 'i1', invoiceNumber: 'I-1', status: 'ISSUED',
      customerId: 'c1', customer: { name: 'Sensitive' }, voyageId: 'v1',
      voyage: { voyageNumber: 'V-1' }, issueDate: at('2026-03-01'), createdAt: at('2026-03-01'),
      dueDate: at('2026-04-01'), currencyCode: 'AED', totalAmount: D('55'),
      taxAmount: D('5'), paidAmount: D('10'), baseAmount: D('16.5'),
      baseCurrencyCode: 'USD', exchangeRate: D('0.3'), rateSource: 'APPROVED_RATE',
      rateEffectiveAt: at('2026-03-01'), currencyRateId: 'rate1', rateOverrideReason: null,
      items: [{ taxAmount: D('2') }, { taxAmount: D('3') }],
      billOfLading: null, billLinks: [], jobLinks: [], allocations: [{ id: 'a1' }] }] },
    customerPosting: { findMany: async () => [{ sourceId: 'i1', id: 'posting1' }] },
    voucher: { findMany: async () => [{ id: 'v1', voucherNumber: 'R-1', type: 'RECEIPT',
      customerId: 'c1', customer: { name: 'Sensitive' }, invoice: null,
      voucherDate: at('2026-03-02'), currencyCode: 'USD', amount: D('100'), baseAmount: D('100'),
      baseCurrencyCode: 'USD', exchangeRate: D('1'), rateSource: 'BASE',
      rateEffectiveAt: at('2026-03-02'), currencyRateId: null, rateOverrideReason: null,
      allocations: [{ id: 'invoice-alloc', invoiceId: 'i1', amount: D('30') },
        { id: 'bill-alloc', invoiceId: null, amount: D('20') }] }] },
  };
  const datasets = new ReportDatasets({ ...tx, ...snapshot(tx) } as unknown as PrismaService);
  const inv = await datasets.load({ source: 'invoices', columns: ['invoiceNumber', 'netIncome'],
    filters: [], groupBy: [], metrics: [] });
  assert.equal(inv[0].tax, '5.00', 'issued tax uses preserved line sums');
  assert.equal(inv[0].taxSource, 'preserved-lines');
  assert.equal(inv[0].netIncome, '50.00');
  assert.equal(inv[0].baseNetIncome, '15.00');
  assert.equal(inv[0].exchangeRate, '0.3');
  assert.equal(inv[0].customerPostingId, 'posting1');
  const voucher = await datasets.load({ source: 'vouchers', columns: ['voucherNumber', 'allocated'],
    filters: [], groupBy: [], metrics: [] });
  assert.equal(voucher[0].allocated, '50.00');
  assert.equal(voucher[0].invoiceAllocated, '30.00', 'B/L-only allocations never become invoice settlement');
  assert.equal(voucher[0].unallocated, '50.00');
}

async function savedAndPermissionCases() {
  const spec = { source: 'invoices', columns: ['invoiceNumber', 'netIncome'], filters: [],
    metrics: [{ op: 'sum', field: 'netIncome', as: 'income' }] };
  const saved = { id: 'saved1', createdById: 'reader', name: 'Snapshot', definition: spec,
    createdAt: at('2026-01-01'), updatedAt: at('2026-01-01') };
  const db = { savedReport: {
    findMany: async (q: { where: { createdById?: string } }) =>
      q.where.createdById === undefined || q.where.createdById === saved.createdById ? [saved] : [],
    findFirst: async (q: { where: { createdById?: string; id: string } }) =>
      q.where.id === saved.id && (q.where.createdById === undefined || q.where.createdById === saved.createdById)
        ? saved : null,
  } } as unknown as PrismaService;
  const builder = new ReportBuilderService(db,
    { load: async () => [{ id: 'invoice1', invoiceNumber: 'I-1', currencyCode: 'USD',
      status: 'ISSUED', netIncome: '40.00' }] } as unknown as ReportDatasets, {} as AuditService);
  assert.equal((await builder.saved(reader)).length, 1);
  assert.equal((await builder.runSaved(saved.id, reader)).totals.income, '40.00');
  const revoked = { ...reader, permissions: ['report:read'] };
  assert.deepEqual(await builder.saved(revoked), []);
  await assert.rejects(builder.runSaved(saved.id, revoked), ForbiddenException,
    'revoked source grant must be checked even on saved reuse');
  await assert.rejects(builder.get(saved.id, { ...reader, id: 'other' }), NotFoundException);
  assert.equal((await builder.get(saved.id, owner)).createdById, 'reader', 'primary owner retains full authority');
  assert.equal((await builder.saved(owner)).length, 1);
  const maybeUnknown = new ReportBuilderService({} as PrismaService,
    { load: async () => [{ id: 'invoice1', invoiceNumber: 'I-1', currencyCode: 'USD',
      status: 'ISSUED', netIncome: null }, { id: 'invoice2', invoiceNumber: 'I-2',
      currencyCode: 'USD', status: 'ISSUED', netIncome: '40.00' }] } as unknown as ReportDatasets,
    {} as AuditService);
  await assert.rejects(maybeUnknown.run(spec, reader), ConflictException,
    'missing monetary amount cannot be omitted from a partial total');
  const meta = (prototype: object, name: string) => Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY,
    Object.getOwnPropertyDescriptor(prototype, name)?.value)?.permissions as string[];
  assert(meta(ReportsController.prototype, 'pnl').includes('voucher:read'));
  assert(meta(ReportsController.prototype, 'issueStatement').includes('report:statement_issue'));
  assert(meta(ReportsController.prototype, 'cost').includes('journal:post'));
  assert(meta(ReportDownloadController.prototype, 'exportStandard').includes('report:export'));
  const downloads = new ReportDownloadController({} as StandardReportsService, builder,
    {} as ReportExportService, {} as AuditService);
  await assert.rejects(downloads.exportStandard('overdue', 'xlsx', { asOf: '2026-01-01' },
    reader, {} as Response), ForbiddenException, 'export must recheck voucher source permission');
  await assert.rejects(downloads.exportStandard('statement', 'xlsx', { customerId: 'c',
    currencyCode: 'USD', from: '2026-01-01', to: '2026-01-02' }, reader, {} as Response),
    ForbiddenException, 'export must recheck statement source permission');
}

async function costCases() {
  let journal: Prisma.GeneralJournalCreateArgs['data'] | undefined;
  let cost: Prisma.VoyageCostCreateArgs['data'] | undefined;
  let tax: Prisma.ExpenseInputTaxCreateArgs['data'] | undefined;
  let audited = false;
  const chart = new Map([['expense', { id: 'expense', type: 'EXPENSE', isActive: true }],
    ['tax', { id: 'tax', type: 'ASSET', isActive: true }],
    ['cash', { id: 'cash', type: 'ASSET', isActive: true }]]);
  const tx = {
    companySettings: { findFirst: async () => ({ defaultCurrency: 'USD' }) },
    currency: { findUnique: async () => ({ isActive: true }) },
    currencyRate: { findFirst: async () => ({ id: 'rate1', rate: D('1.5'), effectiveAt: at('2026-03-01'),
      status: 'APPROVED', source: 'bank' }) },
    voyage: { findUnique: async () => ({ id: 'v1' }) },
    manifest: { findFirst: async () => ({ id: 'm1' }) },
    voyageCostCategory: { findFirst: async () => ({ id: 'cat', code: 'PORT_USE', name: 'Port Use' }) },
    account: { findMany: async (q: { where: { id: { in: string[] } } }) =>
      q.where.id.in.map((id) => chart.get(id)).filter((v) => v !== undefined) },
    generalJournal: { create: async (args: Prisma.GeneralJournalCreateArgs) => {
      journal = args.data;
      return { id: 'j1' };
    } },
    expenseInputTax: { create: async (args: Prisma.ExpenseInputTaxCreateArgs) => {
      tax = args.data;
      return { id: 'vat' };
    } },
    voyageCost: { create: async (args: Prisma.VoyageCostCreateArgs) => {
      cost = args.data;
      return { id: 'cost' };
    } },
  };
  const db = { $transaction: async (fn: (client: object) => Promise<unknown>) => fn(tx),
    generalJournal: { findUnique: async () => ({ id: 'j1', journalNumber: 'J-1', lines: [] }) } };
  const service = new AccountingService(db as unknown as PrismaService,
    { recordIn: async (client: object) => { assert.equal(client, tx); audited = true; } } as unknown as AuditService,
    { allocateNumber: async () => ({ sequence: 'J-1' }) } as unknown as NumberingService,
    new ExchangeRateService());
  const dto = { voyageId: 'v1', manifestId: 'm1', categoryId: 'cat',
    expenseAccountId: 'expense', creditAccountId: 'cash', vatAccountId: 'tax',
    currencyCode: 'AED', amount: '44.00', inputVatAmount: '4.00', taxPaidAt: '2026-03-01',
    description: 'Port charges' };
  await service.voyageCost(dto, owner);
  assert.equal(journal?.kind, 'VOYAGE_COST');
  const lines = journal?.lines?.create;
  assert(Array.isArray(lines));
  assert.equal(String(lines[0].baseDebit), '60');
  assert.equal(String(lines[1].baseDebit), '6');
  assert.equal(String(lines[2].baseCredit), '66');
  assert.equal(String(cost?.netAmount), '40');
  assert.equal(String(cost?.baseNetAmount), '60');
  assert.equal(cost?.categoryCodeSnapshot, 'PORT_USE');
  assert.equal(String(tax?.amount), '4');
  assert.equal(String(tax?.baseAmount), '6');
  assert.equal(audited, true, 'journal, cost, input VAT and audit must share the same transaction');
  await assert.rejects(service.voyageCost({ ...dto, inputVatAmount: undefined }, owner));
  await assert.rejects(service.voyageCost({ ...dto, inputVatAmount: '44.00' }, owner));
  await service.voyageCost({ ...dto, inputVatAmount: '0.00', vatAccountId: undefined,
    taxPaidAt: undefined }, owner);
  assert.equal(String(tax?.amount), '0', 'explicit zero VAT still records a classification');
  assert.equal(String(cost?.netAmount), '44');
}

async function main() {
  await vatCases();
  await statementCases();
  await overdueCases();
  await datasetCases();
  await savedAndPermissionCases();
  await costCases();
  console.log('Phase 7 service checks: VAT allocation/refund gaps, traced issued statements, overdue reconciliation, source datasets, saved permissions and atomic journal-backed costs: PASS');
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
