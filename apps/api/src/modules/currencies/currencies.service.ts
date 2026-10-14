import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import type { CreateCurrencyDto, UpdateCurrencyDto } from './dto/currency-admin.dto';

@Injectable()
export class CurrenciesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  listAll() {
    return this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  listManaged() {
    return this.prisma.currency.findMany({ orderBy: { code: 'asc' } });
  }

  async create(dto: CreateCurrencyDto, actor: AuthenticatedUser) {
    if (!dto.name.trim() || !dto.symbol.trim()) throw new BadRequestException('Name and symbol are required');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const saved = await tx.currency.create({
          data: { code: dto.code, name: dto.name.trim(), symbol: dto.symbol.trim() },
        });
        await this.audit.recordIn(tx, { action: 'currency.create', entityType: 'Currency', entityId: saved.id,
          actorId: actor.id, actorEmail: actor.email, afterData: saved });
        return saved;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Currency code already exists');
      }
      throw error;
    }
  }

  async update(code: string, dto: UpdateCurrencyDto, actor: AuthenticatedUser) {
    if (dto.name !== undefined && !dto.name.trim()) throw new BadRequestException('Name is required');
    if (dto.symbol !== undefined && !dto.symbol.trim()) throw new BadRequestException('Symbol is required');
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.currency.findUnique({ where: { code } });
      if (!before) throw new NotFoundException('Currency not found');
      if (dto.isActive === false && before.isActive) {
        const settings = await tx.companySettings.findFirst({ select: { defaultCurrency: true, supportedCurrenciesJson: true } });
        if (settings?.defaultCurrency === code || (settings && JSON.parse(settings.supportedCurrenciesJson).includes(code))) {
          throw new ConflictException('Remove currency from company settings before deactivation');
        }
      }
      const after = await tx.currency.update({ where: { code }, data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.symbol !== undefined ? { symbol: dto.symbol.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      } });
      await this.audit.recordIn(tx, { action: 'currency.update', entityType: 'Currency', entityId: after.id,
        actorId: actor.id, actorEmail: actor.email, beforeData: before, afterData: after });
      return after;
    });
  }
}
