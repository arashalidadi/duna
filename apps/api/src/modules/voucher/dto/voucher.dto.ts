import {
  IsArray,
  ValidateNested,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VoucherMethod, VoucherType } from '@prisma/client';

// Preserve decimal strings end-to-end; legacy numeric JSON clients are still
// accepted, but new clients must not round money through IEEE-754 floats.
const ToDecimalString = () => Transform(({ value }) => typeof value === 'number' ? String(value) : value);
const MONEY_PATTERN = /^\d{1,16}(?:\.\d{1,2})?$/;
const RATE_PATTERN = /^\d{1,12}(?:\.\d{1,12})?$/;

const ToNumber = () =>
  Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  });

export class AllocationLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billOfLadingId?: string;

  @ApiProperty({ description: 'Original voucher currency; exact decimal string per reference' })
  @ToDecimalString()
  @IsString()
  @Matches(MONEY_PATTERN)
  amount!: string;
}

export class CreateVoucherDto {
  @ApiProperty({ enum: VoucherType, description: 'RECEIPT (money in) | PAYMENT (money out)' })
  @IsEnum(VoucherType)
  type!: VoucherType;

  @ApiProperty({ description: 'Counterparty customer id' })
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @ApiPropertyOptional({ description: 'Invoice settled by this voucher (optional)' })
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiPropertyOptional({ description: 'Optional B/L reference; cannot be combined with invoiceId unless it belongs to the same customer' })
  @IsOptional()
  @IsString()
  billOfLadingId?: string;

  @ApiPropertyOptional({ type: [AllocationLineDto], description: 'Per-reference amounts; omit for configured default allocation' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationLineDto)
  allocations?: AllocationLineDto[];

  @ApiPropertyOptional({ enum: ['MANUAL', 'AUTO', 'NONE'] })
  @IsOptional()
  @IsIn(['MANUAL', 'AUTO', 'NONE'])
  allocationMode?: 'MANUAL' | 'AUTO' | 'NONE';

  @ApiProperty({ description: 'Positive original-currency amount as a decimal string', example: '1500.00' })
  @ToDecimalString()
  @IsString()
  @Matches(MONEY_PATTERN)
  amount!: string;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @ApiPropertyOptional({ description: 'Rate override as an exact decimal string' })
  @IsOptional()
  @ToDecimalString()
  @IsString()
  @Matches(RATE_PATTERN)
  exchangeRate?: string;

  @ApiPropertyOptional({ description: 'Required when exchangeRate overrides the central rate' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rateOverrideReason?: string;

  @ApiPropertyOptional({ enum: VoucherMethod, default: 'BANK_TRANSFER' })
  @IsOptional()
  @IsEnum(VoucherMethod)
  method?: VoucherMethod;

  @ApiPropertyOptional({ description: 'Cheque / transfer trace number' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ description: 'Value date (legacy fromdate)' })
  @IsOptional()
  @IsDateString()
  voucherDate?: string;
}

export class UpdateVoucherDto {
  @ApiPropertyOptional({ enum: VoucherMethod })
  @IsOptional()
  @IsEnum(VoucherMethod)
  method?: VoucherMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ description: 'Value date' })
  @IsOptional()
  @IsDateString()
  voucherDate?: string;

  @ApiPropertyOptional({ description: 'Amount (reposts the ledger effect)' })
  @IsOptional()
  @ToNumber()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ToNumber()
  @IsNumber()
  exchangeRate?: number;
}

export class ReallocateVoucherDto {
  @ApiProperty({ type: [AllocationLineDto], description: 'New complete allocation set. Empty leaves all as credit.' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationLineDto)
  allocations!: AllocationLineDto[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class AdjustVoucherDto {
  @ApiProperty({ description: 'New total as an exact decimal string; correction history is retained.' })
  @ToDecimalString()
  @IsString()
  @Matches(MONEY_PATTERN)
  amount!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class CancelVoucherDto {
  @ApiProperty({ description: 'Cancellation reason' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class LedgerQueryDto {
  @ApiPropertyOptional({ description: 'Customer id (required)' })
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @ApiPropertyOptional({ description: 'Inclusive start date (ISO)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Inclusive end date (ISO)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Filter currency (default: no filtering)' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @ApiPropertyOptional({ enum: ['invoice', 'voucher', 'all'] })
  @IsOptional()
  @IsIn(['invoice', 'voucher', 'all'])
  kind?: 'invoice' | 'voucher' | 'all';
}
