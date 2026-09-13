import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ToInt = () =>
  Transform(({ value }) => (value === undefined || value === '' || value === null ? undefined : Number(value)));

const SalaryStatusValues = ['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'] as const;
const SalaryMethodValues = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const;

export class CreateSalaryRecordDto {
  @ApiProperty({ description: 'Employee the payslip belongs to' })
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @ApiProperty({ description: 'Payroll year', minimum: 2000, maximum: 2100, example: 2026 })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiProperty({ description: 'Payroll month (1-12)', minimum: 1, maximum: 12 })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ description: 'Defaults to the employee base salary when omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(18)
  base?: string;

  @ApiPropertyOptional({ description: 'Bonus / overtime / allowances', default: 0 })
  @IsOptional()
  @IsString()
  @MaxLength(18)
  additions?: string;

  @ApiPropertyOptional({ description: 'Insurance / tax / advances', default: 0 })
  @IsOptional()
  @IsString()
  @MaxLength(18)
  deductions?: string;

  @ApiPropertyOptional({ description: 'Defaults to the employee currency' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateSalaryRecordDto extends PartialType(CreateSalaryRecordDto) {}

export class PaySalaryRecordDto {
  @ApiPropertyOptional({ enum: SalaryMethodValues, default: 'BANK_TRANSFER' })
  @IsOptional()
  @IsIn(SalaryMethodValues as unknown as string[])
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Bank transfer / receipt trace' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentRef?: string;
}

export class CancelSalaryRecordDto {
  @ApiProperty({ description: 'Audit reason (required)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  cancelReason!: string;
}

export class ListSalaryRecordQueryDto {
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

  @ApiPropertyOptional({ description: 'Search by record number or employee name/code' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: SalaryStatusValues })
  @IsOptional()
  @IsIn(SalaryStatusValues as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by employee' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Payroll year', minimum: 2000, maximum: 2100 })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ description: 'Payroll month (1-12)', minimum: 1, maximum: 12 })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['recordNumber', 'net', 'year', 'month', 'createdAt', 'updatedAt'],
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
