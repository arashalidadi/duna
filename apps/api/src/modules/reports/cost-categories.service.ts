import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import type { CreateCostCategoryDto, UpdateCostCategoryDto } from './dto/reports.dto';

@Injectable()
export class CostCategoriesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list() { return this.prisma.voyageCostCategory.findMany({ orderBy: { code: 'asc' } }); }

  async create(dto: CreateCostCategoryDto, actor: AuthenticatedUser) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.voyageCostCategory.create({ data: { code: dto.code,
          name: dto.name.trim(), createdById: actor.id } });
        await this.audit.recordIn(tx, { action: 'report.cost_category.create', entityType: 'VoyageCostCategory',
          entityId: row.id, actorId: actor.id, actorEmail: actor.email, afterData: row });
        return row;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Cost category code already exists');
      }
      throw error;
    }
  }

  update(id: string, dto: UpdateCostCategoryDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.voyageCostCategory.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Cost category not found');
      const after = await tx.voyageCostCategory.update({ where: { id }, data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}), updatedById: actor.id,
      } });
      await this.audit.recordIn(tx, { action: 'report.cost_category.update', entityType: 'VoyageCostCategory',
        entityId: id, actorId: actor.id, actorEmail: actor.email, beforeData: before, afterData: after });
      return after;
    });
  }
}
