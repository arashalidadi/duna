import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Delivery Order (D/O) ─────────────────────────────────────────────────────

export class CreateDeliveryOrderDto {
  @ApiProperty({ description: 'B/L to hand cargo over against' })
  @IsString()
  @IsNotEmpty()
  billOfLadingId!: string;

  @ApiProperty({ description: 'Party physically receiving the cargo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  recipient!: string;

  @ApiPropertyOptional({ description: 'Optional customer link for the recipient' })
  @IsOptional()
  @IsString()
  recipientId?: string;

  @ApiPropertyOptional({ description: 'Pickup vehicle plate' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  vehiclePlate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueDate?: string;
}

export class UpdateDeliveryOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  recipient?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  vehiclePlate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issueDate?: string;
}

// ── Release Order (R/O) ──────────────────────────────────────────────────────

export class CreateReleaseOrderDto {
  @ApiProperty({ description: 'B/L to release' })
  @IsString()
  @IsNotEmpty()
  billOfLadingId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Bypass the fully-paid guard (needs release:override)' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiPropertyOptional({ description: 'Required when force=true' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;
}

export class UpdateReleaseOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  releaseDate?: string;
}

// ── shared ───────────────────────────────────────────────────────────────────

export class CancelDocDto {
  @ApiProperty({ description: 'Cancellation reason' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
