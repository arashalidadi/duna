/**
 * API unit contracts: Phase 6 finance (money/FX snapshots, allocations, journals, reconciliation), Phase 7 reports (P&L, VAT, masking, grouping, filtering, FX gaps, Excel/PDF), Phase 7 services (VAT allocation/refund gaps, traced statements, overdue reconciliation, atomic journal-backed costs) and Phase 8 documents (11 projections x PDF/Print/Excel, marks, workbook data, issuance snapshot, permissions, archive).

Merged on 2026-10-20 from the four standalone test scripts. Each keeps its own
scope; the assertions are unchanged. Run with:
  TSX_TSCONFIG_PATH=apps/api/tsconfig.json pnpm exec tsx apps/api/scripts/unit-contracts.ts
 *
 * Merged on 2026-10-20 from 4 files. Imports were hoisted and deduped;
 * every original body keeps its own scope below (a block, or an IIFE for TypeScript,
 * collide with another file's and no statement was rewritten.
 */

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import assert from 'node:assert/strict';
import type { AuditService } from '../src/common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../src/common/auth/types';
import type { CompanySettingsService } from '../src/modules/company-settings/company-settings.service';
import type { DocumentTemplateService } from '../src/common/infrastructure/templates/document-template.service';
import type { NumberingService } from '../src/common/infrastructure/numbering';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { Response } from 'express';
import type { StorageAdapter } from '../src/common/infrastructure/storage/storage-adapter.interface';
import type { VoucherService } from '../src/modules/voucher/voucher.service';
import { AccountingController } from '../src/modules/accounting/accounting.controller';
import { AccountingService } from '../src/modules/accounting/accounting.service';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateVoucherDto } from '../src/modules/voucher/dto/voucher.dto';
import { CustomerPostingService } from '../src/modules/finance/customer-posting.service';
import { DOCUMENT_TYPES, defaultLayout, validateLayout, type DocumentData } from '../src/modules/document-output/document-layout';
import { DocumentAssetsService, inspectArtworkImage } from '../src/modules/document-output/document-assets.service';
import { DocumentDataService } from '../src/modules/document-output/document-data.service';
import { DocumentOutputService } from '../src/modules/document-output/document-output.service';
import { DocumentRendererService } from '../src/modules/document-output/document-renderer.service';
import { ExchangeRateService } from '../src/modules/finance/exchange-rate.service';
import { Prisma, PrismaClient, VoucherType } from '@prisma/client';
import { REQUIRED_PERMISSIONS_KEY } from '../src/common/auth/decorators/require-permissions.decorator';
import { RatesController } from '../src/modules/currencies/rates.controller';
import { Readable } from 'node:stream';
import { ReportBuilderService } from '../src/modules/reports/report-builder.service';
import { ReportDatasets } from '../src/modules/reports/report-datasets';
import { ReportDownloadController } from '../src/modules/reports/report-download.controller';
import { ReportExportService } from '../src/modules/reports/report-export.service';
import { ReportsController } from '../src/modules/reports/reports.controller';
import { StandardReportsService } from '../src/modules/reports/standard-reports.service';
import { VoucherAllocationService } from '../src/modules/voucher/voucher-allocation.service';
import { VoucherController } from '../src/modules/voucher/voucher.controller';
import { captureIssuedDocument } from '../src/modules/document-output/document-issue-snapshot';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { exactMoney, exactRate, toBase } from '../src/modules/finance/financial-money';
import { invoiceTax, invoiceBaseNet, pnlTotals, quarter, range, recognizedVat } from '../src/modules/reports/report-math';
import { join } from 'node:path';
import { parseSpec, availableCatalogue } from '../src/modules/reports/report-catalogue';
import { plainToInstance } from 'class-transformer';
import { projectRecordedDocument } from '../src/modules/document-output/document-record-projection';
import { readFileSync } from 'node:fs';
import { validateSync } from 'class-validator';

