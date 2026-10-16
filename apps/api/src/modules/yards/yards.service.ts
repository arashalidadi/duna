import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { requireOffice } from '../configuration/configuration.policy';
import type { AuthenticatedUser } from '../../common/auth/types';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { parseBooleanFilter } from '../../common/utils/query-filter.util';
import { CreateYardDto, ListYardsQueryDto, UpdateYardDto } from './dto/yards.dto';

const select = {
  id: true,
  portId: true,
  code: true,
  name: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  port: { select: { id: true, code: true, name: true, country: true, city: true } },
} satisfies Prisma.YardSelect;

@Injectable()
export class YardsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(query: ListYardsQueryDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'yard:read');
    const pagination = parsePagination(query);
    const isActive = parseBooleanFilter(query.isActive);
    const where: Prisma.YardWhereInput = {
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(query.search ? { OR: [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
      ] } : {}),
      ...(query.portId ? { portId: query.portId } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.yard.count({ where }),
      this.prisma.yard.findMany({ where, select, skip: pagination.skip,
        take: pagination.take, orderBy: { code: 'asc' } }),
    ]);
    return buildPaginated(items, total, pagination);
  }

  async findById(id: string, actor: AuthenticatedUser) {
    requireOffice(actor, 'yard:read');
    const yard = await this.prisma.yard.findFirst({ where: { id, deletedAt: null }, select });
    if (!yard) throw new NotFoundException('Yard not found');
    return yard;
  }

  private async assignablePort(tx: Prisma.TransactionClient, id: string) {
    const port = await tx.port.findUnique({ where: { id }, select: { deletedAt: true, isActive: true } });
    if (!port || port.deletedAt) throw new NotFoundException('Port not found');
    if (!port.isActive) throw new ConflictException('An inactive port cannot receive an active yard');
  }

  async create(dto: CreateYardDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'yard:create');
    return this.prisma.$transaction(async (tx) => {
      await this.assignablePort(tx, dto.portId);
      const row = await tx.yard.create({ data: { code: dto.code, name: dto.name,
        portId: dto.portId, address: dto.address }, select });
      await this.audit.recordIn(tx, { action: 'yard.create', entityType: 'Yard', entityId: row.id,
        actorId: actor.id, actorEmail: actor.email,
        afterData: { code: row.code, name: row.name, portId: row.portId } });
      return row;
    });
  }

  private async activeDependencies(tx: Prisma.TransactionClient, id: string) {
    const [inventories, cargos] = await Promise.all([
      tx.yardInventory.count({ where: { yardId: id } }),
      tx.cargo.count({ where: { yardId: id, deletedAt: null,
        status: { notIn: ['CANCELLED', 'DELIVERED'] } } }),
    ]);
    if (inventories || cargos) {
      throw new ConflictException('Yard has current inventory or active cargo; resolve these before deactivation');
    }
  }

  /** A Yard cannot be moved after it has ever been recorded as a cargo/placement
   * location. Updating the location would reinterpret old operational records. */
  async update(id: string, dto: UpdateYardDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'yard:update');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Yard" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.yard.findFirst({ where: { id, deletedAt: null },
        select: { code: true, name: true, portId: true, isActive: true } });
      if (!before) throw new NotFoundException('Yard not found');
      const portId = dto.portId ?? before.portId;
      if (dto.portId && dto.portId !== before.portId) {
        await this.assignablePort(tx, portId);
        const [cargos, inventories] = await Promise.all([
          tx.cargo.count({ where: { yardId: id } }),
          tx.yardInventory.count({ where: { yardId: id } }),
        ]);
        if (cargos || inventories) throw new ConflictException('Yard has location history; do not change its port');
      }
      if (dto.isActive === true && !before.isActive) await this.assignablePort(tx, portId);
      if (dto.isActive === false && before.isActive) await this.activeDependencies(tx, id);
      const after = await tx.yard.update({ where: { id }, data: {
        code: dto.code, name: dto.name, portId: dto.portId,
        address: dto.address, isActive: dto.isActive,
      }, select });
      const action = before.isActive === after.isActive ? 'yard.update'
        : after.isActive ? 'yard.reactivate' : 'yard.deactivate';
      await this.audit.recordIn(tx, { action, entityType: 'Yard', entityId: id,
        actorId: actor.id, actorEmail: actor.email, beforeData: before,
        afterData: { code: after.code, name: after.name, portId: after.portId,
          isActive: after.isActive } });
      return after;
    });
  }

  async setActive(id: string, isActive: boolean, actor: AuthenticatedUser) {
    return this.update(id, { isActive }, actor);
  }

  /** Archive an unused master only; never hide current inventory or old Cargo.
   * The record and audit remain, with no hard-delete route. */
  async remove(id: string, actor: AuthenticatedUser) {
    requireOffice(actor, 'yard:update');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Yard" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.yard.findFirst({ where: { id, deletedAt: null },
        select: { code: true, portId: true, isActive: true } });
      if (!before) throw new NotFoundException('Yard not found');
      const [cargos, inventories, attachments] = await Promise.all([
        tx.cargo.count({ where: { yardId: id } }),
        tx.yardInventory.count({ where: { yardId: id } }),
        tx.fileAttachment.count({ where: { entityType: 'Yard', entityId: id } }),
      ]);
      if (cargos || inventories || attachments) {
        throw new ConflictException('Yard has retained dependencies; deactivate instead');
      }
      await tx.yard.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await this.audit.recordIn(tx, { action: 'yard.archive', entityType: 'Yard', entityId: id,
        actorId: actor.id, actorEmail: actor.email, beforeData: before,
        afterData: { archived: true, isActive: false } });
      return { id, archived: true };
    });
  }
}
