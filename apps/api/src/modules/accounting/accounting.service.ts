import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { AccountType, JournalKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { NumberingService, nextSequenceAfter, periodicSequenceRequest } from '../../common/infrastructure/numbering';
import { ExchangeRateService } from '../finance/exchange-rate.service';
import { exactMoney, toBase, transactionDate } from '../finance/financial-money';
import type {
  CreateAccountDto, JournalLineDto, PostExpenseDto, PostJournalDto, PostVoyageCostDto, UpdateAccountDto,
} from './dto/accounting.dto';

const ZERO = new Prisma.Decimal(0);
type ExpenseMeta = {
  tax?: { amount: Prisma.Decimal; paidAt: Date | null; vatAccountId: string | null };
  cost?: { voyageId: string; manifestId?: string; categoryId: string };
};

function side(value: string | undefined): Prisma.Decimal {
  if (value === undefined || value === '') return ZERO;
  try {
    const amount = new Prisma.Decimal(value);
    if (amount.isFinite() && amount.greaterThanOrEqualTo(0) && amount.decimalPlaces() <= 2) return amount;
  } catch { /* invalid decimal */ }
  throw new BadRequestException('Debit and credit must be nonnegative decimal amounts with at most 2 places');
}

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly fx: ExchangeRateService,
  ) {}

  listAccounts(type?: AccountType) {
    return this.prisma.account.findMany({ where: type ? { type } : {}, orderBy: { code: 'asc' } });
  }

  async createAccount(dto: CreateAccountDto, actor: AuthenticatedUser) {
    if (!dto.name.trim()) throw new BadRequestException('Account name is required');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.account.create({ data: { code: dto.code, name: dto.name.trim(), type: dto.type, createdById: actor.id } });
        await this.audit.recordIn(tx, { action: 'account.create', entityType: 'Account', entityId: row.id,
          actorId: actor.id, actorEmail: actor.email, afterData: row });
        return row;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Account code must be unique');
      }
      throw error;
    }
  }

  async updateAccount(id: string, dto: UpdateAccountDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.account.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Account not found');
      if (dto.name !== undefined && !dto.name.trim()) throw new BadRequestException('Account name is required');
      const after = await tx.account.update({ where: { id }, data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      } });
      await this.audit.recordIn(tx, { action: 'account.update', entityType: 'Account', entityId: id,
        actorId: actor.id, actorEmail: actor.email, beforeData: before, afterData: after });
      return after;
    });
  }

  listJournals(params: { page?: number; currencyCode?: string; kind?: JournalKind; customerId?: string }) {
    const page = Math.max(1, Math.min(100000, params.page ?? 1));
    return this.prisma.generalJournal.findMany({
      where: { ...(params.currencyCode ? { currencyCode: params.currencyCode } : {}),
        ...(params.kind ? { kind: params.kind } : {}),
        ...(params.customerId ? { lines: { some: { customerId: params.customerId } } } : {}) },
      include: { lines: { include: { account: { select: { code: true, name: true, type: true } } } } },
      orderBy: [{ journalDate: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 100, take: 100,
    });
  }

  async journal(id: string) {
    const row = await this.prisma.generalJournal.findUnique({ where: { id }, include: {
      lines: { include: { account: { select: { code: true, name: true, type: true } } } },
      inputTax: true, reportCost: true,
    } });
    if (!row) throw new NotFoundException('Journal not found');
    return row;
  }

  /** One account ledger per original currency; no unlabeled cross-currency sum. */
  async accountEntries(accountId: string, currencyCode?: string) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Account not found');
    const lines = await this.prisma.journalLine.findMany({
      where: { accountId, ...(currencyCode ? { journal: { currencyCode } } : {}) },
      include: { journal: { select: { journalNumber: true, journalDate: true, description: true,
        currencyCode: true, baseCurrencyCode: true, exchangeRate: true, rateEffectiveAt: true,
        rateSource: true, reversedAt: true, reversalOfId: true } } },
      orderBy: { journal: { journalDate: 'asc' } },
    });
    const byCurrency = new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();
    for (const l of lines) {
      const current = byCurrency.get(l.journal.currencyCode) ?? { debit: ZERO, credit: ZERO };
      byCurrency.set(l.journal.currencyCode, { debit: current.debit.plus(l.debit), credit: current.credit.plus(l.credit) });
    }
    return { account, entries: lines, totals: [...byCurrency].map(([currency, t]) => ({
      currencyCode: currency, debit: t.debit.toFixed(2), credit: t.credit.toFixed(2), balance: t.debit.minus(t.credit).toFixed(2),
    })) };
  }

  async post(dto: PostJournalDto, actor: AuthenticatedUser, kind: JournalKind = JournalKind.GENERAL, meta?: ExpenseMeta) {
    if (!dto.description?.trim()) throw new BadRequestException('Description is required');
    if (!dto.lines || dto.lines.length < 2) throw new BadRequestException('At least two journal lines required');
    const date = transactionDate(dto.journalDate);
    const parsed = dto.lines.map((line: JournalLineDto) => ({
      accountId: line.accountId, customerId: line.customerId || null, memo: line.memo?.trim() || null,
      debit: side(line.debit), credit: side(line.credit),
    }));
    if (parsed.some((l) => l.debit.greaterThan(0) === l.credit.greaterThan(0))) {
      throw new BadRequestException('Each line must have either debit or credit (not both)');
    }
    const debit = parsed.reduce((sum, l) => sum.plus(l.debit), ZERO);
    const credit = parsed.reduce((sum, l) => sum.plus(l.credit), ZERO);
    if (!debit.equals(credit) || debit.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Journal debits and credits must balance in original currency');
    }
    try {
      const saved = await this.prisma.$transaction(async (tx) => {
        const rate = await this.fx.resolve(tx, dto.currencyCode, date, actor,
          dto.exchangeRate !== undefined ? { rate: dto.exchangeRate, reason: dto.rateOverrideReason ?? '' } : undefined);
        if (dto.rateOverrideReason && dto.exchangeRate === undefined) throw new BadRequestException('Provide an overridden rate as well as a reason');
        const accounts = await tx.account.findMany({ where: { id: { in: [...new Set(parsed.map((l) => l.accountId))] }, isActive: true } });
        if (accounts.length !== new Set(parsed.map((l) => l.accountId)).size) {
          throw new ConflictException('All journal accounts must exist and be active');
        }
        if (kind !== JournalKind.GENERAL) {
          const expense = accounts.find((a) => a.id === parsed[0].accountId);
          if (expense?.type !== AccountType.EXPENSE) throw new ConflictException('Choose an active EXPENSE category account');
          if (meta?.tax?.amount.greaterThan(0)) {
            const vatAccount = accounts.find((a) => a.id === meta.tax?.vatAccountId);
            const creditAccount = accounts.find((a) => a.id === parsed[parsed.length - 1].accountId);
            if (vatAccount?.type !== AccountType.ASSET || creditAccount?.type !== AccountType.ASSET ||
                vatAccount.id === expense.id || vatAccount.id === creditAccount.id) {
              throw new ConflictException('Paid input VAT needs a separate active ASSET VAT account and ASSET payment account');
            }
          }
        }
        let category: { id: string; code: string; name: string } | null = null;
        if (meta?.cost) {
          const voyage = await tx.voyage.findUnique({ where: { id: meta.cost.voyageId }, select: { id: true } });
          if (!voyage) throw new NotFoundException('Voyage not found');
          if (meta.cost.manifestId) {
            const manifest = await tx.manifest.findFirst({ where: { id: meta.cost.manifestId,
              voyageId: voyage.id, deletedAt: null, status: { not: 'CANCELLED' } }, select: { id: true } });
            if (!manifest) throw new ConflictException('Manifest must belong to the voyage and be live');
          }
          category = await tx.voyageCostCategory.findFirst({
            where: { id: meta.cost.categoryId, isActive: true }, select: { id: true, code: true, name: true },
          });
          if (!category) throw new ConflictException('Cost category must be active');
        }
        const customers = [...new Set(parsed.map((l) => l.customerId).filter((id): id is string => id !== null))];
        if (customers.length) {
          const count = await tx.customer.count({ where: { id: { in: customers }, deletedAt: null } });
          if (count !== customers.length) throw new ConflictException('Unknown or inactive customer on journal line');
        }
        const data = parsed.map((l) => ({ ...l,
          baseDebit: toBase(l.debit, rate.exchangeRate), baseCredit: toBase(l.credit, rate.exchangeRate),
        }));
        // Split gross base amount once; put the at-most-one-cent rounding residual
        // on net expense, keeping the posted journal balanced and VAT traceable.
        if (meta?.tax?.amount.greaterThan(0)) {
          const residualNet = data[data.length - 1].baseCredit.minus(data[1].baseDebit);
          if (residualNet.lessThan(0) ||
              residualNet.minus(data[0].baseDebit).abs().greaterThan('0.01')) {
            throw new BadRequestException('Tax split cannot be reconciled in base currency');
          }
          data[0].baseDebit = residualNet;
        }
        const baseDebit = data.reduce((sum, l) => sum.plus(l.baseDebit), ZERO);
        const baseCredit = data.reduce((sum, l) => sum.plus(l.baseCredit), ZERO);
        if (!baseDebit.equals(baseCredit)) {
          throw new BadRequestException('Journal base-currency sides differ after rounding; adjust the line breakdown');
        }
        const req = periodicSequenceRequest('GENERAL_JOURNAL', new Date());
        const { sequence: journalNumber } = await this.numbering.allocateNumber({ ...req, tx,
          seedNextSequence: async (seedTx) => nextSequenceAfter(req.prefix,
            (await seedTx.generalJournal.findFirst({ where: { journalNumber: { startsWith: req.prefix } },
              orderBy: { journalNumber: 'desc' }, select: { journalNumber: true } }))?.journalNumber ?? null),
        });
        const journal = await tx.generalJournal.create({ data: {
          journalNumber, kind, journalDate: date, description: dto.description.trim(),
          reference: dto.reference?.trim() || null, currencyCode: dto.currencyCode,
          baseCurrencyCode: rate.baseCurrencyCode, exchangeRate: rate.exchangeRate,
          rateEffectiveAt: rate.rateEffectiveAt, rateSource: rate.rateSource,
          currencyRateId: rate.currencyRateId, rateOverrideReason: rate.rateOverrideReason,
          createdById: actor.id, lines: { create: data },
        } });
        if (meta?.tax) await tx.expenseInputTax.create({ data: {
          journalId: journal.id, taxAccountId: meta.tax.vatAccountId,
          amount: meta.tax.amount, baseAmount: meta.tax.amount.greaterThan(0) ? data[1].baseDebit : ZERO, paidAt: meta.tax.paidAt,
        } });
        if (meta?.cost && category) await tx.voyageCost.create({ data: {
          journalId: journal.id, voyageId: meta.cost.voyageId,
          manifestId: meta.cost.manifestId ?? null, categoryId: category.id,
          categoryCodeSnapshot: category.code, categoryNameSnapshot: category.name,
          netAmount: data[0].debit, baseNetAmount: data[0].baseDebit,
        } });
        await this.audit.recordIn(tx, {
          action: kind === JournalKind.GENERAL ? 'journal.post' : kind === JournalKind.VOYAGE_COST ? 'voyage.cost.post' : 'expense.post',
          entityType: 'GeneralJournal', entityId: journal.id, actorId: actor.id, actorEmail: actor.email,
          afterData: { journalNumber, kind, currencyCode: dto.currencyCode,
            baseCurrencyCode: rate.baseCurrencyCode, rate: rate.exchangeRate.toString(),
            effectiveAt: rate.rateEffectiveAt, rateSource: rate.rateSource,
            overrideReason: rate.rateOverrideReason, cost: meta?.cost ?? null,
            inputVat: meta?.tax ? { amount: meta.tax.amount.toFixed(2), paidAt: meta.tax.paidAt, taxAccountId: meta.tax.vatAccountId } : null,
            lines: data.map((l) => ({
              accountId: l.accountId, customerId: l.customerId, debit: l.debit.toFixed(2),
              credit: l.credit.toFixed(2), baseDebit: l.baseDebit.toFixed(2), baseCredit: l.baseCredit.toFixed(2),
            })) },
        });
        return journal;
      });
      return this.journal(saved.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Journal number collision; retry');
      }
      throw error;
    }
  }

  async expense(dto: PostExpenseDto, actor: AuthenticatedUser) {
    return this.postExpense(dto, actor, JournalKind.OFFICE_EXPENSE);
  }

  async voyageCost(dto: PostVoyageCostDto, actor: AuthenticatedUser) {
    if (dto.inputVatAmount === undefined) throw new BadRequestException(
      'Voyage costs need explicit input VAT: 0 when none, or a positive paid amount with VAT asset account and date');
    return this.postExpense(dto, actor, JournalKind.VOYAGE_COST,
      { voyageId: dto.voyageId, manifestId: dto.manifestId, categoryId: dto.categoryId });
  }

  private async postExpense(dto: PostExpenseDto, actor: AuthenticatedUser, kind: JournalKind,
    cost?: ExpenseMeta['cost']) {
    const gross = exactMoney(dto.amount);
    // Omitted means UNKNOWN for historical compatibility; explicit "0" means
    // the operator confirmed there was no input VAT on this expense.
    let tax: Prisma.Decimal | null = null;
    if (dto.inputVatAmount !== undefined) {
      try { tax = new Prisma.Decimal(dto.inputVatAmount); }
      catch { throw new BadRequestException('inputVatAmount must be a nonnegative monetary amount'); }
      if (!tax.isFinite() || tax.isNegative() || tax.decimalPlaces() > 2) {
        throw new BadRequestException('inputVatAmount must be a nonnegative monetary amount');
      }
    }
    const positive = tax !== null && tax.greaterThan(0);
    if ((positive && (!dto.vatAccountId || !dto.taxPaidAt)) ||
        (!positive && (dto.vatAccountId || dto.taxPaidAt))) {
      throw new BadRequestException('Positive input VAT needs a VAT asset account and paid date');
    }
    const net = gross.minus(tax ?? ZERO);
    if (net.lessThanOrEqualTo(0)) throw new BadRequestException('Input VAT must be less than gross expense');
    const meta: ExpenseMeta = { cost, ...(tax !== null ? { tax: {
      amount: tax, paidAt: positive ? transactionDate(dto.taxPaidAt) : null,
      vatAccountId: positive ? dto.vatAccountId! : null,
    } } : {}) };
    return this.post({
      description: dto.description, reference: dto.reference, journalDate: dto.journalDate,
      currencyCode: dto.currencyCode, exchangeRate: dto.exchangeRate,
      rateOverrideReason: dto.rateOverrideReason,
      lines: [
        { accountId: dto.expenseAccountId, debit: net.toFixed(2) },
        ...(positive ? [{ accountId: dto.vatAccountId!, debit: tax!.toFixed(2) }] : []),
        { accountId: dto.creditAccountId, credit: gross.toFixed(2) },
      ],
    }, actor, kind, meta);
  }

  async reverse(id: string, reason: string, actor: AuthenticatedUser) {
    if (!reason?.trim()) throw new BadRequestException('Reversal reason is required');
    const saved = await this.prisma.$transaction(async (tx) => {
      // Lock original so two concurrent reversals cannot both post.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "general_journals" WHERE "id" = ${id} FOR UPDATE`;
      if (!locked.length) throw new NotFoundException('Journal not found');
      const original = await tx.generalJournal.findUniqueOrThrow({ where: { id }, include: { lines: true } });
      if (original.reversalOfId) throw new ConflictException('Cannot reverse a reversal; post a new adjustment');
      if (original.reversedAt) throw new ConflictException('Journal already reversed');
      const now = new Date();
      const req = periodicSequenceRequest('GENERAL_JOURNAL', now);
      const { sequence: journalNumber } = await this.numbering.allocateNumber({ ...req, tx,
        seedNextSequence: async (seedTx) => nextSequenceAfter(req.prefix,
          (await seedTx.generalJournal.findFirst({ where: { journalNumber: { startsWith: req.prefix } },
            orderBy: { journalNumber: 'desc' }, select: { journalNumber: true } }))?.journalNumber ?? null),
      });
      const reversal = await tx.generalJournal.create({ data: {
        journalNumber, kind: original.kind, journalDate: now,
        description: `Reversal of ${original.journalNumber}: ${reason.trim()}`,
        reference: original.reference, currencyCode: original.currencyCode,
        baseCurrencyCode: original.baseCurrencyCode, exchangeRate: original.exchangeRate,
        rateEffectiveAt: original.rateEffectiveAt, rateSource: original.rateSource,
        currencyRateId: original.currencyRateId, rateOverrideReason: original.rateOverrideReason,
        createdById: actor.id, reversalOfId: id,
        lines: { create: original.lines.map((l) => ({
          accountId: l.accountId, customerId: l.customerId, debit: l.credit, credit: l.debit,
          baseDebit: l.baseCredit, baseCredit: l.baseDebit, memo: l.memo,
        })) },
      } });
      await tx.generalJournal.update({ where: { id }, data: { reversedAt: now, reversedById: actor.id, reversalReason: reason.trim() } });
      await this.audit.recordIn(tx, { action: 'journal.reverse', entityType: 'GeneralJournal', entityId: id,
        actorId: actor.id, actorEmail: actor.email, beforeData: {
          journalNumber: original.journalNumber, reversedAt: null },
        afterData: { reversedAt: now, reversalId: reversal.id, reversalNumber: journalNumber },
        metadata: { reason: reason.trim() } });
      return reversal;
    });
    return this.journal(saved.id);
  }
}
