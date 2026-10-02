import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CargoStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { parseBooleanFilter } from '../../common/utils/query-filter.util';
import { AuthenticatedUser } from '../../common/auth/types';
import { CreateCargoDto, ListCargoQueryDto, UpdateCargoDto } from './dto/cargo.dto';

/**
 * Cargo lifecycle transitions (server-side, ADR-019).
 * - Any active state may be cancelled; CANCELLED is terminal.
 * - READY additionally requires inspectionStatus = APPROVED (future Load List rule).
 * - LOADED/DELIVERED are forward-compatible states; Actual Loading (Phase 8)
 *   will drive them atomically with inventory.
 */
const TRANSITIONS: Record<CargoStatus, CargoStatus[]> = {
  REGISTERED: ['CANCELLED'],
  AT_YARD: ['REGISTERED', 'READY_FOR_LOADING', 'CANCELLED'],
  READY_FOR_LOADING: ['AT_YARD', 'LOADED', 'CANCELLED'],
  LOADED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

const select = {
  id: true,
  reference: true,
  customerId: true,
  portId: true,
  yardId: true,
  destinationPortId: true,
  pol: true,
  pod: true,
  cargoType: true,
  specification: true,
  serialNumber: true,
  chassisNumber: true,
  vin: true,
  weight: true,
  weightUnit: true,
  quantity: true,
  packages: true,
  packageType: true,
  arrivalDate: true,
  arrivalReference: true,
  inspectionStatus: true,
  loadingStatus: true,
  manifestNumber: true,
  status: true,
  // Phase 3A: free-text / spec fields written by create+update (see DTO)
  description: true,
  chassis: true,
  serial: true,
  units: true,
  comment: true,
  comments: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, code: true, name: true, shortName: true } },
  port: { select: { id: true, code: true, name: true, country: true, city: true } },
  yard: { select: { id: true, code: true, name: true } },
  destinationPort: { select: { id: true, code: true, name: true, country: true, city: true } },
  inventory: { select: { id: true, yardId: true, portId: true, status: true, enteredAt: true } },
  // Phase 3A: party and financial fields
  shipperId: true,
  consigneeId: true,
  jobId: true,
  cargoValue: true,
  cargoValueCurrency: true,
} satisfies Prisma.CargoSelect;

// The exact row shape produced by the select above (used for type-safe
// normalization of the Decimal weight value).
type CargoRow = Prisma.CargoGetPayload<{ select: typeof select }>;

@Injectable()
export class CargoService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCargoQueryDto) {
    const pagination = parsePagination(query);
    const inYard = parseBooleanFilter(query.inYard);

