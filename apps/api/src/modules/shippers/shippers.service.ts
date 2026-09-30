import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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

  async update(id: string, dto: UpdateShipperDto) {
    await this.findById(id);
    try {
      return await this.prisma.shipper.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          taxId: dto.taxId?.trim() ?? null,
          address: dto.address?.trim() ?? null,
          phone: dto.phone?.trim() ?? null,
          email: dto.email?.trim() ?? null,
          notes: dto.notes?.trim() ?? null,
          isActive: dto.isActive,
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

  async setActive(id: string, isActive: boolean) {
    await this.findById(id);
    return this.prisma.shipper.update({
      where: { id },
      data: { isActive },
      select,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.shipper.update({
      where: { id },
      data: { deletedAt: new Date() },
      select,
    });
  }
}
