import 'reflect-metadata';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Prisma, PrismaClient, VoucherType } from '@prisma/client';
import { exactMoney, exactRate, toBase } from '../src/modules/finance/financial-money';
import { ExchangeRateService } from '../src/modules/finance/exchange-rate.service';
import { VoucherAllocationService } from '../src/modules/voucher/voucher-allocation.service';
import { CreateVoucherDto } from '../src/modules/voucher/dto/voucher.dto';
import { CustomerPostingService } from '../src/modules/finance/customer-posting.service';
import { AccountingService } from '../src/modules/accounting/accounting.service';
import { AccountingController } from '../src/modules/accounting/accounting.controller';
import { RatesController } from '../src/modules/currencies/rates.controller';
import { VoucherController } from '../src/modules/voucher/voucher.controller';
import { REQUIRED_PERMISSIONS_KEY } from '../src/common/auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../src/common/auth/types';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuditService } from '../src/common/infrastructure/audit/audit.service';
import type { NumberingService } from '../src/common/infrastructure/numbering';

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
