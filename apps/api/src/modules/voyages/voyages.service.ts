import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VesselType, VoyageStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  CreateVoyageDto,
  ListVoyageQueryDto,
  ScheduleVoyageDto,
  UpdateVoyageDto,
} from './dto/voyage.dto';
import { NumberingService } from '../../common/infrastructure/numbering/numbering.service';
import type { AllocatedNumber } from '../../common/infrastructure/numbering/numbering-sequence.types';

const TRANSITIONS: Record<VoyageStatus, VoyageStatus[]> = {
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

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
  tugVessel: {
    select: {
      id: true,
      code: true,
      name: true,
      vesselType: true,
    },
  },
  bargeVessel: {
    select: {
      id: true,
      code: true,
      name: true,
      vesselType: true,
    },
  },
  originPort: {
    select: { id: true, code: true, name: true, country: true, city: true, abbreviation: true },
  },
  destinationPort: {
    select: { id: true, code: true, name: true, country: true, city: true, abbreviation: true },
  },
  legs: {
    where: { deletedAt: null },
    orderBy: { legNumber: 'asc' as const },
    select: {
      id: true,
      legNumber: true,
      voyageNumber: true,
      destinationPortId: true,
      destinationPort: {
        select: {
          id: true,
          code: true,
          name: true,
          country: true,
          city: true,
          abbreviation: true,
        },
      },
    },
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
  ) {}

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
    const row = await this.prisma.voyage.findUnique({
      where: { id },
      select: detailSelect,
    });
    if (!row) {
      throw new NotFoundException('Voyage not found');
    }
    return row;
  }

  private async assertMasterData(
    vesselId: string,
    originPortId: string,
    destinationPortId: string,
    tugVesselId?: string,
    bargeVesselId?: string,
  ) {
    const vessel = await this.prisma.vessel.findUnique({
      where: { id: vesselId },
      select: { id: true, isActive: true, deletedAt: true, name: true, vesselType: true },
    });
    if (!vessel || vessel.deletedAt) {
      throw new NotFoundException('Vessel not found');
    }
    if (!vessel.isActive) {
      throw new ConflictException(
        `Vessel "${vessel.name}" is inactive; voyages can only be created for active vessels`,
      );
    }

    if (tugVesselId) {
      const tug = await this.prisma.vessel.findUnique({
        where: { id: tugVesselId },
        select: { id: true, vesselType: true, isActive: true, deletedAt: true },
      });
      if (!tug || tug.deletedAt) {
        throw new NotFoundException('Tug vessel not found');
      }
      if (!tug.isActive) {
        throw new ConflictException('Tug vessel is inactive');
      }
      if (tug.vesselType !== VesselType.TUG) {
        throw new ConflictException(
          'The assigned tug vessel must have vessel type TUG',
        );
      }
    }

    if (bargeVesselId) {
      const barge = await this.prisma.vessel.findUnique({
        where: { id: bargeVesselId },
        select: { id: true, vesselType: true, isActive: true, deletedAt: true },
      });
      if (!barge || barge.deletedAt) {
        throw new NotFoundException('Barge vessel not found');
      }
      if (!barge.isActive) {
        throw new ConflictException('Barge vessel is inactive');
      }
      if (barge.vesselType !== VesselType.BARGE) {
        throw new ConflictException(
          'The assigned barge vessel must have vessel type BARGE',
        );
      }
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
   * Validate a voyage's full desired destination list (primary + additional):
   * every entry must be an existing active port, and no port may appear twice
   * within one voyage (legs are unique per voyage).
   */
  private async assertDestinationLegs(destinationIds: string[]) {
    if (new Set(destinationIds).size !== destinationIds.length) {
      throw new BadRequestException('Duplicate destination in a voyage');
    }
    const ports = await this.prisma.port.findMany({
      where: { id: { in: destinationIds }, deletedAt: null },
      select: { id: true, isActive: true },
    });
    if (ports.length !== destinationIds.length) {
      throw new NotFoundException('Destination port not found');
    }
    const inactive = ports.find((port) => !port.isActive);
    if (inactive) {
      throw new ConflictException('Voyage endpoints must be active ports');
    }
  }

  /**
   * Destination-scoped voyage number (docs 01:58-64 — one sequence per
   * destination per year, rendered `{seq}/{YY}` -> `1/26`, `2/26`).
   * Sequence key `voyage-<portId>-<YY>` is year-rotating and distinct from the
   * parent `voyage-<yymm>` sequence and the stale `voyage-<portId>` rows.
   */
  private async allocateLegNumber(destinationPortId: string): Promise<string> {
    const yy = new Date()
      .getUTCFullYear()
      .toString()
      .slice(-2);
    const allocated = await this.numbering.allocateNumber({
      name: `voyage-${destinationPortId}-${yy}`,
      documentType: 'VOYAGE',
      scopeType: 'DESTINATION',
      scopeValue: destinationPortId,
      prefix: '',
      padding: 1,
      format: `{sequence}/${yy}`,
      period: 'YY',
    });
    return allocated.sequence;
  }

  /**
   * Read-only next-number preview for the create dialog (no allocation):
   * renders what allocateLegNumber WOULD return for each destination.
   */
  async previewDestinationNumbers(destinationPortIds: string[]) {
    if (!destinationPortIds.length) {
      throw new BadRequestException('destinationPortIds is required');
    }
    if (destinationPortIds.length > 20) {
      throw new BadRequestException('Too many destination ports (max 20)');
    }
    await this.assertDestinationLegs(destinationPortIds);

    const yy = new Date()
      .getUTCFullYear()
      .toString()
      .slice(-2);
    const sequences = await this.prisma.numberingSequence.findMany({
      where: { name: { in: destinationPortIds.map((id) => `voyage-${id}-${yy}`) } },
      select: { name: true, nextSequence: true, isActive: true },
    });
    const byName = new Map(sequences.map((seq) => [seq.name, seq]));

    return destinationPortIds.map((destinationPortId) => {
      const seq = byName.get(`voyage-${destinationPortId}-${yy}`);
      // Allocation upserts an inactive/missing sequence from 1 — mirror that.
      const next = seq && seq.isActive ? seq.nextSequence : 1;
      return { destinationPortId, nextVoyageNumber: `${next}/${yy}` };
    });
  }

  private async assertNoOverlap(
    vesselId: string,
    plannedDepartureAt: Date,
    plannedArrivalAt: Date,
    excludeId?: string,
  ) {
    const overlapping = await this.prisma.voyage.findFirst({
      where: {
        vesselId,
        status: { in: UNFINISHED },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          {
            plannedDepartureAt: { lte: plannedArrivalAt },
            plannedArrivalAt: { gte: plannedDepartureAt },
          },
        ],
      },
      select: {
        id: true,
        voyageNumber: true,
        plannedDepartureAt: true,
        plannedArrivalAt: true,
      },
    });
    if (overlapping) {
      const other =
        overlapping.plannedDepartureAt && overlapping.plannedArrivalAt
          ? ` (${overlapping.plannedDepartureAt.toISOString()} -> ${overlapping.plannedArrivalAt.toISOString()})`
          : '';
      throw new ConflictException(
        `Cannot schedule this voyage: it overlaps voyage ${overlapping.voyageNumber}${other} on the same vessel`,
      );
    }
  }

  async create(dto: CreateVoyageDto, actor?: AuthenticatedUser) {
    // Full desired destination list: primary (leg 1) + optional additional legs.
    // `destinations` = ADDITIONAL destinations beyond destinationPortId.
    const additionalDestinations = dto.destinations ?? [];
    const destinationIds = [dto.destinationPortId, ...additionalDestinations];

    await this.assertMasterData(
      dto.vesselId,
      dto.originPortId,
      dto.destinationPortId,
      dto.tugVesselId,
      dto.bargeVesselId,
    );
    // Duplicate destinations within one voyage are rejected (400), and every
    // leg destination must be an existing active port.
    await this.assertDestinationLegs(destinationIds);

    const now = new Date();
    const yymm = `${now
      .getUTCFullYear()
      .toString()
      .slice(-2)}${(now.getUTCMonth() + 1).toString().padStart(2, '0')}`;

    // Parent number: existing global allocation, format VOY-YYMM-##### unchanged.
    const voyageNumber = await this.numbering
      .allocateNumber({
        name: `voyage-${yymm}`,
        documentType: 'VOYAGE',
        scopeType: 'YEAR_PERIOD',
        scopeValue: yymm,
        prefix: `VOY-${yymm}-`,
        padding: 5,
        format: '{prefix}{sequence}',
      })
      .then((a: AllocatedNumber) => a.sequence);

    // Each leg gets its own destination-scoped number ({seq}/{YY} -> 1/26).
    const legNumbers: string[] = [];
    for (const destinationPortId of destinationIds) {
      legNumbers.push(await this.allocateLegNumber(destinationPortId));
    }

    try {
      return await this.prisma.voyage.create({
        data: {
          voyageNumber,
          vesselId: dto.vesselId,
          tugVesselId: dto.tugVesselId,
          bargeVesselId: dto.bargeVesselId,
          originPortId: dto.originPortId,
          destinationPortId: dto.destinationPortId,
          notes: dto.notes,
          createdById: actor?.id,
          legs: {
            create: destinationIds.map((destinationPortId, index) => ({
              destinationPort: { connect: { id: destinationPortId } },
              legNumber: index + 1,
              voyageNumber: legNumbers[index],
            })),
          },
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
        if (
          dto.vesselId !== undefined ||
          dto.originPortId !== undefined ||
          dto.destinationPortId !== undefined ||
          dto.tugVesselId !== undefined ||
          dto.bargeVesselId !== undefined ||
          dto.destinations !== undefined
        ) {
          throw new ConflictException(
            'A SCHEDULED voyage route is frozen; only notes can be edited',
          );
        }
      } else {
        throw new ConflictException('Only a DRAFT or SCHEDULED voyage can be edited');
      }
    }

    // Leg reconciliation only runs when the route's destinations change.
    // SCHEDULED voyages reach here only for notes — dto.destinations is
    // rejected above alongside the other route fields.
    let desiredDestinations: string[] | null = null;
    let currentLegs: Array<{
      id: string;
      destinationPortId: string;
      legNumber: number;
      voyageNumber: string;
      deletedAt: Date | null;
    }> = [];

    if (
      dto.vesselId !== undefined ||
      dto.originPortId !== undefined ||
      dto.destinationPortId !== undefined ||
      dto.tugVesselId !== undefined ||
      dto.bargeVesselId !== undefined ||
      dto.destinations !== undefined
    ) {
      const current = await this.findById(id);
      await this.assertMasterData(
        dto.vesselId ?? current.vessel.id,
        dto.originPortId ?? current.originPort.id,
        dto.destinationPortId ?? current.destinationPort.id,
        dto.tugVesselId ?? current.tugVessel?.id,
        dto.bargeVesselId ?? current.bargeVessel?.id,
      );

      // Leg 1 mirrors the primary destination, so re-targeting
      // destinationPortId alone must also re-sync the legs.
      const primaryChanged =
        dto.destinationPortId !== undefined &&
        dto.destinationPortId !== current.destinationPort.id;
      if (dto.destinations !== undefined || primaryChanged) {
        const primary = dto.destinationPortId ?? current.destinationPort.id;
        const currentPrimary = current.destinationPort.id;
        // Desired additional legs: explicit list, else keep the current ones
        // (minus old/new primary, which is always leg 1).
        const additional =
          dto.destinations !== undefined
            ? dto.destinations
            : current.legs
                .filter(
                  (leg) =>
                    leg.destinationPortId !== currentPrimary &&
                    leg.destinationPortId !== primary,
                )
                .map((leg) => leg.destinationPortId);
        desiredDestinations = [primary, ...additional];
        await this.assertDestinationLegs(desiredDestinations);

        // All rows (incl. soft-deleted) — re-added destinations revive their
        // row because @@unique([voyageId, destinationPortId]) covers them.
        currentLegs = await this.prisma.voyageDestination.findMany({
          where: { voyageId: id },
          select: {
            id: true,
            destinationPortId: true,
            legNumber: true,
            voyageNumber: true,
            deletedAt: true,
          },
        });
      }
    }

    const updateData = {
      vesselId: dto.vesselId,
      // '' / null detach the pairing; absent key leaves it untouched.
      tugVesselId:
        dto.tugVesselId !== undefined
          ? dto.tugVesselId?.trim() || null
          : undefined,
      bargeVesselId:
        dto.bargeVesselId !== undefined
          ? dto.bargeVesselId?.trim() || null
          : undefined,
      originPortId: dto.originPortId,
      destinationPortId: dto.destinationPortId,
      notes: dto.notes,
    };

    if (!desiredDestinations) {
      return this.prisma.voyage.update({
        where: { id },
        data: updateData,
        select: detailSelect,
      });
    }

    // --- Leg sync (DRAFT only): keep / revive / add / soft-remove ---
    const activeByPort = new Map(
      currentLegs.filter((leg) => leg.deletedAt === null).map((leg) => [leg.destinationPortId, leg]),
    );
    const anyByPort = new Map(currentLegs.map((leg) => [leg.destinationPortId, leg]));

    const legWrites: Prisma.PrismaPromise<any>[] = [];

    // (Re)create legs whose destination has no active row: fresh allocation.
    const needsNumber: string[] = [];
    for (const [index, destinationPortId] of desiredDestinations.entries()) {
      const active = activeByPort.get(destinationPortId);
      if (active) {
        if (active.legNumber !== index + 1) {
          legWrites.push(
            this.prisma.voyageDestination.update({
              where: { id: active.id },
              data: { legNumber: index + 1 },
            }),
          );
        }
        continue;
      }
      needsNumber.push(destinationPortId);
    }
    const freshNumbers = new Map<string, string>();
    for (const destinationPortId of needsNumber) {
      freshNumbers.set(destinationPortId, await this.allocateLegNumber(destinationPortId));
    }
    for (const [index, destinationPortId] of desiredDestinations.entries()) {
      if (activeByPort.has(destinationPortId)) continue;
      const revived = anyByPort.get(destinationPortId);
      const voyageNumber = freshNumbers.get(destinationPortId)!;
      if (revived) {
        legWrites.push(
          this.prisma.voyageDestination.update({
            where: { id: revived.id },
            data: { deletedAt: null, legNumber: index + 1, voyageNumber },
          }),
        );
      } else {
        legWrites.push(
          this.prisma.voyageDestination.create({
            data: {
              voyageId: id,
              destinationPortId,
              legNumber: index + 1,
              voyageNumber,
            },
          }),
        );
      }
    }
    // Soft-remove active legs whose destination dropped out of the list.
    const desiredSet = new Set(desiredDestinations);
    for (const leg of activeByPort.values()) {
      if (!desiredSet.has(leg.destinationPortId)) {
        legWrites.push(
          this.prisma.voyageDestination.update({
            where: { id: leg.id },
            data: { deletedAt: new Date() },
          }),
        );
      }
    }

    const results = await this.prisma.$transaction([
      ...legWrites,
      this.prisma.voyage.update({
        where: { id },
        data: updateData,
        select: detailSelect,
      }),
    ]);
    return results[results.length - 1];
  }

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
      throw new BadRequestException(
        'plannedArrivalAt must not be earlier than plannedDepartureAt',
      );
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
        `Voyage transition ${current} -> ${target} is not allowed`,
      );
    }
  }
}
