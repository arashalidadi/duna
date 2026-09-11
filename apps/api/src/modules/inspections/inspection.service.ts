import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InspectionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  CreateInspectionDto,
  ListInspectionQueryDto,
  RejectInspectionDto,
  UpdateInspectionDto,
} from './dto/inspection.dto';

// ---------------------------------------------------------------------------
// Inspection lifecycle (server-side, ADR-024).
//   PENDING -> APPROVED
//   PENDING -> REJECTED
// Once APPROVED or REJECTED an inspection is finalized and cannot be edited or
// re-transitioned. Reinspection is a NEW Inspection record for the same cargo
// (history preserved); the cargo's current state is re-evaluated on create.
// ---------------------------------------------------------------------------
const TRANSITIONS: Record<InspectionStatus, InspectionStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
};

const listSelect = {
  id: true,
  inspectionNumber: true,
  status: true,
  inspectionDate: true,
  inspectorName: true,
  approvedAt: true,
  rejectedAt: true,
  createdAt: true,
  createdBy: { select: { id: true, email: true, fullName: true } },
  cargo: {
    select: {
      id: true,
      reference: true,
      cargoType: true,
      status: true,
      inspectionStatus: true,
      serialNumber: true,
      chassisNumber: true,
      vin: true,
      customer: { select: { id: true, code: true, name: true, shortName: true } },
      port: { select: { id: true, code: true, name: true, country: true, city: true } },
      destinationPort: {
        select: { id: true, code: true, name: true, country: true, city: true },
      },
      yard: { select: { id: true, code: true, name: true } },
      inventory: { select: { id: true, yardId: true, portId: true, status: true, enteredAt: true } },
    },
  },
} satisfies Prisma.InspectionSelect;

const createSelect = {
  ...listSelect,
  findings: true,
  condition: true,
  verificationNotes: true,
  remarks: true,
  rejectionReason: true,
  inspectorId: true,
  approvedById: true,
  rejectedById: true,
  updatedAt: true,
  approvedBy: { select: { id: true, email: true, fullName: true } },
  rejectedBy: { select: { id: true, email: true, fullName: true } },
} satisfies Prisma.InspectionSelect;

@Injectable()
export class InspectionService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListInspectionQueryDto) {
    const pagination = parsePagination(query);
    const sortField = (query.sort ?? 'inspectionDate') as 'inspectionNumber' | 'inspectionDate' | 'createdAt';
    const sortOrder = (query.order ?? 'desc') as Prisma.SortOrder;

