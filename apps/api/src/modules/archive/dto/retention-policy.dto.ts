import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** PATCH semantics: omitted leaves unchanged, null disables only where legal. */
export class UpdateRetentionPolicyDto {
  @ApiPropertyOptional({ description: 'Compliance-supplied minimum in days; never seeded or reducible' })
  @IsOptional() @IsInt() @Min(1) @Max(365000)
  minimumDays?: number | null;

  @ApiPropertyOptional({ description: 'Only LETTER; null disables automatic archiving' })
  @IsOptional() @IsInt() @Min(1) @Max(365000)
  archiveAfterDays?: number | null;

  @ApiPropertyOptional({ description: 'Compliance threshold, not permission to purge files' })
  @IsOptional() @IsInt() @Min(1) @Max(365000)
  secureDeleteAfterDays?: number | null;

  @ApiPropertyOptional({ description: 'Documented legal/accounting/security authority, required for minimumDays' })
  @IsOptional() @IsString() @MinLength(10) @MaxLength(500)
  authority?: string | null;

  @ApiPropertyOptional({ description: 'Required for identity-document capture with a configured period' })
  @IsOptional() @IsString() @MinLength(10) @MaxLength(500)
  lawfulBasis?: string | null;
}

export const RETENTION_SCOPES = [
  'LETTER', 'IDENTITY_DOCUMENT', 'DOCUMENT_ASSET', 'DOCUMENT_TEMPLATE',
  'ISSUED_OUTPUT', 'FINANCE', 'AUDIT',
] as const;
export type RetentionScope = typeof RETENTION_SCOPES[number];
