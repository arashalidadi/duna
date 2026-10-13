import { CanActivate, ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthenticatedUser } from '../src/common/auth/types';
import { PermissionsGuard } from '../src/common/auth/guards/permissions.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';
import { PortalDocumentsController } from '../src/modules/portal/portal-documents.controller';
import { PortalDocumentsService } from '../src/modules/portal/portal-documents.service';

/** HTTP authorization/response contract with an in-memory Prisma stand-in. No DB is opened. */
const at = new Date('2026-10-13T09:00:00Z');

type BillStatus = 'DRAFT' | 'APPROVED' | 'CANCELLED';
type Bill = {
  id: string;
  billNumber: string;
  voyageId: string;
  destinationPortId: string | null;
  status: BillStatus;
  billType: 'HOUSE';
  vesselName: string;
  dateOfIssue: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
  manifestAgentId: string; // deliberately NOT a scope key for B/Ls
};
type Release = {
  id: string;
  docNumber: string;
  billOfLadingId: string;
  status: 'ISSUED' | 'CANCELLED';
  releaseDate: Date;
  paymentState: 'PAID' | null;
  cancelledAt: Date | null;
  deletedAt: Date | null;
  overrideReason: string; // sensitive office-only field
};
type Manifest = {
  id: string;
  manifestNumber: string;
  agentId: string;
  status: 'DRAFT' | 'APPROVED';
  vesselName: string;
  totalQuantity: number;
  totalWeight: number;
  createdAt: Date;
  submittedAt: Date | null;
  approvedAt: Date | null;
  cancelledAt: Date | null;
  deletedAt: Date | null;
  voyage: { voyageNumber: string; plannedDepartureAt: Date | null; plannedArrivalAt: Date | null } | null;
  polPort: { id: string; name: string; code: string } | null;
  podPort: { id: string; name: string; code: string } | null;
};
type RecordState = {
  users: { id: string; portalAgentId: string | null; portalCustomerId: string | null; isActive: boolean; deletedAt: Date | null }[];
  agents: { id: string; isActive: boolean; deletedAt: Date | null }[];
  destinations: { agentId: string; portId: string; isActive: boolean; deletedAt: Date | null }[];
  bills: Bill[];
  releases: Release[];
  manifests: Manifest[];
  labels: { code: 'DRAFT' | 'APPROVED' | 'CANCELLED'; label: string; sortOrder: number }[];
};

