import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CargoStatus, LoadListStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  AddLoadListItemDto,
  BulkAddLoadListItemsDto,
  CancelLoadListDto,
  CreateLoadListDto,
  EligibleCargoQueryDto,
  ListLoadListQueryDto,
  UpdateLoadListDto,
} from './dto/load-planning.dto';

// ---------------------------------------------------------------------------
// LoadList lifecycle (server-side, ADR-028).
//   DRAFT      -> FINALIZED, CANCELLED
//   FINALIZED  -> (terminal, no edits)
//   CANCELLED  -> (terminal, no edits)
// Status changes happen exclusively through dedicated operations
// (finalize/cancel) — never an arbitrary status edit.
// ---------------------------------------------------------------------------
const LOAD_LIST_TRANSITIONS: Record<LoadListStatus, LoadListStatus[]> = {
  // ADR-041: shipped lifecycle is DRAFT -> FINALIZED -> (CANCELLED). The intermediate
  // IN_PROGRESS/PARTIALLY_LOADED/COMPLETED entries below are unreachable (no code writes
  // them) and are retained deliberately — see ADR-041 for the supersession note.
  DRAFT: ['IN_PROGRESS', 'FINALIZED', 'CANCELLED'],
  IN_PROGRESS: ['PARTIALLY_LOADED', 'COMPLETED', 'CANCELLED'],
  PARTIALLY_LOADED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['FINALIZED', 'CANCELLED'],
  FINALIZED: [],
  CANCELLED: [],
};

// Only DRAFT load lists allow item additions/removals/edits.
const EDITABLE_STATUSES: LoadListStatus[] = ['DRAFT'];

// Voyage statuses that permit load planning.
// DRAFT and SCHEDULED voyages can have load lists created.
// IN_PROGRESS/COMPLETED/CANCELLED are blocked.
const PLANNING_ALLOWED_VOYAGE_STATUSES = ['DRAFT', 'SCHEDULED'] as const;

// ---------------------------------------------------------------------------
// Select shapes for consistent responses
// ---------------------------------------------------------------------------
const listSelect = {
  id: true,
  loadListNumber: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  finalizedAt: true,
  cancelledAt: true,
  deletedAt: true,
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
      originPort: {
        select: { id: true, code: true, name: true, country: true, city: true },
      },
      destinationPort: {
        select: { id: true, code: true, name: true, country: true, city: true },
      },
    },
  },
  createdBy: { select: { id: true, email: true, fullName: true } },
  finalizedBy: { select: { id: true, email: true, fullName: true } },
  cancelledBy: { select: { id: true, email: true, fullName: true } },
  _count: { select: { items: true } },
} satisfies Prisma.LoadListSelect;

