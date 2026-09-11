import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { parseBooleanFilter } from '../../common/utils/query-filter.util';
import { CreatePortDto, ListPortsQueryDto, UpdatePortDto } from './dto/ports.dto';

const select = {
  id: true,
  code: true,
  name: true,
  country: true,
  city: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PortSelect;

@Injectable()
export class PortsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListPortsQueryDto) {
    const pagination = parsePagination(query);

    const isActive = parseBooleanFilter(query.isActive);

    const where: Prisma.PortWhereInput = {
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(query.country
        ? { country: { equals: query.country, mode: 'insensitive' } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { country: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.port.count({ where }),
      this.prisma.port.findMany({
        where,
        select,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { code: 'asc' },
      }),
    ]);

    return buildPaginated(items, total, pagination);
  }

  /** Detail view includes its related yards (active + inactive, excluding soft-deleted). */
  async findById(id: string) {
    const port = await this.prisma.port.findUnique({
      where: { id },
      include: {
        yards: {
          where: { deletedAt: null },
          select: {
            id: true,
            code: true,
            name: true,
            address: true,
            isActive: true,
          },
          orderBy: { code: 'asc' },
        },
      },
    });
    if (!port || port.deletedAt) {
      throw new NotFoundException('Port not found');
    }
    return port;
  }

  create(dto: CreatePortDto) {
    return this.prisma.port.create({
      data: {
        code: dto.code,
        name: dto.name,
        country: dto.country,
        city: dto.city,
      },
    });
  }

  async update(id: string, dto: UpdatePortDto) {
    await this.findById(id);
    return this.prisma.port.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        country: dto.country,
        city: dto.city,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * Activate/deactivate lifecycle. A port with active yards cannot be
   * deactivated, because its yards reference it operationally.
   */
  async setActive(id: string, isActive: boolean) {
    await this.findById(id);
    if (!isActive) {
      const activeYards = await this.prisma.yard.count({
        where: { portId: id, deletedAt: null, isActive: true },
      });
      if (activeYards > 0) {
        throw new ConflictException(
          `Cannot deactivate port "${id}": it still has ${activeYards} active yard(s). Deactivate or reassign them first.`
        );
      }
    }
    return this.prisma.port.update({
      where: { id },
      data: { isActive },
    });
  }

  async remove(id: string) {
    const port = await this.findById(id);
    const activeYards = await this.prisma.yard.count({
      where: { portId: id, deletedAt: null },
    });
    if (activeYards > 0) {
      throw new ConflictException(
        `Cannot delete port "${port.code}": it still has ${activeYards} yard(s). Deactivate the port instead.`
      );
    }
    await this.prisma.port.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