// ---- apps/api/scripts/test-phase6-finance.ts (0 tests) ----
(() => {
const D = (v: string) => new Prisma.Decimal(v);
const actor: AuthenticatedUser = { id: 'staff', email: 'staff@example.test', isPrimaryAdmin: false, permissions: [], roles: [] };
const privileged: AuthenticatedUser = { ...actor, permissions: ['currency_rate:override'] };
const at = new Date('2026-10-15T10:00:00.000Z');

async function moneyAndRates() {
  assert.equal(exactMoney('123.40').toFixed(2), '123.40');
  const precise = plainToInstance(CreateVoucherDto, { type: 'RECEIPT', customerId: 'customer1',
    amount: '9007199254740991.99', allocations: [{ invoiceId: 'inv1', amount: '0.01' }] },
  { enableImplicitConversion: true });
  assert.deepEqual(validateSync(precise), []);
  assert.equal(precise.amount, '9007199254740991.99', 'DTO must not round money through Number');
  assert.equal(precise.allocations?.[0].amount, '0.01');
  assert.throws(() => exactMoney('0'), BadRequestException);
  assert.throws(() => exactMoney('1.001'), BadRequestException);
  assert.throws(() => exactRate('-1'), BadRequestException);
  assert.equal(toBase(D('42000'), D('0.000023809524')).toFixed(2), '1.00');
  let current = D('0.000023809524');
  const tx = {
    companySettings: { findFirst: async () => ({ defaultCurrency: 'USD' }) },
    currency: { findUnique: async () => ({ isActive: true }) },
    currencyRate: { findFirst: async () => ({ id: 'rate1', rate: current, effectiveAt: at,
      status: 'APPROVED', source: 'Test bank quote' }) },
  } as unknown as Prisma.TransactionClient;
  const fx = new ExchangeRateService();
  const prior = await fx.resolve(tx, 'IRR', at, actor);
  assert.equal(prior.baseAmount(D('42000')).toFixed(2), '1.00');
  current = D('0.000030000000');
  const later = await fx.resolve(tx, 'IRR', at, actor);
  assert.equal(prior.exchangeRate.toString(), '0.000023809524', 'historical snapshot never re-reads the current rate');
  assert.equal(later.baseAmount(D('42000')).toFixed(2), '1.26');
  await assert.rejects(() => fx.resolve(tx, 'IRR', at, actor,
    { rate: '0.00004', reason: 'specific settlement' }), ForbiddenException);
  const override = await fx.resolve(tx, 'IRR', at, privileged,
    { rate: '0.00004', reason: 'specific settlement' });
  assert.equal(override.rateSource, 'TRANSACTION_OVERRIDE');
  assert.equal(override.rateOverrideReason, 'specific settlement');
  await assert.rejects(() => fx.resolve(tx, 'USD', at, privileged,
    { rate: '2', reason: 'invalid' }), BadRequestException);
  const noRate = { ...tx, currencyRate: { findFirst: async () => null } } as unknown as Prisma.TransactionClient;
  await assert.rejects(() => fx.resolve(noRate, 'IRR', at, actor), ConflictException);
}

async function allocations() {
  const service = new VoucherAllocationService();
  let policy: 'MANUAL' | 'OLDEST_DUE' = 'MANUAL';
  let paid = D('20');
  const invoices = [
    { id: 'i1', customerId: 'c1', currencyCode: 'USD', status: 'ISSUED', deletedAt: null,
      totalAmount: D('80'), paidAmount: paid },
    { id: 'i2', customerId: 'c1', currencyCode: 'USD', status: 'ISSUED', deletedAt: null,
      totalAmount: D('50'), paidAmount: D('0') },
  ];
  const tx = {
    companySettings: { findFirst: async () => ({ allocationPolicy: policy }) },
    invoice: {
      findMany: async () => invoices,
      findUnique: async () => ({ id: 'i1' }),
      update: async ({ data }: { data: { paidAmount: Prisma.Decimal } }) => { paid = data.paidAmount; },
    },
    voucherAllocation: { findMany: async () => [{ amount: D('35'), voucher: { type: 'RECEIPT' } },
      { amount: D('25'), voucher: { type: 'RECEIPT' } },
      { amount: D('10'), voucher: { type: 'PAYMENT' } }] },
    voucher: { findMany: async () => [] },
  } as unknown as Prisma.TransactionClient;
  const voucher = { id: 'v1', customerId: 'c1', currencyCode: 'USD', amount: D('120'),
    type: VoucherType.RECEIPT, status: 'POSTED' as const };
  const manual = await service.forCreate(tx, { ...voucher });
  assert.deepEqual(manual, [], 'unallocated receipts never error (REQ-165)');
  policy = 'OLDEST_DUE';
  const auto = await service.forCreate(tx, { ...voucher });
  assert.deepEqual(auto, [{ invoiceId: 'i1', amount: '60.00' }, { invoiceId: 'i2', amount: '50.00' }]);
  const unappliedDeposit = await service.forCreate(tx, { ...voucher, amount: D('50.00'), allocationMode: 'NONE' });
  assert.deepEqual(unappliedDeposit, [], 'explicit NONE keeps a deposit unapplied under an automatic company policy');
  await assert.rejects(() => service.forCreate(tx, { ...voucher, invoiceId: 'i1', allocationMode: 'NONE' }),
    BadRequestException);
  assert.equal(voucher.amount.minus(auto.reduce((s, l) => s.plus(l.amount), D('0'))).toFixed(2), '10.00');
  await service.validate(tx, voucher, auto);
  await assert.rejects(() => service.validate(tx, voucher,
    [{ invoiceId: 'i1', amount: '60.00' }, { invoiceId: 'i1', amount: '1.00' }]), BadRequestException);
  await assert.rejects(() => service.validate(tx, voucher,
    [{ invoiceId: 'i1', amount: '121.00' }]), BadRequestException);
  await assert.rejects(() => service.validate(tx, voucher,
    [{ invoiceId: 'i2', amount: '51.00' }]), ConflictException);
  await service.recomputeInvoicePaid(tx, 'i1');
  assert.equal(paid.toFixed(2), '50.00', 'receipts less refund per linked invoice');
}

async function journalChecks() {
  const service = new AccountingService(
    { $transaction: async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn({} as Prisma.TransactionClient) } as unknown as PrismaService,
    { recordIn: async () => {} } as unknown as AuditService,
    { allocateNumber: async () => ({ sequence: 'JRN-2610-00001' }) } as unknown as NumberingService,
    new ExchangeRateService(),
  );
  await assert.rejects(() => service.post({ description: 'Unbalanced adjustment', currencyCode: 'USD',
    lines: [{ accountId: 'asset', debit: '10.00' }, { accountId: 'liability', credit: '9.99' }] }, actor), BadRequestException);
  await assert.rejects(() => service.post({ description: 'Both sides wrong', currencyCode: 'USD',
    lines: [{ accountId: 'asset', debit: '1.00', credit: '1.00' }, { accountId: 'liability', credit: '1.00' }] }, actor), BadRequestException);
}

async function successfulPostingAndPermissions() {
  const recorded: Array<{ kind: string; customerId: string | null; audited: boolean }> = [];
  const chart = new Map([
    ['cash', { id: 'cash', type: 'ASSET', isActive: true }],
    ['loan', { id: 'loan', type: 'LIABILITY', isActive: true }],
    ['expense', { id: 'expense', type: 'EXPENSE', isActive: true }],
  ]);
  let filteredCustomer = '';
  const tx = {
    companySettings: { findFirst: async () => ({ defaultCurrency: 'USD' }) },
    currency: { findUnique: async () => ({ isActive: true }) },
    account: { findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => chart.get(id)).filter((row) => row !== undefined) },
    customer: { count: async () => 1 },
    generalJournal: { create: async ({ data }: Prisma.GeneralJournalCreateArgs) => {
      const lines = 'create' in data.lines! ? data.lines.create : [];
      if (!Array.isArray(lines)) throw new Error('Expected journal lines');
      recorded.push({ kind: data.kind ?? 'GENERAL', customerId: lines.find((l) => l.customerId)?.customerId ?? null,
        audited: false });
      return { id: `journal-${recorded.length}` };
    } },
  } as unknown as Prisma.TransactionClient;
  const db = {
    $transaction: async (fn: (transaction: Prisma.TransactionClient) => Promise<unknown>) => fn(tx),
    generalJournal: {
      findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, journalNumber: 'JRN-2610-00001', lines: [] }),
      findMany: async ({ where }: { where: { lines?: { some?: { customerId: string } } } }) => {
        filteredCustomer = where.lines?.some?.customerId ?? ''; return [];
      },
    },
  } as unknown as PrismaService;
  const audit = { recordIn: async (client: Prisma.TransactionClient) => {
    assert.equal(client, tx, 'audit row must be inside the posting transaction');
    recorded[recorded.length - 1].audited = true;
  } } as unknown as AuditService;
  const numbers = { allocateNumber: async () => ({ sequence: 'JRN-2610-00001' }) } as unknown as NumberingService;
  const service = new AccountingService(db, audit, numbers, new ExchangeRateService());
  const posted = await service.post({ currencyCode: 'USD', description: 'Loan received',
    lines: [{ accountId: 'cash', debit: '90.00' },
      { accountId: 'loan', customerId: 'customer1', credit: '90.00' }] }, actor);
  assert.equal(posted.journalNumber, 'JRN-2610-00001');
  await service.post({ currencyCode: 'USD', description: 'Manual adjustment',
    lines: [{ accountId: 'loan', customerId: 'customer1', debit: '5.00' },
      { accountId: 'cash', credit: '5.00' }] }, actor);
  await service.expense({ currencyCode: 'USD', description: 'Electricity',
    expenseAccountId: 'expense', creditAccountId: 'cash', amount: '20.00' }, actor);
  assert.deepEqual(recorded.map((r) => r.kind), ['GENERAL', 'GENERAL', 'OFFICE_EXPENSE']);
  assert.deepEqual(recorded.map((r) => r.customerId), ['customer1', 'customer1', null]);
  assert.ok(recorded.every((r) => r.audited), 'every posting has co-transactional audit');
  await service.listJournals({ customerId: 'customer1' });
  assert.equal(filteredCustomer, 'customer1');

  const check = (prototype: object, method: string, code: string) => {
    const metadata = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, Object.getOwnPropertyDescriptor(prototype, method)?.value);
    assert.deepEqual(metadata.permissions, [code]);
  };
  check(AccountingController.prototype, 'post', 'journal:post');
  check(AccountingController.prototype, 'expense', 'expense:post');
  check(AccountingController.prototype, 'reverse', 'journal:reverse');
  check(RatesController.prototype, 'approve', 'currency_rate:approve');
  check(VoucherController.prototype, 'reallocate', 'voucher:allocate');
}

