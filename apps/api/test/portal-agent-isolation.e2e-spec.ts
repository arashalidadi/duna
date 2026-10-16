import { randomUUID } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { BlStatus, DeliveryOrderStatus, Prisma, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AuthenticatedUser } from '../src/common/auth/types';
import { PermissionsGuard } from '../src/common/auth/guards/permissions.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PortalDocumentsController } from '../src/modules/portal/portal-documents.controller';
import { PortalDocumentsService } from '../src/modules/portal/portal-documents.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { portalIsolationTestDatabase } from './support/portal-isolation-test-db';

/**
 * Real PostgreSQL isolation test. No default DATABASE_URL, seed, migration,
 * delete/cleanup, or writes to existing rows. Every synthetic row and state
 * change lives inside a Prisma interactive transaction that ALWAYS rolls back.
 * The fixture auth guard injects principals; JWT verification and the audited
 * cancellation *write workflow* are intentionally outside this read-side test.
 */

type Fixture = {
  users: { d: string; e: string; unlinked: string; customer: string };
  agents: { d: string; e: string };
  ports: { d: string; e: string; removed: string };
  destinations: { d: string; inactive: string; removed: string };
  bills: {
    d: string;
    e: string;
    cancelled: string;
    draft: string;
    deleted: string;
    inactive: string;
    removed: string;
    noPort: string;
  };
  releases: {
    d: string;
    e: string;
    cancelled: string;
    draft: string;
    deletedBill: string;
    inactive: string;
    removed: string;
    noPort: string;
    deleted: string;
  };
  manifests: { d: string; e: string; deleted: string };
};

type Harness = {
  app: INestApplication;
  tx: Prisma.TransactionClient;
  fixture: Fixture;
  tag: string;
};

class FixtureAuthenticationGuard implements CanActivate {
  constructor(private readonly principals: Record<string, AuthenticatedUser>) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();
    const principal = this.principals[http.headers.authorization ?? ''];
    if (!principal) throw new UnauthorizedException('Authentication required');
    http.user = principal;
    return true;
  }
}

function fixturePrincipal(
  id: string,
  permissions: string[] = ['portal:access']
): AuthenticatedUser {
  return { id, email: `${id}@example.test`, roles: [], permissions, isPrimaryAdmin: false };
}

// Prisma's transaction client has no nested $transaction([read, count]). Both
// existing service reads already use this transaction's delegates/connection;
// Promise.all triggers those read-only PrismaPromises without starting a second
// transaction. The production PrismaService and query predicates are unchanged.
function transactionScopedPrisma(tx: Prisma.TransactionClient) {
  return {
    user: tx.user,
    agent: tx.agent,
    agentDestination: tx.agentDestination,
    billOfLading: tx.billOfLading,
    releaseOrder: tx.releaseOrder,
    manifest: tx.manifest,
    blLifecycleLabel: tx.blLifecycleLabel,
    $transaction: (reads: readonly PromiseLike<unknown>[]) => Promise.all(reads),
  };
}

