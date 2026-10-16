import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CargoStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { auditProjection } from '../../common/infrastructure/audit/audit-change';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { parseBooleanFilter } from '../../common/utils/query-filter.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  NumberingService,
  nextSequenceAfter,
  periodicSequenceRequest,
} from '../../common/infrastructure/numbering';
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
  comments: true,
  documentStatus: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, code: true, name: true } },
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
const detailSelect = { ...select, legacyAttributes: { select: {
  chassis: true, serial: true, comment: true, units: true, archivedAt: true,
} }, intakeDocuments: { select: { id: true, name: true, reference: true, createdAt: true },
  orderBy: { createdAt: 'asc' as const } } } satisfies Prisma.CargoSelect;

// Excludes relation objects and personal identifiers; captures the operational
// fields needed to reconstruct a significant cargo change without log bloat.
const auditedCargoFields = [
  'reference', 'status', 'customerId', 'portId', 'yardId', 'destinationPortId',
  'shipperId', 'consigneeId', 'jobId', 'cargoType', 'quantity', 'packages',
  'weight', 'cargoValue', 'cargoValueCurrency', 'inspectionStatus',
  'loadingStatus', 'documentStatus', 'pol', 'pod', 'manifestNumber',
] as const;

@Injectable()
export class CargoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

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
    const row = await this.prisma.cargo.findUnique({ where: { id }, select: detailSelect });
    if (!row || row.deletedAt) {
      throw new NotFoundException('Cargo not found');
    }
    return this.normalize(row);
  }

  async create(dto: CreateCargoDto, actor: AuthenticatedUser) {
    await this.validateRelations(dto.portId, dto.customerId, dto.yardId, dto.destinationPortId);
    if (dto.shipperId) await this.validateParty('shipper', dto.shipperId);
    if (dto.consigneeId) await this.validateParty('consignee', dto.consigneeId);

    // Number and record are created in ONE transaction (DEC-027): concurrent creates get distinct
    // CRG numbers from the row-locked sequence, and a failed insert rolls the counter back.
    const row = await this.prisma.$transaction(async (tx) => {
      const req = periodicSequenceRequest('CARGO', new Date());
      const { sequence: reference } = await this.numbering.allocateNumber({
        ...req,
        seedNextSequence: async (seedTx) =>
          nextSequenceAfter(
            req.prefix,
            (
              await seedTx.cargo.findFirst({
                where: { reference: { startsWith: req.prefix } },
                orderBy: { reference: 'desc' },
                select: { reference: true },
              })
            )?.reference ?? null,
          ),
        tx,
      });
      const created = await tx.cargo.create({
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
              documentStatus: dto.documentStatus,
              intakeDocuments: dto.intakeDocuments?.length ? { create: dto.intakeDocuments.map((d) =>
                ({ name: d.name.trim(), reference: d.reference?.trim() || null })) } : undefined,
              description: dto.description ?? null,
              shipperId: dto.shipperId ?? null,
              consigneeId: dto.consigneeId ?? null,
              jobId: dto.jobId ?? null,
              cargoValue: dto.cargoValue ?? null,
              cargoValueCurrency: dto.cargoValueCurrency ?? null,
              createdById: actor.id,
            },
        select,
      });
      await this.audit.recordIn(tx, { action: 'cargo.create', entityType: 'Cargo',
        entityId: created.id, actorId: actor.id, actorEmail: actor.email,
        afterData: auditProjection(created, auditedCargoFields),
        metadata: { intakeDocuments: dto.intakeDocuments?.map((d) => d.name) ?? [] } });
      if (dto.documentStatus || dto.intakeDocuments?.length) await this.audit.recordIn(tx, {
        action: 'cargo.paperwork.record', entityType: 'Cargo', entityId: created.id,
        actorId: actor.id, actorEmail: actor.email,
        afterData: { documentStatus: dto.documentStatus ?? null,
          intakeDocuments: dto.intakeDocuments?.map((d) => d.name) ?? [] },
      });
      return created;
    });
    return this.normalize(row);
  }

  async update(id: string, dto: UpdateCargoDto, actor: AuthenticatedUser) {
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

    await this.validateRelations(portId, customerId, yardId, destinationPortId,
      { portId: existing.portId, customerId: existing.customerId, yardId: existing.yardId,
        destinationPortId: existing.destinationPortId });
    // Existing historical references may remain attached when their masters are
    // deactivated; a newly selected inactive party must never be assigned.
    if (dto.shipperId && dto.shipperId !== existing.shipperId) await this.validateParty('shipper', dto.shipperId);
    if (dto.consigneeId && dto.consigneeId !== existing.consigneeId) await this.validateParty('consignee', dto.consigneeId);

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Cargo" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.cargo.findUnique({ where: { id }, select });
      if (!before || before.deletedAt) throw new NotFoundException('Cargo not found');
      if (before.status === 'CANCELLED' || before.updatedAt.getTime() !== existing.updatedAt.getTime()) {
        throw new ConflictException('Cargo changed while being edited; retry');
      }
      const row = await tx.cargo.update({
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
          documentStatus: dto.documentStatus,
          intakeDocuments: dto.intakeDocuments?.length ? { create: dto.intakeDocuments.map((d) =>
            ({ name: d.name.trim(), reference: d.reference?.trim() || null })) } : undefined,
          description: dto.description ?? undefined,
          // Phase 3A: party and financial fields
          shipperId: dto.shipperId ?? existing.shipperId,
          consigneeId: dto.consigneeId ?? existing.consigneeId,
          jobId: dto.jobId ?? existing.jobId,
          cargoValue: dto.cargoValue !== undefined ? dto.cargoValue : existing.cargoValue,
          cargoValueCurrency: dto.cargoValueCurrency ?? existing.cargoValueCurrency,
        },
        select,
      });
      await this.audit.recordIn(tx, { action: 'cargo.update', entityType: 'Cargo',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: auditProjection(before, auditedCargoFields),
        afterData: auditProjection(row, auditedCargoFields),
        metadata: { addedIntakeDocuments: dto.intakeDocuments?.map((d) => d.name) ?? [] } });
      if (dto.documentStatus !== undefined || dto.intakeDocuments?.length) await this.audit.recordIn(tx, {
        action: 'cargo.paperwork.update', entityType: 'Cargo', entityId: id,
        actorId: actor.id, actorEmail: actor.email,
        beforeData: { documentStatus: before.documentStatus },
        afterData: { documentStatus: row.documentStatus,
          addedIntakeDocuments: dto.intakeDocuments?.map((d) => d.name) ?? [] },
      });
      return this.normalize(row);
    });
  }

  /**
   * Lifecycle transition (server-side). Validates the transition table and the
   * inspection/loading readiness rules. Inventory is updated transactionally by
   * the YardInventory module when cargo is placed into or removed from a yard.
   */
  async transition(id: string, to: CargoStatus, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Cargo" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.cargo.findUnique({ where: { id }, select });
      if (!before || before.deletedAt) throw new NotFoundException('Cargo not found');
      const from = before.status;
      if (from === to) return this.normalize(before);
      if (!TRANSITIONS[from]?.includes(to)) {
        throw new ConflictException(`Cannot transition cargo from ${from} to ${to}.`);
      }
      if (to === 'READY_FOR_LOADING' && before.inspectionStatus !== 'DONE') {
        throw new ConflictException('Cargo cannot be marked READY_FOR_LOADING until its inspection status is DONE.');
      }
      if ((to === 'LOADED' || to === 'DELIVERED') && before.inventory == null) {
        throw new ConflictException('Cargo must be recorded in a yard (inventory) before it can be marked loaded/delivered.');
      }
      const after = await tx.cargo.update({ where: { id }, data: { status: to }, select });
      await this.audit.recordIn(tx, { action: 'cargo.transition', entityType: 'Cargo',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { status: from }, afterData: { status: to },
        metadata: { reference: before.reference } });
      return this.normalize(after);
    });
  }

  /** Only a never-used, non-financial cargo registration may be archived.
   * Cargo with loading/manifest/B/L history is cancelled instead. */
  async remove(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Cargo" WHERE "id" = ${id} FOR UPDATE`;
      const cargo = await tx.cargo.findFirst({ where: { id, deletedAt: null },
        include: { _count: { select: { inspections: true, dischargeItems: true,
          loadListItems: true, actualLoadingItems: true, manifestItems: true,
          billsOfLadingItems: true, intakeDocuments: true } },
          inventory: { select: { id: true } }, legacyAttributes: { select: { cargoId: true } } } });
      if (!cargo) throw new NotFoundException('Cargo not found');
      const [attachments, sidecars, issued, rendered] = await Promise.all([
        tx.fileAttachment.count({ where: { entityType: 'Cargo', entityId: id } }),
        tx.configFieldValue.count({ where: { scope: 'Cargo', recordId: id } }),
        tx.documentIssuedSnapshot.count({ where: { documentType: 'Cargo', recordId: id } }),
        tx.documentRenderedOutput.count({ where: { documentType: 'Cargo', recordId: id } }),
      ]);
      if (attachments || sidecars || issued || rendered || cargo.inventory || cargo.legacyAttributes || cargo.jobId ||
          cargo.cargoValue || Object.values(cargo._count).some((n) => n > 0) ||
          cargo.status !== 'REGISTERED') {
        throw new ConflictException('Cargo has dependent or historically significant records; cancel instead');
      }
      const result = await tx.cargo.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.recordIn(tx, { action: 'cargo.archive', entityType: 'Cargo',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { reference: cargo.reference, status: cargo.status },
        afterData: { deletedAt: result.deletedAt } });
      return { id, archived: true };
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
  private async validateParty(type: 'shipper' | 'consignee', id: string) {
    const row = type === 'shipper'
      ? await this.prisma.shipper.findUnique({ where: { id }, select: { deletedAt: true, isActive: true } })
      : await this.prisma.consignee.findUnique({ where: { id }, select: { deletedAt: true, isActive: true } });
    if (!row || row.deletedAt) throw new NotFoundException(`${type} not found`);
    if (!row.isActive) throw new ConflictException(`Inactive ${type} cannot be selected`);
  }

  private async validateRelations(
    portId: string,
    customerId: string,
    yardId?: string | null,
    destinationPortId?: string | null,
    previous?: { portId: string; customerId: string; yardId: string | null;
      destinationPortId: string | null }
  ) {
    const [customer, port] = await Promise.all([
      this.prisma.customer.findUnique({ where: { id: customerId } }),
      this.prisma.port.findUnique({ where: { id: portId } }),
    ]);

    if (!customer || customer.deletedAt) {
      throw new NotFoundException('Customer not found');
    }
    if (!customer.isActive && (!previous || customerId !== previous.customerId)) {
      throw new ConflictException('Inactive customers cannot receive new cargo');
    }

    if (!port || port.deletedAt) {
      throw new NotFoundException('Port not found');
    }
    if (!port.isActive && (!previous || portId !== previous.portId)) {
      throw new ConflictException('Inactive ports cannot receive new cargo');
    }

    if (destinationPortId) {
      const dest = await this.prisma.port.findUnique({ where: { id: destinationPortId } });
      if (!dest || dest.deletedAt) {
        throw new NotFoundException('Destination port not found');
      }
      if (!dest.isActive && (!previous || destinationPortId !== previous.destinationPortId)) {
        throw new ConflictException('Inactive destination port cannot be selected');
      }
    }

    if (yardId) {
      const yard = await this.prisma.yard.findUnique({ where: { id: yardId } });
      if (!yard || yard.deletedAt) {
        throw new NotFoundException('Yard not found');
      }
      if (!yard.isActive && (!previous || yardId !== previous.yardId)) {
        throw new ConflictException('Inactive yard cannot be assigned to cargo');
      }
      if (yard.portId !== portId) {
        throw new ConflictException('Yard does not belong to the selected port');
      }
    }
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