async function reconciliation() {
  const sourceDate = new Date('2026-10-14T12:00:00Z');
  const invoices = [{ id: 'inv1', customerId: 'customer1', currencyCode: 'USD',
    totalAmount: D('100.00'), issueDate: sourceDate, createdAt: sourceDate }];
  const vouchers = [{ id: 'vch1', customerId: 'customer1', currencyCode: 'USD',
    amount: D('25.00'), voucherDate: sourceDate }];
  const rows = [
    { id: 'p1', sourceType: 'invoice', sourceId: 'inv1', customerId: 'customer1',
      currencyCode: 'USD', effectiveAt: sourceDate, debit: D('100.00'), credit: D('0') },
    { id: 'p2', sourceType: 'voucher', sourceId: 'vch1', customerId: 'customer1',
      currencyCode: 'USD', effectiveAt: sourceDate, debit: D('0'), credit: D('25.00') },
  ];
  const tx = {
    customer: { findMany: async () => [{ id: 'customer1' }, { id: 'customer2' }] },
    invoice: { findMany: async () => invoices }, voucher: { findMany: async () => vouchers },
    customerPosting: { findMany: async () => rows },
  } as unknown as Prisma.TransactionClient;
  const db = { $transaction: async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => fn(tx) } as unknown as PrismaClient;
  const service = new CustomerPostingService(db);
  const pass = await service.reconcileAll();
  assert.equal(pass.passed, true);
  assert.equal(pass.checkedCustomers, 2, 'inactive/no-balance customers are not skipped');
  rows[1].credit = D('24.99');
  const fail = await service.reconcileAll();
  assert.equal(fail.passed, false);
  assert(fail.mismatches.some((m) => m.field === 'closingBalance'));
}

async function main() {
  await moneyAndRates();
  await allocations();
  await journalChecks();
  await successfulPostingAndPermissions();
  await reconciliation();
  console.log('Phase 6 unit checks: money/FX snapshot + override, manual/auto/NONE allocations, loan/adjustment/expense journals, permissions, all-customer reconciliation passed');
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
})();

