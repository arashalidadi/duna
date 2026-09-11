import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
      customer: { select: { id: true, code: true, name: true, shortName: true } },
    },
  },
  yard: { select: { id: true, code: true, name: true } },
  port: { select: { id: true, code: true, name: true, country: true, city: true } },
} satisfies Prisma.YardInventorySelect;

@Injectable()
export class YardInventoryService {
  constructor(private readonly prisma: PrismaService) {}

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
    const row = await this.prisma.yardInventory.findUnique({ where: { id }, include: select });
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
  async place(dto: PlaceCargoDto, actor?: AuthenticatedUser) {
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
            createdById: actor?.id,
            updatedById: actor?.id,
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
  async update(id: string, dto: UpdateInventoryDto, actor?: AuthenticatedUser) {
    const existing = await this.prisma.yardInventory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Yard inventory record not found');
    }

    let yardId = dto.yardId ?? existing.yardId;
    let portId = existing.portId;
    if (dto.yardId && dto.yardId !== existing.yardId) {
      const yard = await this.prisma.yard.findUnique({
        where: { id: dto.yardId },
        include: { port: { select: { id: true, isActive: true } } },
      });
      if (!yard || yard.deletedAt) {
        throw new NotFoundException('Target yard not found');
      }
      if (!yard.isActive) {
        throw new ConflictException('Inactive yard cannot receive moved inventory');
      }
      if (!yard.port.isActive) {
        throw new ConflictException(`Cannot move cargo: the target yard's port is inactive`);
      }
      yardId = yard.id;
      portId = yard.portId;
    }

    return this.prisma.yardInventory.update({
      where: { id },
      data: {
        yardId,
        portId,
        status: dto.status,
        locationLabel: dto.locationLabel,
        notes: dto.notes,
        updatedById: actor?.id,
      },
      select,
    });
  }

  /**
   * Remove cargo from a yard. Deletes the current inventory record and reverts
   * cargo status from AT_YARD to REGISTERED (transactionally), so a cargo that
   * is not loaded returns to a registrable/not-in-yard state. Cargo in READY or
   * terminal states is left untouched (it moves back to REGISTERED only when
   * it was in AT_YARD as a direct consequence of placement).
   */
  async remove(id: string, _actor?: AuthenticatedUser) {
    const existing = await this.prisma.yardInventory.findUnique({
      where: { id },
      select: { id: true, cargoId: true },
    });
    if (!existing) {
      throw new NotFoundException('Yard inventory record not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.yardInventory.delete({ where: { id: existing.id } });

      const cargo = await tx.cargo.findUnique({
        where: { id: existing.cargoId },
        select: { status: true },
      });
      if (cargo && cargo.status === 'AT_YARD') {
        await tx.cargo.update({
          where: { id: existing.cargoId },
          data: { status: 'REGISTERED' },
        });
      }
    });
    return { id: existing.id, removed: true, cargoId: existing.cargoId };
  }
}