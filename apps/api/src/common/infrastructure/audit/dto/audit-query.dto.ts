import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Read filters for the audit review endpoint.
 *
 * DEC-044…DEC-048 / DEC-116 — the audit log is append-only and read-only; this DTO
 * therefore exposes only filters, never mutation.
 */
export class AuditQueryDto {
  @ApiPropertyOptional({ description: 'Filter by action, e.g. `role:permissions:set`' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by entity type, e.g. `Role`, `User`, `ReleaseOrder`' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: 'Filter by entity id' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Filter by the acting user id' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ description: 'ISO timestamp — only rows at or after this time' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO timestamp — only rows at or before this time' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: 'Page size, 1-500 (default 100)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ description: 'Rows to skip (default 0)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  /** Kept for forward compatibility with a future sort control. */
  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