    const where: Prisma.CargoWhereInput = {
      deletedAt: null,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.portId ? { portId: query.portId } : {}),
      ...(query.yardId ? { yardId: query.yardId } : {}),
      ...(query.destinationPortId ? { destinationPortId: query.destinationPortId } : {}),
      ...(query.pol ? { pol: query.pol } : {}),
      ...(query.pod ? { pod: query.pod } : {}),
      ...(query.cargoType ? { cargoType: query.cargoType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.inspectionStatus ? { inspectionStatus: query.inspectionStatus } : {}),
      ...(query.loadingStatus ? { loadingStatus: query.loadingStatus } : {}),
      ...(query.arrivalFrom || query.arrivalTo
        ? {
            arrivalDate: {
              ...(query.arrivalFrom ? { gte: new Date(query.arrivalFrom) } : {}),
              ...(query.arrivalTo ? { lte: new Date(query.arrivalTo) } : {}),
            },
          }
        : {}),
      // inYard=true -> a current inventory record exists; inYard=false -> none.
      ...(inYard === true ? { inventory: { isNot: null } } : {}),
      ...(inYard === false ? { inventory: { is: null } } : {}),
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              { serialNumber: { contains: query.search, mode: 'insensitive' } },
              { chassisNumber: { contains: query.search, mode: 'insensitive' } },
              { vin: { contains: query.search, mode: 'insensitive' } },
              { manifestNumber: { contains: query.search, mode: 'insensitive' } },
              { customer: { name: { contains: query.search, mode: 'insensitive' } } },
              { customer: { code: { contains: query.search, mode: 'insensitive' } } },
              { pol: { contains: query.search, mode: 'insensitive' } },
              { pod: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.cargo.count({ where }),
      this.prisma.cargo.findMany({
        where,
        select,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return buildPaginated(items.map((r) => this.normalize(r)), total, pagination);
  }

  async findById(id: string) {
    const row = await this.prisma.cargo.findUnique({ where: { id }, select });
    if (!row || row.deletedAt) {
      throw new NotFoundException('Cargo not found');
    }
    return this.normalize(row);
  }

  async create(dto: CreateCargoDto, actor?: AuthenticatedUser) {
    await this.validateRelations(dto.portId, dto.customerId, dto.yardId, dto.destinationPortId);

    // Atomic reference allocation by BOUNDED RETRY on P2002. generateReference() is
    // read-then-write (read the current max, then create), so under concurrent creates two
    // requests can compute the same CRG-YYMM-##### and the loser hits the unique index
    // (P2002 -> 409 via the exception filter). On collision we re-read the max — the
    // winner's row is committed, so max has advanced — and allocate again. generateReference
    // counts soft-deleted rows too (no deletedAt filter), so numbers are never reused, and
    // the format + "highest existing sequence for the current month + 1" semantics are
    // preserved without any schema/sequence change.
    const MAX_REFERENCE_ATTEMPTS = 10;
    for (let attempt = 1; ; attempt += 1) {
      const reference = await this.generateReference();
      try {
        return await this.prisma.cargo
          .create({
            data: {
              reference,
              customerId: dto.customerId,
              portId: dto.portId,
              yardId: dto.yardId,
              destinationPortId: dto.destinationPortId,
              pol: dto.pol ?? null,
              pod: dto.pod ?? null,
              cargoType: dto.cargoType,
              specification: dto.specification,
              serialNumber: dto.serialNumber,
              chassisNumber: dto.chassisNumber,
              vin: dto.vin,
              weight: dto.weight ?? null,
              weightUnit: dto.weightUnit ?? null,
              quantity: dto.quantity,
              packages: dto.packages,
              packageType: dto.packageType,
              arrivalDate: dto.arrivalDate ? new Date(dto.arrivalDate) : null,
              arrivalReference: dto.arrivalReference,
              manifestNumber: dto.manifestNumber,
              comments: dto.comments,
              comment: dto.comment ?? null,
              description: dto.description ?? null,
              chassis: dto.chassis ?? null,
              serial: dto.serial ?? null,
              units: dto.units,
              shipperId: dto.shipperId ?? null,
              consigneeId: dto.consigneeId ?? null,
              jobId: dto.jobId ?? null,
              cargoValue: dto.cargoValue ?? null,
              cargoValueCurrency: dto.cargoValueCurrency ?? null,
              createdById: actor?.id,
            },
            select,
          })
          .then((row) => this.normalize(row));
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          attempt < MAX_REFERENCE_ATTEMPTS
        ) {
          continue; // lost the allocation race: re-read the committed max and retry
        }
        throw e;
      }
    }
  }

  async update(id: string, dto: UpdateCargoDto, _actor?: AuthenticatedUser) {
    const existing = await this.prisma.cargo.findUnique({ where: { id }, select });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Cargo not found');
    }
    if (existing.status === 'CANCELLED') {
      throw new ConflictException('Cancelled cargo cannot be edited');
    }

    const portId = dto.portId ?? existing.portId;
    const customerId = dto.customerId ?? existing.customerId;
    const yardId = dto.clearYard ? null : dto.yardId ?? existing.yardId;
    const destinationPortId = dto.clearDestination
      ? null
      : dto.destinationPortId ?? existing.destinationPortId;

    await this.validateRelations(portId, customerId, yardId, destinationPortId);

    return this.prisma.cargo
      .update({
        where: { id },
        data: {
          customerId,
          portId,
          yardId,
          destinationPortId,
          pol: dto.pol ?? existing.pol,
          pod: dto.pod ?? existing.pod,
          cargoType: dto.cargoType,
          specification: dto.specification,
          serialNumber: dto.serialNumber,
          chassisNumber: dto.chassisNumber,
          vin: dto.vin,
          weight: dto.weight ?? undefined,
          weightUnit: dto.weightUnit,
          quantity: dto.quantity,
          packages: dto.packages,
          packageType: dto.packageType,
          arrivalDate: dto.arrivalDate ? new Date(dto.arrivalDate) : undefined,
          arrivalReference: dto.arrivalReference,
          manifestNumber: dto.manifestNumber,
          comments: dto.comments,
          comment: dto.comment ?? undefined,
          description: dto.description ?? undefined,
          chassis: dto.chassis ?? undefined,
          serial: dto.serial ?? undefined,
          units: dto.units ?? undefined,
          // Phase 3A: party and financial fields
          shipperId: dto.shipperId ?? existing.shipperId,
          consigneeId: dto.consigneeId ?? existing.consigneeId,
          jobId: dto.jobId ?? existing.jobId,
          cargoValue: dto.cargoValue !== undefined ? dto.cargoValue : existing.cargoValue,
          cargoValueCurrency: dto.cargoValueCurrency ?? existing.cargoValueCurrency,
        },
        select,
      })
      .then((row) => this.normalize(row));
  }

  /**
   * Lifecycle transition (server-side). Validates the transition table and the
   * inspection/loading readiness rules. Inventory is updated transactionally by
   * the YardInventory module when cargo is placed into or removed from a yard.
   */
  async transition(id: string, to: CargoStatus, _actor?: AuthenticatedUser) {
    const existing = await this.prisma.cargo.findUnique({ where: { id }, select });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Cargo not found');
    }

    const from = existing.status;
    if (from === to) return this.normalize(existing);

    if (!TRANSITIONS[from]?.includes(to)) {
      throw new ConflictException(`Cannot transition cargo from ${from} to ${to}.`);
    }

    if (to === 'READY_FOR_LOADING' && existing.inspectionStatus !== 'DONE') {
      throw new ConflictException(
        'Cargo cannot be marked READY_FOR_LOADING until its inspection status is DONE.'
      );
    }

    const hasInventory = existing.inventory != null;
    if ((to === 'LOADED' || to === 'DELIVERED') && !hasInventory) {
      throw new ConflictException(
        'Cargo must be recorded in a yard (inventory) before it can be marked loaded/delivered.'
      );
    }

    return this.prisma.cargo
      .update({ where: { id }, data: { status: to }, select })
      .then((row) => this.normalize(row));
  }

