import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ManifestStatus, BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VoucherService } from '../voucher/voucher.service';

export interface PortalActor {
  id?: string;
}

interface BookingRow {
  id: string;
  bookingNumber: string;
  customerId: string;
  status: BookingStatus;
  cargoDescription: string;
  originPortId: string | null;
  destinationPortId: string | null;
  requestedShipDate: Date | null;
  containers: number | null;
  weightKg: Prisma.Decimal | null;
  notes: string | null;
  responseNote: string | null;
  handledById: string | null;
  handledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { id: string; name: string; code: string };
  originPort: { id: string; name: string; code: string; country: string } | null;
  destinationPort: { id: string; name: string; code: string; country: string } | null;
  handledBy: { id: string; fullName: string } | null;
}

const bookingSelect = {
  id: true,
  bookingNumber: true,
  customerId: true,
  status: true,
  cargoDescription: true,
  originPortId: true,
  destinationPortId: true,
  requestedShipDate: true,
  containers: true,
  weightKg: true,
  notes: true,
  responseNote: true,
  handledById: true,
  handledAt: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true, code: true } },
  originPort: { select: { id: true, name: true, code: true, country: true } },
  destinationPort: { select: { id: true, name: true, code: true, country: true } },
  handledBy: { select: { id: true, fullName: true } },
} satisfies Prisma.BookingRequestSelect;

