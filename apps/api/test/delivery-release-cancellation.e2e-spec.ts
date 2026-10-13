import { CanActivate, ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthenticatedUser } from '../src/common/auth/types';
import { PermissionsGuard } from '../src/common/auth/guards/permissions.guard';
import { AuditService } from '../src/common/infrastructure/audit/audit.service';
import { STORAGE_ADAPTER_TOKEN } from '../src/common/infrastructure/storage/storage.token';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';
import { DeliveryOrderController } from '../src/modules/delivery-release/delivery-order.controller';
import { ReleaseOrderController } from '../src/modules/delivery-release/release-order.controller';
import { DeliveryReleaseService } from '../src/modules/delivery-release/delivery-release.service';

/** HTTP contract and transaction tests with a rollback-capable in-memory Prisma stub.
 * No database is opened or changed; the real PostgreSQL E2E remains in delivery-release.e2e-spec.ts.
 */
type Status = 'ISSUED' | 'CANCELLED';
type Document = {
  id: string;
  docNumber: string;
  billOfLadingId: string;
  status: Status;
  cancelReason: string | null;
  cancelledById: string | null;
  cancelledAt: Date | null;
  deletedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  notes: string | null;
  billOfLading: { id: string; billNumber: string; status: 'APPROVED' };
};
type Delivery = Document & {
  issueDate: Date;
  recipient: string;
  recipientId: null;
  vehiclePlate: null;
  portId: string;
  portName: string;
  recipientCustomer: null;
};
type Release = Document & {
  releaseDate: Date;
  paymentState: 'PAID';
  financialOverride: false;
  overrideReason: null;
};
type AuditRow = {
  actorId: string;
  actorEmail: string;
  entityId: string;
  entityType: string;
  action: string;
  timestamp: Date;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
};
type State = { delivery: Delivery; release: Release; audits: AuditRow[] };

function initialState(): State {
  const at = new Date('2026-10-13T09:00:00Z');
  const common: Document = {
    id: 'unused', docNumber: 'unused', billOfLadingId: 'bill-1', status: 'ISSUED',
    cancelReason: null, cancelledById: null, cancelledAt: null, deletedAt: null,
    createdById: 'creator-1', createdAt: at, updatedAt: at, notes: null,
    billOfLading: { id: 'bill-1', billNumber: 'BOL-1', status: 'APPROVED' },
  };
  return {
    delivery: {
      ...common, id: 'do-1', docNumber: 'DO-2601-00001', issueDate: at,
      recipient: 'Test recipient', recipientId: null, vehiclePlate: null,
      portId: 'port-1', portName: 'Test Port', recipientCustomer: null,
    },
    release: {
      ...common, id: 'ro-1', docNumber: 'RO-2601-00001', releaseDate: at,
      paymentState: 'PAID', financialOverride: false, overrideReason: null,
    },
    audits: [],
  };
}

class TestAuthenticationGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const http = ctx.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();
    const role = http.headers.authorization;
    if (role !== 'Bearer canceller' && role !== 'Bearer reader') {
      throw new UnauthorizedException('Authentication required');
    }
    http.user = {
      id: role === 'Bearer canceller' ? 'canceller-1' : 'reader-1',
      email: role === 'Bearer canceller' ? 'canceller@example.test' : 'reader@example.test',
      roles: [],
      permissions: role === 'Bearer canceller'
        ? ['delivery:read', 'delivery:cancel', 'delivery:delete', 'release:read', 'release:cancel', 'release:delete']
        : ['delivery:read', 'release:read'],
      isPrimaryAdmin: false,
    };
    return true;
  }
}

