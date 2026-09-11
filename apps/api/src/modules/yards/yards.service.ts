import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListYardsQueryDto) {
    const pagination = parsePagination(query);

    const isActive = parseBooleanFilter(query.isActive);

    const where: Prisma.YardWhereInput = {
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { address: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.portId ? { portId: query.portId } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.yard.count({ where }),
      this.prisma.yard.findMany({
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
    const yard = await this.prisma.yard.findUnique({ where: { id }, select });
    if (!yard || !yard.port) {
      throw new NotFoundException('Yard not found');
    }
    return yard;
  }

  async create(dto: CreateYardDto) {
    await this.ensurePortExists(dto.portId);
    return this.prisma.yard.create({
      data: {
        code: dto.code,
        name: dto.name,
        portId: dto.portId,
        address: dto.address,
      },
      select,
    });
  }

  async update(id: string, dto: UpdateYardDto) {
    await this.findById(id);
    if (dto.portId) {
      await this.ensurePortExists(dto.portId);
    }
    return this.prisma.yard.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        portId: dto.portId,
        address: dto.address,
        isActive: dto.isActive,
      },
      select,
    });
  }

  async setActive(id: string, isActive: boolean) {
    await this.findById(id);
    return this.prisma.yard.update({
      where: { id },
      data: { isActive },
      select,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.yard.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async ensurePortExists(portId: string) {
    const port = await this.prisma.port.findUnique({ where: { id: portId } });
    if (!port || port.deletedAt) {
      throw new NotFoundException('Port not found');
    }
  }
}
