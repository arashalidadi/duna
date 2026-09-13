import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, DischargeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  CancelDischargeDto,
  CompleteDischargeDto,
  CreateDischargeDto,
  ListDischargeQueryDto,
  UpdateDischargeItemDto,
} from './dto/discharge.dto';

// ---------------------------------------------------------------------------
// Discharge lifecycle (server-side). Mirror of Actual Loading:
//   NOT_STARTED -> IN_PROGRESS -> COMPLETED | CANCELLED
//   COMPLETED and CANCELLED are terminal.
// On complete, fully discharged cargo reaches CargoStatus.DELIVERED
// (workflows.md: LOADED -> DELIVERED via Delivery/Discharge).
// ---------------------------------------------------------------------------
const DISCHARGE_TRANSITIONS: Record<DischargeStatus, DischargeStatus[]> = {
  NOT_STARTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const EDITABLE_STATUSES: DischargeStatus[] = ['NOT_STARTED', 'IN_PROGRESS'];

// ---------------------------------------------------------------------------
// Select shapes
// ---------------------------------------------------------------------------
const actualLoadingSelect = {
  id: true,
  actualLoadingNumber: true,
  status: true,
  loadList: {
    select: {
      id: true,
      loadListNumber: true,
      status: true,
      voyage: {
        select: {
          id: true,
          voyageNumber: true,
          status: true,
          vessel: { select: { id: true, code: true, name: true } },
          originPort: { select: { id: true, code: true, name: true } },
          destinationPort: { select: { id: true, code: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.ActualLoadingSelect;

const listSelect = {
  id: true,
  dischargeNumber: true,
  actualLoadingId: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  cancelledAt: true,
  deletedAt: true,
  actualLoading: { select: actualLoadingSelect },
  createdBy: { select: { id: true, email: true, fullName: true } },
  completedBy: { select: { id: true, email: true, fullName: true } },
  cancelledBy: { select: { id: true, email: true, fullName: true } },
  items: { select: { expectedQuantity: true, dischargeQuantity: true } },
  _count: { select: { items: true } },
} satisfies Prisma.DischargeSelect;

const detailSelect = {
  ...listSelect,
  items: {
    select: {
      id: true,
      dischargeId: true,
      actualLoadingItemId: true,
      cargoId: true,
      expectedQuantity: true,
      dischargeQuantity: true,
      result: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      cargo: {
        select: {
          id: true,
          reference: true,
          cargoType: true,
          status: true,
          loadingStatus: true,
          quantity: true,
          packages: true,
          customer: { select: { id: true, code: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.DischargeSelect;

type DischargeDetail = Prisma.DischargeGetPayload<{ select: typeof detailSelect }>;

/** Flattens the prisma row to the shared Discharge shape (itemsCount + totals). */
function flatten(row: DischargeDetail) {
  const items = row.items ?? [];
  const expectedTotal = items.reduce((acc, it) => acc + (it.expectedQuantity ?? 0), 0);
  const dischargedTotal = items.reduce((acc, it) => acc + (it.dischargeQuantity ?? 0), 0);
  const { _count, ...rest } = row as DischargeDetail & { _count?: { items: number } };
  return {
    ...rest,
    itemsCount: _count?.items ?? items.length,
    expectedTotal,
    dischargedTotal,
  };
}

@Injectable()
export class DischargeService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  async list(query: ListDischargeQueryDto) {
    const pagination = parsePagination(query);
    const sortField = (query.sort ?? 'createdAt') as
      | 'dischargeNumber'
      | 'status'
      | 'createdAt'
      | 'completedAt';
    const sortOrder = (query.order ?? 'desc') as Prisma.SortOrder;

    const where: Prisma.DischargeWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status as DischargeStatus } : {}),
      ...(query.actualLoadingId ? { actualLoadingId: query.actualLoadingId } : {}),
      ...(query.voyageId
        ? { actualLoading: { loadList: { voyageId: query.voyageId } } }
        : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { dischargeNumber: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
              {
                actualLoading: {
                  actualLoadingNumber: { contains: query.search, mode: 'insensitive' },
                },
              },
              { actualLoading: { loadList: { voyage: { voyageNumber: { contains: query.search, mode: 'insensitive' } } } } },
              { actualLoading: { loadList: { voyage: { vessel: { name: { contains: query.search, mode: 'insensitive' } } } } } },
              { actualLoading: { loadList: { voyage: { destinationPort: { name: { contains: query.search, mode: 'insensitive' } } } } } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.discharge.count({ where }),
      this.prisma.discharge.findMany({
        where,
        select: listSelect,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { [sortField]: sortOrder },
      }),
    ]);

    return buildPaginated(
      items.map((row) => {
        const { _count, items, ...rest } = row as typeof row & {
          _count: { items: number };
          items: { expectedQuantity: number | null; dischargeQuantity: number | null }[];
        };
        return {
          ...rest,
          itemsCount: _count?.items ?? items.length,
          expectedTotal: items.reduce((acc, it) => acc + (it.expectedQuantity ?? 0), 0),
          dischargedTotal: items.reduce((acc, it) => acc + (it.dischargeQuantity ?? 0), 0),
        };
      }),
      total,
      pagination,
    );
  }

  async findById(id: string) {
    const row = await this.prisma.discharge.findUnique({ where: { id }, select: detailSelect });
    if (!row || row.deletedAt) {
      throw new NotFoundException('Discharge not found');
    }
    return flatten(row);
  }

  /**
   * Create a Discharge for a COMPLETED Actual Loading (the vessel is at POD).
   * Pre-populates expected lines from what was actually loaded (FULL/PARTIAL
   * results with a recorded quantity); NOT_LOADED lines never left the yard
   * and cannot be discharged. One live discharge per actual loading.
   */
  async create(dto: CreateDischargeDto, actor?: AuthenticatedUser) {
    const actualLoading = await this.prisma.actualLoading.findUnique({
      where: { id: dto.actualLoadingId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        actualLoadingNumber: true,
        items: {
          select: {
            id: true,
            cargoId: true,
            actualQuantity: true,
            result: true,
          },
        },
      },
    });
    if (!actualLoading || actualLoading.deletedAt) {
      throw new NotFoundException('Actual Loading not found');
    }
    if (actualLoading.status !== 'COMPLETED') {
      throw new ConflictException(
        `Discharge can only be created for COMPLETED Actual Loadings. Current status: ${actualLoading.status}`,
      );
    }

    // what is on board: only lines with a recorded, positive quantity
    const onBoard = actualLoading.items.filter(
      (it) => it.actualQuantity !== null && it.actualQuantity > 0,
    );
    if (onBoard.length === 0) {
      throw new BadRequestException(
        'Nothing was actually loaded on this Actual Loading; there is nothing to discharge',
      );
    }

    // one live discharge per actual loading (unique + friendly message)
    const existing = await this.prisma.discharge.findFirst({
      where: { actualLoadingId: dto.actualLoadingId, deletedAt: null },
      select: { dischargeNumber: true },
    });
    if (existing) {
      throw new ConflictException(
        `A Discharge (${existing.dischargeNumber}) already exists for this Actual Loading`,
      );
    }

    const dischargeNumber = await this.generateReference();

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.discharge.create({
          data: {
            dischargeNumber,
            actualLoadingId: dto.actualLoadingId,
            notes: dto.notes,
            createdById: actor?.id,
            items: {
              create: onBoard.map((it) => ({
                actualLoadingItemId: it.id,
                cargoId: it.cargoId,
                expectedQuantity: it.actualQuantity,
                result: 'NOT_DISCHARGED' as const,
              })),
            },
          },
          select: detailSelect,
        });
        return row;
      });
      return flatten(created as DischargeDetail);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === 'P2002' || e.code === 'P2018')
      ) {
        throw new ConflictException('Could not create Discharge: duplicate reference');
      }
      throw e;
    }
  }

  /** Update notes. Only NOT_STARTED/IN_PROGRESS. */
  async update(id: string, dto: { notes?: string }) {
    const existing = await this.prisma.discharge.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Discharge not found');
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw new ConflictException(
        `Discharge is ${existing.status}; only NOT_STARTED/IN_PROGRESS can be edited`,
      );
    }

    const row = await this.prisma.discharge.update({
      where: { id },
      data: { notes: dto.notes },
      select: detailSelect,
    });
    return flatten(row as DischargeDetail);
  }

  /** Soft delete. Only NOT_STARTED/IN_PROGRESS. */
  async remove(id: string) {
    const existing = await this.prisma.discharge.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Discharge not found');
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw new ConflictException(
        `Discharge is ${existing.status}; only NOT_STARTED/IN_PROGRESS can be deleted`,
      );
    }
    await this.prisma.discharge.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // -------------------------------------------------------------------------
  // Items (actual discharge quantities)
  // -------------------------------------------------------------------------

  /**
   * Record the actual discharged quantity for one expected line.
   * Validates: discharge is editable, item belongs to it, quantity within
   * the expected snapshot. Result is derived (FULL/PARTIAL/NOT_DISCHARGED).
   */
  async updateItem(
    dischargeId: string,
    itemId: string,
    dto: UpdateDischargeItemDto,
    _actor?: AuthenticatedUser,
  ) {
    const discharge = await this.prisma.discharge.findUnique({
      where: { id: dischargeId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!discharge || discharge.deletedAt) {
      throw new NotFoundException('Discharge not found');
    }
    if (!EDITABLE_STATUSES.includes(discharge.status)) {
      throw new ConflictException(
        `Discharge is ${discharge.status}; items can only be updated in NOT_STARTED/IN_PROGRESS`,
      );
    }

    const item = await this.prisma.dischargeItem.findUnique({
      where: { id: itemId },
      select: { id: true, dischargeId: true, expectedQuantity: true },
    });
    if (!item || item.dischargeId !== dischargeId) {
      throw new NotFoundException('Discharge item not found or does not belong to this Discharge');
    }

    if (dto.dischargeQuantity !== undefined) {
      if (dto.dischargeQuantity < 0) {
        throw new BadRequestException('Discharged quantity cannot be negative');
      }
      if (item.expectedQuantity !== null && dto.dischargeQuantity > item.expectedQuantity) {
        throw new BadRequestException(
          `Discharged quantity (${dto.dischargeQuantity}) exceeds expected/loaded quantity (${item.expectedQuantity})`,
        );
      }
    }

    let result: 'FULL' | 'PARTIAL' | 'NOT_DISCHARGED' = 'NOT_DISCHARGED';
    if (dto.dischargeQuantity !== undefined) {
      if (dto.dischargeQuantity === 0) {
        result = 'NOT_DISCHARGED';
      } else if (item.expectedQuantity !== null && dto.dischargeQuantity >= item.expectedQuantity) {
        result = 'FULL';
      } else {
        result = 'PARTIAL';
      }
    }

    await this.prisma.$transaction([
      this.prisma.dischargeItem.update({
        where: { id: itemId },
        data: {
          ...(dto.dischargeQuantity !== undefined ? { dischargeQuantity: dto.dischargeQuantity } : {}),
          result,
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      }),
      this.prisma.discharge.update({ where: { id: dischargeId }, data: { updatedAt: new Date() } }),
    ]);

    const row = await this.prisma.discharge.findUnique({
      where: { id: dischargeId },
      select: detailSelect,
    });
    return flatten(row as DischargeDetail);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** NOT_STARTED -> IN_PROGRESS. */
  async start(id: string, _actor?: AuthenticatedUser) {
    const existing = await this.prisma.discharge.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Discharge not found');
    }
    this.assertTransition(existing.status, 'IN_PROGRESS');

    const row = await this.prisma.discharge.update({
      where: { id },
      data: { status: 'IN_PROGRESS', updatedAt: new Date() },
      select: detailSelect,
    });
    return flatten(row as DischargeDetail);
  }

  /**
   * Complete the discharge: status COMPLETED + stamps; fully discharged cargo
   * reaches CargoStatus.DELIVERED in the same transaction. Partial / not
   * discharged lines keep their cargo at LOADED for follow-up claims.
   */
  async complete(id: string, dto: CompleteDischargeDto, actor?: AuthenticatedUser) {
    const discharge = await this.prisma.discharge.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        items: {
          select: { id: true, cargoId: true, expectedQuantity: true, dischargeQuantity: true, result: true },
        },
      },
    });
    if (!discharge || discharge.deletedAt) {
      throw new NotFoundException('Discharge not found');
    }
    this.assertTransition(discharge.status, 'COMPLETED');
    if (discharge.items.length === 0) {
      throw new BadRequestException('Cannot complete a Discharge with no items');
    }

    // Re-validate quantities against the expected snapshots (stale clients cannot bypass).
    for (const item of discharge.items) {
      if (
        item.dischargeQuantity !== null &&
        item.expectedQuantity !== null &&
        item.dischargeQuantity > item.expectedQuantity
      ) {
        throw new ConflictException(
          `Discharged quantity exceeds the expected/loaded quantity on one of the lines`,
        );
      }
      const cargo = await this.prisma.cargo.findUnique({
        where: { id: item.cargoId },
        select: { status: true, deletedAt: true },
      });
      if (!cargo || cargo.deletedAt) {
        throw new ConflictException('A cargo on this discharge no longer exists');
      }
      if (cargo.status === 'CANCELLED') {
        throw new ConflictException('A cargo on this discharge is cancelled');
      }
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.discharge.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedById: actor?.id,
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
        select: detailSelect,
      });

      for (const item of discharge.items) {
        if (item.result !== 'FULL') {
          continue; // PARTIAL/NOT_DISCHARGED stay LOADED for claims follow-up
        }
        await tx.cargo.update({
          where: { id: item.cargoId },
          data: { status: 'DELIVERED' },
        });
      }

      return updated;
    });
    return flatten(row as DischargeDetail);
  }

  /** Cancel with mandatory reason. NOT_STARTED/IN_PROGRESS -> CANCELLED. */
  async cancel(id: string, dto: CancelDischargeDto, actor?: AuthenticatedUser) {
    const existing = await this.prisma.discharge.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Discharge not found');
    }
    this.assertTransition(existing.status, 'CANCELLED');

    const reason = dto.cancelReason?.trim();
    if (!reason) {
      throw new BadRequestException('A cancellation reason is required');
    }

    const row = await this.prisma.discharge.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: actor?.id,
        notes: dto.cancelReason,
      },
      select: detailSelect,
    });
    return flatten(row as DischargeDetail);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private assertTransition(current: DischargeStatus, target: DischargeStatus) {
    if (current === target) {
      throw new ConflictException(`Discharge is already ${target}`);
    }
    if (!DISCHARGE_TRANSITIONS[current]?.includes(target)) {
      throw new ConflictException(`Discharge transition ${current} -> ${target} is not allowed`);
    }
  }

  /** Stable, ordered discharge number: DIS-YYMM-##### (mirrors AL- pattern). */
  private async generateReference(): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0')}`;
    const prefix = `DIS-${yymm}-`;

    const latest = await this.prisma.discharge.findFirst({
      where: { dischargeNumber: { startsWith: prefix } },
      orderBy: { dischargeNumber: 'desc' },
      select: { dischargeNumber: true },
    });

    const lastSeq = latest ? Number(latest.dischargeNumber.slice(prefix.length)) : 0;
    const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }
}