describe('Delivery/Release cancellation integrity (HTTP, no database)', () => {
  let app: INestApplication;
  let service: DeliveryReleaseService;
  let state = initialState();
  let failAudit = false;
  let staleUpdate = false;
  let transactionCount = 0;

  function model(draft: State, key: 'delivery' | 'release') {
    return {
      findFirst: async ({ where }: { where: { id: string; deletedAt: null } }) => {
        const row = draft[key];
        // Prisma query results are separate objects, not mutable references to stored rows.
        return row.id === where.id && row.deletedAt === null ? structuredClone(row) : null;
      },
      updateMany: async ({ where, data }: {
        where: { id: string; status: Status; deletedAt: null };
        data: { status: Status; cancelReason: string; cancelledById: string; cancelledAt: Date };
      }) => {
        const row = draft[key];
        if (staleUpdate || row.id !== where.id || row.deletedAt !== null || row.status !== where.status) {
          return { count: 0 };
        }
        Object.assign(row, data);
        return { count: 1 };
      },
    };
  }

  function makeTransaction(draft: State) {
    return {
      deliveryOrder: model(draft, 'delivery'),
      releaseOrder: model(draft, 'release'),
      auditLog: {
        create: async ({ data }: { data: AuditRow }) => {
          if (failAudit) throw new Error('in-memory audit write failed');
          draft.audits.push(data);
          return data;
        },
      },
    };
  }

  const prisma = {
    $transaction: async (callback: (tx: ReturnType<typeof makeTransaction>) => Promise<unknown>) => {
      transactionCount++;
      const draft = structuredClone(state);
      const result = await callback(makeTransaction(draft));
      state = draft; // Commit only if both the status update and the audit write succeed.
      return result;
    },
    deliveryOrder: {
      findFirst: async ({ where }: { where: { id: string; deletedAt: null } }) =>
        state.delivery.id === where.id && state.delivery.deletedAt === null ? state.delivery : null,
    },
    releaseOrder: {
      findFirst: async ({ where }: { where: { id: string; deletedAt: null } }) =>
        state.release.id === where.id && state.release.deletedAt === null ? state.release : null,
    },
    invoice: { findMany: async () => [] },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DeliveryOrderController, ReleaseOrderController],
      providers: [
        DeliveryReleaseService,
        AuditService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_ADAPTER_TOKEN, useValue: {} },
      ],
    }).compile();
    service = module.get(DeliveryReleaseService);
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalGuards(new TestAuthenticationGuard(), new PermissionsGuard(app.get(Reflector)));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  beforeEach(() => {
    state = initialState();
    failAudit = false;
    staleUpdate = false;
    transactionCount = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  const S = () => request(app.getHttpServer());
  const asCanceller = { Authorization: 'Bearer canceller' };
  const asReader = { Authorization: 'Bearer reader' };

  for (const config of [
    { path: 'delivery-orders', key: 'delivery', id: 'do-1', entity: 'DeliveryOrder', action: 'delivery:cancel', docNumber: 'DO-2601-00001' },
    { path: 'release-orders', key: 'release', id: 'ro-1', entity: 'ReleaseOrder', action: 'release:cancel', docNumber: 'RO-2601-00001' },
  ] as const) {
    describe(config.entity, () => {
      const url = `/api/v1/${config.path}/${config.id}`;
      const reason = 'customer request';

      it('rejects unauthorized cancellation/deletion and blank or missing reasons without writing', async () => {
        await S().post(`${url}/cancel`).send({ reason }).expect(401);
        await S().post(`${url}/cancel`).set(asReader).send({ reason }).expect(403);
        await S().delete(url).expect(401);
        await S().delete(url).set(asReader).expect(403);
        for (const body of [{}, { reason: '' }, { reason: '\t \n  ' }]) {
          await S().post(`${url}/cancel`).set(asCanceller).send(body).expect(400);
        }
        const unchanged = await S().get(url).set(asReader).expect(200);
        expect(unchanged.body.data.status).toBe('ISSUED');
        expect(unchanged.body.data.cancelReason).toBeNull();
        expect(transactionCount).toBe(0);
        expect(state.audits).toHaveLength(0);
      });

      it('audits the cancellation atomically and retains the document despite DELETE attempts', async () => {
        await S().delete(url).set(asCanceller).expect(405);
        const response = await S().post(`${url}/cancel`).set(asCanceller)
          .send({ reason: `  ${reason}  ` }).expect(200);
        expect(response.body.data.status).toBe('CANCELLED');
        expect(response.body.data.cancelReason).toBe(reason);
        expect(response.body.data.cancelledById).toBe('canceller-1');
        const cancelledAt = response.body.data.cancelledAt;
        expect(new Date(cancelledAt).getTime()).not.toBeNaN();
        expect(transactionCount).toBe(1);

        await S().post(`${url}/cancel`).set(asCanceller).send({ reason: 'again' }).expect(409);
        await S().delete(url).set(asCanceller).expect(405);
        const retained = await S().get(url).set(asReader).expect(200);
        expect(retained.body.data.status).toBe('CANCELLED');
        expect(retained.body.data.cancelReason).toBe(reason);
        expect(retained.body.data.cancelledAt).toBe(cancelledAt);
        const persisted = state[config.key];
        expect(persisted.cancelReason).toBe(reason);
        expect(persisted.cancelledAt?.toISOString()).toBe(cancelledAt);
        expect(state.audits).toHaveLength(1);
        const audit = state.audits[0];
        expect(audit).toMatchObject({
          action: config.action, entityType: config.entity, entityId: config.id,
          actorId: 'canceller-1', actorEmail: 'canceller@example.test',
        });
        expect(audit.timestamp).toBeInstanceOf(Date);
        expect(audit.beforeData).toMatchObject({ status: 'ISSUED', cancelledAt: null });
        expect(audit.afterData).toMatchObject({
          status: 'CANCELLED', cancelReason: reason, cancelledById: 'canceller-1', cancelledAt,
        });
        expect(audit.metadata).toMatchObject({
          docNumber: config.docNumber, billOfLadingId: 'bill-1', reason, cancelledAt,
        });
      });

      it('rolls back the cancellation if audit creation fails', async () => {
        failAudit = true;
        const actor = { userId: 'canceller-1', actorEmail: 'canceller@example.test' };
        if (config.key === 'delivery') {
          await expect(service.cancelDelivery(config.id, { reason }, actor)).rejects.toThrow('in-memory audit write failed');
        } else {
          await expect(service.cancelRelease(config.id, { reason }, actor)).rejects.toThrow('in-memory audit write failed');
        }
        expect(transactionCount).toBe(1);
        expect(state[config.key].status).toBe('ISSUED');
        expect(state.audits).toHaveLength(0);
      });

      it('does not write audit when the conditional update loses a cancellation race', async () => {
        staleUpdate = true;
        await S().post(`${url}/cancel`).set(asCanceller).send({ reason }).expect(409);
        expect(transactionCount).toBe(1);
        expect(state[config.key].status).toBe('ISSUED');
        expect(state.audits).toHaveLength(0);
      });
    });
  }
});