// ---- apps/api/scripts/test-phase7-reports.ts (0 tests) ----
(() => {
const dec = (x: string) => new Prisma.Decimal(x);
const owner: AuthenticatedUser = { id: 'owner', email: 'owner@example.test', roles: [], permissions: [], isPrimaryAdmin: true };
const invoiceReader: AuthenticatedUser = { ...owner, id: 'reader', isPrimaryAdmin: false,
  permissions: ['report:read', 'invoice:read'] };
const date = (d: string) => new Date(`${d}T00:00:00.000Z`);

async function main() {
  // Hand-computed two-currency manifest:
  // USD invoice 110 gross - 10 VAT = 100 income; USD cost 44 gross - 4 input VAT = 40 net.
  // AED invoice 55 gross - 5 VAT = 50 income; AED cost 22 gross - 2 VAT = 20 net.
  // USD profit 60, AED profit 30; the approved AED->USD rate 0.30 yields base profit 69 USD.
  const facts = [
    { id: 'invoice-1', kind: 'invoice' as const, currencyCode: 'USD', gross: dec('110'), vat: dec('10'),
      net: dec('100'), baseCurrencyCode: 'USD', baseNet: dec('100') },
    { id: 'invoice-2', kind: 'invoice' as const, currencyCode: 'AED', gross: dec('55'), vat: dec('5'),
      net: dec('50'), baseCurrencyCode: 'USD', baseNet: dec('15') },
    { id: 'journal-1', kind: 'cost' as const, currencyCode: 'USD', gross: dec('44'), vat: dec('4'),
      net: dec('40'), baseCurrencyCode: 'USD', baseNet: dec('40') },
    { id: 'journal-2', kind: 'cost' as const, currencyCode: 'AED', gross: dec('22'), vat: dec('2'),
      net: dec('20'), baseCurrencyCode: 'USD', baseNet: dec('6') },
  ];
  const totals = pnlTotals(facts);
  assert.deepEqual(totals.byCurrency, [
    { currencyCode: 'AED', grossInvoiced: '55.00', billedVat: '5.00', netIncome: '50.00', netCost: '20.00', netProfit: '30.00' },
    { currencyCode: 'USD', grossInvoiced: '110.00', billedVat: '10.00', netIncome: '100.00', netCost: '40.00', netProfit: '60.00' },
  ]);
  assert.deepEqual(totals.base, { currencyCode: 'USD', income: '115.00', cost: '46.00', profit: '69.00' });
  assert.equal(pnlTotals([{ ...facts[0], baseNet: null }, ...facts.slice(1)]).base, null,
    'missing historic FX cannot be reconstructed');
  assert.equal(pnlTotals([{ ...facts[0], baseCurrencyCode: 'AED' }, ...facts.slice(1)]).base, null,
    'never add incompatible base currencies');
  assert.equal(invoiceBaseNet({ baseAmount: dec('16.50'), exchangeRate: dec('0.3'), baseCurrencyCode: 'USD' }, dec('5'))?.toFixed(2), '15.00');
  assert.deepEqual(invoiceTax({ id: 'i1', taxAmount: dec('10'), items: [{ taxAmount: dec('6') }, { taxAmount: dec('4') }] }),
    { amount: dec('10'), source: 'preserved-lines' });
  assert.equal(invoiceTax({ id: 'old', taxAmount: dec('10'), items: [{ taxAmount: null }] }).source, 'historic-header');
  assert.throws(() => invoiceTax({ id: 'bad', taxAmount: dec('10'), items: [{ taxAmount: dec('9') }] }), ConflictException);
  assert.throws(() => invoiceTax({ id: 'excess', totalAmount: dec('5'), taxAmount: dec('6'),
    items: [{ taxAmount: dec('6') }] }), ConflictException);
  assert.equal(range('2026-01-01', '2026-03-31').lt.toISOString(), '2026-04-01T00:00:00.000Z');
  assert.equal(quarter(2026, 1).lt.toISOString(), '2026-04-01T00:00:00.000Z');
  assert.throws(() => range('2026-02-30', '2026-03-01'), BadRequestException);
  assert.throws(() => range('2026-02-05', '2026-02-04'), BadRequestException);

  // Hand VAT cash example (110 gross/10 VAT): receive 55+55, refund 22 => 8 VAT collected.
  const vat = recognizedVat([
    { invoiceId: 'i1', gross: dec('110'), tax: dec('10'), amount: dec('55'), currencyCode: 'USD', voucherDate: date('2026-01-01'), voucherId: 'a', allocationId: 'a1' },
    { invoiceId: 'i1', gross: dec('110'), tax: dec('10'), amount: dec('55'), currencyCode: 'USD', voucherDate: date('2026-02-01'), voucherId: 'b', allocationId: 'b1' },
    { invoiceId: 'i1', gross: dec('110'), tax: dec('10'), amount: dec('-22'), currencyCode: 'USD', voucherDate: date('2026-03-01'), voucherId: 'c', allocationId: 'c1' },
  ]);
  assert.deepEqual(vat.map((v) => v.vat), ['5.00', '5.00', '-2.00']);
  assert.equal(vat.reduce((sum, line) => sum.plus(line.vat), dec('0')).toFixed(2), '8.00');
  assert.throws(() => recognizedVat([{ invoiceId: 'i1', gross: dec('110'), tax: dec('10'),
    amount: dec('-1'), currencyCode: 'USD', voucherDate: date('2026-01-01'),
    voucherId: 'premature-refund', allocationId: 'invalid' }]), ConflictException,
  'refund cannot create negative invoice settlement');
  assert.deepEqual(recognizedVat([35, 35, 40].map((x, n) => ({
    invoiceId: 'i', gross: dec('110'), tax: dec('10'), amount: dec(String(x)), currencyCode: 'USD',
    voucherDate: date(`2026-01-0${n + 1}`), voucherId: String(n), allocationId: String(n),
  }))).map((e) => e.vat), ['3.18', '3.18', '3.64']);

  // Real service-level P&L: two B/Ls on ONE invoice count once. Inputs reflect
  // the same example; journal reversal removes cost without deleting history.
  const manifest = { id: 'm1', manifestNumber: 'MAN-1', voyageId: 'v1', manifestDate: date('2026-03-05'),
    createdAt: date('2026-03-01'), voyage: { voyageNumber: 'V-1', plannedDepartureAt: date('2026-03-04') } };
  const baseInv = { id: 'i1', invoiceNumber: 'INV-1', customerId: 'c1', status: 'ISSUED',
    issueDate: date('2026-03-06'), createdAt: date('2026-03-05'), voyageId: 'v1', currencyCode: 'USD',
    totalAmount: dec('110'), taxAmount: dec('10'), dueDate: date('2026-03-16'), paidAmount: dec('0'),
    baseAmount: dec('110'), baseCurrencyCode: 'USD', exchangeRate: dec('1'),
    rateEffectiveAt: date('2026-03-06'), rateSource: 'BASE', currencyRateId: null, rateOverrideReason: null,
    items: [{ id: 'line-1', taxAmount: dec('10') }],
    correctionsAsOriginal: [], correctionAsReplacement: null,
    billOfLading: { id: 'b1', billNumber: 'B-1', voyageId: 'v1', manifestId: 'm1', status: 'ISSUED' },
    billLinks: [
      { billOfLading: { id: 'b1', billNumber: 'B-1', voyageId: 'v1', manifestId: 'm1', status: 'ISSUED' } },
      { billOfLading: { id: 'b2', billNumber: 'B-2', voyageId: 'v1', manifestId: 'm1', status: 'ISSUED' } },
    ] };
  const cost = { id: 'cost-1', voyageId: 'v1', manifestId: 'm1', categoryId: 'cat',
    categoryCodeSnapshot: 'PORT_HANDLING', categoryNameSnapshot: 'Port Handling',
    netAmount: dec('40'), baseNetAmount: dec('40'), journal: { id: 'j1', journalNumber: 'J-1',
      reversedAt: null, currencyCode: 'USD', baseCurrencyCode: 'USD', exchangeRate: dec('1'),
      rateEffectiveAt: date('2026-03-07'), rateSource: 'BASE', currencyRateId: null,
      rateOverrideReason: null, lines: [{ id: 'expense-line' }, { id: 'tax-line' }, { id: 'cash-line' }],
      inputTax: { amount: dec('4'), paidAt: date('2026-03-07') } } };
  let differentCostManifest = false;
  let differentIncomeManifest = false;
  const fakeDb = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>, opts: { isolationLevel: string }) => {
      assert.equal(opts.isolationLevel, 'RepeatableRead');
      return fn(fakeDb);
    },
    manifest: { findMany: async () => [manifest] },
    billOfLading: { findMany: async () => [{ id: 'b1' }, { id: 'b2' }] },
    invoice: { findMany: async (q: { select: object }) => 'invoiceNumber' in q.select && 'items' in q.select
      ? [{ ...baseInv, billLinks: differentIncomeManifest ?
        [baseInv.billLinks[0],
          { billOfLading: { ...baseInv.billLinks[1].billOfLading, manifestId: 'other-manifest' } }] : baseInv.billLinks }] : [] },
    voyageCost: { findMany: async () => [{ ...cost, manifestId: differentCostManifest ? 'other-manifest' : 'm1' }] },
    customerPosting: { findMany: async () => [{ id: 'posting', sourceId: 'i1', eventKey: 'invoice:i1:ISSUE', debit: dec('110') }] },
    voucherAllocation: { findMany: async () => [] },
  };
  const p = await new StandardReportsService(fakeDb as unknown as PrismaService,
    {} as VoucherService, {} as AuditService).pnl({ year: 2026 });
  assert.equal(p.rows[0].byCurrency[0].netIncome, '100.00');
  assert.equal(p.rows[0].byCurrency[0].netCost, '40.00');
  assert.equal(p.rows[0].byCurrency[0].netProfit, '60.00');
  assert.equal(p.annual.byCurrency[0].netProfit, '60.00', 'annual == one filtered manifest');
  assert.equal(p.rows[0].sources.filter((s) => s.kind === 'invoice').length, 1);
  assert.equal(p.rows[0].reconciled, true);
  assert.equal(p.rows[0].sources.find((s) => s.kind === 'cost')?.journalId, 'j1');
  differentCostManifest = true;
  const detachedCost = await new StandardReportsService(fakeDb as unknown as PrismaService,
    {} as VoucherService, {} as AuditService).pnl({ year: 2026 });
  assert.equal(detachedCost.complete, false, 'another manifest cost is not silently reassigned');
  assert.equal(detachedCost.rows[0].byCurrency[0].netCost, '0.00');
  differentCostManifest = false;
  differentIncomeManifest = true;
  const detachedIncome = await new StandardReportsService(fakeDb as unknown as PrismaService,
    {} as VoucherService, {} as AuditService).pnl({ year: 2026 });
  assert.equal(detachedIncome.complete, false, 'another manifest invoice is not silently reassigned');
  assert.equal(detachedIncome.rows[0].sources.some((s) => s.kind === 'invoice'), false);
  differentIncomeManifest = false;

  const spec = { source: 'invoices', columns: ['invoiceNumber', 'customerName', 'netIncome'],
    filters: [], metrics: [{ op: 'sum', field: 'netIncome', as: 'income' }] };
  assert.throws(() => parseSpec(spec, invoiceReader), ForbiddenException,
    'customerName requires customer:read even if invoice dataset is allowed');
  assert.ok(!availableCatalogue(invoiceReader).find((x) => x.source === 'invoices')?.fields.some((f) => f.field === 'customerName'));
  const noNames = { ...spec, columns: ['invoiceNumber', 'netIncome'] };
  parseSpec(noNames, invoiceReader);
  assert.throws(() => parseSpec({ ...noNames, filters: [{ field: 'customerName', op: 'contains', value: 'secret' }] },
    invoiceReader), ForbiddenException, 'filtering a hidden field must also be forbidden');
  assert.throws(() => parseSpec({ ...noNames, sort: { field: 'customerName', direction: 'asc' } }, invoiceReader), ForbiddenException);
  assert.throws(() => parseSpec({ ...noNames, metrics: [{ op: 'sum', field: 'constructor', as: 'pwn' }] }, owner), BadRequestException);
  assert.throws(() => parseSpec({ ...noNames, columns: ['salary'] }, owner), BadRequestException);
  assert.throws(() => parseSpec({ ...noNames, columns: ['constructor'] }, owner), BadRequestException);
  assert.throws(() => parseSpec({ ...noNames, columns: ['currencyRateId'] }, invoiceReader), ForbiddenException,
    'approved-rate source IDs are masked without a currency-rate read grant');
  assert.throws(() => parseSpec({ ...noNames, metrics: [{ op: 'sum', field: 'exchangeRate', as: 'nonsense' }] },
    invoiceReader), BadRequestException, 'FX rates cannot be added as money');
  assert.throws(() => parseSpec({ ...noNames, source: 'journal_lines' }, invoiceReader), ForbiddenException);
  const mockRows = [
    { id: '1', invoiceNumber: 'I1', netIncome: '100.00', currencyCode: 'USD', status: 'ISSUED' },
    { id: '2', invoiceNumber: 'I2', netIncome: '40.00', currencyCode: 'USD', status: 'ISSUED' },
  ];
  const mockData = { load: async () => mockRows } as unknown as ReportDatasets;
  const builder = new ReportBuilderService({} as PrismaService, mockData, {} as AuditService);
  const all = await builder.run(noNames, invoiceReader);
  const noFilter = await builder.run({ ...noNames, filters: [] }, invoiceReader);
  assert.equal(all.totals.income, '140.00');
  assert.equal(noFilter.totals.income, all.totals.income, 'explicit no-filter = implicit no-filter');
  assert.equal((await builder.run({ ...noNames, filters: [{ field: 'invoiceNumber', op: 'eq', value: 'I1' }] }, invoiceReader)).totals.income, '100.00');
  const groups = await builder.run({ ...noNames, groupBy: ['currencyCode'], filters: [],
    metrics: [{ op: 'sum', field: 'netIncome', as: 'income' }] }, invoiceReader);
  assert.equal(groups.rows[0].income, '140.00');
  const mixed = new ReportBuilderService({} as PrismaService,
    { load: async () => [mockRows[0], { ...mockRows[1], currencyCode: 'AED' }] } as unknown as ReportDatasets,
    {} as AuditService);
  await assert.rejects(mixed.run(noNames, invoiceReader), ConflictException, 'mixed currency grand totals fail');
  const groupedMixed = await mixed.run({ ...noNames, groupBy: ['currencyCode'] }, invoiceReader);
  assert.equal(groupedMixed.totals.income, null, 'group totals permitted but mixed grand total unavailable');
  assert.equal(groupedMixed.rows.length, 2);

  const exporter = new ReportExportService();
  const output = exporter.custom(all);
  assert.equal(output.tables[0].rows[0].sourceId, '1');
  const xlsx = await exporter.excel({ ...output, tables: [{ name: 'Formula safety', columns: ['name'],
    rows: [{ name: '=1+1' }, { name: 'نام مشتری' }] }] });
  assert.equal(xlsx.subarray(0, 2).toString(), 'PK');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.read(Readable.from([xlsx]));
  assert.equal(workbook.getWorksheet('Formula safety')?.getCell('A2').value, "'=1+1",
    'untrusted text must remain literal in the saved workbook, not a formula');
  assert.equal(workbook.getWorksheet('Formula safety')?.getCell('A3').value, 'نام مشتری');
  const pdf = await exporter.pdf({ ...output, tables: [{ name: 'Unicode', columns: ['name'],
    rows: [{ name: 'نام مشتری' }] }] });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  console.log('Phase 7 manual P&L, VAT, permission/masking, grouping, filtering, FX gaps and Excel/PDF: PASS');
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 2; });
})();

