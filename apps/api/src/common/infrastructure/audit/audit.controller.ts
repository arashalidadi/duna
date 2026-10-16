import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditExportQueryDto } from './dto/audit-export-query.dto';

/**
 * DEC-044…DEC-048 / DEC-116 — audit review.
 *
 * The audit trail was previously write-only: AuditService could record rows, but
 * nothing could read them back. The owner's confirmed decision requires that the
 * primary administrator be able to "review relevant audit records", so this
 * read-only browse surface was added.
 *
 * Access is gated by `audit:read`. The primary administrator reaches it by
 * implicit full authority (PermissionsGuard) and needs no separate grant — but
 * they are still subject to the same audit trail as everyone else, because every
 * action they take is recorded.
 *
 * There is no create, update or delete route. A separately gated CSV export
 * appends its own audit event; database triggers reject UPDATE/DELETE/TRUNCATE
 * regardless of the caller's application permissions (DEC-047/048).
 */
@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  async query(@Query() query: AuditQueryDto) {
    const parseDate = (value?: string): Date | undefined => {
      if (!value) return undefined;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    };

    const limit = query.limit !== undefined ? Number(query.limit) : undefined;
    const offset = query.offset !== undefined ? Number(query.offset) : undefined;

    return this.auditService.query({
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      actorId: query.actorId,
      from: parseDate(query.from),
      to: parseDate(query.to),
      limit: limit !== undefined && Number.isFinite(limit) ? limit : undefined,
      offset: offset !== undefined && Number.isFinite(offset) ? offset : undefined,
    });
  }

  /** Sensitive export is separate from browsing and always records the actor. */
  @Get('export')
  @RequirePermissions(['audit:read', 'audit:export'])
  async export(@Query() query: AuditExportQueryDto, @CurrentUser() actor: AuthenticatedUser,
    @Req() req: Request, @Res() res: Response) {
    const page = await this.auditService.exportCsv(query, actor, {
      ipAddress: req.ip ?? null, userAgent: req.get('user-agent') ?? null,
    });
    res.set({ 'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="audit-export.csv"',
      'Cache-Control': 'no-store',
      'X-Audit-Export-Has-More': String(page.hasMore),
      ...(page.nextOffset !== null ? { 'X-Audit-Export-Next-Offset': String(page.nextOffset) } : {}),
    });
    res.status(200).send(page.csv);
  }

  /** Audit history for one entity — the "who changed this record" view. */
  @Get('entity/:entityType/:entityId')
  @RequirePermissions('audit:read')
  async forEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('limit') limit?: string
  ) {
    return this.auditService.forEntity(entityType, entityId, {
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  /** Everything one actor did — the "what did this person do" view. */
  @Get('actor/:actorId')
  @RequirePermissions('audit:read')
  async byActor(@Param('actorId') actorId: string, @Query('limit') limit?: string) {
    return this.auditService.byActor(actorId, {
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }
}
