import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_ADAPTER_TOKEN } from '../storage/storage.token';
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
