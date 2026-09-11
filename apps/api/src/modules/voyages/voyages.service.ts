import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VoyageStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  CreateVoyageDto,
  ListVoyageQueryDto,
  ScheduleVoyageDto,
  UpdateVoyageDto,
} from './dto/voyage.dto';

// ---------------------------------------------------------------------------
// Voyage lifecycle (server-side, ADR-026).
//   DRAFT      -> SCHEDULED, CANCELLED
//   SCHEDULED  -> IN_PROGRESS, CANCELLED
//   IN_PROGRESS-> COMPLETED
//   COMPLETED / CANCELLED are terminal historical states.
// Status changes happen exclusively through dedicated operations
// (schedule/start/complete/cancel) — never an arbitrary status edit.
// ---------------------------------------------------------------------------
const TRANSITIONS: Record<VoyageStatus, VoyageStatus[]> = {
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

// Unfinished statuses used for deactivation overlap / active-window checks.
const UNFINISHED: VoyageStatus[] = ['DRAFT', 'SCHEDULED', 'IN_PROGRESS'];

const listSelect = {
  id: true,
  voyageNumber: true,
  status: true,
  plannedDepartureAt: true,
  plannedArrivalAt: true,
  createdAt: true,
  updatedAt: true,
  vessel: {
    select: {
      id: true,
      code: true,
      name: true,
      imo: true,
      flag: true,
      vesselType: true,
      isActive: true,
    },
  },
  originPort: {
    select: { id: true, code: true, name: true, country: true, city: true },
  },
  destinationPort: {
    select: { id: true, code: true, name: true, country: true, city: true },
  },
} satisfies Prisma.VoyageSelect;

const detailSelect = {
  ...listSelect,
  cancelReason: true,
  notes: true,
  createdBy: { select: { id: true, email: true, fullName: true } },
} satisfies Prisma.VoyageSelect;

@Injectable()
export class VoyagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListVoyageQueryDto) {
    const pagination = parsePagination(query);
    const sortField = (query.sort ?? 'plannedDepartureAt') as
      | 'voyageNumber'
      | 'status'
      | 'plannedDepartureAt'
      | 'plannedArrivalAt'
      | 'createdAt';
    const sortOrder = (query.order ?? 'desc') as Prisma.SortOrder;