    const where: Prisma.InspectionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.cargoId ? { cargoId: query.cargoId } : {}),
      ...(query.customerId ? { cargo: { customerId: query.customerId } } : {}),
      // A yard filter selects inspections whose cargo is currently in that yard.
      ...(query.yardId ? { cargo: { inventory: { yardId: query.yardId } } } : {}),
      ...(query.inspectionFrom || query.inspectionTo
        ? {
            inspectionDate: {
              ...(query.inspectionFrom ? { gte: new Date(query.inspectionFrom) } : {}),
              ...(query.inspectionTo ? { lte: new Date(query.inspectionTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { inspectionNumber: { contains: query.search, mode: 'insensitive' } },
              { inspectorName: { contains: query.search, mode: 'insensitive' } },
              { cargo: { reference: { contains: query.search, mode: 'insensitive' } } },
              { cargo: { serialNumber: { contains: query.search, mode: 'insensitive' } } },
              { cargo: { chassisNumber: { contains: query.search, mode: 'insensitive' } } },
              { cargo: { vin: { contains: query.search, mode: 'insensitive' } } },
              { cargo: { customer: { name: { contains: query.search, mode: 'insensitive' } } } },
              { cargo: { customer: { code: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.inspection.count({ where }),
      this.prisma.inspection.findMany({
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
    const row = await this.prisma.inspection.findUnique({ where: { id }, select: createSelect });
    if (!row) {
      throw new NotFoundException('Inspection not found');
    }
    return row;
  }

  /**
   * Create a new inspection for a cargo and set the cargo's current readiness
   * state to PENDING. Rejects if the cargo does not exist, is soft-deleted, is
   * cancelled, or already has a PENDING inspection (only one pending at a time).
   *
   * inspectorId references the authenticated user; inspectorName defaults to the
   * actor's full name (free-text snapshot for external inspectors).
   */
  async create(dto: CreateInspectionDto, actor?: AuthenticatedUser) {
    const cargo = await this.prisma.cargo.findUnique({
      where: { id: dto.cargoId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!cargo || cargo.deletedAt) {
      throw new NotFoundException('Cargo not found');
    }
    if (cargo.status === 'CANCELLED') {
      throw new ConflictException('Cancelled cargo cannot be inspected');
    }

    const existingPending = await this.prisma.inspection.findFirst({
      where: { cargoId: dto.cargoId, status: 'PENDING' },
      select: { id: true, inspectionNumber: true },
    });
    if (existingPending) {
      throw new ConflictException(
        `This cargo already has a pending inspection (${existingPending.inspectionNumber}). Resolve it before creating another.`
      );
    }

    const inspectorName =
      dto.inspectorName?.trim() || actor?.email?.split('@')[0] || 'Unnamed inspector';

    const inspectionNumber = await this.generateReference();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const inspection = await tx.inspection.create({
          data: {
            inspectionNumber,
            cargoId: dto.cargoId,
            inspectionDate: dto.inspectionDate ? new Date(dto.inspectionDate) : new Date(),
            inspectorId: actor?.id,
            inspectorName,
            findings: dto.findings,
            condition: dto.condition,
            verificationNotes: dto.verificationNotes,
            remarks: dto.remarks,
            createdById: actor?.id,
          },
          select: createSelect,
        });

        // The cargo's current readiness re-enters PENDING for this new cycle.
        await tx.cargo.update({
          where: { id: dto.cargoId },
          data: { inspectionStatus: 'PENDING' },
        });

        return inspection;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === 'P2002' || e.code === 'P2018')
      ) {
        throw new ConflictException(
          'This cargo already has a pending inspection. Resolve it before creating another.'
        );
      }
      throw e;
    }
  }

  /**
   * Edit a non-finalized (PENDING) inspection's details. APPROVED/REJECTED
   * inspections are immutable; corrections require a new inspection cycle.
   */
  async update(id: string, dto: UpdateInspectionDto, _actor?: AuthenticatedUser) {
    const existing = await this.prisma.inspection.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException('Inspection not found');
    }
    if (existing.status !== 'PENDING') {
      throw new ConflictException('Only a pending inspection can be edited');
    }

    return this.prisma.inspection.update({
      where: { id },
      data: {
        inspectionDate: dto.inspectionDate ? new Date(dto.inspectionDate) : undefined,
        inspectorName: dto.inspectorName,
        findings: dto.findings,
        condition: dto.condition,
        verificationNotes: dto.verificationNotes,
        remarks: dto.remarks,
      },
      select: createSelect,
    });
  }

  /**
   * Approve. Transactionally validates the transition, finalizes this
   * inspection, and sets the cargo's current readiness to APPROVED — the
   * authoritative rule future Load Planning (Phase 7) will consume.
   */
  async approve(id: string, actor?: AuthenticatedUser) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id },
      select: { id: true, status: true, cargoId: true },
    });
    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }
    this.assertTransition(inspection.status, 'APPROVED');

    await this.prisma.$transaction([
      this.prisma.inspection.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: actor?.id,
          approvedAt: new Date(),
        },
      }),
      this.prisma.cargo.update({
        where: { id: inspection.cargoId },
        data: { inspectionStatus: 'APPROVED' },
      }),
    ]);

    return this.findById(id);
  }

  /**
   * Reject. Requires a rejection reason (the driver of Load-List ineligibility).
   * Transactionally finalizes this inspection and sets the cargo's current
   * readiness to REJECTED.
   */
  async reject(id: string, dto: RejectInspectionDto, actor?: AuthenticatedUser) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id },
      select: { id: true, status: true, cargoId: true },
    });
    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }
    this.assertTransition(inspection.status, 'REJECTED');

    const reason = dto.rejectionReason?.trim();
    if (!reason) {
      throw new BadRequestException('A rejection reason is required');
    }

    await this.prisma.$transaction([
      this.prisma.inspection.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          rejectedById: actor?.id,
          rejectedAt: new Date(),
        },
      }),
      this.prisma.cargo.update({
        where: { id: inspection.cargoId },
        data: { inspectionStatus: 'REJECTED' },
      }),
    ]);

    return this.findById(id);
  }

  /**
   * Inspection history for a cargo, newest first. Returns only PENDING/APPROVED/
   * REJECTED records (never soft-deleted — inspections are not soft-deleted).
   */
  async historyByCargo(cargoId: string) {
    const cargo = await this.prisma.cargo.findUnique({ where: { id: cargoId }, select: { id: true } });
    if (!cargo) {
      throw new NotFoundException('Cargo not found');
    }
    const rows = await this.prisma.inspection.findMany({
      where: { cargoId },
      select: listSelect,
      orderBy: { createdAt: 'desc' },
    });
    return rows;
  }

  /**
   * Readiness contract for future Load Planning (Phase 7): is this cargo
   * inspection-approved? Backed by the authoritative Cargo.inspectionStatus
   * (kept in sync transactionally on approve/reject). Never trusts frontend.
   */
  async isCargoInspectionApproved(cargoId: string): Promise<boolean> {
    const cargo = await this.prisma.cargo.findUnique({
      where: { id: cargoId },
      select: { inspectionStatus: true },
    });
    return cargo?.inspectionStatus === 'APPROVED';
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private assertTransition(from: InspectionStatus, to: InspectionStatus) {
    if (from === to) {
      throw new ConflictException(`Inspection is already ${to}`);
    }
    if (!TRANSITIONS[from]?.includes(to)) {
      throw new ConflictException(`Cannot transition inspection from ${from} to ${to}.`);
    }
  }

  /** Deterministic unique human-friendly reference: INS-<YYMM>-<padded seq>. */
  private async generateReference(): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(
      now.getUTCMonth() + 1
    ).padStart(2, '0')}`;
    const prefix = `INS-${yymm}-`;

    const latest = await this.prisma.inspection.findFirst({
      where: { inspectionNumber: { startsWith: prefix } },
      orderBy: { inspectionNumber: 'desc' },
      select: { inspectionNumber: true },
    });

    const lastSeq = latest ? Number(latest.inspectionNumber.slice(prefix.length)) : 0;
    const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }
}