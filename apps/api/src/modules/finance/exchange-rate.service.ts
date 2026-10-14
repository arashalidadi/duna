import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/auth/types';
import { exactRate, toBase } from './financial-money';

export class NoApprovedRateException extends ConflictException {}

export interface AppliedRate {
  baseCurrencyCode: string;
  exchangeRate: Prisma.Decimal;
  rateEffectiveAt: Date;
  rateSource: string;
  currencyRateId: string | null;
  rateOverrideReason: string | null;
  baseAmount: (amount: Prisma.Decimal) => Prisma.Decimal;
}

@Injectable()
export class ExchangeRateService {
  /**
   * Select the latest *approved* central rate at or before the value date.
   * An override always needs its own permission and an audit reason; the caller
   * writes the override and transaction to AuditLog in the SAME transaction.
   */
  async resolve(
    tx: Prisma.TransactionClient,
    currencyCode: string,
    at: Date,
    actor: AuthenticatedUser,
    override?: { rate: number | string; reason: string },
  ): Promise<AppliedRate> {
    const settings = await tx.companySettings.findFirst({ select: { defaultCurrency: true } });
    if (!settings) throw new ConflictException('Company base currency is not configured');
    const baseCurrencyCode = settings.defaultCurrency;
    const currency = await tx.currency.findUnique({ where: { code: currencyCode }, select: { isActive: true } });
    if (!currency?.isActive) throw new BadRequestException('Unknown or inactive transaction currency');

    if (currencyCode === baseCurrencyCode) {
      if (override) throw new BadRequestException('Base-currency rate cannot be overridden');
      return this.snapshot(baseCurrencyCode, new Prisma.Decimal(1), at, 'IDENTITY', null, null);
    }
    if (override) {
      if (!actor.isPrimaryAdmin && !actor.permissions.includes('currency_rate:override')) {
        throw new ForbiddenException('Exchange-rate override permission required');
      }
      const reason = override.reason?.trim();
      if (!reason) throw new BadRequestException('Rate override requires a reason');
      return this.snapshot(baseCurrencyCode, exactRate(override.rate), at, 'TRANSACTION_OVERRIDE', null, reason);
    }
    const rate = await tx.currencyRate.findFirst({
      where: { currencyCode, baseCurrencyCode, status: 'APPROVED', effectiveAt: { lte: at } },
      orderBy: [{ effectiveAt: 'desc' }, { approvedAt: 'desc' }],
    });
    if (!rate) {
      throw new NoApprovedRateException(`No approved ${currencyCode}/${baseCurrencyCode} rate effective at transaction date`);
    }
    return this.snapshot(baseCurrencyCode, rate.rate, rate.effectiveAt, rate.source, rate.id, null);
  }

  private snapshot(
    baseCurrencyCode: string,
    exchangeRate: Prisma.Decimal,
    rateEffectiveAt: Date,
    rateSource: string,
    currencyRateId: string | null,
    rateOverrideReason: string | null,
  ): AppliedRate {
    return {
      baseCurrencyCode,
      exchangeRate,
      rateEffectiveAt,
      rateSource,
      currencyRateId,
      rateOverrideReason,
      baseAmount: (amount) => toBase(amount, exchangeRate),
    };
  }
}