    const where: Prisma.VoyageWhereInput = {
      ...(query.status ? { status: query.status as VoyageStatus } : {}),
      ...(query.vesselId ? { vesselId: query.vesselId } : {}),
      ...(query.originPortId ? { originPortId: query.originPortId } : {}),
      ...(query.destinationPortId ? { destinationPortId: query.destinationPortId } : {}),
      ...(query.departureFrom || query.departureTo
        ? {
            plannedDepartureAt: {
              ...(query.departureFrom ? { gte: new Date(query.departureFrom) } : {}),
              ...(query.departureTo ? { lte: new Date(query.departureTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { voyageNumber: { contains: query.search, mode: 'insensitive' } },
              {
                vessel: {
                  OR: [
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { code: { contains: query.search, mode: 'insensitive' } },
                  ],
                },
              },
              { originPort: { name: { contains: query.search, mode: 'insensitive' } } },
              { destinationPort: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.voyage.count({ where }),
      this.prisma.voyage.findMany({
        where,
        select: listSelect,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { [sortField]: sortOrder },
      }),
    ]);

    return buildPaginated(items, total, pagination);
  }

  async findById(id: string) {
    const row = await this.prisma.voyage.findUnique({ where: { id }, select: detailSelect });
    if (!row) {
      throw new NotFoundException('Voyage not found');
    }
    return row;
  }

  /** Guard used to resolve master data (vessel/ports) must exist and be active. */
  private async assertMasterData(vesselId: string, originPortId: string, destinationPortId: string) {
    const vessel = await this.prisma.vessel.findUnique({
      where: { id: vesselId },
      select: { id: true, isActive: true, deletedAt: true, name: true },
    });
    if (!vessel || vessel.deletedAt) {
      throw new NotFoundException('Vessel not found');
    }
    if (!vessel.isActive) {
      throw new ConflictException(`Vessel "${vessel.name}" is inactive; voyages can only be created for active vessels`);
    }

    const ports = await this.prisma.port.findMany({
      where: { id: { in: [originPortId, destinationPortId] }, deletedAt: null },
      select: { id: true, isActive: true },
    });
    if (ports.length !== 2) {
      throw new NotFoundException('Origin or destination port not found');
    }
    const inactive = ports.find((p) => !p.isActive);
    if (inactive) {
      throw new ConflictException('Voyage endpoints must be active ports');
    }
    return vessel;
  }

  /**
   * A vessel cannot have two simultaneous routes: reject creating/scheduling a
   * voyage whose planned window overlaps any existing unfinished
   * (DRAFT/SCHEDULED/IN_PROGRESS) voyage of the same vessel (ADR-027).
   * Only enforced once dates are known (i.e. at schedule time).
   */
  private async assertNoOverlap(
    vesselId: string,
    plannedDepartureAt: Date,
    plannedArrivalAt: Date,
    excludeId?: string
  ) {
    const overlapping = await this.prisma.voyage.findFirst({
      where: {
        vesselId,
        status: { in: UNFINISHED },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          // Existing voyage starts inside our window.
          { plannedDepartureAt: { lte: plannedArrivalAt }, plannedArrivalAt: { gte: plannedDepartureAt } },
          // Existing voyage is a point-window (no dates yet) — cannot overlap by definition.
        ],
      },
      select: { id: true, voyageNumber: true, plannedDepartureAt: true, plannedArrivalAt: true },
    });
    if (overlapping) {
      const other =
        overlapping.plannedDepartureAt && overlapping.plannedArrivalAt
          ? ` (${overlapping.plannedDepartureAt.toISOString()} -> ${overlapping.plannedArrivalAt.toISOString()})`
          : '';
      throw new ConflictException(
        `Cannot schedule this voyage: it overlaps voyage ${overlapping.voyageNumber}${other} on the same vessel`
      );
    }
  }

  async create(dto: CreateVoyageDto, actor?: AuthenticatedUser) {
    await this.assertMasterData(dto.vesselId, dto.originPortId, dto.destinationPortId);

    const voyageNumber = await this.generateReference();

    try {
      return await this.prisma.voyage.create({
        data: {
          voyageNumber,
          vesselId: dto.vesselId,
          originPortId: dto.originPortId,
          destinationPortId: dto.destinationPortId,
          notes: dto.notes,
          createdById: actor?.id,
        },
        select: detailSelect,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === 'P2002' || e.code === 'P2018')
      ) {
        throw new ConflictException('Could not create voyage: duplicate or invalid reference');
      }
      throw e;
    }
  }

  /**
   * Editing rules (ADR-026): a DRAFT voyage may be edited fully. Once SCHEDULED
   * the route (vessel/ports) becomes read-only; only notes may change.
   * IN_PROGRESS/COMPLETED/CANCELLED are read-only.
   */
  async update(id: string, dto: UpdateVoyageDto) {
    const existing = await this.prisma.voyage.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException('Voyage not found');
    }
    if (existing.status !== 'DRAFT') {
      if (existing.status === 'SCHEDULED') {
        if (dto.vesselId || dto.originPortId || dto.destinationPortId) {
          throw new ConflictException('A SCHEDULED voyage route is frozen; only notes can be edited');
        }
      } else {
        throw new ConflictException('Only a DRAFT or SCHEDULED voyage can be edited');
      }
    }

    if (dto.vesselId || dto.originPortId || dto.destinationPortId) {
      const current = await this.findById(id);
      await this.assertMasterData(
        dto.vesselId ?? current.vessel.id,
        dto.originPortId ?? current.originPort.id,
        dto.destinationPortId ?? current.destinationPort.id
      );
    }

    return this.prisma.voyage.update({
      where: { id },
      data: {
        vesselId: dto.vesselId,
        originPortId: dto.originPortId,
        destinationPortId: dto.destinationPortId,
        notes: dto.notes,
      },
      select: detailSelect,
    });
  }

  /** Send a voyage forward: SCHEDULED sets planned dates (required, ordered, non-overlapping). */
  async schedule(id: string, dto: ScheduleVoyageDto) {
    const existing = await this.prisma.voyage.findUnique({
      where: { id },
      select: { id: true, status: true, vesselId: true },
    });
    if (!existing) {
      throw new NotFoundException('Voyage not found');
    }
    this.assertTransition(existing.status, 'SCHEDULED');

    const departure = new Date(dto.plannedDepartureAt);
    const arrival = new Date(dto.plannedArrivalAt);
    if (Number.isNaN(departure.getTime()) || Number.isNaN(arrival.getTime())) {
      throw new BadRequestException('Invalid planned departure/arrival date');
    }
    if (arrival < departure) {
      throw new BadRequestException('plannedArrivalAt must not be earlier than plannedDepartureAt');
    }

    await this.assertNoOverlap(existing.vesselId, departure, arrival);

    return this.prisma.voyage.update({
      where: { id },
      data: {
        status: 'SCHEDULED',
        plannedDepartureAt: departure,
        plannedArrivalAt: arrival,
        notes: dto.notes,
      },
      select: detailSelect,
    });
  }

  async start(id: string) {
    const existing = await this.prisma.voyage.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException('Voyage not found');
    }
    this.assertTransition(existing.status, 'IN_PROGRESS');

    return this.prisma.voyage.update({
      where: { id },
      data: { status: 'IN_PROGRESS' },
      select: detailSelect,
    });
  }

  async complete(id: string) {
    const existing = await this.prisma.voyage.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException('Voyage not found');
    }
    this.assertTransition(existing.status, 'COMPLETED');

    return this.prisma.voyage.update({
      where: { id },
      data: { status: 'COMPLETED' },
      select: detailSelect,
    });
  }

  async cancel(id: string, cancelReason: string) {
    const existing = await this.prisma.voyage.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException('Voyage not found');
    }
    this.assertTransition(existing.status, 'CANCELLED');
    const reason = cancelReason?.trim();
    if (!reason) {
      throw new BadRequestException('A cancellation reason is required');
    }

    return this.prisma.voyage.update({
      where: { id },
      data: { status: 'CANCELLED', cancelReason: reason },
      select: detailSelect,
    });
  }

  private assertTransition(current: VoyageStatus, target: VoyageStatus) {
    if (!TRANSITIONS[current].includes(target)) {
      throw new ConflictException(
        `Voyage transition ${current} -> ${target} is not allowed`
      );
    }
  }

  /** Stable, ordered voyage number: VOY-YYMM-##### (mirrors inspection/CRG pattern). */
  private async generateReference() {
    const now = new Date();
    const yymm = `${now.getUTCFullYear().toString().slice(-2)}${(now.getUTCMonth() + 1).toString().padStart(2, '0')}`;
    const prefix = `VOY-${yymm}`;
    const countThisMonth = await this.prisma.voyage.count({
      where: { voyageNumber: { startsWith: prefix } },
    });
    return `${prefix}-${(countThisMonth + 1).toString().padStart(5, '0')}`;
  }
}