import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { auditProjection } from '../../common/infrastructure/audit/audit-change';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  ListInventoryQueryDto,
  PlaceCargoDto,
  UpdateInventoryDto,
} from './dto/yard-inventory.dto';

const select = {
  id: true,
  status: true,
  enteredAt: true,
  locationLabel: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  cargo: {
    select: {
      id: true,
      reference: true,
      cargoType: true,
      status: true,
      inspectionStatus: true,
      customer: { select: { id: true, code: true, name: true } },
    },
  },
  yard: { select: { id: true, code: true, name: true } },
  port: { select: { id: true, code: true, name: true, country: true, city: true } },
} satisfies Prisma.YardInventorySelect;

@Injectable()
export class YardInventoryService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(query: ListInventoryQueryDto) {
    const pagination = parsePagination(query);

    // Search is executed by scanning cargo-identifiers through a join.
    const where: Prisma.YardInventoryWhereInput = {
      ...(query.yardId ? { yardId: query.yardId } : {}),
      ...(query.portId ? { portId: query.portId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.cargoStatus ? { cargo: { status: query.cargoStatus } } : {}),
      ...(query.customerId ? { cargo: { customerId: query.customerId } } : {}),
      ...(query.destinationPortId
        ? { cargo: { destinationPortId: query.destinationPortId } }
        : {}),
      ...(query.search
        ? {
            cargo: {
              OR: [
                { reference: { contains: query.search, mode: 'insensitive' } },
                { serialNumber: { contains: query.search, mode: 'insensitive' } },
                { chassisNumber: { contains: query.search, mode: 'insensitive' } },
                { vin: { contains: query.search, mode: 'insensitive' } },
                { customer: { name: { contains: query.search, mode: 'insensitive' } } },
                { customer: { code: { contains: query.search, mode: 'insensitive' } } },
              ],
            },
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.yardInventory.count({ where }),
      this.prisma.yardInventory.findMany({
        where,
        select,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { enteredAt: 'desc' },
      }),
    ]);

    return buildPaginated(items, total, pagination);
  }

  async findById(id: string) {
    const row = await this.prisma.yardInventory.findUnique({ where: { id }, select });
    if (!row) {
      throw new NotFoundException('Yard inventory record not found');
    }
    return row;
  }

  /**
   * Place a cargo into a yard. Transactionally:
   *  1. Validates the cargo exists, is not cancelled, and is not already in a yard.
   *  2. Validates the yard exists, is active, and its port is active.
   *  3. Creates the (unique) current inventory record, portId mirroring yard.portId.
   *  4. Moves the cargo status to AT_YARD (if not already further along).
   *
   * The @@unique(cargoId) constraint is the final guard against duplicate
   * current inventory under concurrency.
   */
  async place(dto: PlaceCargoDto, actor: AuthenticatedUser) {
    const { cargoId, yardId } = dto;

    const cargo = await this.prisma.cargo.findUnique({
      where: { id: cargoId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!cargo || cargo.deletedAt) {
      throw new NotFoundException('Cargo not found');
    }
    if (cargo.status === 'CANCELLED') {
      throw new ConflictException('Cancelled cargo cannot be placed in a yard');
    }

    const yard = await this.prisma.yard.findUnique({
      where: { id: yardId },
      include: { port: { select: { id: true, isActive: true } } },
    });
    if (!yard || yard.deletedAt) {
      throw new NotFoundException('Yard not found');
    }
    if (!yard.isActive) {
      throw new ConflictException('Inactive yard cannot receive inventory');
    }
    if (!yard.port.isActive) {
      throw new ConflictException(`Cannot place cargo: the yard's port is inactive`);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Re-check for an existing current record inside the transaction won't
        // protect against two inserts racing; the unique constraint is the guard.
        const createdId = await tx.yardInventory.create({
          data: {
            cargoId,
            yardId,
            portId: yard.portId,
            status: 'IN_YARD',
            locationLabel: dto.locationLabel,
            notes: dto.notes,
            createdById: actor.id,
            updatedById: actor.id,
          },
          select: { id: true },
        });

        // Cargo status drives to AT_YARD once it is physically in a yard.
        if (cargo.status === 'REGISTERED') {
          await tx.cargo.update({
            where: { id: cargoId },
            data: { status: 'AT_YARD' },
          });
        }

        await this.audit.recordIn(tx, { action: 'yard_inventory.place', entityType: 'YardInventory',
          entityId: createdId.id, actorId: actor.id, actorEmail: actor.email,
          beforeData: { cargoStatus: cargo.status },
          afterData: { cargoId, yardId, portId: yard.portId, status: 'IN_YARD',
            cargoStatus: cargo.status === 'REGISTERED' ? 'AT_YARD' : cargo.status,
            locationLabel: dto.locationLabel ?? null } });
        // Re-read so the returned row reflects the updated cargo.status.
        return tx.yardInventory.findUniqueOrThrow({
          where: { id: createdId.id },
          select,
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === 'P2002' || e.code === 'P2018')
      ) {
        throw new ConflictException(
          'This cargo already has a current yard inventory record. Move or remove it first.'
        );
      }
      throw e;
    }
  }

  /**
   * Move / status change / location update for an existing current record.
   * Moving to a new yard updates yardId + portId (mirror) and validates the
   * target yard. Status transitions are IN_YARD <-> RESERVED.
   */
  async update(id: string, dto: UpdateInventoryDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "YardInventory" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.yardInventory.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Yard inventory record not found');
      let yardId = before.yardId;
      let portId = before.portId;
      if (dto.yardId && dto.yardId !== before.yardId) {
        const yard = await tx.yard.findUnique({ where: { id: dto.yardId },
          include: { port: { select: { id: true, isActive: true } } } });
        if (!yard || yard.deletedAt) throw new NotFoundException('Target yard not found');
        if (!yard.isActive) throw new ConflictException('Inactive yard cannot receive moved inventory');
        if (!yard.port.isActive) throw new ConflictException('Cannot move cargo: the target yard\'s port is inactive');
        yardId = yard.id;
        portId = yard.portId;
      }
      const after = await tx.yardInventory.update({ where: { id }, data: {
        yardId, portId, status: dto.status, locationLabel: dto.locationLabel,
        notes: dto.notes, updatedById: actor.id,
      }, select });
      const fields = ['yardId', 'portId', 'status', 'locationLabel', 'notes'];
      await this.audit.recordIn(tx, { action: 'yard_inventory.update', entityType: 'YardInventory',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: auditProjection(before, fields), afterData: auditProjection(after, fields),
        metadata: { cargoId: before.cargoId } });
      return after;
    });
  }

  /** Remove only an unused, unreserved current placement. A shipment with
   * inspection/planning/billing history remains addressable; handle it by its
   * normal workflow, never by erasing its yard record. */
  async remove(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "YardInventory" WHERE "id" = ${id} FOR UPDATE`;
      const row = await tx.yardInventory.findUnique({ where: { id },
        select: { id: true, cargoId: true, yardId: true, portId: true,
          status: true, enteredAt: true, locationLabel: true, notes: true } });
      if (!row) throw new NotFoundException('Yard inventory record not found');
      const cargo = await tx.cargo.findUnique({ where: { id: row.cargoId },
        select: { status: true, jobId: true, _count: { select: {
          inspections: true, loadListItems: true, actualLoadingItems: true,
          manifestItems: true, billsOfLadingItems: true, dischargeItems: true,
        } } } });
      if (!cargo || cargo.status !== 'AT_YARD' || cargo.jobId ||
          row.status !== 'IN_YARD' || Object.values(cargo._count).some((n) => n > 0)) {
        throw new ConflictException('Yard placement is used or reserved; use the operational workflow instead');
      }
      await tx.yardInventory.delete({ where: { id } });
      await tx.cargo.update({ where: { id: row.cargoId }, data: { status: 'REGISTERED' } });
      await this.audit.recordIn(tx, { action: 'yard_inventory.remove_unused',
        entityType: 'YardInventory', entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: row, afterData: { removed: true, cargoStatus: 'REGISTERED' } });
      return { id, removed: true, cargoId: row.cargoId };
    });
  }
}
