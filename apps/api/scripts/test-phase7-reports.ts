import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { invoiceTax, invoiceBaseNet, pnlTotals, quarter, range, recognizedVat } from '../src/modules/reports/report-math';
import { parseSpec, availableCatalogue } from '../src/modules/reports/report-catalogue';
import { ReportBuilderService } from '../src/modules/reports/report-builder.service';
import { ReportExportService } from '../src/modules/reports/report-export.service';
import { StandardReportsService } from '../src/modules/reports/standard-reports.service';
import type { AuthenticatedUser } from '../src/common/auth/types';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { VoucherService } from '../src/modules/voucher/voucher.service';
import type { AuditService } from '../src/common/infrastructure/audit/audit.service';
import type { ReportDatasets } from '../src/modules/reports/report-datasets';

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
