import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { STORAGE_ADAPTER_TOKEN } from '../storage/storage.token';
import type { AuthenticatedUser } from '../../auth/types';
import { auditExportWindow, MAX_AUDIT_EXPORT_ROWS, renderAuditCsv } from './audit-export';
import type { AuditExportQueryDto } from './dto/audit-export-query.dto';
import type { StorageAdapter } from '../storage/storage-adapter.interface';
import type {
  AuditContext,
  AuditLogRecord,
  AuditQueryOptions,
  AuditResult,
} from './audit.types';

/**
 * Append-only audit log (ADR-010). Records are written in the same
 * transaction as the mutation they describe and are never edited or
 * deleted through the application.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  private readonly selectAll = {
    id: true,
    actorId: true,
    actorEmail: true,
    action: true,
    entityType: true,
    entityId: true,
    timestamp: true,
    beforeData: true,
    afterData: true,
    metadata: true,
    ipAddress: true,
    userAgent: true,
    createdAt: true,
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER_TOKEN) private readonly storage: StorageAdapter
  ) {}

  makeId(): string {
    return Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 10);
  }

  toPrismaJson(v: unknown): unknown {
    if (v === null || v === undefined) return { null: true };
    return v;
  }

  async record(ctx: AuditContext): Promise<void> {
    if (!ctx.action || !ctx.entityType || !ctx.entityId || !ctx.actorId || !ctx.actorEmail) {
      throw new BadRequestException(
        'Audit record requires action, entityType, entityId, actorId, and actorEmail'
      );
    }
    await this.prisma.auditLog.create({
      data: {
        id: this.makeId(),
        actorId: ctx.actorId,
        actorEmail: ctx.actorEmail,
        action: ctx.action,
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        timestamp: new Date(),
        beforeData: this.toPrismaJson(ctx.beforeData) as never,
        afterData: this.toPrismaJson(ctx.afterData) as never,
        metadata: this.toPrismaJson(ctx.metadata ?? {}) as never,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });
  }

  /**
   * P4-U6: identical to record(), but written through a caller-owned transaction so
   * the audit row and the mutation it describes COMMIT TOGETHER (the ADR-010 promise
   * this service's header documents — record() itself always uses the outer client,
   * i.e. runs post-commit). First business-module caller: B/L release (ADR-046
   * ruling 2) and the audited ReleaseOrder override (ruling 3).
   */
  async recordIn(tx: Prisma.TransactionClient, ctx: AuditContext): Promise<void> {
    if (!ctx.action || !ctx.entityType || !ctx.entityId || !ctx.actorId || !ctx.actorEmail) {
      throw new BadRequestException(
        'Audit record requires action, entityType, entityId, actorId, and actorEmail'
      );
    }
    await tx.auditLog.create({
      data: {
        id: this.makeId(),
        actorId: ctx.actorId,
        actorEmail: ctx.actorEmail,
        action: ctx.action,
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        timestamp: new Date(),
        beforeData: this.toPrismaJson(ctx.beforeData) as never,
        afterData: this.toPrismaJson(ctx.afterData) as never,
        metadata: this.toPrismaJson(ctx.metadata ?? {}) as never,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });
  }

  async recordMany(contexts: AuditContext[]): Promise<void> {
    if (!contexts.length) return;
    await this.prisma.auditLog.createMany({
      data: contexts.map((ctx) => ({
        id: this.makeId(),
        actorId: ctx.actorId,
        actorEmail: ctx.actorEmail,
        action: ctx.action,
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        timestamp: new Date(),
        beforeData: this.toPrismaJson(ctx.beforeData) as never,
        afterData: this.toPrismaJson(ctx.afterData) as never,
        metadata: this.toPrismaJson(ctx.metadata ?? {}) as never,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
      })),
    });
  }

  async forEntity(
    entityType: string,
    entityId: string,
    options?: AuditQueryOptions
  ): Promise<AuditResult> {
    const limit = Math.min(options?.limit ?? 100, 500);
    const offset = options?.offset ?? 0;
    const where = {
      entityType,
      entityId,
      ...(options?.action ? { action: options.action } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items: items as AuditLogRecord[], total };
  }

  async byActor(actorId: string, options?: AuditQueryOptions): Promise<AuditResult> {
    const limit = Math.min(options?.limit ?? 100, 500);
    const offset = options?.offset ?? 0;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where: { actorId },
        orderBy: { timestamp: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.auditLog.count({ where: { actorId } }),
    ]);
    return { items: items as AuditLogRecord[], total };
  }

  /**
   * DEC-044..048 / DEC-116 — filtered audit query.
   *
   * Exists so that the primary administrator (who is explicitly required to be
   * able to "review relevant audit records") and any user holding `audit:read`
   * can actually browse the audit trail. Without this the service could write
   * audit rows but nothing could read them back.
   *
   * Read-only: the audit log is append-only (DEC-047/048). This method never
   * mutates and never deletes.
   */
  async query(filters: {
    action?: string;
    entityType?: string;
    entityId?: string;
    actorId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditResult> {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const offset = Math.max(filters.offset ?? 0, 0);

    const where: Prisma.AuditLogWhereInput = {
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.from || filters.to
        ? {
            timestamp: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items: items as AuditLogRecord[], total };
  }

  /**
   * P11: separately permissioned, logged, deterministic CSV export. Reading a
   * page and recording who prepared it commit together; there is no unlogged
   * successful read and a failed audit insert does not return sensitive rows.
   */
  async exportCsv(filters: AuditExportQueryDto, actor: AuthenticatedUser,
    request: { ipAddress?: string | null; userAgent?: string | null }) {
    const range = auditExportWindow(filters.from, filters.to);
    const limit = filters.limit ?? 500;
    const offset = filters.offset ?? 0;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_AUDIT_EXPORT_ROWS ||
      !Number.isSafeInteger(offset) || offset < 0 || offset > 2147483647) {
      throw new BadRequestException('Invalid audit export page');
    }
    // Never interpolate filters into SQL. Timestamp + unique ID gives a stable
    // order; the fixed past time window excludes new writes during pagination.
    const where: Prisma.AuditLogWhereInput = {
      timestamp: { gte: range.from, lte: range.to },
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.auditLog.findMany({ where, select: this.selectAll,
        orderBy: [{ timestamp: 'asc' }, { id: 'asc' }], skip: offset, take: limit + 1 });
      const rows = batch.slice(0, limit);
      const hasMore = batch.length > limit;
      await this.recordIn(tx, { action: 'audit.export', entityType: 'AuditLog',
        entityId: 'export', actorId: actor.id, actorEmail: actor.email,
        metadata: { from: range.from.toISOString(), to: range.to.toISOString(),
          filters: { action: filters.action ?? null, entityType: filters.entityType ?? null,
            entityId: filters.entityId ?? null, actorId: filters.actorId ?? null },
          offset, preparedRows: rows.length, hasMore },
        ipAddress: request.ipAddress ?? null, userAgent: request.userAgent ?? null });
      return { csv: renderAuditCsv(rows as AuditLogRecord[]), hasMore,
        nextOffset: hasMore ? offset + rows.length : null };
    });
  }

  async byTimeRange(
    start: Date,
    end: Date,
    options?: AuditQueryOptions
  ): Promise<AuditResult> {
    const limit = Math.min(options?.limit ?? 100, 500);
    const offset = options?.offset ?? 0;
    const where = {
      timestamp: { gte: start, lte: end },
      ...(options?.entityType ? { entityType: options.entityType } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items: items as AuditLogRecord[], total };
  }
}