function iso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function mapBooking(row: BookingRow) {
  return {
    id: row.id,
    bookingNumber: row.bookingNumber,
    customerId: row.customerId,
    status: row.status,
    cargoDescription: row.cargoDescription,
    containers: row.containers,
    weightKg: row.weightKg ? Number(row.weightKg) : null,
    requestedShipDate: iso(row.requestedShipDate),
    notes: row.notes,
    responseNote: row.responseNote,
    handledAt: iso(row.handledAt),
    handledBy: row.handledBy ? row.handledBy.fullName : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    customer: row.customer,
    originPort: row.originPort,
    destinationPort: row.destinationPort,
  };
}

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vouchers: VoucherService,
  ) {}

  /** Resolve the portal company for a user; 403 when not linked. */
  /**
   * Office-desk guard (ADR-040): portal-linked accounts must never use the
   * staff desk at /bookings — even if a role accidentally grants booking:read.
   */
  private async assertStaff(actor: PortalActor) {
    const user = actor.id
      ? await this.prisma.user.findUnique({ where: { id: actor.id }, select: { portalCustomerId: true } })
      : null;
    if (user?.portalCustomerId) {
      throw new ForbiddenException('Portal accounts cannot access the office booking desk');
    }
  }

  private async portalCustomerIdOf(actor: PortalActor): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: actor.id, deletedAt: null },
      select: { portalCustomerId: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.portalCustomerId) {
      throw new ForbiddenException('This account is not linked to a portal company');
    }
    return user.portalCustomerId;
  }

  /**
   * Manifest-scoping ids for a portal user: the linked Agent master id
   * (`portalAgentId`, plan §3 addendum).
   *
   * The legacy Customer-id leg is REMOVED (follow-up to the party cutover):
   * `manifests.agentId` now references `agents`, so a Customer id can never
   * match a manifest agent — carrying it in the scope was dead code at best
   * and a cross-table id confusion at worst. A user linked only to a portal
   * Customer therefore scopes to NO manifests (empty list) rather than to
   * Customer ids; bookings/statement stay Customer-scoped via
   * `portalCustomerIdOf` and are unaffected.
   *
   * Mirrors portalCustomerIdOf semantics: user not found -> 404; linked to
   * neither agent nor customer -> the same 403 message as an unlinked portal
   * company (empty is reserved for "customer-only", which is a real state).
   */
  private async portalManifestScopeIds(actor: PortalActor): Promise<string[]> {
    const user = await this.prisma.user.findFirst({
      where: { id: actor.id, deletedAt: null },
      select: { portalAgentId: true, portalCustomerId: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.portalAgentId && !user.portalCustomerId) {
      throw new ForbiddenException('This account is not linked to a portal company');
    }
    return user.portalAgentId ? [user.portalAgentId] : [];
  }

  private async nextBookingNumber(): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `BRK-${yymm}-`;
    const count = await this.prisma.bookingRequest.count({
      where: { bookingNumber: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }

  async me(actor: PortalActor) {
    const customerId = await this.portalCustomerIdOf(actor);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true, name: true, code: true, email: true, phone: true, type: true },
    });
    if (!customer) throw new NotFoundException('Portal company not found');

    // Manifest scoping goes through portalAgentId only (see
    // portalManifestScopeIds); bookings/statement stay Customer-scoped.
    const manifestScopeIds = await this.portalManifestScopeIds(actor);
    const [bookingsTotal, bookingsPending, manifestsApproved, ledger] = await Promise.all([
      this.prisma.bookingRequest.count({ where: { customerId, deletedAt: null } }),
      this.prisma.bookingRequest.count({ where: { customerId, deletedAt: null, status: 'PENDING' } }),
      this.prisma.manifest.count({ where: { agentId: { in: manifestScopeIds }, deletedAt: null, status: 'APPROVED' as ManifestStatus } }),
      this.vouchers.ledger({ customerId }).catch(() => null),
    ]);

    return {
      customer,
      summary: {
        bookingsTotal,
        bookingsPending,
        approvedManifests: manifestsApproved,
        balanceDue: Number(ledger?.summary?.closingBalance ?? 0),
        currencyCode: ledger?.summary?.currencyCode ?? 'USD',
      },
    };
  }

  // ---- Bookings (agent scope: own company only) ----

  async listOwnBookings(actor: PortalActor, query: { page?: number; pageSize?: number; search?: string; status?: string }) {
    const customerId = await this.portalCustomerIdOf(actor);
    return this.listBookings(query, customerId);
  }

  /** Office desk: all bookings across companies (booking:read, staff-only via assertStaff). */
  async listAllBookings(query: { page?: number; pageSize?: number; search?: string; status?: string; customerId?: string }, actor?: PortalActor) {
    if (actor) await this.assertStaff(actor);
    return this.listBookings(query);
  }

  async bookingDetail(id: string, actor?: PortalActor) {
    if (actor) await this.assertStaff(actor);
    const row = await this.prisma.bookingRequest.findFirst({ where: { id, deletedAt: null }, select: bookingSelect });
    if (!row) throw new NotFoundException('Booking not found');
    return mapBooking(row);
  }

  async respond(id: string, dto: { decision: 'ACCEPTED' | 'DECLINED'; responseNote?: string }, actor: { id?: string }) {
    await this.assertStaff(actor as PortalActor);
    return this.respondBooking(actor as PortalActor, id, dto);
  }

  async listBookings(query: { page?: number; pageSize?: number; search?: string; status?: string; customerId?: string }, forceCustomerId?: string) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.BookingRequestWhereInput = {
      deletedAt: null,
      ...(forceCustomerId ? { customerId: forceCustomerId } : query.customerId ? { customerId: query.customerId } : {}),
      ...(query.status ? { status: query.status as BookingStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { bookingNumber: { contains: query.search, mode: 'insensitive' } },
              { cargoDescription: { contains: query.search, mode: 'insensitive' } },
              { customer: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.bookingRequest.findMany({
        where,
        select: bookingSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.bookingRequest.count({ where }),
    ]);
    return {
      data: rows.map(mapBooking),
      meta: { page, pageSize, totalItems: total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async ownBookingDetail(actor: PortalActor, id: string) {
    const customerId = await this.portalCustomerIdOf(actor);
    const row = await this.prisma.bookingRequest.findFirst({ where: { id, deletedAt: null }, select: bookingSelect });
    if (!row || row.customerId !== customerId) throw new NotFoundException('Booking not found');
    return mapBooking(row);
  }

  private async validatePorts(originPortId?: string, destinationPortId?: string) {
    const ids = [originPortId, destinationPortId].filter((v): v is string => Boolean(v));
    if (!ids.length) return;
    const found = await this.prisma.port.count({ where: { id: { in: ids }, deletedAt: null, isActive: true } as Prisma.PortWhereInput });
    if (found !== new Set(ids).size) throw new BadRequestException('Invalid or inactive port');
  }

  async createBooking(actor: PortalActor, dto: {
    cargoDescription: string;
    originPortId?: string;
    destinationPortId?: string;
    requestedShipDate?: string;
    containers?: number;
    weightKg?: number;
    notes?: string;
  }) {
    const customerId = await this.portalCustomerIdOf(actor);
    await this.validatePorts(dto.originPortId, dto.destinationPortId);
    const bookingNumber = await this.nextBookingNumber();
    const row = await this.prisma.bookingRequest.create({
      data: {
        bookingNumber,
        customerId,
        cargoDescription: dto.cargoDescription.trim(),
        originPortId: dto.originPortId ?? null,
        destinationPortId: dto.destinationPortId ?? null,
        requestedShipDate: dto.requestedShipDate ? new Date(dto.requestedShipDate) : null,
        containers: dto.containers ?? null,
        weightKg: dto.weightKg != null ? new Prisma.Decimal(dto.weightKg) : null,
        notes: dto.notes?.trim() || null,
      },
      select: bookingSelect,
    });
    return mapBooking(row);
  }

  async cancelOwnBooking(actor: PortalActor, id: string) {
    const customerId = await this.portalCustomerIdOf(actor);
    const row = await this.prisma.bookingRequest.findFirst({ where: { id, deletedAt: null }, select: bookingSelect });
    if (!row || row.customerId !== customerId) throw new NotFoundException('Booking not found');
    if (row.status !== 'PENDING') throw new ConflictException('Only PENDING bookings can be cancelled');
    const updated = await this.prisma.bookingRequest.update({ where: { id }, data: { status: 'CANCELLED' }, select: bookingSelect });
    return mapBooking(updated);
  }

  async respondBooking(actor: PortalActor, id: string, dto: { decision: 'ACCEPTED' | 'DECLINED'; responseNote?: string }) {
    const row = await this.prisma.bookingRequest.findFirst({ where: { id, deletedAt: null }, select: bookingSelect });
    if (!row) throw new NotFoundException('Booking not found');
    if (row.status !== 'PENDING') throw new ConflictException('Only PENDING bookings can be responded to');
    const updated = await this.prisma.bookingRequest.update({
      where: { id },
      data: {
        status: dto.decision,
        responseNote: dto.responseNote?.trim() || null,
        handledById: actor.id,
        handledAt: new Date(),
      },
      select: bookingSelect,
    });
    return mapBooking(updated);
  }

  // ---- Shipments: manifests where this company is the booking agent ----

  async shipments(actor: PortalActor, query: { page?: number; pageSize?: number; status?: string; search?: string }) {
    // Agent scoping via portalAgentId only; manifests.agentId references the
    // Agent master since the party cutover, so no Customer id belongs here.
    const manifestScopeIds = await this.portalManifestScopeIds(actor);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.ManifestWhereInput = {
      agentId: { in: manifestScopeIds },
      deletedAt: null,
      ...(query.status ? { status: query.status as ManifestStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { manifestNumber: { contains: query.search, mode: 'insensitive' } },
              { vesselName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.manifest.findMany({
        where,
        select: {
          id: true,
          manifestNumber: true,
          status: true,
          vesselName: true,
          submittedAt: true,
          approvedAt: true,
          cancelledAt: true,
          createdAt: true,
          totalWeight: true,
          totalQuantity: true,
          voyage: { select: { id: true, voyageNumber: true, plannedDepartureAt: true, plannedArrivalAt: true } },
          polPort: { select: { id: true, name: true, code: true } },
          podPort: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.manifest.count({ where }),
    ]);
    return {
      data: rows.map((r) => ({
        id: r.id,
        manifestNumber: r.manifestNumber,
        status: r.status,
        vesselName: r.vesselName,
        voyageNumber: r.voyage ? r.voyage.voyageNumber : null,
        departureDate: r.voyage?.plannedDepartureAt ? r.voyage.plannedDepartureAt.toISOString() : null,
        arrivalDate: r.voyage?.plannedArrivalAt ? r.voyage.plannedArrivalAt.toISOString() : null,
        pol: r.polPort ? { id: r.polPort.id, name: r.polPort.name, code: r.polPort.code } : null,
        pod: r.podPort ? { id: r.podPort.id, name: r.podPort.name, code: r.podPort.code } : null,
        totalWeight: Number(r.totalWeight),
        totalQuantity: r.totalQuantity,
        timeline: {
          createdAt: r.createdAt.toISOString(),
          submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
          approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
          cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
        },
      })),
      meta: { page, pageSize, totalItems: total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  // ---- Statement: ledger for the portal company (server-side scoped) ----

  async statement(actor: PortalActor, query: { fromDate?: string; toDate?: string; currencyCode?: string; kind?: string }) {
    const customerId = await this.portalCustomerIdOf(actor);
    return this.vouchers.ledger({
      customerId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      currencyCode: query.currencyCode,
      kind: query.kind,
    });
  }

  // ---- Port dropdown for the booking form (active ports only) ----

  async ports() {
    return this.prisma.port.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, country: true },
      take: 100,
    });
  }
}
