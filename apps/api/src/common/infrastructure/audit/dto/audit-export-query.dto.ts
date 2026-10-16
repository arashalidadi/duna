import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MAX_AUDIT_EXPORT_ROWS } from '../audit-export';

/** Export is bounded and paged; callers choose adjacent UTC windows as needed. */
export class AuditExportQueryDto {
  @ApiProperty({ description: 'Inclusive UTC timestamp (ISO-8601)' })
  @IsDateString()
  from!: string;

  @ApiProperty({ description: 'Inclusive UTC timestamp (ISO-8601), at most 31 days after from' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  actorId?: string;

  @ApiPropertyOptional({ description: `Rows per CSV page, 1-${MAX_AUDIT_EXPORT_ROWS}` })
  @IsOptional() @IsInt() @Min(1) @Max(MAX_AUDIT_EXPORT_ROWS)
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset in timestamp/id order (0-based)' })
  @IsOptional() @IsInt() @Min(0) @Max(2147483647)
  offset?: number;
}