async function createFixture(tx: Prisma.TransactionClient, tag: string): Promise<Fixture> {
  const at = new Date('2026-10-14T00:00:00Z');
  const prefix = `S5-${tag}`;
  const port = async (suffix: string) =>
    tx.port.create({
      data: { code: `${prefix}-P-${suffix}`, name: `Isolation ${suffix}`, country: 'Test fixture' },
    });
  const [portD, portE, portRemoved] = [await port('D'), await port('E'), await port('REMOVED')];
  const agentD = await tx.agent.create({
    data: { code: `${prefix}-A-D`, name: 'Isolation agent D' },
  });
  const agentE = await tx.agent.create({
    data: { code: `${prefix}-A-E`, name: 'Isolation agent E' },
  });
  const destinationD = await tx.agentDestination.create({
    data: { agentId: agentD.id, portId: portD.id },
  });
  const destinationInactive = await tx.agentDestination.create({
    data: { agentId: agentD.id, portId: portE.id, isActive: false },
  });
  const destinationRemoved = await tx.agentDestination.create({
    data: { agentId: agentD.id, portId: portRemoved.id, deletedAt: at },
  });
  await tx.agentDestination.create({ data: { agentId: agentE.id, portId: portE.id } });

  const customer = await tx.customer.create({
    data: { code: `${prefix}-C`, name: 'Isolation customer' },
  });
  const user = async (suffix: string, portalAgentId?: string, portalCustomerId?: string) =>
    tx.user.create({
      data: {
        email: `slice5-${tag}-${suffix}@example.test`,
        passwordHash: 'fixture-not-a-login',
        fullName: `Isolation ${suffix}`,
        portalAgentId,
        portalCustomerId,
      },
    });
  const userD = await user('d', agentD.id);
  const userE = await user('e', agentE.id);
  const unlinked = await user('unlinked');
  const customerUser = await user('customer', undefined, customer.id);

  const vessel = await tx.vessel.create({
    data: {
      code: `${prefix}-V`,
      name: 'Isolation vessel',
      flag: 'Test fixture',
      vesselType: 'GENERAL',
    },
  });
  const voyageD = await tx.voyage.create({
    data: {
      voyageNumber: `${prefix}-VOY-D`,
      vesselId: vessel.id,
      originPortId: portRemoved.id,
      destinationPortId: portD.id,
    },
  });
  const voyageE = await tx.voyage.create({
    data: {
      voyageNumber: `${prefix}-VOY-E`,
      vesselId: vessel.id,
      originPortId: portRemoved.id,
      destinationPortId: portE.id,
    },
  });
  const manifest = async (
    suffix: string,
    agentId: string,
    voyageId: string,
    podPortId: string,
    status: 'DRAFT' | 'APPROVED',
    deletedAt?: Date
  ) =>
    tx.manifest.create({
      data: {
        manifestNumber: `${prefix}-MAN-${suffix}`,
        voyageId,
        agentId,
        polPortId: portRemoved.id,
        podPortId,
        vesselName: vessel.name,
        status,
        deletedAt,
      },
    });
  const manifestD = await manifest('D', agentD.id, voyageD.id, portD.id, 'DRAFT');
  const manifestE = await manifest('E', agentE.id, voyageE.id, portE.id, 'APPROVED');
  const manifestDeleted = await manifest(
    'DELETED',
    agentD.id,
    voyageD.id,
    portD.id,
    'APPROVED',
    at
  );

  const bill = async (
    suffix: string,
    destinationPortId: string | null,
    status: BlStatus = 'APPROVED',
    manifestId?: string,
    deletedAt?: Date
  ) =>
    tx.billOfLading.create({
      data: {
        billNumber: `${prefix}-BL-${suffix}`,
        voyageId: voyageD.id,
        destinationPortId,
        status,
        manifestId,
        vesselName: vessel.name,
        deletedAt,
      },
    });
  // Deliberately cross-linked manifests: they must not grant B/L access.
  const billD = await bill('D', portD.id, 'APPROVED', manifestE.id);
  const billE = await bill('E', portE.id, 'APPROVED', manifestD.id);
  const billCancelled = await bill('CANCELLED', portD.id, 'CANCELLED');
  const billDraft = await bill('DRAFT', portD.id, 'DRAFT');
  const billDeleted = await bill('DELETED', portD.id, 'APPROVED', undefined, at);
  const billInactive = await bill('INACTIVE', portE.id);
  const billRemoved = await bill('REMOVED', portRemoved.id);
  const billNoPort = await bill('NO-PORT', null);

  const release = async (
    suffix: string,
    billOfLadingId: string,
    status: DeliveryOrderStatus = 'ISSUED',
    deletedAt?: Date
  ) =>
    tx.releaseOrder.create({
      data: {
        docNumber: `${prefix}-RO-${suffix}`,
        billOfLadingId,
        createdById: userD.id,
        status,
        paymentState: status === 'CANCELLED' ? 'PARTIAL' : 'PAID',
        cancelledAt: status === 'CANCELLED' ? at : null,
        cancelReason: status === 'CANCELLED' ? 'Fixture cancellation' : null,
        deletedAt,
      },
    });
  const releaseD = await release('D', billD.id);
  const releaseE = await release('E', billE.id);
  const releaseCancelled = await release('CANCELLED', billCancelled.id, 'CANCELLED');
  const releaseDraft = await release('DRAFT', billDraft.id);
  const releaseDeletedBill = await release('DELETED-BL', billDeleted.id);
  const releaseInactive = await release('INACTIVE', billInactive.id);
  const releaseRemoved = await release('REMOVED', billRemoved.id);
  const releaseNoPort = await release('NO-PORT', billNoPort.id);
  const releaseDeleted = await release('DELETED', billD.id, 'CANCELLED', at);

  return {
    users: { d: userD.id, e: userE.id, unlinked: unlinked.id, customer: customerUser.id },
    agents: { d: agentD.id, e: agentE.id },
    ports: { d: portD.id, e: portE.id, removed: portRemoved.id },
    destinations: {
      d: destinationD.id,
      inactive: destinationInactive.id,
      removed: destinationRemoved.id,
    },
    bills: {
      d: billD.id,
      e: billE.id,
      cancelled: billCancelled.id,
      draft: billDraft.id,
      deleted: billDeleted.id,
      inactive: billInactive.id,
      removed: billRemoved.id,
      noPort: billNoPort.id,
    },
    releases: {
      d: releaseD.id,
      e: releaseE.id,
      cancelled: releaseCancelled.id,
      draft: releaseDraft.id,
      deletedBill: releaseDeletedBill.id,
      inactive: releaseInactive.id,
      removed: releaseRemoved.id,
      noPort: releaseNoPort.id,
      deleted: releaseDeleted.id,
    },
    manifests: { d: manifestD.id, e: manifestE.id, deleted: manifestDeleted.id },
  };
}

