import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDecimal,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const QuotationStatusValues = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED'] as const;

const ToInt = () =>
  Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)));

/** One quoted line: description x quantity x unitPrice -> amount (server-side). */
export class QuotationItemInputDto {
  @ApiProperty({ description: 'What is being quoted (freight, handling, storage...)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty({ description: 'Price per unit', example: '250.00' })
  @IsNumberString()
  @MaxLength(16)
  unitPrice!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateQuotationDto {
  @ApiProperty({ description: 'Customer the quote is issued to' })
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @ApiPropertyOptional({ description: 'Free heading on the printed quote' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @ApiPropertyOptional({ description: 'ISO date the quote is dated' })
  @IsOptional()
  @IsString()
  issueDate?: string;

  @ApiPropertyOptional({ description: 'ISO date the quote expires' })
  @IsOptional()
  @IsString()
  validUntil?: string;

  @ApiPropertyOptional({ description: 'Tax percent 0..100', default: 0 })
  @IsOptional()
  @IsNumberString()
  taxRate?: string;

  @ApiPropertyOptional({ description: 'Flat discount off the subtotal', default: 0 })
  @IsOptional()
  @IsNumberString()
  discountAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ type: [QuotationItemInputDto], description: 'Optional inline lines' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  items?: QuotationItemInputDto[];
}

/** Header edit — DRAFT only. Same fields as create (customerId immutable). */
export class UpdateQuotationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  issueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  validUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  taxRate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  discountAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class AddQuotationItemDto extends QuotationItemInputDto {}

export class UpdateQuotationItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  unitPrice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RejectQuotationDto {
  @ApiProperty({ description: 'Why the customer declined the quote' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  rejectReason!: string;
}

export class CancelQuotationDto {
  @ApiProperty({ description: 'Audit reason (required)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  cancelReason!: string;
}

export class ListQuotationQueryDto {
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

  @ApiPropertyOptional({ description: 'Search by quote number, title, customer, description' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: QuotationStatusValues })
  @IsOptional()
  @IsEnum(QuotationStatusValues)
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by quoted-for customer' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Accepted quotes not yet converted to a proforma',
  })
  @IsOptional()
  @IsString()
  convertible?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['quotationNumber', 'status', 'totalAmount', 'issueDate', 'validUntil', 'createdAt'],
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