function fixtures(): RecordState {
  const bill = (id: string, port: string | null, status: BillStatus, manifestAgentId: string): Bill => ({
    id, billNumber: `BOL-${id}`, voyageId: 'voyage-1', destinationPortId: port,
    status, billType: 'HOUSE', vesselName: 'Vessel', dateOfIssue: at,
    createdAt: at, deletedAt: null, manifestAgentId,
  });
  const release = (id: string, billOfLadingId: string, status: Release['status'] = 'ISSUED'): Release => ({
    id, docNumber: `RO-${id}`, billOfLadingId, status, releaseDate: at,
    paymentState: 'PAID', cancelledAt: status === 'CANCELLED' ? at : null,
    deletedAt: null, overrideReason: 'Office-only financial detail',
  });
  const manifest = (id: string, agentId: string, status: Manifest['status']): Manifest => ({
    id, manifestNumber: `MAN-${id}`, agentId, status, vesselName: 'Vessel',
    totalQuantity: 2, totalWeight: 42, createdAt: at, submittedAt: null,
    approvedAt: null, cancelledAt: null, deletedAt: null,
    voyage: { voyageNumber: 'VOY-1', plannedDepartureAt: at, plannedArrivalAt: null },
    polPort: null, podPort: { id: 'port-b', name: 'Other destination', code: 'PB' },
  });
  return {
    users: [
      { id: 'user-a', portalAgentId: 'agent-a', portalCustomerId: null, isActive: true, deletedAt: null },
      { id: 'user-b', portalAgentId: 'agent-b', portalCustomerId: null, isActive: true, deletedAt: null },
      { id: 'user-c', portalAgentId: 'agent-c', portalCustomerId: null, isActive: true, deletedAt: null },
      { id: 'user-customer', portalAgentId: null, portalCustomerId: 'customer-1', isActive: true, deletedAt: null },
      { id: 'user-unlinked', portalAgentId: null, portalCustomerId: null, isActive: true, deletedAt: null },
    ],
    agents: [
      { id: 'agent-a', isActive: true, deletedAt: null },
      { id: 'agent-b', isActive: true, deletedAt: null },
      { id: 'agent-c', isActive: true, deletedAt: null },
    ],
    destinations: [
      { agentId: 'agent-a', portId: 'port-a', isActive: true, deletedAt: null },
      { agentId: 'agent-a', portId: 'port-b', isActive: false, deletedAt: null },
      { agentId: 'agent-a', portId: 'port-soft-deleted', isActive: true, deletedAt: at },
      { agentId: 'agent-b', portId: 'port-b', isActive: true, deletedAt: null },
      { agentId: 'agent-c', portId: 'port-c', isActive: true, deletedAt: null },
    ],
    bills: [
      bill('own', 'port-a', 'APPROVED', 'agent-b'), // destination wins over manifest link
      bill('cancelled-own', 'port-a', 'CANCELLED', 'agent-a'),
      bill('other', 'port-b', 'APPROVED', 'agent-a'), // manifest link must NOT grant access
      bill('draft', 'port-a', 'DRAFT', 'agent-a'),
      { ...bill('deleted', 'port-a', 'APPROVED', 'agent-a'), deletedAt: at },
      bill('deleted-port', 'port-soft-deleted', 'APPROVED', 'agent-a'),
      bill('no-port', null, 'APPROVED', 'agent-a'),
    ],
    releases: [
      release('own', 'own'),
      release('cancelled-own', 'cancelled-own', 'CANCELLED'),
      release('other', 'other'),
      release('draft', 'draft'),
      release('deleted-bill', 'deleted'),
      release('deleted-port', 'deleted-port'),
      release('no-port', 'no-port'),
      { ...release('deleted', 'own'), deletedAt: at },
    ],
    manifests: [
      manifest('agent-a', 'agent-a', 'DRAFT'), // destination need not be active for manifests
      manifest('agent-b', 'agent-b', 'APPROVED'),
      { ...manifest('deleted', 'agent-a', 'APPROVED'), deletedAt: at },
    ],
    labels: [
      { code: 'DRAFT', label: 'Draft', sortOrder: 0 },
      { code: 'APPROVED', label: 'Approved', sortOrder: 2 },
      { code: 'CANCELLED', label: 'Cancelled', sortOrder: 3 },
    ],
  };
}

type BillWhere = { deletedAt: null; status: { not: 'DRAFT' }; destinationPortId: { in: string[] } };
type ReleaseWhere = { deletedAt: null; billOfLading: { is: BillWhere } };
type ManifestWhere = { agentId: string; deletedAt: null };
type Paging = { skip: number; take: number };

class TestAuthenticationGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const http = ctx.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: AuthenticatedUser }>();
    const tokens: Record<string, string> = {
      'Bearer a': 'user-a', 'Bearer b': 'user-b', 'Bearer c': 'user-c',
      'Bearer customer': 'user-customer', 'Bearer unlinked': 'user-unlinked',
      'Bearer denied': 'user-a', 'Bearer admin-unlinked': 'user-unlinked',
    };
    const token = http.headers.authorization ?? '';
    if (!tokens[token]) throw new UnauthorizedException('Authentication required');
    http.user = {
      id: tokens[token], email: `${tokens[token]}@example.test`, roles: [],
      permissions: token === 'Bearer denied' ? [] : ['portal:access'],
      isPrimaryAdmin: token === 'Bearer admin-unlinked',
    };
    return true;
  }
}