// ---- apps/api/scripts/test-phase7-services.ts (0 tests) ----
(() => {
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
})();

// ---- apps/api/scripts/test-phase8-documents.ts (0 tests) ----
(() => {
function png(): Buffer {
  const signature = Buffer.from('89504e470d0a1a0a', 'hex');
  const crc = (bytes: Buffer) => {
    let result = 0xffffffff;
    for (const byte of bytes) {
      result ^= byte;
      for (let i = 0; i < 8; i++) result = (result >>> 1) ^ (result & 1 ? 0xedb88320 : 0);
    }
    return (result ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, bytes: Buffer) => {
    const name = Buffer.from(type);
    const length = Buffer.alloc(4); length.writeUInt32BE(bytes.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc(Buffer.concat([name, bytes])));
    return Buffer.concat([length, name, bytes, checksum]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4);
  header[8] = 8; header[9] = 6; // one RGBA pixel
  return Buffer.concat([signature, chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))), chunk('IEND', Buffer.alloc(0))]);
}

const fixture = png();
const calls: string[] = [];
const assets = { bytes: async (_id: string, kind: string) => { calls.push(kind); return fixture; } };
const renderer = new DocumentRendererService(assets as unknown as DocumentAssetsService);
const identity = { companyName: 'Recorded company', legalName: null, registrationNumber: null,
  taxNumber: 'TRN-original', address: null, city: null, country: null,
  phone: null, email: null, defaultCurrency: 'USD' };
const owner: AuthenticatedUser = { id: 'owner', email: 'owner@example.test', roles: [], permissions: [], isPrimaryAdmin: true };
const portal: AuthenticatedUser = { ...owner, id: 'portal', isPrimaryAdmin: false,
  portalAgentId: 'agent-1', permissions: ['portal:access'] };

async function projectionCases() {
  const date = new Date('2026-10-15T11:00:00Z');
  const bill = { billNumber: 'BOL-123', status: 'APPROVED', issuedAt: date, createdAt: date,
    dateOfIssue: date, vesselName: 'Ship', voyage: { voyageNumber: 'V-1' },
    shipper: { name: 'Shipper' }, consignee: { name: 'Consignee' },
    goodsDescription: 'Cargo', totalPackages: 2, totalGrossWeight: '12', freightAmount: '10',
    currencyCode: 'USD', notes: null, items: [{ cargo: { reference: 'CARGO' },
      goodsDescription: 'Goods', packages: 2, grossWeight: '12', marksAndNumbers: null }] };
  const payment = { voucherNumber: 'PMT-123', type: 'PAYMENT', status: 'POSTED', voucherDate: date,
    createdAt: date, customer: { name: 'Customer' }, amount: '10.20', currencyCode: 'USD',
    reference: 'P1', description: 'Refund', allocations: [] };
  const fake = {
    loadList: { findFirst: async () => ({ loadListNumber: 'LOAD-1', status: 'FINALIZED', createdAt: date,
      finalizedAt: date, notes: null, voyage: { voyageNumber: 'V-1', vessel: { name: 'Ship' },
        originPort: { name: 'A' }, destinationPort: { name: 'B' } },
      items: [{ sequence: 1, plannedQuantity: 3, cargo: { reference: 'CARGO', description: 'Goods',
        quantity: 4, packages: 2, weight: '12' } }] }) },
    billOfLading: { findFirst: async () => bill },
    manifest: { findFirst: async () => ({ manifestNumber: 'MAN-1', status: 'APPROVED', createdAt: date,
      manifestDate: date, approvedAt: date, vesselName: 'Ship', voyage: { voyageNumber: 'V-1' },
      polPort: { name: 'A' }, podPort: { name: 'B' }, totalQuantity: 3, totalPackages: 2,
      totalWeight: '12', notes: null, items: [{ blNumber: null,
        billOfLadingItem: { billOfLading: { billNumber: 'BOL-123' } },
        shipper: { name: 'Shipper' }, consignee: { name: 'Consignee' },
        cargo: { description: 'Goods' }, quantity: 3, packages: 2, weight: '12' }] }) },
    invoice: { findFirst: async () => ({ invoiceNumber: 'INV-123', status: 'ISSUED', issueDate: date,
      issuedAt: date, createdAt: date, customer: { name: 'Customer' },
      billOfLading: { billNumber: 'BOL-123' }, title: null, description: null,
      currencyCode: 'USD', subtotal: '10.00', taxAmount: '0.50', totalAmount: '10.50',
      trn: 'original-TRN', notes: null,
      items: [{ description: 'Goods', quantity: 1, unitPrice: '10.00',
        amount: '10.00', taxAmount: '0.50' }] }) },
    deliveryOrder: { findFirst: async () => ({ docNumber: 'DO-1', status: 'ISSUED', createdAt: date,
      issueDate: new Date('2026-10-01T00:00:00Z'), recipient: 'Recipient', portName: 'A', notes: null,
      billOfLading: { billNumber: 'BOL-123', vesselName: 'Ship' } }) },
    releaseOrder: { findFirst: async () => ({ docNumber: 'RO-1', status: 'ISSUED', createdAt: date,
      releaseDate: date, paymentState: 'PARTIAL', notes: null,
      billOfLading: { billNumber: 'BOL-123', vesselName: 'Ship' } }) },
    salaryRecord: { findFirst: async () => ({ recordNumber: 'SAL-1', status: 'APPROVED', createdAt: date,
      approvedAt: date, year: 2026, month: 10, employee: { name: 'Employee', code: 'E-1' },
      base: '1000', additions: '100', deductions: '50', net: '1050',
      currencyCode: 'USD', notes: null }) },
    voucher: { findFirst: async ({ where }: { where: { type?: string } }) =>
      where.type === 'RECEIPT' ? { ...payment, voucherNumber: 'RCP-123', type: 'RECEIPT' } : payment },
  };
  for (const type of DOCUMENT_TYPES.filter((t) => t !== 'ledger')) {
    const data = await projectRecordedDocument(fake as unknown as Prisma.TransactionClient, type, 'record-12345');
    assert.equal(data.issued, true, `${type} is an issued projection`);
    assert.equal(data.type, type);
    assert.ok(data.fields.number);
    assert.ok(data.effectiveAt instanceof Date);
  }
  const manifest = await projectRecordedDocument(fake as unknown as Prisma.TransactionClient, 'manifest', 'record-12345');
  assert.equal(manifest.rows[0].reference, 'BOL-123', 'new manifest line resolves its B/L reference');
  assert.equal(manifest.rows[0].shipper, 'Shipper');
  assert.deepEqual(manifest.rows.at(-1), { reference: 'TOTAL', units: '3', packages: '2', weight: '12' });
  const delivery = await projectRecordedDocument(fake as unknown as Prisma.TransactionClient, 'delivery-order', 'record-12345');
  assert.equal(delivery.effectiveAt?.toISOString(), date.toISOString(), 'backdated display date is not issuance time');
  assert.equal(delivery.fields.date, '2026-10-01');
  const inv = await projectRecordedDocument(fake as unknown as Prisma.TransactionClient, 'invoice', 'record-12345');
  assert.equal(inv.fields.taxNumber, 'original-TRN');
  const salary = await projectRecordedDocument(fake as unknown as Prisma.TransactionClient, 'salary-slip', 'record-12345');
  const salaryWorkbook = new ExcelJS.Workbook();
  await salaryWorkbook.xlsx.load(await renderer.render(salary, defaultLayout('salary-slip'), identity, 'xlsx', owner));
  assert.ok(salaryWorkbook.getWorksheet('Document')!.getRows(1, 30)!
    .flatMap((row) => row.values as unknown[]).includes('-50'), 'negative deductions remain exact spreadsheet text');
  const ledger = await new DocumentDataService(fake as unknown as PrismaService,
    { ledger: async () => ({ summary: { customerName: 'Customer', currencyCode: 'MIXED',
      closingBalance: '300', warning: 'Mixed currencies' }, entries: [] }) } as unknown as VoucherService)
    .get('ledger', 'customer-123');
  assert.equal(ledger.issued, false);
  assert.equal(ledger.fields.amount, '', 'never display a cross-currency closing sum');
}

async function main() {
  inspectArtworkImage(fixture, 'image/png');
  inspectArtworkImage(readFileSync(join(__dirname, '../../web/public/images/operations-network.jpg')), 'image/jpeg');
  const oversized = Buffer.from(fixture); oversized.writeUInt32BE(10_000, 16);
  assert.throws(() => inspectArtworkImage(oversized, 'image/png'), BadRequestException);
  assert.throws(() => inspectArtworkImage(Buffer.from('89504e470d0a1a0a', 'hex'), 'image/png'), BadRequestException);
  const approvedAt = new Date('2026-10-12T00:00:00Z');
  const retiredAt = new Date('2026-10-16T00:00:00Z');
  const verifiedAsset = new DocumentAssetsService({ documentAsset: { findUnique: async () => ({
    kind: 'STAMP', approvedAt, deactivatedAt: retiredAt, isApproved: false,
    storageKey: 'private', sha256: createHash('sha256').update(fixture).digest('hex'),
  }) } } as unknown as PrismaService, { record: async () => undefined } as unknown as AuditService,
  { getFile: async () => fixture } as StorageAdapter);
  assert.deepEqual(await verifiedAsset.bytes('stamp', 'STAMP', owner, new Date('2026-10-15T12:00:00Z')), fixture,
    'a retired mark is still eligible when approved at actual issuance');
  await assert.rejects(() => verifiedAsset.bytes('stamp', 'STAMP', owner, new Date('2026-10-10T00:00:00Z')),
    NotFoundException, 'the same backdated display date predates artwork approval');
  await assert.rejects(() => verifiedAsset.bytes('stamp', 'STAMP', owner, new Date('2026-10-17T00:00:00Z')),
    NotFoundException, 'a newly issued document cannot select retired artwork');
  assert.equal(DOCUMENT_TYPES.length, 11, 'DEC-099 catalog');
  assert.equal(new Set(DOCUMENT_TYPES).size, 11);
  await projectionCases();
  for (const type of DOCUMENT_TYPES) {
    const data: DocumentData = { type, id: 'record-12345', number: 'DOC-01', status: 'ISSUED',
      effectiveAt: new Date('2026-10-15T11:00:00Z'), issued: true,
      fields: { number: 'DOC-01', party: '=1+1', amount: '9007199254740993.20',
        taxNumber: 'TRN-at-issuance', status: 'ISSUED' },
      rows: [{ reference: 'REF', description: '+cmd()', amount: '9007199254740993.20' }] };
    const layout = { ...defaultLayout(type), columns: ['reference', 'description', 'amount'],
      stampAssetId: 'asset-stamp', signatureAssetId: 'asset-signature' };
    assert.equal(validateLayout(layout).title.length > 0, true);
    calls.length = 0;
    const print = await renderer.render(data, layout, identity, 'print', owner);
    assert.equal(print.subarray(0, 5).toString(), '%PDF-');
    assert.deepEqual(calls, [], `${type}: print must never read company stamp/signature bytes`);
    calls.length = 0;
    const pdf = await renderer.render(data, layout, identity, 'pdf', owner);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.deepEqual(calls, ['STAMP', 'SIGNATURE'], `${type}: PDF has only assigned approval marks`);
    assert.match(pdf.toString('latin1'), /\/Subtype\s*\/Image/, 'PDF contains approved images');
    calls.length = 0;
    const excel = await renderer.render(data, layout, identity, 'xlsx', owner);
    assert.equal(excel.subarray(0, 2).toString(), 'PK');
    assert.deepEqual(calls, [], `${type}: Excel omits approval artwork`);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(excel);
    const sheet = book.getWorksheet('Document')!;
    const values = sheet.getRows(1, sheet.rowCount)!.flatMap((row) => row.values as Array<unknown>);
    assert.ok(values.includes("'=1+1"), `${type}: input is inert spreadsheet text`);
    assert.ok(values.includes("'+cmd()"));
    assert.ok(values.includes('9007199254740993.20'), 'money remains an exact string');
    if (type === 'invoice') assert.ok(values.includes('TRN-at-issuance'), 'issued TRN does not change with company settings');
  }
  const sample: DocumentData = { type: 'invoice', id: 'sample-record', number: 'INV-123',
    status: 'DRAFT', effectiveAt: null, issued: false, fields: { number: 'INV-123' }, rows: [] };
  const beforeSwitch = new ExcelJS.Workbook();
  await beforeSwitch.xlsx.load(await renderer.render(sample, { ...defaultLayout('invoice'), title: 'Version A' }, identity, 'xlsx', owner));
  const afterSwitch = new ExcelJS.Workbook();
  await afterSwitch.xlsx.load(await renderer.render(sample, { ...defaultLayout('invoice'), title: 'Version B' }, identity, 'xlsx', owner));
  assert.equal(beforeSwitch.getWorksheet('Document')!.getCell('A1').value, 'Version A');
  assert.equal(afterSwitch.getWorksheet('Document')!.getCell('A1').value, 'Version B');
  // Instrument PDFKit's text call, not PDF internals: a long draft must get a
  // DRAFT overlay on EACH page; the live ledger gets LIVE, never DRAFT.
  const originalText = PDFDocument.prototype.text;
  let watermarks = 0;
  PDFDocument.prototype.text = function (...args: Parameters<typeof originalText>) {
    if (args[0] === 'DRAFT') watermarks++;
    return originalText.apply(this, args);
  };
  try {
    const draft: DocumentData = { type: 'bill', id: 'draft-record', number: 'B-1',
      status: 'DRAFT', effectiveAt: null, issued: false,
      fields: { number: 'B-1' }, rows: Array.from({ length: 110 }, (_, i) =>
        ({ description: `Line ${i} with several words to use vertical space` })) };
    await renderer.render(draft, defaultLayout('bill'), identity, 'print', owner);
    assert.ok(watermarks > 1, 'all draft B/L pages get a DRAFT watermark');
    calls.length = 0;
    await renderer.render(draft, { ...defaultLayout('bill'),
      stampAssetId: 'asset-stamp', signatureAssetId: 'asset-signature' }, identity, 'pdf', owner);
    assert.deepEqual(calls, [], 'draft B/L cannot carry issuance approval marks');
  } finally { PDFDocument.prototype.text = originalText; }
  assert.throws(() => validateLayout({ ...defaultLayout('invoice'), externalUrl: 'https://bad.test' }), BadRequestException);
  assert.throws(() => validateLayout({ ...defaultLayout('invoice'), columns: ['__proto__'] }), BadRequestException);
  assert.throws(() => validateLayout({ ...defaultLayout('invoice'), fields: ['number', 'number'] }), BadRequestException);
  assert.throws(() => validateLayout({ ...defaultLayout('invoice'), stampAssetId: '../secret' }), BadRequestException);

  // DB-free issuance transaction: projection, company identity and template
  // assignment are copied before their source rows can change.
  const prior = new Date('2026-10-10T00:00:00Z');
  let currentCompany = 'Company at issuance';
  let currentParty = 'Alice';
  let activeVersion: string | null = 'version-old';
  let issuedSnapshot: { data: Prisma.JsonValue; identity: Prisma.JsonValue;
    fallbackLayout: Prisma.JsonValue; templateVersionId: string | null; createdAt?: Date } | null = null;
  const tx = {
    invoice: { findFirst: async () => ({ invoiceNumber: 'INV-123', status: 'ISSUED',
      issueDate: prior, issuedAt: prior, createdAt: prior, customer: { name: currentParty },
      billOfLading: null, title: null, description: null, currencyCode: 'USD', subtotal: '1.00',
      taxAmount: '0', totalAmount: '1.00', trn: 'TRN-at-issuance', notes: null,
      items: [{ description: 'Line', quantity: 1, unitPrice: '1', amount: '1', taxAmount: '0' }] }) },
    companySettings: { findFirst: async () => ({ ...identity, companyName: currentCompany }) },
    documentTemplateAssignment: { findFirst: async () => ({ versionId: activeVersion }) },
    documentIssuedSnapshot: { create: async ({ data }: { data: typeof issuedSnapshot }) => {
      issuedSnapshot = data;
    } },
  };
  await captureIssuedDocument(tx as unknown as Prisma.TransactionClient, 'invoice', 'inv-record', 'issuer');
  assert.equal((issuedSnapshot as { data: DocumentData }).data.fields.party, 'Alice');
  assert.equal((issuedSnapshot as { identity: { companyName: string } }).identity.companyName, 'Company at issuance');
  assert.equal((issuedSnapshot as { fallbackLayout: unknown }).fallbackLayout, Prisma.JsonNull,
    'assigned versions use their immutable, hash-verified stored layout');
  const assignedSnapshot = issuedSnapshot;
  activeVersion = null;
  await captureIssuedDocument(tx as unknown as Prisma.TransactionClient, 'invoice', 'inv-fallback', 'issuer');
  assert.equal((issuedSnapshot as { fallbackLayout: { title: string } }).fallbackLayout.title, 'Invoice',
    'the generic fallback is also frozen at issuance');
  const capturedAt = new Date('2026-10-15T12:00:00Z');
  issuedSnapshot = { ...assignedSnapshot, createdAt: capturedAt };
  currentCompany = 'Renamed company'; currentParty = 'Bob'; activeVersion = 'version-new';

  let projected = 0;
  let rendered = 0;
  const stored = new Map<string, { content: Buffer; sha256: string }>();
  const db = {
    documentIssuedSnapshot: { findUnique: async () => issuedSnapshot },
    documentTemplateVersion: { findUnique: async ({ where }: { where: { id: string } }) =>
      where.id === 'version-new' ? { template: { documentType: 'invoice' } } : null },
    documentRenderedOutput: {
      findUnique: async ({ where }: { where: { documentType_recordId_format_revisionKey: object } }) =>
        stored.get(JSON.stringify(where.documentType_recordId_format_revisionKey)) ?? null,
      create: async ({ data }: { data: { documentType: string; recordId: string; format: string;
        revisionKey: string; content: Buffer; sha256: string } }) => {
        const { documentType, recordId, format, revisionKey } = data;
        stored.set(JSON.stringify({ documentType, recordId, format, revisionKey }), data);
        return data;
      },
    },
  };
  const templates = { versionAt: async () => { throw new Error('Current assignment must not be consulted'); },
    readLayout: async (id: string) => {
      assert.equal(id, rendered ? 'version-new' : 'version-old');
      return defaultLayout('invoice');
    } };
  const service = new DocumentOutputService(db as unknown as PrismaService,
    templates as unknown as DocumentTemplateService,
    { get: async () => { projected++; throw new Error('Snapshot must replace current projection'); } } as unknown as DocumentDataService,
    { render: async (data: DocumentData, _layout: unknown, snapshotIdentity: typeof identity,
      _format: string, _actor: AuthenticatedUser, artworkAt: Date | null) => {
      assert.equal(data.fields.party, 'Alice');
      assert.equal(snapshotIdentity.companyName, 'Company at issuance');
      assert.equal(artworkAt?.getTime(), rendered ? undefined : capturedAt.getTime(),
        'assigned artwork is eligible at actual capture time, not the backdated display date');
      rendered++; return Buffer.from(`frozen-${rendered}`);
    } } as unknown as DocumentRendererService,
    { getDocumentIdentity: async () => { throw new Error('Current company must not be consulted'); } } as unknown as CompanySettingsService);
  await assert.rejects(() => service.output(portal, 'invoice', 'inv-record', 'pdf'), ForbiddenException);
  const partial: AuthenticatedUser = { ...portal, portalAgentId: null, permissions: ['document:render'] };
  await assert.rejects(() => service.output(partial, 'invoice', 'inv-record', 'pdf'), ForbiddenException);
  assert.equal(projected, 0, 'denied callers do not read records');
  const reader: AuthenticatedUser = { ...portal, portalAgentId: null, permissions: ['document:render', 'invoice:read'] };
  await assert.rejects(() => service.output({ ...reader, portalAgentId: 'agent-1' }, 'invoice', 'inv-record', 'pdf'),
    ForbiddenException, 'a portal principal cannot render an unscoped office document even with mistaken grants');
  const first = await service.output(reader, 'invoice', 'inv-record', 'pdf');
  const second = await service.output(reader, 'invoice', 'inv-record', 'pdf');
  assert.equal(first.bytes.toString(), 'frozen-1');
  assert.equal(second.bytes.toString(), 'frozen-1', 'archive bytes not recomputed');
  assert.equal(rendered, 1);
  await assert.rejects(() => service.output(reader, 'invoice', 'inv-record', 'pdf', { previewVersionId: 'version-new' }), ForbiddenException);
  await assert.rejects(() => service.output(reader, 'unknown', 'inv-record', 'pdf'), BadRequestException);
  await assert.rejects(() => service.output(owner, 'ledger', 'customer-123', 'pdf',
    { fromDate: '2026-02-30' }), BadRequestException);
  const preview = await service.output(owner, 'invoice', 'inv-record', 'pdf', { previewVersionId: 'version-new' });
  assert.equal(preview.bytes.toString(), 'frozen-2', 'authorized preview is not the issued archive');

  // Historical rows cannot be backfilled with fabricated issuance state. Warn
  // on first render, then return the same archived bytes after status changes.
  let historicStatus = 'ISSUED';
  let historicRenders = 0;
  let historicWarning = '';
  const historicDb = { ...db,
    documentIssuedSnapshot: { findUnique: async () => null },
    documentRenderedOutput: {
      findUnique: db.documentRenderedOutput.findUnique,
      create: db.documentRenderedOutput.create,
    } };
  const historic = new DocumentOutputService(historicDb as unknown as PrismaService,
    { versionAt: async () => null } as unknown as DocumentTemplateService,
    { get: async () => ({ type: 'invoice', id: 'legacy-record', number: 'INV-LEGACY',
      status: historicStatus, issued: true, effectiveAt: prior,
      fields: { party: currentParty }, rows: [] }) } as unknown as DocumentDataService,
    { render: async (d: DocumentData) => {
      historicWarning = d.warning ?? ''; historicRenders++;
      return Buffer.from(`legacy-${historicRenders}`);
    } } as unknown as DocumentRendererService,
    { getDocumentIdentity: async () => identity } as unknown as CompanySettingsService);
  const legacyFirst = await historic.output(reader, 'invoice', 'legacy-record', 'pdf');
  assert.match(historicWarning, /reconstructed on first render/);
  historicStatus = 'CANCELLED'; currentParty = 'Renamed party';
  const legacyLater = await historic.output(reader, 'invoice', 'legacy-record', 'pdf');
  assert.equal(legacyLater.bytes.toString(), legacyFirst.bytes.toString());
  assert.equal(historicRenders, 1);
  console.log('Phase 8 document unit checks passed: 11 projections and 11 types × PDF/Print/Excel; marks, workbook data, issuance snapshot, permissions and archive.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
})();

