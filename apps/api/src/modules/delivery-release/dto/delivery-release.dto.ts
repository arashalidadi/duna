import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Delivery Order (D/O) ─────────────────────────────────────────────────────

/** Payment condition recorded at release (REQ-182, EMP-685..689). Keep in step with packages/shared. */
export const RELEASE_PAYMENT_STATES = ['PAID', 'PARTIAL', 'UNPAID'] as const;

export class CreateDeliveryOrderDto {
  @ApiProperty({ description: 'B/L to hand cargo over against' })
  @IsString()
  @IsNotEmpty()
  billOfLadingId!: string;

  @ApiProperty({ description: 'Port stated on the delivery order (REQ-186), from the Ports master' })
  @IsString()
  @IsNotEmpty()
  portId!: string;

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

  @ApiProperty({ enum: RELEASE_PAYMENT_STATES, description: 'Payment condition recorded at release (REQ-182)' })
  @IsIn([...RELEASE_PAYMENT_STATES])
  paymentState!: (typeof RELEASE_PAYMENT_STATES)[number];

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

  @ApiPropertyOptional({ description: 'Additive custom field values written only at release creation; never part of financial policy' })
  @IsOptional()
  @IsObject()
  customValues?: Record<string, unknown>;
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
  @Matches(/\S/, { message: 'reason must contain a non-whitespace character' })
  @MaxLength(500)
  reason!: string;
}
