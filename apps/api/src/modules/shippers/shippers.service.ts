import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { AuthenticatedUser } from '../../common/auth/types';
import { requireOffice } from '../configuration/configuration.policy';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { parseBooleanFilter } from '../../common/utils/query-filter.util';
import { CreateShipperDto, ListShipperQueryDto, UpdateShipperDto } from './dto/shippers.dto';

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
} satisfies Prisma.ShipperSelect;

/**
 * Shipper master data (Phase 2 party model). Shipper is the cargo origin
 * party, distinct from Customer (the internal commercial counterparty).
 */
@Injectable()
export class ShippersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(query: ListShipperQueryDto) {
    const pagination = parsePagination(query);
    const isActive = parseBooleanFilter(query.isActive);

    const where: Prisma.ShipperWhereInput = {
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
      this.prisma.shipper.count({ where }),
      this.prisma.shipper.findMany({
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
    const shipper = await this.prisma.shipper.findUnique({ where: { id }, select });
    if (!shipper || shipper.deletedAt) {
      throw new NotFoundException('Shipper not found');
    }
    return shipper;
  }

  async create(dto: CreateShipperDto) {
    try {
      return await this.prisma.shipper.create({
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
        throw new ConflictException('A shipper with this code already exists');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateShipperDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'shipper:update');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "shippers" WHERE "id" = ${id} FOR UPDATE`;
        const before = await tx.shipper.findFirst({ where: { id, deletedAt: null },
          select: { code: true, isActive: true } });
        if (!before) throw new NotFoundException('Shipper not found');
        const after = await tx.shipper.update({
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
          await this.audit.recordIn(tx, { action: after.isActive ? 'shipper.reactivate' : 'shipper.deactivate',
            entityType: 'Shipper', entityId: id, actorId: actor.id, actorEmail: actor.email,
            beforeData: before, afterData: { code: after.code, isActive: after.isActive } });
        }
        return after;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('A shipper with this code already exists');
      }
      throw e;
    }
  }

  async setActive(id: string, isActive: boolean, actor: AuthenticatedUser) {
    return this.update(id, { isActive }, actor);
  }

  /** A party with even archived operational/document relations must stay addressable. */
  async remove(id: string, actor: AuthenticatedUser) {
    requireOffice(actor, 'shipper:delete');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "shippers" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.shipper.findFirst({ where: { id, deletedAt: null },
        select: { id: true, code: true, isActive: true } });
      if (!before) throw new NotFoundException('Shipper not found');
      const [cargos, manifests, manifestItems, bills, attachments] = await Promise.all([
        tx.cargo.count({ where: { shipperId: id } }),
        tx.manifest.count({ where: { shipperId: id } }),
        tx.manifestItem.count({ where: { shipperId: id } }),
        tx.billOfLading.count({ where: { shipperId: id } }),
        tx.fileAttachment.count({ where: { entityType: 'Shipper', entityId: id } }),
      ]);
      if (cargos || manifests || manifestItems || bills || attachments) {
        throw new ConflictException('Shipper has operational or document history; deactivate instead');
      }
      await tx.shipper.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await this.audit.recordIn(tx, { action: 'shipper.archive', entityType: 'Shipper',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: before, afterData: { code: before.code, isActive: false, archived: true } });
      return { id, archived: true };
    });
  }
}
