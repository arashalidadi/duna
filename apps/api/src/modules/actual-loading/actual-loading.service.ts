import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ActualLoadingStatus } from '@prisma/client';
type ActualLoadingStatusFilter = { equals: ActualLoadingStatus } | { in: ActualLoadingStatus[] } | { not: ActualLoadingStatus };
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  CreateActualLoadingDto,
  UpdateActualLoadingItemDto,
  BulkUpdateActualLoadingItemsDto,
  CompleteActualLoadingDto,
  CancelActualLoadingDto,
  ListActualLoadingQueryDto,
} from './dto/actual-loading.dto';

// ---------------------------------------------------------------------------
// Actual Loading lifecycle (server-side).
//   DRAFT           -> IN_PROGRESS -> PARTIALLY_LOADED -> COMPLETED | FINALIZED | CANCELLED
//   COMPLETED, FINALIZED and CANCELLED are terminal.
// ---------------------------------------------------------------------------
const ACTUAL_LOADING_TRANSITIONS: Record<ActualLoadingStatus, ActualLoadingStatus[]> = {
  DRAFT: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PARTIALLY_LOADED', 'COMPLETED', 'CANCELLED'],
  PARTIALLY_LOADED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  FINALIZED: ['CANCELLED'],
  CANCELLED: [],
};

const EDITABLE_STATUSES: ActualLoadingStatus[] = ['DRAFT', 'IN_PROGRESS'];

// ---------------------------------------------------------------------------
// Select shapes for consistent responses
// ---------------------------------------------------------------------------
const listSelect = {
  id: true,
  actualLoadingNumber: true,
  loadListId: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  cancelledAt: true,
  deletedAt: true,
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
          plannedDepartureAt: true,
          plannedArrivalAt: true,
          vessel: {
            select: {
              id: true,
              code: true,
              name: true,
              imo: true,
              vesselType: true,
            },
          },
          originPort: { select: { id: true, code: true, name: true, country: true, city: true } },
          destinationPort: { select: { id: true, code: true, name: true, country: true, city: true } },
        },
      },
    },
  },
  createdBy: { select: { id: true, email: true, fullName: true } },
  completedBy: { select: { id: true, email: true, fullName: true } },
  cancelledBy: { select: { id: true, email: true, fullName: true } },
  _count: { select: { items: true } },
} satisfies Prisma.ActualLoadingSelect;

