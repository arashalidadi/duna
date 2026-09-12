import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VoucherMethod, VoucherType } from '@prisma/client';

const ToNumber = () =>
  Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  });

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

  @ApiProperty({ description: 'Amount (always positive)', example: 1500 })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  exchangeRate?: number;

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
