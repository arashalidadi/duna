import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { requireOffice } from '../configuration/configuration.policy';
import type { AuthenticatedUser } from '../../common/auth/types';
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
  ownership: true,
  capacityTeu: true,
  isActive: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.VesselSelect;

@Injectable()
export class VesselsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

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

  async create(dto: CreateVesselDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'vessel:create');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const vessel = await tx.vessel.create({
        data: {
          code: dto.code.trim(),
          name: dto.name.trim(),
          imo: dto.imo?.trim() || null,
          flag: dto.flag.trim(),
          vesselType: dto.vesselType as Prisma.VesselCreateInput['vesselType'],
          ownership: dto.ownership,
          capacityTeu: dto.capacityTeu,
          notes: dto.notes,
        },
        select,
        });
        await this.audit.recordIn(tx, { action: 'vessel.create', entityType: 'Vessel',
          entityId: vessel.id, actorId: actor.id, actorEmail: actor.email,
          afterData: { code: vessel.code, ownership: vessel.ownership, imo: vessel.imo } });
        return vessel;
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
  async update(id: string, dto: UpdateVesselDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'vessel:update');
    try {
      return await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Vessel" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.vessel.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw new NotFoundException('Vessel not found');
      const after = await tx.vessel.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          imo: dto.imo === undefined ? undefined : dto.imo?.trim() || null,
          flag: dto.flag?.trim(),
          vesselType: dto.vesselType as Prisma.VesselUpdateInput['vesselType'] | undefined,
          ownership: dto.ownership,
          capacityTeu: dto.capacityTeu,
          notes: dto.notes,
        },
        select,
      });
      await this.audit.recordIn(tx, { action: 'vessel.update', entityType: 'Vessel',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { name: before.name, imo: before.imo, ownership: before.ownership },
        afterData: { name: after.name, imo: after.imo, ownership: after.ownership } });
      return after;
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
  async setActive(id: string, isActive: boolean, actor: AuthenticatedUser) {
    requireOffice(actor, 'vessel:activate');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Vessel" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.vessel.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw new NotFoundException('Vessel not found');
      if (before.isActive === isActive) return tx.vessel.findUniqueOrThrow({ where: { id }, select });
      if (!isActive) {
        const activeVoyages = await tx.voyage.count({ where: {
          status: { in: ['DRAFT', 'SCHEDULED', 'IN_PROGRESS'] },
          OR: [{ vesselId: id }, { tugVesselId: id }, { bargeVesselId: id }],
        } });
        if (activeVoyages) throw new ConflictException(
          `Cannot deactivate vessel: ${activeVoyages} unfinished voyage(s) still use it. Cancel or complete them first.`);
      }
      const after = await tx.vessel.update({ where: { id }, data: { isActive }, select });
      await this.audit.recordIn(tx, { action: isActive ? 'vessel.activate' : 'vessel.deactivate',
        entityType: 'Vessel', entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { isActive: before.isActive }, afterData: { isActive } });
      return after;
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    requireOffice(actor, 'vessel:update');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Vessel" WHERE "id" = ${id} FOR UPDATE`;
      const vessel = await tx.vessel.findFirst({ where: { id, deletedAt: null }, include: { _count: {
        select: { voyages: true, tugVoyages: true, bargeVoyages: true, legNumberingVessels: true },
      } } });
      if (!vessel) throw new NotFoundException('Vessel not found');
      const attachments = await tx.fileAttachment.count({ where: {
        entityType: 'Vessel', entityId: id } });
      if (attachments || Object.values(vessel._count).some((n) => n > 0)) {
        throw new ConflictException('Vessel has voyage or retained records; deactivate instead');
      }
      const after = await tx.vessel.update({ where: { id },
        data: { deletedAt: new Date(), isActive: false } });
      await this.audit.recordIn(tx, { action: 'vessel.archive', entityType: 'Vessel',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { code: vessel.code, isActive: vessel.isActive },
        afterData: { deletedAt: after.deletedAt, isActive: false } });
      return { id, archived: true };
    });
  }
}