const detailSelect = {
  ...listSelect,
  items: {
    select: {
      id: true,
      loadListItemId: true,
      cargoId: true,
      actualQuantity: true,
      result: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      loadListItem: { select: { id: true, plannedQuantity: true, sequence: true } },
      cargo: {
        select: {
          id: true,
          reference: true,
          cargoType: true,
          status: true,
          inspectionStatus: true,
          loadingStatus: true,
          weight: true,
          weightUnit: true,
          quantity: true,
          packages: true,
          packageType: true,
          serialNumber: true,
          chassisNumber: true,
          vin: true,
          customer: { select: { id: true, code: true, name: true, shortName: true } },
          port: { select: { id: true, code: true, name: true } },
          destinationPort: { select: { id: true, code: true, name: true } },
          yard: { select: { id: true, code: true, name: true } },
          inventory: { select: { id: true, yardId: true, portId: true, status: true, enteredAt: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ActualLoadingSelect;

const itemSelect = {
  id: true,
  loadListItemId: true,
  cargoId: true,
  actualQuantity: true,
  result: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  loadListItem: { select: { id: true, plannedQuantity: true, sequence: true } },
  cargo: {
    select: {
      id: true,
      reference: true,
      cargoType: true,
      status: true,
      inspectionStatus: true,
      loadingStatus: true,
      weight: true,
      weightUnit: true,
      quantity: true,
      packages: true,
      packageType: true,
      serialNumber: true,
      chassisNumber: true,
      vin: true,
      customer: { select: { id: true, code: true, name: true, shortName: true } },
      port: { select: { id: true, code: true, name: true } },
      destinationPort: { select: { id: true, code: true, name: true } },
      yard: { select: { id: true, code: true, name: true } },
      inventory: { select: { id: true, yardId: true, portId: true, status: true, enteredAt: true } },
    },
  },
} satisfies Prisma.ActualLoadingItemSelect;

@Injectable()
export class ActualLoadingService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Actual Loading CRUD
  // -------------------------------------------------------------------------

  async list(query: ListActualLoadingQueryDto) {
    const pagination = parsePagination(query);
    const sortField = (query.sort ?? 'createdAt') as
      | 'actualLoadingNumber'
      | 'status'
      | 'createdAt'
      | 'completedAt';
    const sortOrder = (query.order ?? 'desc') as Prisma.SortOrder;

    const where: Prisma.ActualLoadingWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status as unknown as Prisma.ActualLoadingWhereInput['status'] } : {}),
      ...(query.loadListId ? { loadListId: query.loadListId } : {}),
      ...(query.voyageId ? { loadList: { voyageId: query.voyageId } } : {}),
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
              { actualLoadingNumber: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
              { loadList: { loadListNumber: { contains: query.search, mode: 'insensitive' } } },
              { loadList: { voyage: { voyageNumber: { contains: query.search, mode: 'insensitive' } } } },
              { loadList: { voyage: { vessel: { name: { contains: query.search, mode: 'insensitive' } } } } },
              { loadList: { voyage: { originPort: { name: { contains: query.search, mode: 'insensitive' } } } } },
              { loadList: { voyage: { destinationPort: { name: { contains: query.search, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.actualLoading.count({ where }),
      this.prisma.actualLoading.findMany({
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
    const row = await this.prisma.actualLoading.findUnique({ where: { id }, select: detailSelect });
    if (!row || row.deletedAt) {
      throw new NotFoundException('Actual Loading not found');
    }
    return row;
  }

  /**
   * Create an Actual Loading for a Load List.
   * Validates: load list exists, is active (not soft-deleted), and in COMPLETED state.
   * Creates in DRAFT state. Generates stable actualLoadingNumber: AL-YYMM-#####.
   */
  async create(dto: CreateActualLoadingDto, actor?: AuthenticatedUser) {
    const loadList = await this.prisma.loadList.findUnique({
      where: { id: dto.loadListId },
      select: { id: true, status: true, loadListNumber: true, voyageId: true, items: { select: { cargoId: true } } },
    });
    if (!loadList) {
      throw new NotFoundException('Load List not found');
    }
    if (loadList.status !== 'COMPLETED') {
      throw new ConflictException(
        `Actual Loading can only be created for COMPLETED Load Lists. Current status: ${loadList.status}`,
      );
    }
    if (loadList.items.length === 0) {
      throw new BadRequestException('Cannot create Actual Loading for an empty Load List');
    }

    // Atomic number allocation by BOUNDED RETRY (same pattern as Cargo.reference): several e2e
    // suites create Actual Loadings in parallel and generateReference() is read-then-write, so
    // two requests can compute the same AL-YYMM-##### and the loser hits the unique number index.
    // On that collision we re-read the committed max and retry; any other P2002/P2018 (e.g. the
    // one-per-load-list rule) keeps the existing 409 semantics.
    const MAX_AL_ATTEMPTS = 10;
    for (let attempt = 1; ; attempt += 1) {
      const actualLoadingNumber = await this.generateReference();
      try {
        return await this.prisma.actualLoading.create({
          data: {
            actualLoadingNumber,
            loadListId: dto.loadListId,
            notes: dto.notes,
            createdById: actor?.id,
          },
          select: detailSelect,
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          attempt < MAX_AL_ATTEMPTS &&
          String((e.meta as { target?: unknown } | undefined)?.target ?? '').includes(
            'actualLoadingNumber'
          )
        ) {
          continue; // lost the number race: re-read the committed max and retry
        }
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (e.code === 'P2002' || e.code === 'P2018')
        ) {
          throw new ConflictException('Could not create Actual Loading: duplicate reference');
        }
        throw e;
      }
    }
  }

  /**
   * Update Actual Loading notes.
   * Only DRAFT/IN_PROGRESS lists may be edited.
   */
  async update(id: string, dto: { notes?: string }) {
    const existing = await this.prisma.actualLoading.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Actual Loading not found');
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw new ConflictException(
        `Actual Loading is ${existing.status}; only DRAFT/IN_PROGRESS can be edited`,
      );
    }

    return this.prisma.actualLoading.update({
      where: { id },
      data: { notes: dto.notes },
      select: detailSelect,
    });
  }

  /**
   * Soft delete an Actual Loading.
   * Only DRAFT/IN_PROGRESS lists may be deleted. COMPLETED/FINALIZED/CANCELLED are preserved for audit.
   */
  async remove(id: string) {
    const existing = await this.prisma.actualLoading.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Actual Loading not found');
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw new ConflictException(
        `Actual Loading is ${existing.status}; only DRAFT/IN_PROGRESS can be deleted`,
      );
    }

    await this.prisma.actualLoading.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // -------------------------------------------------------------------------
  // Actual Loading Items (cargo actual quantities)
  // -------------------------------------------------------------------------

  /**
   * Update actual quantity for a single cargo item.
   * Enforces: actual loading is DRAFT/IN_PROGRESS, quantity constraints.
   */
  async updateItem(
    actualLoadingId: string,
    loadListItemId: string,
    dto: UpdateActualLoadingItemDto,
    _actor?: AuthenticatedUser
  ) {
    const actualLoading = await this.prisma.actualLoading.findUnique({
      where: { id: actualLoadingId },
      select: { id: true, status: true, loadListId: true, deletedAt: true },
    });
    if (!actualLoading || actualLoading.deletedAt) {
      throw new NotFoundException('Actual Loading not found');
    }
    if (!EDITABLE_STATUSES.includes(actualLoading.status)) {
      throw new ConflictException(
        `Actual Loading is ${actualLoading.status}; items can only be updated in DRAFT/IN_PROGRESS`,
      );
    }

    // Verify the LoadListItem belongs to the same LoadList as the ActualLoading
    const loadListItem = await this.prisma.loadListItem.findUnique({
      where: { id: loadListItemId },
      select: {
        id: true,
        loadListId: true,
        cargoId: true,
        plannedQuantity: true,
        cargo: { select: { id: true, reference: true, quantity: true, inspectionStatus: true, status: true, deletedAt: true } },
      },
    });
    if (!loadListItem || loadListItem.loadListId !== actualLoading.loadListId) {
      throw new NotFoundException('Load List item not found or does not belong to this Actual Loading');
    }

    const cargo = loadListItem.cargo;
    if (!cargo || cargo.deletedAt) {
      throw new NotFoundException('Cargo not found');
    }
    if (cargo.status === 'CANCELLED') {
      throw new ConflictException('Cancelled cargo cannot be loaded');
    }
    if (cargo.inspectionStatus !== 'DONE') {
      throw new ConflictException(`Cargo inspection is ${cargo.inspectionStatus}; must be DONE`);
    }

    // Validate actual quantity
    if (dto.actualQuantity !== undefined) {
      if (dto.actualQuantity < 0) {
        throw new BadRequestException('Actual quantity cannot be negative');
      }
      if (loadListItem.plannedQuantity !== null && dto.actualQuantity > loadListItem.plannedQuantity) {
        throw new BadRequestException(
          `Actual quantity (${dto.actualQuantity}) exceeds planned quantity (${loadListItem.plannedQuantity})`
        );
      }
    }

    // Determine result based on actual quantity
    let result: 'FULL' | 'PARTIAL' | 'NOT_LOADED' = 'NOT_LOADED';
    if (dto.actualQuantity !== undefined) {
      if (dto.actualQuantity === 0) {
        result = 'NOT_LOADED';
      } else if (loadListItem.plannedQuantity !== null && dto.actualQuantity >= loadListItem.plannedQuantity) {
        result = 'FULL';
      } else if (dto.actualQuantity > 0) {
        result = 'PARTIAL';
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.actualLoadingItem.upsert({
          where: { loadListItemId },
          create: {
            actualLoadingId,
            loadListItemId,
            cargoId: loadListItem.cargoId,
            actualQuantity: dto.actualQuantity ?? null,
            result,
            notes: dto.notes,
          },
          update: {
            actualQuantity: dto.actualQuantity ?? null,
            result,
            notes: dto.notes,
          },
          select: itemSelect,
        });

        // Update actual loading updatedAt
        await tx.actualLoading.update({
          where: { id: actualLoadingId },
          data: { updatedAt: new Date() },
        });

        return item;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002' // unique constraint violation
      ) {
        throw new ConflictException('This cargo is already in the Actual Loading');
      }
      throw e;
    }
  }

  /**
   * Bulk update actual quantities for multiple cargo items.
   * Transactional: all items validated first, then all inserted/updated or none.
   */
  async updateItemsBulk(
    actualLoadingId: string,
    dto: BulkUpdateActualLoadingItemsDto,
    _actor?: AuthenticatedUser
  ) {
    const actualLoading = await this.prisma.actualLoading.findUnique({
      where: { id: actualLoadingId },
      select: { id: true, status: true, loadListId: true, deletedAt: true },
    });
    if (!actualLoading || actualLoading.deletedAt) {
      throw new NotFoundException('Actual Loading not found');
    }
    if (!EDITABLE_STATUSES.includes(actualLoading.status)) {
      throw new ConflictException(
        `Actual Loading is ${actualLoading.status}; items can only be updated in DRAFT/IN_PROGRESS`,
      );
    }

    // Validate all items first
    const results = await Promise.all(
      dto.items.map(async (itemDto): Promise<
        { loadListItemId: string; success: true; cargoId: string; plannedQuantity: number | null } |
        { loadListItemId: string; success: false; reason: string }
      > => {
        const loadListItem = await this.prisma.loadListItem.findUnique({
          where: { id: itemDto.loadListItemId },
          select: {
            id: true,
            loadListId: true,
            cargoId: true,
            plannedQuantity: true,
            cargo: { select: { id: true, reference: true, quantity: true, inspectionStatus: true, status: true, deletedAt: true } },
          },
        });
        if (!loadListItem || loadListItem.loadListId !== actualLoading.loadListId) {
          return { loadListItemId: itemDto.loadListItemId, success: false, reason: 'Item not found or not in this Load List' };
        }
        if (!loadListItem.cargo || loadListItem.cargo.deletedAt) {
          return { loadListItemId: itemDto.loadListItemId, success: false, reason: 'Cargo not found' };
        }
        if (loadListItem.cargo.status === 'CANCELLED') {
          return { loadListItemId: itemDto.loadListItemId, success: false, reason: 'Cancelled cargo cannot be loaded' };
        }
        if (loadListItem.cargo.inspectionStatus !== 'DONE') {
          return {
            loadListItemId: itemDto.loadListItemId,
            success: false,
            reason: `Cargo inspection is ${loadListItem.cargo.inspectionStatus}; must be DONE`,
          };
        }
        if (itemDto.actualQuantity !== undefined) {
          if (itemDto.actualQuantity < 0) {
            return { loadListItemId: itemDto.loadListItemId, success: false, reason: 'Actual quantity cannot be negative' };
          }
          if (loadListItem.plannedQuantity !== null && itemDto.actualQuantity > loadListItem.plannedQuantity) {
            return {
              loadListItemId: itemDto.loadListItemId,
              success: false,
              reason: `Actual quantity (${itemDto.actualQuantity}) exceeds planned quantity (${loadListItem.plannedQuantity})`,
            };
          }
        }
        return {
          loadListItemId: itemDto.loadListItemId,
          cargoId: loadListItem.cargoId,
          plannedQuantity: loadListItem.plannedQuantity,
          success: true,
        };
      })
    );

    const validItems = results
      .filter((r): r is { loadListItemId: string; success: true; cargoId: string; plannedQuantity: number | null } => r.success)
      .map((r) => ({
        item: dto.items.find((it) => it.loadListItemId === r.loadListItemId) ?? { loadListItemId: r.loadListItemId },
        result: r,
      }));
    const failedItems = results
      .filter((r): r is { loadListItemId: string; success: false; reason: string } => !r.success)
      .map((r) => ({
        item: dto.items.find((it) => it.loadListItemId === r.loadListItemId) ?? { loadListItemId: r.loadListItemId },
        result: r,
      }));

    // If no valid items, return early with all failures
    if (validItems.length === 0) {
      return {
        updated: 0,
        failed: failedItems.map(({ item, result }) => ({
          loadListItemId: item.loadListItemId,
          reason: result.reason,
        })),
      };
    }

    // Insert/update valid items transactionally
    await this.prisma.$transaction(
      async (tx) => {
        for (const { item, result } of validItems) {
          let loadingResult: 'FULL' | 'PARTIAL' | 'NOT_LOADED' = 'NOT_LOADED';
          if (item.actualQuantity !== undefined) {
            if (item.actualQuantity === 0) {
              loadingResult = 'NOT_LOADED';
            } else if (result.plannedQuantity !== null && item.actualQuantity >= result.plannedQuantity) {
              loadingResult = 'FULL';
            } else if (item.actualQuantity > 0) {
              loadingResult = 'PARTIAL';
            }
          }
          await tx.actualLoadingItem.upsert({
            where: { actualLoadingId_loadListItemId: { actualLoadingId, loadListItemId: item.loadListItemId } },
            create: {
              actualLoadingId,
              loadListItemId: item.loadListItemId,
              cargoId: result.cargoId,
              actualQuantity: item.actualQuantity ?? null,
              result: loadingResult,
              notes: item.notes,
            },
            update: {
              actualQuantity: item.actualQuantity ?? null,
              result: loadingResult,
              notes: item.notes,
            },
          });
        }
        // Update actual loading updatedAt
        await tx.actualLoading.update({
          where: { id: actualLoadingId },
          data: { updatedAt: new Date() },
        });
      }
    );

    return {
      updated: validItems.length,
      failed: failedItems.map(({ item, result }) => ({
        loadListItemId: item.loadListItemId,
        reason: result.reason,
      })),
    };
  }

  /**
   * Only DRAFT/IN_PROGRESS lists. Removes actual loading relationship only.
   */
  async removeItem(actualLoadingId: string, itemId: string) {
    const actualLoading = await this.prisma.actualLoading.findUnique({
      where: { id: actualLoadingId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!actualLoading || actualLoading.deletedAt) {
      throw new NotFoundException('Actual Loading not found');
    }
    if (!EDITABLE_STATUSES.includes(actualLoading.status)) {
      throw new ConflictException(`Actual Loading is ${actualLoading.status}; items can only be removed from DRAFT/IN_PROGRESS lists`);
    }

    const item = await this.prisma.actualLoadingItem.findUnique({
      where: { id: itemId },
      select: { id: true, actualLoadingId: true },
    });
    if (!item || item.actualLoadingId !== actualLoadingId) {
      throw new NotFoundException('Actual Loading item not found');
    }

    await this.prisma.$transaction([
      this.prisma.actualLoadingItem.delete({ where: { id: itemId } }),
      this.prisma.actualLoading.update({ where: { id: actualLoadingId }, data: { updatedAt: new Date() } }),
    ]);
  }

  // -------------------------------------------------------------------------
  // Lifecycle Transitions
  // -------------------------------------------------------------------------

  /**
   * Start the loading operation.
   * Transitions DRAFT -> IN_PROGRESS. Required before recording quantities
   * in the standard flow (quantities may still be recorded while IN_PROGRESS).
   */
  async start(id: string, _actor?: AuthenticatedUser) {
    const existing = await this.prisma.actualLoading.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Actual Loading not found');
    }
    this.assertTransition(existing.status, 'IN_PROGRESS');

    return this.prisma.actualLoading.update({
      where: { id },
      data: { status: 'IN_PROGRESS', updatedAt: new Date() },
      select: detailSelect,
    });
  }

  /**
   * Complete an Actual Loading.
   * Re-validates all items against current cargo state.
   * Sets status = COMPLETED, completedAt, completedById.
   * For fully loaded items, marks cargo loadingStatus = LOADED and removes the
   * yard inventory record (cargo has left the yard) in the same transaction.
   * Completed Actual Loadings are immutable for ordinary edits.
   */
  async complete(id: string, dto: CompleteActualLoadingDto, actor?: AuthenticatedUser) {
    const actualLoading = await this.prisma.actualLoading.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        loadListId: true,
        deletedAt: true,
        items: {
          select: { cargoId: true, loadListItemId: true, actualQuantity: true, result: true },
        },
      },
    });
    if (!actualLoading || actualLoading.deletedAt) {
      throw new NotFoundException('Actual Loading not found');
    }
    this.assertTransition(actualLoading.status, 'COMPLETED');
    if (actualLoading.items.length === 0) {
      throw new BadRequestException('Cannot complete an Actual Loading with no items');
    }

    // Re-validate ALL items against CURRENT cargo state (stale frontend cannot bypass)
    for (const item of actualLoading.items) {
      const cargo = await this.prisma.cargo.findUnique({
        where: { id: item.cargoId },
        select: { id: true, inspectionStatus: true, status: true, quantity: true, deletedAt: true },
      });
      if (!cargo || cargo.deletedAt) {
        throw new ConflictException(`Cargo ${item.cargoId} no longer exists`);
      }
      if (cargo.status === 'CANCELLED') {
        throw new ConflictException(`Cargo is cancelled; cannot complete loading`);
      }
      if (cargo.inspectionStatus !== 'DONE') {
        throw new ConflictException(`Cargo inspection is ${cargo.inspectionStatus}; must be DONE`);
      }
      if (item.actualQuantity !== null && cargo.quantity !== null && item.actualQuantity > cargo.quantity) {
        throw new ConflictException(`Actual quantity exceeds cargo quantity`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.actualLoading.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedById: actor?.id,
          notes: dto.notes,
        },
        select: detailSelect,
      });

      // Fully loaded cargo leaves the yard: mark loadingStatus = LOADED and
      // remove its yard inventory record (ADR-020: current-inventory model).
      for (const item of actualLoading.items) {
        if (item.result !== 'FULL') {
          continue;
        }
        await tx.cargo.update({
          where: { id: item.cargoId },
          data: { loadingStatus: 'LOADED' },
        });
        await tx.yardInventory.deleteMany({ where: { cargoId: item.cargoId } });
      }

      return updated;
    });
  }

  /**
   * Cancel an Actual Loading.
   * Requires cancel reason. Sets status = CANCELLED, cancelledAt, cancelledById.
   * Cancelled Actual Loadings are immutable.
   */
  async cancel(id: string, dto: CancelActualLoadingDto, actor?: AuthenticatedUser) {
    const actualLoading = await this.prisma.actualLoading.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!actualLoading || actualLoading.deletedAt) {
      throw new NotFoundException('Actual Loading not found');
    }
    this.assertTransition(actualLoading.status, 'CANCELLED');

    const reason = dto.cancelReason?.trim();
    if (!reason) {
      throw new BadRequestException('A cancellation reason is required');
    }

    return this.prisma.actualLoading.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: actor?.id,
        notes: dto.cancelReason,
      },
      select: detailSelect,
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private assertTransition(current: ActualLoadingStatus, target: ActualLoadingStatus) {
    if (current === target) {
      throw new ConflictException(`Actual Loading is already ${target}`);
    }
    if (!ACTUAL_LOADING_TRANSITIONS[current]?.includes(target)) {
      throw new ConflictException(`Actual Loading transition ${current} -> ${target} is not allowed`);
    }
  }

  /** Stable, ordered actual loading number: AL-YYMM-##### (mirrors VOY/INS/CRG/LL pattern). */
  private async generateReference(): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(
      now.getUTCMonth() + 1
    ).padStart(2, '0')}`;
    const prefix = `AL-${yymm}-`;

    const latest = await this.prisma.actualLoading.findFirst({
      where: { actualLoadingNumber: { startsWith: prefix } },
      orderBy: { actualLoadingNumber: 'desc' },
      select: { actualLoadingNumber: true },
    });

    const lastSeq = latest ? Number(latest.actualLoadingNumber.slice(prefix.length)) : 0;
    const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }
}