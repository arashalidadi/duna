import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { exactRate, transactionDate } from '../finance/financial-money';
import type { CreateRateDto, UpdateDraftRateDto } from './dto/currency-admin.dto';

@Injectable()
export class RatesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list(currencyCode?: string) {
    return this.prisma.currencyRate.findMany({
      where: currencyCode ? { currencyCode } : {},
      orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  async create(dto: CreateRateDto, actor: AuthenticatedUser) {
    const rate = exactRate(dto.rate);
    const effectiveAt = transactionDate(dto.effectiveAt);
    const source = dto.source.trim();
    if (!source) throw new BadRequestException('Rate source is required');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const settings = await tx.companySettings.findFirst({ select: { defaultCurrency: true } });
        if (!settings) throw new ConflictException('Base currency not configured');
        const [original, base] = await Promise.all([
          tx.currency.findUnique({ where: { code: dto.currencyCode }, select: { isActive: true } }),
          tx.currency.findUnique({ where: { code: settings.defaultCurrency }, select: { isActive: true } }),
        ]);
        if (!original?.isActive || !base?.isActive || dto.currencyCode === settings.defaultCurrency) {
          throw new BadRequestException('Choose an active non-base currency');
        }
        const saved = await tx.currencyRate.create({
          data: { currencyCode: dto.currencyCode, baseCurrencyCode: settings.defaultCurrency, rate, effectiveAt, source, createdById: actor.id },
        });
        await this.audit.recordIn(tx, {
          action: 'currency_rate.create_draft', entityType: 'CurrencyRate', entityId: saved.id,
          actorId: actor.id, actorEmail: actor.email, afterData: saved,
        });
        return saved;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A rate already exists at this effective time for the currency pair');
      }
      throw error;
    }
  }

  async updateDraft(id: string, dto: UpdateDraftRateDto, actor: AuthenticatedUser) {
    const data = {
      ...(dto.rate !== undefined ? { rate: exactRate(dto.rate) } : {}),
      ...(dto.effectiveAt !== undefined ? { effectiveAt: transactionDate(dto.effectiveAt) } : {}),
      ...(dto.source !== undefined ? { source: dto.source.trim() } : {}),
    };
    if ('source' in data && !data.source) throw new BadRequestException('Rate source is required');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.currencyRate.findUnique({ where: { id } });
        if (!before) throw new NotFoundException('Rate not found');
        if (before.status !== 'DRAFT') throw new ConflictException('Approved rates are immutable; create a new dated rate');
        // Conditional write avoids a concurrent approval racing with the edit.
        const updated = await tx.currencyRate.updateMany({ where: { id, status: 'DRAFT' }, data });
        if (updated.count !== 1) throw new ConflictException('Rate was approved while being edited');
        const after = await tx.currencyRate.findUniqueOrThrow({ where: { id } });
        await this.audit.recordIn(tx, {
          action: 'currency_rate.update_draft', entityType: 'CurrencyRate', entityId: id,
          actorId: actor.id, actorEmail: actor.email, beforeData: before, afterData: after,
        });
        return after;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A rate already exists at this effective time for the currency pair');
      }
      throw error;
    }
  }

  async approve(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.currencyRate.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Rate not found');
      if (before.status !== 'DRAFT') throw new ConflictException('Rate is already approved');
      const updated = await tx.currencyRate.updateMany({
        where: { id, status: 'DRAFT' },
        data: { status: 'APPROVED', approvedAt: new Date(), approvedById: actor.id },
      });
      if (updated.count !== 1) throw new ConflictException('Rate was approved concurrently');
      const after = await tx.currencyRate.findUniqueOrThrow({ where: { id } });
      await this.audit.recordIn(tx, {
        action: 'currency_rate.approve', entityType: 'CurrencyRate', entityId: id,
        actorId: actor.id, actorEmail: actor.email, beforeData: before, afterData: after,
      });
      return after;
    });
  }
}
