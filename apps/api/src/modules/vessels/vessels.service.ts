import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { parseBooleanFilter } from '../../common/utils/query-filter.util';
import {
  CreateVesselDto,
  ListVesselQueryDto,
  UpdateVesselDto,
} from './dto/vessel.dto';

const select = {
  id: true,
  code: true,
  name: true,
  imo: true,
  flag: true,
  vesselType: true,
  capacityTeu: true,
  isActive: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.VesselSelect;

@Injectable()
export class VesselsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListVesselQueryDto) {
    const pagination = parsePagination(query);
    const isActive = parseBooleanFilter(query.isActive);

    const where: Prisma.VesselWhereInput = {
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(query.vesselType ? { vesselType: query.vesselType as Prisma.VesselWhereInput['vesselType'] } : {}),
      ...(query.flag
        ? { flag: { equals: query.flag, mode: 'insensitive' } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { flag: { contains: query.search, mode: 'insensitive' } },
              { imo: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.vessel.count({ where }),
      this.prisma.vessel.findMany({
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
    const vessel = await this.prisma.vessel.findUnique({ where: { id }, select });
    if (!vessel || vessel.deletedAt) {
      throw new NotFoundException('Vessel not found');
    }
    return vessel;
  }

  async findByCode(code: string) {
    return this.prisma.vessel.findUnique({ where: { code }, select });
  }

  async create(dto: CreateVesselDto) {
    try {
      return await this.prisma.vessel.create({
        data: {
          code: dto.code.trim(),
          name: dto.name.trim(),
          imo: dto.imo?.trim() || null,
          flag: dto.flag.trim(),
          vesselType: dto.vesselType as Prisma.VesselCreateInput['vesselType'],
          capacityTeu: dto.capacityTeu,
          notes: dto.notes,
        },
        select,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = (e.meta?.target as string[])?.join(', ') ?? 'code';
        throw new ConflictException(
          target.includes('imo')
            ? 'A vessel with this IMO number already exists'
            : 'A vessel with this code already exists'
        );
      }
      throw e;
    }
  }

  /**
   * Editing a vessel preserves its stable registry identity (`code` is
   * immutable once assigned, since voyage references display it). Mutable
   * master fields: name, imo, flag, vesselType, capacityTeu, notes.
   */
  async update(id: string, dto: UpdateVesselDto) {
    await this.findById(id);
    try {
      return await this.prisma.vessel.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          imo: dto.imo?.trim() ?? null,
          flag: dto.flag?.trim(),
          vesselType: dto.vesselType as Prisma.VesselUpdateInput['vesselType'] | undefined,
          capacityTeu: dto.capacityTeu,
          notes: dto.notes,
        },
        select,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('A vessel with this IMO number already exists');
      }
      throw e;
    }
  }

  /**
   * Activate/deactivate lifecycle. A vessel with an unfinished voyage
   * (DRAFT/SCHEDULED/IN_PROGRESS) cannot be deactivated, because its voyages
   * reference it operationally. Completed historical voyages do NOT block
   * deactivation and remain readable.
   */
  async setActive(id: string, isActive: boolean) {
    await this.findById(id);
    if (!isActive) {
      const activeVoyages = await this.prisma.voyage.count({
        where: {
          vesselId: id,
          status: { in: ['DRAFT', 'SCHEDULED', 'IN_PROGRESS'] },
        },
      });
      if (activeVoyages > 0) {
        throw new ConflictException(
          `Cannot deactivate vessel "${id}": it still has ${activeVoyages} active/unfinished voyage(s). Cancel or complete them first.`
        );
      }
    }
    return this.prisma.vessel.update({
      where: { id },
      data: { isActive },
    });
  }

  async remove(id: string) {
    const vessel = await this.findById(id);
    const voyageCount = await this.prisma.voyage.count({ where: { vesselId: id } });
    if (voyageCount > 0) {
      throw new ConflictException(
        `Cannot delete vessel "${vessel.code}": it is referenced by ${voyageCount} voyage(s). Deactivate the vessel instead.`
      );
    }
    await this.prisma.vessel.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}