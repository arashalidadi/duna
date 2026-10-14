import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Financial values are never computed using binary floating-point. */
export function exactMoney(value: number | string | Prisma.Decimal, label = 'amount'): Prisma.Decimal {
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw new BadRequestException(`${label} must be a monetary amount`);
  }
  if (!amount.isFinite() || amount.lessThanOrEqualTo(0) || amount.decimalPlaces() > 2) {
    throw new BadRequestException(`${label} must be positive with at most 2 decimal places`);
  }
  return amount;
}

export function exactRate(value: number | string | Prisma.Decimal): Prisma.Decimal {
  let rate: Prisma.Decimal;
  try {
    rate = new Prisma.Decimal(value);
  } catch {
    throw new BadRequestException('exchange rate must be positive');
  }
  if (!rate.isFinite() || rate.lessThanOrEqualTo(0) || rate.decimalPlaces() > 12 || rate.greaterThanOrEqualTo('1000000000000')) {
    throw new BadRequestException('exchange rate must be positive with at most 12 decimal places');
  }
  return rate;
}

/** One original-currency unit buys `rate` units of the snapshotted base currency. */
export function toBase(amount: Prisma.Decimal, rate: Prisma.Decimal): Prisma.Decimal {
  return amount.times(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function transactionDate(value?: string): Date {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) throw new BadRequestException('Invalid transaction date');
  return date;
}
