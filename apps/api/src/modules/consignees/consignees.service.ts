import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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

  async update(id: string, dto: UpdateConsigneeDto) {
    await this.findById(id);
    try {
      return await this.prisma.consignee.update({
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
        throw new ConflictException('A consignee with this code already exists');
      }
      throw e;
    }
  }

  async setActive(id: string, isActive: boolean) {
    await this.findById(id);
    return this.prisma.consignee.update({
      where: { id },
      data: { isActive },
      select,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.consignee.update({
      where: { id },
      data: { deletedAt: new Date() },
      select,
    });
  }
}