describe('Agent portal document reads (HTTP, no database)', () => {
  let app: INestApplication;
  let state = fixtures();

  function matchingBills(where: BillWhere): Bill[] {
    if (where.deletedAt !== null || where.status?.not !== 'DRAFT' || !Array.isArray(where.destinationPortId?.in)) {
      throw new Error('B/L query must scope by active destination, non-DRAFT status and deletion');
    }
    return state.bills.filter((bill) =>
      bill.deletedAt === null && bill.status !== 'DRAFT' &&
      bill.destinationPortId !== null && where.destinationPortId.in.includes(bill.destinationPortId)
    );
  }

  function matchingReleases(where: ReleaseWhere): Release[] {
    if (where.deletedAt !== null || !where.billOfLading?.is) {
      throw new Error('Release query must scope through a non-deleted B/L');
    }
    const visibleBillIds = new Set(matchingBills(where.billOfLading.is).map((bill) => bill.id));
    return state.releases.filter((release) => release.deletedAt === null && visibleBillIds.has(release.billOfLadingId));
  }

  function matchingManifests(where: ManifestWhere): Manifest[] {
    if (!where.agentId || where.deletedAt !== null) {
      throw new Error('Manifest query must scope by linked agent and deletion');
    }
    return state.manifests.filter((manifest) => manifest.agentId === where.agentId && manifest.deletedAt === null);
  }

  const prisma = {
    user: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; isActive: true; deletedAt: null } }) => {
        if (where.isActive !== true || where.deletedAt !== null) throw new Error('Unscoped portal user');
        return state.users.find((user) => user.id === where.id && user.isActive && user.deletedAt === null) ?? null;
      }),
    },
    agent: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; isActive: true; deletedAt: null } }) => {
        if (where.isActive !== true || where.deletedAt !== null) throw new Error('Unscoped portal agent');
        return state.agents.find((agent) => agent.id === where.id && agent.isActive && agent.deletedAt === null) ?? null;
      }),
    },
    agentDestination: {
      findMany: jest.fn(async ({ where }: { where: { agentId: string; isActive: true; deletedAt: null } }) => {
        if (!where.agentId || where.isActive !== true || where.deletedAt !== null) {
          throw new Error('Only active, non-deleted agent destinations may grant B/L access');
        }
        return state.destinations.filter((dest) =>
          dest.agentId === where.agentId && dest.isActive && dest.deletedAt === null
        );
      }),
    },
    billOfLading: {
      findMany: jest.fn(async ({ where, select, skip, take }: {
        where: BillWhere;
        select: { releaseOrders: { where: { deletedAt: null; status: 'ISSUED' }; take: number } };
      } & Paging) => {
        if (select.releaseOrders.where.deletedAt !== null || select.releaseOrders.where.status !== 'ISSUED') {
          throw new Error('Only an issued, non-deleted release is active');
        }
        return matchingBills(where).sort((a, b) => b.id.localeCompare(a.id)).slice(skip, skip + take).map((bill) => ({
          ...bill,
          releaseOrders: state.releases.filter((release) => release.billOfLadingId === bill.id &&
            release.deletedAt === null && release.status === 'ISSUED').slice(0, select.releaseOrders.take),
        }));
      }),
      count: jest.fn(async ({ where }: { where: BillWhere }) => matchingBills(where).length),
    },
    releaseOrder: {
      findMany: jest.fn(async ({ where, skip, take }: { where: ReleaseWhere } & Paging) =>
        matchingReleases(where).sort((a, b) => b.id.localeCompare(a.id)).slice(skip, skip + take).map((release) => {
          const bill = state.bills.find((row) => row.id === release.billOfLadingId);
          if (!bill) throw new Error('Test release without B/L');
          return { ...release, billOfLading: bill };
        })
      ),
      count: jest.fn(async ({ where }: { where: ReleaseWhere }) => matchingReleases(where).length),
    },
    manifest: {
      findMany: jest.fn(async ({ where, skip, take }: { where: ManifestWhere } & Paging) =>
        matchingManifests(where).sort((a, b) => b.id.localeCompare(a.id)).slice(skip, skip + take)
      ),
      count: jest.fn(async ({ where }: { where: ManifestWhere }) => matchingManifests(where).length),
    },
    blLifecycleLabel: {
      findMany: jest.fn(async ({ where }: { where: { code: { not: 'DRAFT' } } }) => {
        if (where.code?.not !== 'DRAFT') throw new Error('DRAFT label must not be presented');
        return state.labels.filter((label) => label.code !== 'DRAFT').sort((a, b) => a.sortOrder - b.sortOrder);
      }),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PortalDocumentsController],
      providers: [PortalDocumentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, forbidNonWhitelisted: true, transform: true,
      transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalGuards(new TestAuthenticationGuard(), new PermissionsGuard(app.get(Reflector)));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  beforeEach(() => {
    state = fixtures();
    jest.clearAllMocks();
  });

  afterAll(async () => { await app.close(); });

  const S = () => request(app.getHttpServer());
  const url = (resource: string) => `/api/v1/portal/${resource}`;
  const asA = { Authorization: 'Bearer a' };
  const asB = { Authorization: 'Bearer b' };

  it('requires authentication and portal:access for all four routes (no reads on denial)', async () => {
    for (const resource of ['bills-of-lading', 'release-orders', 'manifests', 'bl-labels']) {
      await S().get(url(resource)).expect(401);
      await S().get(url(resource)).set({ Authorization: 'Bearer denied' }).expect(403);
    }
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.billOfLading.findMany).not.toHaveBeenCalled();
  });

  it('rejects unlinked users, even an admin with implicit permissions; deactivated user or agent fails closed', async () => {
    for (const resource of ['bills-of-lading', 'release-orders', 'manifests', 'bl-labels']) {
      await S().get(url(resource)).set({ Authorization: 'Bearer unlinked' }).expect(403);
      await S().get(url(resource)).set({ Authorization: 'Bearer admin-unlinked' }).expect(403);
    }
    state.users[0].isActive = false;
    await S().get(url('bills-of-lading')).set(asA).expect(403);
    state.users[0].isActive = true;
    state.agents[0].isActive = false;
    await S().get(url('release-orders')).set(asA).expect(403);
    state.agents[0].isActive = true;
    state.agents[0].deletedAt = at;
    await S().get(url('manifests')).set(asA).expect(403);
    expect(prisma.billOfLading.findMany).not.toHaveBeenCalled();
    expect(prisma.releaseOrder.findMany).not.toHaveBeenCalled();
    expect(prisma.manifest.findMany).not.toHaveBeenCalled();
  });

  it('returns an explicit empty reason to customer-only accounts without document reads', async () => {
    for (const resource of ['bills-of-lading', 'release-orders', 'manifests', 'bl-labels']) {
      const response = await S().get(url(resource)).set({ Authorization: 'Bearer customer' }).expect(200);
      expect(response.body.data.data).toEqual([]);
      expect(response.body.data.emptyState).toEqual({ reason: 'CUSTOMER_ONLY' });
      if (resource !== 'bl-labels') expect(response.body.data.meta.totalItems).toBe(0);
    }
    expect(prisma.agentDestination.findMany).not.toHaveBeenCalled();
    expect(prisma.billOfLading.findMany).not.toHaveBeenCalled();
    expect(prisma.releaseOrder.findMany).not.toHaveBeenCalled();
    expect(prisma.manifest.findMany).not.toHaveBeenCalled();
    expect(prisma.blLifecycleLabel.findMany).not.toHaveBeenCalled();
  });

  it('matches B/Ls only through active destinations; never includes DRAFT, deleted, null or other ports', async () => {
    const a = await S().get(url('bills-of-lading')).set(asA).expect(200);
    expect(a.body.data.data.map((row: Bill) => row.id)).toEqual(['own', 'cancelled-own']);
    expect(a.body.data.meta.totalItems).toBe(2);
    expect(a.body.data.emptyState).toBeNull();
    expect(a.body.data.data[0]).toMatchObject({
      destinationPortId: 'port-a', hasActiveRelease: true,
      activeRelease: { docNumber: 'RO-own', paymentState: 'PAID' },
    });
    expect(a.body.data.data[1]).toMatchObject({ status: 'CANCELLED', hasActiveRelease: false, activeRelease: null });
    expect(a.body.data.data[0]).not.toHaveProperty('manifestAgentId');
    expect(prisma.agentDestination.findMany).toHaveBeenCalledWith({
      where: { agentId: 'agent-a', isActive: true, deletedAt: null }, select: { portId: true },
    });
    const billWhere = { deletedAt: null, status: { not: 'DRAFT' }, destinationPortId: { in: ['port-a'] } };
    expect(prisma.billOfLading.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: billWhere }));
    expect(prisma.billOfLading.count).toHaveBeenCalledWith({ where: billWhere });

    const b = await S().get(url('bills-of-lading')).set(asB).expect(200);
    expect(b.body.data.data.map((row: Bill) => row.id)).toEqual(['other']);
    expect(b.body.data.meta.totalItems).toBe(1);
  });

  it('includes every active destination, but not an inactive one for the same agent', async () => {
    state.destinations[1].isActive = true;
    const bills = await S().get(url('bills-of-lading')).set(asA).expect(200);
    expect(bills.body.data.data.map((row: Bill) => row.id)).toEqual(['own', 'other', 'cancelled-own']);
    expect(bills.body.data.meta.totalItems).toBe(3);
    const releases = await S().get(url('release-orders')).set(asA).expect(200);
    expect(releases.body.data.data.map((row: Release) => row.id)).toEqual(['own', 'other', 'cancelled-own']);
    expect(prisma.billOfLading.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { deletedAt: null, status: { not: 'DRAFT' }, destinationPortId: { in: ['port-a', 'port-b'] } },
    }));
  });

  it('reads fresh destination state on each request and has a distinct no-active-destinations state', async () => {
    await S().get(url('bills-of-lading')).set(asA).expect(200);
    state.destinations[0].isActive = false;
    for (const resource of ['bills-of-lading', 'release-orders']) {
      const response = await S().get(url(resource)).set(asA).expect(200);
      expect(response.body.data.data).toEqual([]);
      expect(response.body.data.emptyState).toEqual({ reason: 'NO_ACTIVE_DESTINATIONS' });
    }
    const manifests = await S().get(url('manifests')).set(asA).expect(200);
    expect(manifests.body.data.data).toHaveLength(1); // manifest scope does not use destination membership
    state.destinations[0].isActive = true;
    state.destinations[0].deletedAt = at;
    const deleted = await S().get(url('bills-of-lading')).set(asA).expect(200);
    expect(deleted.body.data.emptyState).toEqual({ reason: 'NO_ACTIVE_DESTINATIONS' });
    state.destinations[0].deletedAt = null;
    const restored = await S().get(url('bills-of-lading')).set(asA).expect(200);
    expect(restored.body.data.meta.totalItems).toBe(2);
  });

  it('scopes release orders via the same visible B/L predicate, retaining cancelled orders without internal override details', async () => {
    const a = await S().get(url('release-orders')).set(asA).expect(200);
    expect(a.body.data.data.map((row: Release) => row.id)).toEqual(['own', 'cancelled-own']);
    expect(a.body.data.meta.totalItems).toBe(2);
    expect(a.body.data.data[1]).toMatchObject({ status: 'CANCELLED', cancelledAt: at.toISOString() });
    expect(JSON.stringify(a.body.data)).not.toContain('Office-only financial detail');
    const releaseWhere = {
      deletedAt: null,
      billOfLading: { is: { deletedAt: null, status: { not: 'DRAFT' }, destinationPortId: { in: ['port-a'] } } },
    };
    expect(prisma.releaseOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: releaseWhere }));
    expect(prisma.releaseOrder.count).toHaveBeenCalledWith({ where: releaseWhere });
    const b = await S().get(url('release-orders')).set(asB).expect(200);
    expect(b.body.data.data.map((row: Release) => row.id)).toEqual(['other']);
  });

  it('lists non-deleted manifests by linked agent, including DRAFT and unrelated destinations', async () => {
    const a = await S().get(url('manifests')).set(asA).expect(200);
    expect(a.body.data.data.map((row: Manifest) => row.id)).toEqual(['agent-a']);
    expect(a.body.data.data[0]).toMatchObject({ status: 'DRAFT', pod: { id: 'port-b' }, totalWeight: 42 });
    expect(a.body.data.data[0].departureDate).toBe(at.toISOString());
    expect(prisma.manifest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { agentId: 'agent-a', deletedAt: null },
    }));
    expect(prisma.manifest.count).toHaveBeenCalledWith({ where: { agentId: 'agent-a', deletedAt: null } });
    const b = await S().get(url('manifests')).set(asB).expect(200);
    expect(b.body.data.data.map((row: Manifest) => row.id)).toEqual(['agent-b']);
  });

  it('exposes configured non-DRAFT B/L labels, or an explicit empty state if none exist', async () => {
    const a = await S().get(url('bl-labels')).set(asA).expect(200);
    expect(a.body.data.data).toEqual([
      { code: 'APPROVED', label: 'Approved', sortOrder: 2 },
      { code: 'CANCELLED', label: 'Cancelled', sortOrder: 3 },
    ]);
    expect(a.body.data.emptyState).toBeNull();
    expect(prisma.blLifecycleLabel.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { code: { not: 'DRAFT' } },
    }));
    state.labels = [];
    const empty = await S().get(url('bl-labels')).set(asA).expect(200);
    expect(empty.body.data).toEqual({ data: [], emptyState: { reason: 'NO_LABELS' } });
  });

  it('rejects request-supplied agent/destination and invalid pagination before document reads', async () => {
    for (const resource of ['bills-of-lading', 'release-orders', 'manifests']) {
      for (const query of [
        '?agentId=agent-b', '?destinationPortId=port-b', '?billOfLadingId=other',
        '?status=DRAFT', '?page=0', '?pageSize=101', '?page=abc',
      ]) {
        await S().get(url(resource) + query).set(asA).expect(400);
      }
    }
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.agentDestination.findMany).not.toHaveBeenCalled();
  });

  it('paginates scoped results and distinguishes no documents from an out-of-range page', async () => {
    const page2 = await S().get(url('bills-of-lading') + '?page=2&pageSize=1').set(asA).expect(200);
    expect(page2.body.data.data.map((row: Bill) => row.id)).toEqual(['cancelled-own']);
    expect(page2.body.data.meta).toEqual({ page: 2, pageSize: 1, totalItems: 2, totalPages: 2 });
    const outOfRange = await S().get(url('release-orders') + '?page=9&pageSize=1').set(asA).expect(200);
    expect(outOfRange.body.data.data).toEqual([]);
    expect(outOfRange.body.data.meta.totalItems).toBe(2);
    expect(outOfRange.body.data.emptyState).toEqual({ reason: 'PAGE_OUT_OF_RANGE' });
    for (const resource of ['bills-of-lading', 'release-orders', 'manifests']) {
      const none = await S().get(url(resource)).set({ Authorization: 'Bearer c' }).expect(200);
      expect(none.body.data.data).toEqual([]);
      expect(none.body.data.emptyState).toEqual({ reason: 'NO_DOCUMENTS' });
    }
  });
});