const path = (resource: string) => `/api/v1/portal/${resource}`;
const auth = (principal: string) => ({ Authorization: `Bearer fixture-${principal}` });
const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort();

describe('Portal document isolation on an expressly confirmed real PostgreSQL test database', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    // This is checked BEFORE constructing PrismaClient or opening any connection.
    const { url, name } = portalIsolationTestDatabase(process.env);
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
    const rows = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database()::text AS name`;
    if (rows.length !== 1 || rows[0].name !== name) {
      throw new Error(
        'Connected database does not match the confirmed test name; no fixture was written'
      );
    }
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  async function withRolledBackFixture(check: (harness: Harness) => Promise<void>): Promise<void> {
    const tag = randomUUID().replaceAll('-', '');
    const rollback = new Error('Deliberate rollback of Slice 5 fixtures');
    let assertionsCompleted = false;

    try {
      await prisma.$transaction(
        async (tx) => {
          const fixture = await createFixture(tx, tag);
          const module = await Test.createTestingModule({
            controllers: [PortalDocumentsController],
            providers: [
              PortalDocumentsService,
              { provide: PrismaService, useValue: transactionScopedPrisma(tx) },
            ],
          }).compile();
          const app = module.createNestApplication();
          app.setGlobalPrefix('api/v1');
          app.useGlobalPipes(
            new ValidationPipe({
              whitelist: true,
              forbidNonWhitelisted: true,
              transform: true,
              transformOptions: { enableImplicitConversion: true },
            })
          );
          app.useGlobalGuards(
            new FixtureAuthenticationGuard({
              'Bearer fixture-d': fixturePrincipal(fixture.users.d),
              'Bearer fixture-e': fixturePrincipal(fixture.users.e),
              'Bearer fixture-denied': fixturePrincipal(fixture.users.d, []),
              'Bearer fixture-unlinked': fixturePrincipal(fixture.users.unlinked),
              'Bearer fixture-customer': fixturePrincipal(fixture.users.customer),
            }),
            new PermissionsGuard(app.get(Reflector))
          );
          app.useGlobalFilters(new HttpExceptionFilter());
          app.useGlobalInterceptors(new TransformInterceptor());
          try {
            await app.init();
            await check({ app, tx, fixture, tag });
            assertionsCompleted = true;
          } finally {
            await app.close();
          }
          // Even a successful assertion path cannot commit. A failed assertion or
          // app error also causes Prisma to roll back before control returns here.
          throw rollback;
        },
        { maxWait: 20_000, timeout: 120_000 }
      );
    } catch (error) {
      if (error !== rollback) throw error;
    }

    expect(assertionsCompleted).toBe(true);
    // Read-only proof from a fresh connection that no synthetic row persisted.
    expect(await prisma.user.count({ where: { email: { startsWith: `slice5-${tag}-` } } })).toBe(0);
    expect(await prisma.agent.count({ where: { code: { startsWith: `S5-${tag}-` } } })).toBe(0);
    expect(await prisma.customer.count({ where: { code: { startsWith: `S5-${tag}-` } } })).toBe(0);
    expect(await prisma.port.count({ where: { code: { startsWith: `S5-${tag}-` } } })).toBe(0);
    expect(await prisma.vessel.count({ where: { code: { startsWith: `S5-${tag}-` } } })).toBe(0);
    expect(
      await prisma.voyage.count({ where: { voyageNumber: { startsWith: `S5-${tag}-` } } })
    ).toBe(0);
    expect(
      await prisma.billOfLading.count({ where: { billNumber: { startsWith: `S5-${tag}-` } } })
    ).toBe(0);
    expect(
      await prisma.releaseOrder.count({ where: { docNumber: { startsWith: `S5-${tag}-` } } })
    ).toBe(0);
    expect(
      await prisma.manifest.count({ where: { manifestNumber: { startsWith: `S5-${tag}-` } } })
    ).toBe(0);
  }

  it('separates D/E B/Ls, releases, manifests and counts through real relation filters', async () => {
    await withRolledBackFixture(async ({ app, fixture: f }) => {
      const S = () => request(app.getHttpServer());
      const dBills = await S().get(path('bills-of-lading')).set(auth('d')).expect(200);
      expect(ids(dBills.body.data.data)).toEqual([f.bills.d, f.bills.cancelled].sort());
      expect(dBills.body.data.meta.totalItems).toBe(2);
      const dActive = dBills.body.data.data.find((row: { id: string }) => row.id === f.bills.d);
      expect(dActive).toMatchObject({
        hasActiveRelease: true,
        activeRelease: { id: f.releases.d },
      });
      expect(dActive).not.toHaveProperty('manifestAgentId');
      expect(dActive.activeRelease).not.toHaveProperty('overrideReason');
      const dCancelled = dBills.body.data.data.find(
        (row: { id: string }) => row.id === f.bills.cancelled
      );
      expect(dCancelled).toMatchObject({
        status: 'CANCELLED',
        hasActiveRelease: false,
        activeRelease: null,
      });

      const eBills = await S().get(path('bills-of-lading')).set(auth('e')).expect(200);
      expect(ids(eBills.body.data.data)).toEqual([f.bills.e, f.bills.inactive].sort());
      expect(eBills.body.data.meta.totalItems).toBe(2);
      const dReleases = await S().get(path('release-orders')).set(auth('d')).expect(200);
      expect(ids(dReleases.body.data.data)).toEqual([f.releases.d, f.releases.cancelled].sort());
      expect(dReleases.body.data.meta.totalItems).toBe(2);
      const cancelled = dReleases.body.data.data.find(
        (row: { id: string }) => row.id === f.releases.cancelled
      );
      expect(cancelled).toMatchObject({ status: 'CANCELLED', paymentState: 'PARTIAL' });
      expect(cancelled.cancelledAt).not.toBeNull();
      expect(cancelled).not.toHaveProperty('overrideReason');
      const eReleases = await S().get(path('release-orders')).set(auth('e')).expect(200);
      expect(ids(eReleases.body.data.data)).toEqual([f.releases.e, f.releases.inactive].sort());
      expect(eReleases.body.data.meta.totalItems).toBe(2);

      const dManifests = await S().get(path('manifests')).set(auth('d')).expect(200);
      expect(ids(dManifests.body.data.data)).toEqual([f.manifests.d]);
      expect(dManifests.body.data.data[0].status).toBe('DRAFT');
      const eManifests = await S().get(path('manifests')).set(auth('e')).expect(200);
      expect(ids(eManifests.body.data.data)).toEqual([f.manifests.e]);
      expect(eManifests.body.data.meta.totalItems).toBe(1);

      for (const resource of ['bills-of-lading', 'release-orders']) {
        const page = await S()
          .get(path(resource))
          .query({ page: 2, pageSize: 1 })
          .set(auth('d'))
          .expect(200);
        expect(page.body.data.data).toHaveLength(1);
        expect(page.body.data.meta).toEqual({ page: 2, pageSize: 1, totalItems: 2, totalPages: 2 });
        const beyond = await S()
          .get(path(resource))
          .query({ page: 3, pageSize: 1 })
          .set(auth('d'))
          .expect(200);
        expect(beyond.body.data.data).toEqual([]);
        expect(beyond.body.data.emptyState).toEqual({ reason: 'PAGE_OUT_OF_RANGE' });
      }
      // The caller cannot select a different agent or destination via query params.
      for (const resource of ['bills-of-lading', 'release-orders', 'manifests']) {
        await S().get(path(resource)).query({ agentId: f.agents.e }).set(auth('d')).expect(400);
        await S()
          .get(path(resource))
          .query({ destinationPortId: f.ports.e })
          .set(auth('d'))
          .expect(400);
      }
    });
  }, 180_000);

  it('denies anonymous, unpermitted, unlinked and inactive principals; customer-only is explicit', async () => {
    await withRolledBackFixture(async ({ app, tx, fixture: f }) => {
      const S = () => request(app.getHttpServer());
      for (const resource of ['bills-of-lading', 'release-orders', 'manifests', 'bl-labels']) {
        await S().get(path(resource)).expect(401);
        await S().get(path(resource)).set(auth('invalid')).expect(401);
        await S().get(path(resource)).set(auth('denied')).expect(403);
        await S().get(path(resource)).set(auth('unlinked')).expect(403);
        const customer = await S().get(path(resource)).set(auth('customer')).expect(200);
        expect(customer.body.data.data).toEqual([]);
        expect(customer.body.data.emptyState).toEqual({ reason: 'CUSTOMER_ONLY' });
      }
      await tx.user.update({ where: { id: f.users.d }, data: { isActive: false } });
      await S().get(path('bills-of-lading')).set(auth('d')).expect(403);
      await tx.user.update({ where: { id: f.users.d }, data: { isActive: true } });
      await tx.agent.update({ where: { id: f.agents.d }, data: { isActive: false } });
      await S().get(path('release-orders')).set(auth('d')).expect(403);
      await tx.agent.update({
        where: { id: f.agents.d },
        data: { isActive: true, deletedAt: new Date() },
      });
      await S().get(path('manifests')).set(auth('d')).expect(403);
      await S().get(path('bills-of-lading')).set(auth('e')).expect(200);
    });
  }, 180_000);

  it('refreshes destination visibility and active release state after fixture-only transitions', async () => {
    await withRolledBackFixture(async ({ app, tx, fixture: f, tag }) => {
      const S = () => request(app.getHttpServer());
      const bills = () => S().get(path('bills-of-lading')).set(auth('d'));
      const releases = () => S().get(path('release-orders')).set(auth('d'));
      expect(ids((await bills().expect(200)).body.data.data)).toEqual(
        [f.bills.d, f.bills.cancelled].sort()
      );

      // Read-side transition only. This does NOT exercise the audited office
      // cancellation command; only this uncommitted fixture row is updated.
      await tx.releaseOrder.update({
        where: { id: f.releases.d },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Fixture transition' },
      });
      const afterCancel = await bills().expect(200);
      expect(
        afterCancel.body.data.data.find((row: { id: string }) => row.id === f.bills.d)
      ).toMatchObject({ hasActiveRelease: false, activeRelease: null });
      expect(
        (await releases().expect(200)).body.data.data.find(
          (row: { id: string }) => row.id === f.releases.d
        )
      ).toMatchObject({ status: 'CANCELLED' });
      // A later issued release is active; the cancelled history remains visible.
      const replacement = await tx.releaseOrder.create({
        data: {
          docNumber: `S5-${tag}-RO-REPLACEMENT`,
          billOfLadingId: f.bills.d,
          createdById: f.users.d,
          status: 'ISSUED',
          paymentState: 'UNPAID',
        },
      });
      const afterReissue = await bills().expect(200);
      expect(
        afterReissue.body.data.data.find((row: { id: string }) => row.id === f.bills.d)
      ).toMatchObject({
        hasActiveRelease: true,
        activeRelease: { id: replacement.id, paymentState: 'UNPAID' },
      });
      expect(ids((await releases().expect(200)).body.data.data)).toEqual(
        [f.releases.d, f.releases.cancelled, replacement.id].sort()
      );

      await tx.agentDestination.update({
        where: { id: f.destinations.d },
        data: { isActive: false },
      });
      for (const resource of ['bills-of-lading', 'release-orders']) {
        const empty = await S().get(path(resource)).set(auth('d')).expect(200);
        expect(empty.body.data.data).toEqual([]);
        expect(empty.body.data.emptyState).toEqual({ reason: 'NO_ACTIVE_DESTINATIONS' });
      }
      // Manifest ownership is independent of destination activation.
      expect(
        ids((await S().get(path('manifests')).set(auth('d')).expect(200)).body.data.data)
      ).toEqual([f.manifests.d]);
      expect(
        ids((await S().get(path('bills-of-lading')).set(auth('e')).expect(200)).body.data.data)
      ).toEqual([f.bills.e, f.bills.inactive].sort());

      await tx.agentDestination.update({
        where: { id: f.destinations.inactive },
        data: { isActive: true },
      });
      expect(ids((await bills().expect(200)).body.data.data)).toEqual(
        [f.bills.e, f.bills.inactive].sort()
      );
      expect(ids((await releases().expect(200)).body.data.data)).toEqual(
        [f.releases.e, f.releases.inactive].sort()
      );
      // Deleted destinations remain excluded, even when their isActive flag is true.
      expect((await bills().expect(200)).body.data.data).not.toContainEqual(
        expect.objectContaining({ id: f.bills.removed })
      );
      await tx.agentDestination.update({
        where: { id: f.destinations.inactive },
        data: { isActive: false },
      });
      await tx.agentDestination.update({
        where: { id: f.destinations.d },
        data: { isActive: true },
      });
      expect(ids((await bills().expect(200)).body.data.data)).toEqual(
        [f.bills.d, f.bills.cancelled].sort()
      );
    });
  }, 180_000);
});