  async remove(id: string) {
    const existing = await this.prisma.cargo.findUnique({ where: { id }, select });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Cargo not found');
    }
    if (existing.inventory) {
      throw new ConflictException(
        'Cargo is currently recorded in a yard. Remove it from the yard before deleting the cargo record.'
      );
    }
    await this.prisma.cargo.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Master-data integrity (Phase 3). Enforces that references exist and are not
   * soft-deleted; new assignments require active master data while historical
   * records stay linked. yardId must belong to portId.
   */
  private async validateRelations(
    portId: string,
    customerId: string,
    yardId?: string | null,
    destinationPortId?: string | null
  ) {
    const [customer, port] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: customerId } }),
      this.prisma.port.findUnique({ where: { id: portId } }),
    ]);

    if (!customer || customer.deletedAt) {
      throw new NotFoundException('Customer not found');
    }
    if (!customer.isActive) {
      throw new ConflictException('Inactive customers cannot receive new cargo');
    }

    if (!port || port.deletedAt) {
      throw new NotFoundException('Port not found');
    }
    if (!port.isActive) {
      throw new ConflictException('Inactive ports cannot receive new cargo');
    }

    if (destinationPortId) {
      const dest = await this.prisma.port.findUnique({ where: { id: destinationPortId } });
      if (!dest || dest.deletedAt) {
        throw new NotFoundException('Destination port not found');
      }
      if (!dest.isActive) {
        throw new ConflictException('Inactive destination port cannot be selected');
      }
    }

    if (yardId) {
      const yard = await this.prisma.yard.findUnique({ where: { id: yardId } });
      if (!yard || yard.deletedAt) {
        throw new NotFoundException('Yard not found');
      }
      if (!yard.isActive) {
        throw new ConflictException('Inactive yard cannot be assigned to cargo');
      }
      if (yard.portId !== portId) {
        throw new ConflictException('Yard does not belong to the selected port');
      }
    }
  }

  /** Deterministic unique human-friendly reference: CRG-<YYMM>-<padded seq>. */
  private async generateReference(): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(
      now.getUTCMonth() + 1
    ).padStart(2, '0')}`;
    const prefix = `CRG-${yymm}-`;

    // Highest existing sequence for the current month avoids collisions when
    // earlier records were deleted or soft-deleted.
    const latest = await this.prisma.cargo.findFirst({
      where: { reference: { startsWith: prefix } },
      orderBy: { reference: 'desc' },
      select: { reference: true },
    });

    const lastSeq = latest ? Number(latest.reference.slice(prefix.length)) : 0;
    const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }

  /** Prisma returns Decimal for weight; surface it as a string (JSON-safe). */
  private normalize(row: CargoRow) {
    if (row.weight != null) {
      row.weight = (row.weight as unknown as { toString: () => string }).toString() as never;
    }
    // Derived boolean mirroring the inYard list filter (inventory relation exists).
    // Kept in sync with the filter `inventory: { isNot: null }` by construction.
    return { ...row, inYard: row.inventory != null } as unknown as CargoRow;
  }
}