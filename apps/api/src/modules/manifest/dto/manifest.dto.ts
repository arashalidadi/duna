import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Cost fields arrive as strings from the UI (Decimal inputs) — coerce to number.
 * '' -> undefined (skip), null stays null (clear), numeric strings -> Number.
 */
const ToCost = () =>
  Transform(({ value }) => {
    if (value === null) return null;
    if (value === '' || value === undefined) return undefined;
    return Number(value);
  });

const ManifestStatusValues = ['DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED'] as const;

export class CreateManifestDto {
  @ApiProperty({ description: 'ID of the Voyage this manifest covers' })
  @IsNotEmpty()
  @IsString()
  voyageId: string;

  @ApiPropertyOptional({ description: 'Shipper customer ID (legacy shipper)' })
  @IsOptional()
  @IsString()
  shipperId?: string;

  @ApiPropertyOptional({ description: 'Consignee customer ID (legacy consignee)' })
  @IsOptional()
  @IsString()
  consigneeId?: string;

  @ApiPropertyOptional({ description: 'Agent customer ID (legacy agent)' })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({ description: 'Notify party (free text, legacy notify_party)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notifyParty?: string;

  @ApiPropertyOptional({ description: 'Description (legacy descr)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ description: 'Gas cost', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gasCost?: number;

  @ApiPropertyOptional({ description: 'Lashing cost', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lashingCost?: number;

  @ApiPropertyOptional({ description: 'Shipper cost', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shipperCost?: number;

  @ApiPropertyOptional({ description: 'POD cost', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  podCost?: number;

  @ApiPropertyOptional({ description: 'POL cost', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  polCost?: number;

  @ApiPropertyOptional({ description: 'ISO 4217 currency code for costs' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateManifestDto {
  @ApiPropertyOptional({ description: 'Shipper customer ID (null to clear)' })
  @IsOptional()
  @IsString()
  shipperId?: string | null;

  @ApiPropertyOptional({ description: 'Consignee customer ID (null to clear)' })
  @IsOptional()
  @IsString()
  consigneeId?: string | null;

  @ApiPropertyOptional({ description: 'Agent customer ID (null to clear)' })
  @IsOptional()
  @IsString()
  agentId?: string | null;

  @ApiPropertyOptional({ description: 'Notify party (null to clear)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notifyParty?: string | null;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @ApiPropertyOptional({ description: 'Gas cost', minimum: 0 })
  @IsOptional()
  @ToCost()
  @IsNumber()
  @Min(0)
  gasCost?: number | null;

  @ApiPropertyOptional({ description: 'Lashing cost', minimum: 0 })
  @IsOptional()
  @ToCost()
  @IsNumber()
  @Min(0)
  lashingCost?: number | null;

  @ApiPropertyOptional({ description: 'Shipper cost', minimum: 0 })
  @IsOptional()
  @ToCost()
  @IsNumber()
  @Min(0)
  shipperCost?: number | null;

  @ApiPropertyOptional({ description: 'POD cost', minimum: 0 })
  @IsOptional()
  @ToCost()
  @IsNumber()
  @Min(0)
  podCost?: number | null;

  @ApiPropertyOptional({ description: 'POL cost', minimum: 0 })
  @IsOptional()
  @ToCost()
  @IsNumber()
  @Min(0)
  polCost?: number | null;

  @ApiPropertyOptional({ description: 'ISO 4217 currency code' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string | null;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class AddManifestItemDto {
  @ApiProperty({ description: 'ID of the cargo to manifest' })
  @IsNotEmpty()
  @IsString()
  cargoId: string;

  @ApiPropertyOptional({ description: 'Legacy B/L number (filled by the future B/L module)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  blNumber?: string;

  @ApiPropertyOptional({ description: 'Item notes' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateManifestItemDto {
  @ApiPropertyOptional({ description: 'B/L number (null to clear)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  blNumber?: string | null;

  @ApiPropertyOptional({ description: 'Item notes' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class CancelManifestDto {
  @ApiProperty({ description: 'Reason for cancellation' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(4000)
  cancelReason: string;
}

export class ListManifestQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Search by manifest number, vessel, voyage or notes' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ManifestStatusValues })
  @IsOptional()
  @IsEnum(ManifestStatusValues)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voyageId?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  createdTo?: string;

  @ApiPropertyOptional({
    enum: ['manifestNumber', 'status', 'createdAt', 'submittedAt', 'approvedAt'],
  })
  @IsOptional()
  @IsIn(['manifestNumber', 'status', 'createdAt', 'submittedAt', 'approvedAt'])
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