const detailSelect = {
  ...listSelect,
  finalizedBy: { select: { id: true, email: true, fullName: true } },
  cancelledBy: { select: { id: true, email: true, fullName: true } },
  deletedAt: true,
  items: {
    select: {
      id: true,
      cargoId: true,
      plannedQuantity: true,
      sequence: true,
      notes: true,
      createdAt: true,
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
    orderBy: { sequence: 'asc' },
  },
} satisfies Prisma.LoadListSelect;

const itemSelect = {
  id: true,
  loadListId: true,
  cargoId: true,
  plannedQuantity: true,
  sequence: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
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
} satisfies Prisma.LoadListItemSelect;

// ---------------------------------------------------------------------------
// Cargo eligibility response type
// ---------------------------------------------------------------------------
interface CargoEligibilityResult {
  cargoId: string;
  eligible: boolean;
  reason?: string;
}

@Injectable()
export class LoadPlanningService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Load List CRUD
  // -------------------------------------------------------------------------

  async list(query: ListLoadListQueryDto) {
    const pagination = parsePagination(query);
    const sortField = (query.sort ?? 'createdAt') as
      | 'loadListNumber'
      | 'status'
      | 'createdAt'
      | 'finalizedAt';
    const sortOrder = (query.order ?? 'desc') as Prisma.SortOrder;

    const where: Prisma.LoadListWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status as LoadListStatus } : {}),
      ...(query.voyageId ? { voyageId: query.voyageId } : {}),
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
              { loadListNumber: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
              { voyage: { voyageNumber: { contains: query.search, mode: 'insensitive' } } },
              { voyage: { vessel: { name: { contains: query.search, mode: 'insensitive' } } } },
              { voyage: { originPort: { name: { contains: query.search, mode: 'insensitive' } } } },
              { voyage: { destinationPort: { name: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.loadList.count({ where }),
      this.prisma.loadList.findMany({
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
    const row = await this.prisma.loadList.findUnique({ where: { id }, select: detailSelect });
    if (!row || row.deletedAt) {
      throw new NotFoundException('Load List not found');
    }
    return row;
  }

  /**
   * Create a Load List for a Voyage.
   * Validates: voyage exists, is active (not soft-deleted), and in a planning-allowed state.
   * Creates in DRAFT state. Generates stable loadListNumber: LL-YYMM-#####.
   */
  async create(dto: CreateLoadListDto, actor?: AuthenticatedUser) {
    const voyage = await this.prisma.voyage.findUnique({
      where: { id: dto.voyageId },
      select: { id: true, status: true, voyageNumber: true },
    });
    if (!voyage) {
      throw new NotFoundException('Voyage not found');
    }
    if (!PLANNING_ALLOWED_VOYAGE_STATUSES.includes(voyage.status as any)) {
      throw new ConflictException(
        `Load planning not allowed for voyage in ${voyage.status} state. Only DRAFT or SCHEDULED voyages permit load planning.`
      );
    }

    // Atomic number allocation by BOUNDED RETRY (same pattern as Cargo.reference): six e2e
    // suites create load lists in parallel and generateReference() is read-then-write, so the
    // loser of an LL-YYMM-##### race hits the unique number index (observed blocking the
    // deterministic full run). Re-read the committed max and retry; other P2002/P2018 keep
    // the existing 409 semantics.
    const MAX_LL_ATTEMPTS = 10;
    for (let attempt = 1; ; attempt += 1) {
      const loadListNumber = await this.generateReference();
      try {
        return await this.prisma.loadList.create({
          data: {
            loadListNumber,
            voyageId: dto.voyageId,
            notes: dto.notes,
            createdById: actor?.id,
          },
          select: detailSelect,
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          attempt < MAX_LL_ATTEMPTS &&
          String((e.meta as { target?: unknown } | undefined)?.target ?? '').includes(
            'loadListNumber'
          )
        ) {
          continue; // lost the number race: re-read the committed max and retry
        }
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (e.code === 'P2002' || e.code === 'P2018')
        ) {
          throw new ConflictException('Could not create load list: duplicate reference');
        }
        throw e;
      }
    }
  }

  /**
   * Update a Load List (notes only).
   * Only DRAFT lists may be edited.
   */
  async update(id: string, dto: UpdateLoadListDto) {
    const existing = await this.prisma.loadList.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Load List not found');
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw new ConflictException(
        `Load List is ${existing.status}; only DRAFT lists can be edited`
      );
    }

    return this.prisma.loadList.update({
      where: { id },
      data: { notes: dto.notes },
      select: detailSelect,
    });
  }

  /**
   * Delete a Load List (soft delete).
   * Only DRAFT lists may be deleted. FINALIZED/CANCELLED are preserved for audit.
   */
  async remove(id: string) {
    const existing = await this.prisma.loadList.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Load List not found');
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw new ConflictException(
        `Load List is ${existing.status}; only DRAFT lists can be deleted`
      );
    }

    await this.prisma.loadList.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // -------------------------------------------------------------------------
  // Cargo Eligibility (centralized logic — used by add-item, bulk, finalize)
  // -------------------------------------------------------------------------

  /**
   * Core eligibility check: only APPROVED inspection cargo may be added to a Load List.
   * Also validates: cargo exists, not deleted, not cancelled, not already assigned to same voyage.
   * This is the authoritative server-side rule — never trust frontend.
   */
  async checkCargoEligibility(
    cargoId: string,
    voyageId: string,
    excludeLoadListId?: string
  ): Promise<CargoEligibilityResult> {
    const cargo = await this.prisma.cargo.findUnique({
      where: { id: cargoId },
      select: {
        id: true,
        reference: true,
        status: true,
        inspectionStatus: true,
        loadingStatus: true,
        deletedAt: true,
      },
    });

    if (!cargo || cargo.deletedAt) {
      return { cargoId, eligible: false, reason: 'Cargo not found' };
    }
    if (cargo.status === 'CANCELLED') {
      return { cargoId, eligible: false, reason: 'Cargo is cancelled' };
    }
    if (cargo.inspectionStatus !== 'DONE') {
      return {
        cargoId,
        eligible: false,
        reason: `Inspection status is ${cargo.inspectionStatus}; only DONE cargo may be planned`,
      };
    }

    // Check for duplicate assignment to same voyage (through any load list)
    const existingAssignment = await this.prisma.loadListItem.findFirst({
      where: {
        cargoId,
        loadList: {
          voyageId,
          status: { not: 'CANCELLED' }, // cancelled load lists don't block
          deletedAt: null,
        },
        ...(excludeLoadListId ? { loadListId: { not: excludeLoadListId } } : {}),
      },
      select: { id: true, loadList: { select: { loadListNumber: true } } },
    });
    if (existingAssignment) {
      return {
        cargoId,
        eligible: false,
        reason: `Cargo already assigned to voyage via Load List ${existingAssignment.loadList.loadListNumber}`,
      };
    }

    return { cargoId, eligible: true };
  }

  /**
   * Batch eligibility check for multiple cargo IDs.
   * Used by Cargo Selection UI and bulk add operations.
   */
  async checkBulkCargoEligibility(
    cargoIds: string[],
    voyageId: string,
    excludeLoadListId?: string
  ): Promise<CargoEligibilityResult[]> {
    const results = await Promise.all(
      cargoIds.map((cargoId) =>
        this.checkCargoEligibility(cargoId, voyageId, excludeLoadListId)
      )
    );
    return results;
  }

  /**
   * Get paginated list of cargo eligible for a given voyage.
   * Filters: inspectionStatus=APPROVED (by default), not already assigned to this voyage,
   * not cancelled, not deleted.
   */
  async getEligibleCargo(voyageId: string, query: EligibleCargoQueryDto) {
    const pagination = parsePagination(query);
    const eligibleOnly = query.eligibleOnly !== 'false'; // default true

    // First get cargo IDs already assigned to this voyage (active load lists)
    const assignedCargoIds = await this.prisma.loadListItem.findMany({
      where: {
        loadList: {
          voyageId,
          status: { not: 'CANCELLED' },
          deletedAt: null,
        },
      },
      select: { cargoId: true },
    });
    const assignedIds = new Set(assignedCargoIds.map((i) => i.cargoId));

    const where: Prisma.CargoWhereInput = {
      deletedAt: null,
      status: { not: 'CANCELLED' },
      ...(eligibleOnly ? { inspectionStatus: 'DONE' as const } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.yardId ? { yardId: query.yardId } : {}),
      ...(query.cargoType ? { cargoType: query.cargoType as any } : {}),
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              { serialNumber: { contains: query.search, mode: 'insensitive' } },
              { chassisNumber: { contains: query.search, mode: 'insensitive' } },
              { vin: { contains: query.search, mode: 'insensitive' } },
              { customer: { name: { contains: query.search, mode: 'insensitive' } } },
              { customer: { code: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    // Exclude already-assigned cargo from eligible list
    if (assignedIds.size > 0) {
      where.id = { notIn: Array.from(assignedIds) };
    }

    const cargoSelect = {
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
    } satisfies Prisma.CargoSelect;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.cargo.count({ where }),
      this.prisma.cargo.findMany({
        where,
        select: cargoSelect,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { reference: 'asc' },
      }),
    ]);

    return buildPaginated(items, total, pagination);
  }

  // -------------------------------------------------------------------------
  // Load List Items (cargo assignments)
  // -------------------------------------------------------------------------

  /**
   * Add a single cargo to a Load List.
   * Enforces: load list is DRAFT, cargo is eligible (APPROVED inspection, not duplicated),
   * voyage matches, quantity <= cargo quantity (if provided).
   */
  async addItem(
    loadListId: string,
    dto: AddLoadListItemDto,
    actor?: AuthenticatedUser
  ) {
    const loadList = await this.prisma.loadList.findUnique({
      where: { id: loadListId },
      select: { id: true, status: true, voyageId: true, deletedAt: true },
    });
    if (!loadList || loadList.deletedAt) {
      throw new NotFoundException('Load List not found');
    }
    if (!EDITABLE_STATUSES.includes(loadList.status)) {
      throw new ConflictException(`Load List is ${loadList.status}; items can only be added to DRAFT lists`);
    }

    const cargo = await this.prisma.cargo.findUnique({
      where: { id: dto.cargoId },
      select: {
        id: true,
        reference: true,
        quantity: true,
        inspectionStatus: true,
        status: true,
        deletedAt: true,
      },
    });
    if (!cargo || cargo.deletedAt) {
      throw new NotFoundException('Cargo not found');
    }
    if (cargo.status === 'CANCELLED') {
      throw new ConflictException('Cancelled cargo cannot be added to a Load List');
    }
    if (cargo.inspectionStatus !== 'DONE') {
      throw new ConflictException(
        `Cargo "${cargo.reference}" has inspection status ${cargo.inspectionStatus}; only DONE cargo may be added`
      );
    }

    // Check quantity constraint
    if (dto.plannedQuantity && cargo.quantity !== null && dto.plannedQuantity > cargo.quantity) {
      throw new BadRequestException(
        `Planned quantity (${dto.plannedQuantity}) exceeds cargo quantity (${cargo.quantity})`
      );
    }

    // Check for duplicate within this load list (enforced by unique constraint)
    // Check for assignment to same voyage via another load list
    const existingAssignment = await this.prisma.loadListItem.findFirst({
      where: {
        cargoId: dto.cargoId,
        loadList: {
          voyageId: loadList.voyageId,
          status: { not: 'CANCELLED' },
          deletedAt: null,
        },
      },
      select: { id: true, loadList: { select: { loadListNumber: true } } },
    });
    if (existingAssignment) {
      throw new ConflictException(
        `Cargo already assigned to this voyage via Load List ${existingAssignment.loadList.loadListNumber}`
      );
    }

    // Determine next sequence number
    const maxSeq = await this.prisma.loadListItem.aggregate({
      where: { loadListId },
      _max: { sequence: true },
    });
    const nextSequence = (maxSeq._max.sequence ?? 0) + 1;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.loadListItem.create({
          data: {
            loadListId,
            cargoId: dto.cargoId,
            plannedQuantity: dto.plannedQuantity ?? null,
            sequence: dto.sequence ?? nextSequence,
            notes: dto.notes,
          },
          select: itemSelect,
        });

        // Update load list updatedAt
        await tx.loadList.update({
          where: { id: loadListId },
          data: { updatedAt: new Date() },
        });

        return item;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002' // unique constraint violation
      ) {
        throw new ConflictException('This cargo is already in the Load List');
      }
      throw e;
    }
  }

  /**
   * Bulk add cargo items to a Load List.
   * Transactional: all items validated first, then all inserted or none.
   * Returns detailed results per item (success/failure with reasons).
   */
  async addItemsBulk(loadListId: string, dto: BulkAddLoadListItemsDto, actor?: AuthenticatedUser) {
    const loadList = await this.prisma.loadList.findUnique({
      where: { id: loadListId },
      select: { id: true, status: true, voyageId: true, deletedAt: true },
    });
    if (!loadList || loadList.deletedAt) {
      throw new NotFoundException('Load List not found');
    }
    if (!EDITABLE_STATUSES.includes(loadList.status)) {
      throw new ConflictException(`Load List is ${loadList.status}; items can only be added to DRAFT lists`);
    }

    // Validate all items first
    const results = await Promise.all(
      dto.items.map(async (itemDto) => {
        const eligibility = await this.checkCargoEligibility(itemDto.cargoId, loadList.voyageId, loadListId);
        const cargo = await this.prisma.cargo.findUnique({
          where: { id: itemDto.cargoId },
          select: { id: true, reference: true, quantity: true },
        });
        if (!eligibility.eligible) {
          return { cargoId: itemDto.cargoId, success: false, reason: eligibility.reason };
        }
        if (!cargo) {
          return { cargoId: itemDto.cargoId, success: false, reason: 'Cargo not found' };
        }
        if (itemDto.plannedQuantity !== undefined && cargo.quantity !== null && itemDto.plannedQuantity > cargo.quantity) {
          return {
            cargoId: itemDto.cargoId,
            success: false,
            reason: `Planned quantity exceeds cargo quantity (${cargo.quantity})`,
          };
        }
        return { cargoId: itemDto.cargoId, success: true };
      })
    );

    const validItems = dto.items.filter((_, i) => results[i].success);
    const failedItems = dto.items.filter((_, i) => !results[i].success);

    // If no valid items, return early with all failures
    if (validItems.length === 0) {
      return {
        added: 0,
        failed: results.filter((r) => !r.success).map((r) => ({
          cargoId: r.cargoId,
          reason: r.reason,
        })),
      };
    }

    // Determine sequence start
    const maxSeq = await this.prisma.loadListItem.aggregate({
      where: { loadListId },
      _max: { sequence: true },
    });
    let nextSequence = (maxSeq._max.sequence ?? 0) + 1;

    // Insert valid items transactionally
    await this.prisma.$transaction(
      async (tx) => {
        for (const item of validItems) {
          await tx.loadListItem.create({
            data: {
              loadListId,
              cargoId: item.cargoId,
              plannedQuantity: item.plannedQuantity ?? null,
              sequence: item.sequence ?? nextSequence++,
              notes: item.notes,
            },
          });
        }
        // Update load list updatedAt
        await tx.loadList.update({
          where: { id: loadListId },
          data: { updatedAt: new Date() },
        });
      }
    );

    return {
      added: validItems.length,
      failed: failedItems.map((item, i) => ({
        cargoId: item.cargoId,
        reason: results[i].reason,
      })),
    };
  }

  /**
   * Remove a cargo item from a Load List.
   * Only DRAFT lists. Removes planning relationship only — does not affect cargo/inspection/inventory.
   */
  async removeItem(loadListId: string, itemId: string) {
    const loadList = await this.prisma.loadList.findUnique({
      where: { id: loadListId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!loadList || loadList.deletedAt) {
      throw new NotFoundException('Load List not found');
    }
    if (!EDITABLE_STATUSES.includes(loadList.status)) {
      throw new ConflictException(`Load List is ${loadList.status}; items can only be removed from DRAFT lists`);
    }

    const item = await this.prisma.loadListItem.findUnique({
      where: { id: itemId },
      select: { id: true, loadListId: true },
    });
    if (!item || item.loadListId !== loadListId) {
      throw new NotFoundException('Load List item not found');
    }

    await this.prisma.$transaction([
      this.prisma.loadListItem.delete({ where: { id: itemId } }),
      this.prisma.loadList.update({ where: { id: loadListId }, data: { updatedAt: new Date() } }),
    ]);
  }

  // -------------------------------------------------------------------------
  // Lifecycle Transitions
  // -------------------------------------------------------------------------

  /**
   * Finalize a Load List.
   * Re-validates all items against current cargo state (inspection may have changed since add).
   * Sets status = FINALIZED, finalizedAt, finalizedById.
   * Finalized lists are immutable for ordinary edits.
   */
  async finalize(id: string, actor?: AuthenticatedUser) {
    const loadList = await this.prisma.loadList.findUnique({
      where: { id },
      select: { id: true, status: true, voyageId: true, deletedAt: true, items: { select: { cargoId: true } } },
    });
    if (!loadList || loadList.deletedAt) {
      throw new NotFoundException('Load List not found');
    }
    this.assertTransition(loadList.status, 'FINALIZED');
    if (loadList.items.length === 0) {
      throw new BadRequestException('Cannot finalize an empty Load List');
    }

    // Re-validate ALL items against CURRENT cargo state (stale frontend cannot bypass)
    for (const item of loadList.items) {
      const eligibility = await this.checkCargoEligibility(item.cargoId, loadList.voyageId, loadList.id);
      if (!eligibility.eligible) {
        throw new ConflictException(
          `Cargo ${item.cargoId} is no longer eligible for planning: ${eligibility.reason}. Finalization aborted.`
        );
      }
    }

    return this.prisma.loadList.update({
      where: { id },
      data: {
        status: 'FINALIZED',
        finalizedAt: new Date(),
        finalizedById: actor?.id,
      },
      select: detailSelect,
    });
  }

  /**
   * Cancel a Load List.
   * Requires cancel reason. Sets status = CANCELLED, cancelledAt, cancelledById.
   * Cancelled lists are immutable and no longer block duplicate assignments.
   */
  async cancel(id: string, dto: CancelLoadListDto, actor?: AuthenticatedUser) {
    const loadList = await this.prisma.loadList.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!loadList || loadList.deletedAt) {
      throw new NotFoundException('Load List not found');
    }
    this.assertTransition(loadList.status, 'CANCELLED');

    const reason = dto.cancelReason?.trim();
    if (!reason) {
      throw new BadRequestException('A cancellation reason is required');
    }

    return this.prisma.loadList.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: actor?.id,
      },
      select: detailSelect
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private assertTransition(current: LoadListStatus, target: LoadListStatus) {
    if (current === target) {
      throw new ConflictException(`Load List is already ${target}`);
    }
    if (!LOAD_LIST_TRANSITIONS[current]?.includes(target)) {
      throw new ConflictException(`Load List transition ${current} -> ${target} is not allowed`);
    }
  }

  /** Stable, ordered load list number: LL-YYMM-##### (mirrors VOY/INS/CRG pattern). */
  private async generateReference(): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(
      now.getUTCMonth() + 1
    ).padStart(2, '0')}`;
    const prefix = `LL-${yymm}-`;

    const latest = await this.prisma.loadList.findFirst({
      where: { loadListNumber: { startsWith: prefix } },
      orderBy: { loadListNumber: 'desc' },
      select: { loadListNumber: true },
    });

    const lastSeq = latest ? Number(latest.loadListNumber.slice(prefix.length)) : 0;
    const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }
}