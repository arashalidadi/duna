import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Decimal-ish fields arrive as strings from the UI — coerce to number.
 * '' -> undefined (skip), null stays null (clear), numeric strings -> Number.
 */
const ToDecimal = () =>
  Transform(({ value }) => {
    if (value === null) return null;
    if (value === '' || value === undefined) return undefined;
    return Number(value);
  });

const BillStatusValues = ['DRAFT', 'ISSUED', 'CANCELLED'] as const;
const BillTypeValues = ['MASTER', 'HOUSE'] as const;
const FreightTermsValues = ['PREPAID', 'COLLECT'] as const;

export class CreateBillDto {
  @ApiProperty({ description: 'ID of the APPROVED Manifest this B/L is issued against' })
  @IsNotEmpty()
  @IsString()
  manifestId: string;

  @ApiPropertyOptional({ enum: BillTypeValues, default: 'HOUSE' })
  @IsOptional()
  @IsEnum(BillTypeValues)
  billType?: string;

  @ApiPropertyOptional({ description: 'Shipper customer ID (defaults from the manifest)' })
  @IsOptional()
  @IsString()
  shipperId?: string;

  @ApiPropertyOptional({ description: 'Consignee customer ID (defaults from the manifest)' })
  @IsOptional()
  @IsString()
  consigneeId?: string;

  @ApiPropertyOptional({ description: 'Notify party (free text on the printed document)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notifyParty?: string;

  @ApiPropertyOptional({ enum: FreightTermsValues })
  @IsOptional()
  @IsEnum(FreightTermsValues)
  freightTerms?: string;

  @ApiPropertyOptional({ description: 'Carrier / issuing line name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  carrierName?: string;

  @ApiPropertyOptional({ description: 'Place of issue' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  placeOfIssue?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  dateOfIssue?: string;

  @ApiPropertyOptional({ description: 'Number of original B/Ls issued', minimum: 1, maximum: 10 })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(10)
  originals?: number;

  @ApiPropertyOptional({ description: 'Freight amount', minimum: 0 })
  @IsOptional()
  @ToDecimal()
  @IsNumber()
  @Min(0)
  freightAmount?: number;

  @ApiPropertyOptional({ description: 'ISO 4217 currency code' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Za-z]{3}$/)
  currencyCode?: string;

  @ApiPropertyOptional({ description: 'Header goods description ("said to contain")' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  goodsDescription?: string;

  @ApiPropertyOptional({ description: 'Shipment marks & numbers' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  shipmentMarks?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateBillDto {
  @ApiPropertyOptional({ enum: BillTypeValues })
  @IsOptional()
  @IsEnum(BillTypeValues)
  billType?: string;

  @ApiPropertyOptional({ description: 'Shipper customer ID (null to clear)' })
  @IsOptional()
  @IsString()
  shipperId?: string | null;

  @ApiPropertyOptional({ description: 'Consignee customer ID (null to clear)' })
  @IsOptional()
  @IsString()
  consigneeId?: string | null;

  @ApiPropertyOptional({ description: 'Notify party (null to clear)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notifyParty?: string | null;

  @ApiPropertyOptional({ enum: FreightTermsValues })
  @IsOptional()
  @IsEnum(FreightTermsValues)
  freightTerms?: string | null;

  @ApiPropertyOptional({ description: 'Carrier name (null to clear)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  carrierName?: string | null;

  @ApiPropertyOptional({ description: 'Place of issue (null to clear)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  placeOfIssue?: string | null;

  @ApiPropertyOptional({ description: 'ISO date string (null to clear)' })
  @IsOptional()
  @IsString()
  dateOfIssue?: string | null;

  @ApiPropertyOptional({ description: 'Number of originals', minimum: 1, maximum: 10 })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(10)
  originals?: number | null;

  @ApiPropertyOptional({ description: 'Freight amount', minimum: 0 })
  @IsOptional()
  @ToDecimal()
  @IsNumber()
  @Min(0)
  freightAmount?: number | null;

  @ApiPropertyOptional({ description: 'ISO 4217 currency code' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Za-z]{3}$/)
  currencyCode?: string | null;

  @ApiPropertyOptional({ description: 'Header goods description' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  goodsDescription?: string | null;

  @ApiPropertyOptional({ description: 'Shipment marks & numbers' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  shipmentMarks?: string | null;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class AddBillItemDto {
  @ApiProperty({ description: 'ID of the ManifestItem this B/L line documents' })
  @IsNotEmpty()
  @IsString()
  manifestItemId: string;

  @ApiPropertyOptional({ description: 'Line goods description (defaults from the cargo)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  goodsDescription?: string;

  @ApiPropertyOptional({ description: 'Marks & numbers (defaults from the cargo)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  marksAndNumbers?: string;

  @ApiPropertyOptional({ description: 'Package count (defaults from the manifest line)', minimum: 0 })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  packages?: number;

  @ApiPropertyOptional({ description: 'Package type (defaults from the manifest line)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  packageType?: string;

  @ApiPropertyOptional({ description: 'Gross weight (defaults from the manifest line)', minimum: 0 })
  @IsOptional()
  @ToDecimal()
  @IsNumber()
  @Min(0)
  grossWeight?: number;

  @ApiPropertyOptional({ description: 'Volume / measurement (m³)', minimum: 0 })
  @IsOptional()
  @ToDecimal()
  @IsNumber()
  @Min(0)
  volume?: number;
}

export class UpdateBillItemDto {
  @ApiPropertyOptional({ description: 'Line goods description (null to clear)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  goodsDescription?: string | null;

  @ApiPropertyOptional({ description: 'Marks & numbers (null to clear)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  marksAndNumbers?: string | null;

  @ApiPropertyOptional({ description: 'Package count', minimum: 0 })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  packages?: number | null;

  @ApiPropertyOptional({ description: 'Package type' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  packageType?: string | null;

  @ApiPropertyOptional({ description: 'Gross weight', minimum: 0 })
  @IsOptional()
  @ToDecimal()
  @IsNumber()
  @Min(0)
  grossWeight?: number | null;

  @ApiPropertyOptional({ description: 'Volume / measurement (m³)', minimum: 0 })
  @IsOptional()
  @ToDecimal()
  @IsNumber()
  @Min(0)
  volume?: number | null;
}

export class CancelBillDto {
  @ApiProperty({ description: 'Reason for cancellation' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(4000)
  cancelReason: string;
}

export class ListBillQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Search by B/L number, vessel, manifest, carrier or notes' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: BillStatusValues })
  @IsOptional()
  @IsEnum(BillStatusValues)
  status?: string;

  @ApiPropertyOptional({ enum: BillTypeValues })
  @IsOptional()
  @IsEnum(BillTypeValues)
  billType?: string;

  @ApiPropertyOptional({ description: 'Filter by manifest' })
  @IsOptional()
  @IsString()
  manifestId?: string;

  @ApiPropertyOptional({ description: 'Filter by voyage' })
  @IsOptional()
  @IsString()
  voyageId?: string;

  @ApiPropertyOptional({ description: 'Filter by shipper' })
  @IsOptional()
  @IsString()
  shipperId?: string;

  @ApiPropertyOptional({ description: 'Filter by consignee' })
  @IsOptional()
  @IsString()
  consigneeId?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  createdTo?: string;

  @ApiPropertyOptional({
    enum: ['billNumber', 'status', 'createdAt', 'issuedAt'],
  })
  @IsOptional()
  @IsIn(['billNumber', 'status', 'createdAt', 'issuedAt'])
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
