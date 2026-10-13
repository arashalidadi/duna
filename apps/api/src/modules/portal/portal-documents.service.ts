import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PortalBillOfLading,
  PortalBillOfLadingListResult,
  PortalBlLabelListResult,
  PortalManifestListResult,
  PortalReadEmptyReason,
  PortalReadListResult,
  PortalReleaseOrder,
  PortalReleaseOrderListResult,
  PortalShipment,
} from '@shipping/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildPaginated,
  Pagination,
  PaginationParams,
  parsePagination,
} from '../../common/utils/pagination.util';

const portalBillSelect = {
  id: true,
  billNumber: true,
  voyageId: true,
  destinationPortId: true,
  status: true,
  billType: true,
  vesselName: true,
  dateOfIssue: true,
  createdAt: true,
  releaseOrders: {
    where: { deletedAt: null, status: 'ISSUED' },
    orderBy: [{ releaseDate: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { id: true, docNumber: true, status: true, releaseDate: true, paymentState: true },
  },
} satisfies Prisma.BillOfLadingSelect;

type PortalBillRow = Prisma.BillOfLadingGetPayload<{ select: typeof portalBillSelect }>;

const portalReleaseSelect = {
  id: true,
  docNumber: true,
  billOfLadingId: true,
  status: true,
  paymentState: true,
  releaseDate: true,
  cancelledAt: true,
  billOfLading: {
    select: { id: true, billNumber: true, destinationPortId: true, status: true },
  },
} satisfies Prisma.ReleaseOrderSelect;

type PortalReleaseRow = Prisma.ReleaseOrderGetPayload<{ select: typeof portalReleaseSelect }>;

// Keep the manifest row shape compatible with the existing /portal/shipments list.
const portalManifestSelect = {
  id: true,
  manifestNumber: true,
  status: true,
  vesselName: true,
  totalQuantity: true,
  totalWeight: true,
  createdAt: true,
  submittedAt: true,
  approvedAt: true,
  cancelledAt: true,
  voyage: { select: { voyageNumber: true, plannedDepartureAt: true, plannedArrivalAt: true } },
  polPort: { select: { id: true, name: true, code: true } },
  podPort: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ManifestSelect;

type PortalManifestRow = Prisma.ManifestGetPayload<{ select: typeof portalManifestSelect }>;

/** Shared by B/Ls and releases so neither query can drift into a broader scope. */
function visibleBillWhere(portIds: string[]): Prisma.BillOfLadingWhereInput {
  return {
    deletedAt: null,
    status: { not: 'DRAFT' },
    destinationPortId: { in: portIds },
  };
}

function mapBill(row: PortalBillRow): PortalBillOfLading {
  const release = row.releaseOrders.find((order) => order.status === 'ISSUED') ?? null;
  return {
    id: row.id,
    billNumber: row.billNumber,
    voyageId: row.voyageId,
    destinationPortId: row.destinationPortId,
    status: row.status,
    billType: row.billType,
    vesselName: row.vesselName,
    dateOfIssue: row.dateOfIssue?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    hasActiveRelease: release !== null,
    activeRelease: release
      ? {
          id: release.id,
          docNumber: release.docNumber,
          releaseDate: release.releaseDate.toISOString(),
          paymentState: release.paymentState,
        }
      : null,
  };
}

function mapRelease(row: PortalReleaseRow): PortalReleaseOrder {
  return {
    id: row.id,
    docNumber: row.docNumber,
    billOfLadingId: row.billOfLadingId,
    status: row.status,
    paymentState: row.paymentState,
    releaseDate: row.releaseDate.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    billOfLading: row.billOfLading,
  };
}

function mapManifest(row: PortalManifestRow): PortalShipment {
  return {
    id: row.id,
    manifestNumber: row.manifestNumber,
    status: row.status,
    vesselName: row.vesselName,
    voyageNumber: row.voyage?.voyageNumber ?? null,
    departureDate: row.voyage?.plannedDepartureAt?.toISOString() ?? null,
    arrivalDate: row.voyage?.plannedArrivalAt?.toISOString() ?? null,
    pol: row.polPort,
    pod: row.podPort,
    totalWeight: Number(row.totalWeight),
    totalQuantity: row.totalQuantity,
    timeline: {
      createdAt: row.createdAt.toISOString(),
      submittedAt: row.submittedAt?.toISOString() ?? null,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
    },
  };
}

@Injectable()
export class PortalDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Never take an agent ID from query parameters or a JWT claim. Resolve the live user link. */
  private async agentIdFor(userId: string): Promise<string | null> {
    if (!userId) throw new ForbiddenException('Authenticated portal user required');

    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null },
      select: { portalAgentId: true, portalCustomerId: true },
    });
    if (!user) throw new ForbiddenException('Portal user is inactive or unavailable');
    if (!user.portalAgentId) {
      if (user.portalCustomerId) return null;
      throw new ForbiddenException('Portal account is not linked to an agent');
    }

    const agent = await this.prisma.agent.findFirst({
      where: { id: user.portalAgentId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!agent) throw new ForbiddenException('Portal agent is inactive or unavailable');
    return agent.id;
  }

  private async activePortIds(agentId: string): Promise<string[]> {
    const destinations = await this.prisma.agentDestination.findMany({
      where: { agentId, isActive: true, deletedAt: null },
      select: { portId: true },
    });
    return destinations.map(({ portId }) => portId);
  }

  private page<T>(
    rows: T[],
    total: number,
    pagination: Pagination,
    emptyReason: PortalReadEmptyReason = 'NO_DOCUMENTS'
  ): PortalReadListResult<T> {
    return {
      ...buildPaginated(rows, total, pagination),
      emptyState: rows.length === 0
        ? { reason: total > 0 ? 'PAGE_OUT_OF_RANGE' : emptyReason }
        : null,
    };
  }

  async billsOfLading(userId: string, query: PaginationParams): Promise<PortalBillOfLadingListResult> {
    const pagination = parsePagination(query);
    const agentId = await this.agentIdFor(userId);
    if (!agentId) return this.page([], 0, pagination, 'CUSTOMER_ONLY');

    const portIds = await this.activePortIds(agentId);
    if (!portIds.length) return this.page([], 0, pagination, 'NO_ACTIVE_DESTINATIONS');

    const where = visibleBillWhere(portIds);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.billOfLading.findMany({
        where,
        select: portalBillSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.billOfLading.count({ where }),
    ]);
    return this.page(rows.map(mapBill), total, pagination);
  }

  async releaseOrders(userId: string, query: PaginationParams): Promise<PortalReleaseOrderListResult> {
    const pagination = parsePagination(query);
    const agentId = await this.agentIdFor(userId);
    if (!agentId) return this.page([], 0, pagination, 'CUSTOMER_ONLY');

    const portIds = await this.activePortIds(agentId);
    if (!portIds.length) return this.page([], 0, pagination, 'NO_ACTIVE_DESTINATIONS');

    // Scope through the B/L itself, not through an unrelated manifest or supplied port.
    const where: Prisma.ReleaseOrderWhereInput = {
      deletedAt: null,
      billOfLading: { is: visibleBillWhere(portIds) },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.releaseOrder.findMany({
        where,
        select: portalReleaseSelect,
        orderBy: [{ releaseDate: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.releaseOrder.count({ where }),
    ]);
    return this.page(rows.map(mapRelease), total, pagination);
  }

  async manifests(userId: string, query: PaginationParams): Promise<PortalManifestListResult> {
    const pagination = parsePagination(query);
    const agentId = await this.agentIdFor(userId);
    if (!agentId) return this.page([], 0, pagination, 'CUSTOMER_ONLY');

    // A manifest belongs to its linked agent; destination membership is a B/L rule.
    const where: Prisma.ManifestWhereInput = { agentId, deletedAt: null };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.manifest.findMany({
        where,
        select: portalManifestSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.manifest.count({ where }),
    ]);
    return this.page(rows.map(mapManifest), total, pagination);
  }

  async blLabels(userId: string): Promise<PortalBlLabelListResult> {
    const agentId = await this.agentIdFor(userId);
    if (!agentId) return { data: [], emptyState: { reason: 'CUSTOMER_ONLY' } };

    // A DRAFT B/L is not in the portal, so its lifecycle label is not presented.
    const data = await this.prisma.blLifecycleLabel.findMany({
      where: { code: { not: 'DRAFT' } },
      select: { code: true, label: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    return { data, emptyState: data.length ? null : { reason: 'NO_LABELS' } };
  }
}
