import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { AuthenticatedUser } from '../../common/auth/types';
import { requireOffice } from '../configuration/configuration.policy';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { parseBooleanFilter } from '../../common/utils/query-filter.util';
import {
  CreateConsigneeDto,
  ListConsigneeQueryDto,
  UpdateConsigneeDto,
} from './dto/consignees.dto';

const select = {
  id: true,
  code: true,
  name: true,
  taxId: true,
  address: true,
  phone: true,
  email: true,
  isActive: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.ConsigneeSelect;

/**
 * Consignee master data (Phase 2 party model). The consignee is the cargo
 * destination party named on the bill of lading.
 */
@Injectable()
export class ConsigneesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(query: ListConsigneeQueryDto) {
    const pagination = parsePagination(query);
    const isActive = parseBooleanFilter(query.isActive);

    const where: Prisma.ConsigneeWhereInput = {
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.consignee.count({ where }),
      this.prisma.consignee.findMany({
        where,
        select,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { code: 'asc' },
      }),
    ]);

    return buildPaginated(items, total, pagination);
  }

  async findById(id: string) {
    const consignee = await this.prisma.consignee.findUnique({ where: { id }, select });
    if (!consignee || consignee.deletedAt) {
      throw new NotFoundException('Consignee not found');
    }
    return consignee;
  }

  async create(dto: CreateConsigneeDto) {
    try {
      return await this.prisma.consignee.create({
        data: {
          code: dto.code.trim(),
          name: dto.name.trim(),
          taxId: dto.taxId?.trim() || null,
          address: dto.address?.trim() || null,
          phone: dto.phone?.trim() || null,
          email: dto.email?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
        select,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('A consignee with this code already exists');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateConsigneeDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'consignee:update');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "consignees" WHERE "id" = ${id} FOR UPDATE`;
        const before = await tx.consignee.findFirst({ where: { id, deletedAt: null },
          select: { code: true, isActive: true } });
        if (!before) throw new NotFoundException('Consignee not found');
        const after = await tx.consignee.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          taxId: dto.taxId === undefined ? undefined : dto.taxId.trim() || null,
          address: dto.address === undefined ? undefined : dto.address.trim() || null,
          phone: dto.phone === undefined ? undefined : dto.phone.trim() || null,
          email: dto.email === undefined ? undefined : dto.email.trim() || null,
          notes: dto.notes === undefined ? undefined : dto.notes.trim() || null,
          isActive: dto.isActive,
        },
        select,
        });
        if (before.isActive !== after.isActive) {
          await this.audit.recordIn(tx, { action: after.isActive ? 'consignee.reactivate' : 'consignee.deactivate',
            entityType: 'Consignee', entityId: id, actorId: actor.id, actorEmail: actor.email,
            beforeData: before, afterData: { code: after.code, isActive: after.isActive } });
        }
        return after;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('A consignee with this code already exists');
      }
      throw e;
    }
  }

  async setActive(id: string, isActive: boolean, actor: AuthenticatedUser) {
    return this.update(id, { isActive }, actor);
  }

  /** A party with even archived operational/document relations must stay addressable. */
  async remove(id: string, actor: AuthenticatedUser) {
    requireOffice(actor, 'consignee:delete');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "consignees" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.consignee.findFirst({ where: { id, deletedAt: null },
        select: { id: true, code: true, isActive: true } });
      if (!before) throw new NotFoundException('Consignee not found');
      const [cargos, manifests, manifestItems, bills, attachments] = await Promise.all([
        tx.cargo.count({ where: { consigneeId: id } }),
        tx.manifest.count({ where: { consigneeId: id } }),
        tx.manifestItem.count({ where: { consigneeId: id } }),
        tx.billOfLading.count({ where: { consigneeId: id } }),
        tx.fileAttachment.count({ where: { entityType: 'Consignee', entityId: id } }),
      ]);
      if (cargos || manifests || manifestItems || bills || attachments) {
        throw new ConflictException('Consignee has operational or document history; deactivate instead');
      }
      await tx.consignee.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await this.audit.recordIn(tx, { action: 'consignee.archive', entityType: 'Consignee',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: before, afterData: { code: before.code, isActive: false, archived: true } });
      return { id, archived: true };
    });
  }
}
