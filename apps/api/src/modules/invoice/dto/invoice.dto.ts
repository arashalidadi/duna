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
 * Money/decimal fields arrive as strings from the UI — coerce to number.
 * '' -> undefined (skip), null stays null (clear), numeric strings -> Number.
 */
const ToMoney = () =>
  Transform(({ value }) => {
    if (value === null) return null;
    if (value === '' || value === undefined) return undefined;
    return Number(value);
  });

const ToInt = () =>
  Transform(({ value }) => {
    if (value === null) return null;
    if (value === '' || value === undefined) return undefined;
    return Number.isInteger(Number(value)) ? Number(value) : Number.NaN;
  });

const InvoiceStatusValues = ['DRAFT', 'ISSUED', 'CANCELLED'] as const;

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Bill-to customer ID' })
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @ApiPropertyOptional({ description: 'Invoice title' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'To-description (legacy todescr)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ description: 'Tax rate in percent (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @ToMoney()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiPropertyOptional({ description: 'Flat discount amount', minimum: 0 })
  @IsOptional()
  @ToMoney()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ description: 'ISO 4217 currency code' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  issueDate?: string;

  @ApiPropertyOptional({ description: 'ISO date string — payment due' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Optional B/L anchor (legacy bl_id)' })
  @IsOptional()
  @IsString()
  billOfLadingId?: string;

  @ApiPropertyOptional({ description: 'Optional Manifest anchor (legacy manifest_id)' })
  @IsOptional()
  @IsString()
  manifestId?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ description: 'Bill-to customer ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Title (null to clear)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string | null;

  @ApiPropertyOptional({ description: 'To-description (null to clear)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @ApiPropertyOptional({ description: 'Tax rate percent', minimum: 0, maximum: 100 })
  @IsOptional()
  @ToMoney()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number | null;

  @ApiPropertyOptional({ description: 'Flat discount amount', minimum: 0 })
  @IsOptional()
  @ToMoney()
  @IsNumber()
  @Min(0)
  discountAmount?: number | null;

  @ApiPropertyOptional({ description: 'ISO 4217 currency code' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @ApiPropertyOptional({ description: 'ISO date string (null to clear)' })
  @IsOptional()
  @IsString()
  issueDate?: string | null;

  @ApiPropertyOptional({ description: 'ISO date string (null to clear)' })
  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @ApiPropertyOptional({ description: 'B/L anchor (null to clear)' })
  @IsOptional()
  @IsString()
  billOfLadingId?: string | null;

  @ApiPropertyOptional({ description: 'Manifest anchor (null to clear)' })
  @IsOptional()
  @IsString()
  manifestId?: string | null;

  @ApiPropertyOptional({ description: 'Notes (null to clear)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class AddInvoiceItemDto {
  @ApiProperty({ description: 'Line description' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  description: string;

  @ApiProperty({ description: 'Unit price', minimum: 0 })
  @ToMoney()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ description: 'Quantity', minimum: 1, default: 1 })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Line notes' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateInvoiceItemDto {
  @ApiPropertyOptional({ description: 'Line description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Unit price', minimum: 0 })
  @IsOptional()
  @ToMoney()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Quantity', minimum: 1 })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Line notes (null to clear)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class CancelInvoiceDto {
  @ApiProperty({ description: 'Reason for cancellation' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(4000)
  cancelReason: string;
}

export class ListInvoiceQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', minimum: 1, default: 1 })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Search by invoice number, title, customer, notes' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: InvoiceStatusValues })
  @IsOptional()
  @IsEnum(InvoiceStatusValues)
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by bill-to customer' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filter by voyage' })
  @IsOptional()
  @IsString()
  voyageId?: string;

  @ApiPropertyOptional({ description: 'true = ISSUED with remaining balance' })
  @IsOptional()
  @IsIn(['true', 'false', ''])
  unpaid?: string;

  @ApiPropertyOptional({ description: 'true = ISSUED, past due and unpaid' })
  @IsOptional()
  @IsIn(['true', 'false', ''])
  overdue?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  createdTo?: string;

  @ApiPropertyOptional({
    enum: ['invoiceNumber', 'status', 'totalAmount', 'issueDate', 'dueDate', 'createdAt'],
  })
  @IsOptional()
  @IsIn(['invoiceNumber', 'status', 'totalAmount', 'issueDate', 'dueDate', 'createdAt'])
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
