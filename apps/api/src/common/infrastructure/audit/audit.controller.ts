import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

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
 * Read-only by construction: there is no create, update or delete route. The
 * audit log is append-only (DEC-047 tamper resistance; DEC-048 corrections create
 * new events rather than erasing history).
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
