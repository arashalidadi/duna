import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
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

const JobStatusValues = ['DRAFT', 'OPEN', 'COMPLETED', 'CANCELLED'] as const;
const JobItemKindValues = ['COST', 'INCOME'] as const;

export class JobItemInputDto {
  @ApiProperty({ enum: JobItemKindValues })
  @IsIn(JobItemKindValues as unknown as string[])
  kind!: 'COST' | 'INCOME';

  @ApiPropertyOptional({ description: 'THC, freight, customs, detention...' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiProperty({ description: 'What the line is for' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description!: string;

  @ApiProperty({ description: 'Decimal string in the job currency', example: '1250.00' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(18)
  amount!: string;

  @ApiPropertyOptional({ description: 'ISO date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  itemDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class CreateJobDto {
  @ApiPropertyOptional({ description: 'Auto-generated JOB-YYMM-##### when omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  jobNumber?: string;

  @ApiProperty({ description: 'Job title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'IMPORT_CLEARANCE, EXPORT, TRANSIT, CUSTOMS...' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  jobType?: string;

  @ApiPropertyOptional({ description: 'Optional customer link' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Optional voyage link' })
  @IsOptional()
  @IsString()
  voyageId?: string;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ type: [JobItemInputDto] })
  @IsOptional()
  items?: JobItemInputDto[];
}

export class UpdateJobDto extends PartialType(CreateJobDto) {}

export class CancelJobDto {
  @ApiProperty({ description: 'Audit reason (required)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  cancelReason!: string;
}

export class UpdateJobItemDto extends PartialType(JobItemInputDto) {}

export class ListJobQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Search by job number, title, customer name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: JobStatusValues })
  @IsOptional()
  @IsIn(JobStatusValues as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by customer' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filter by job type' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  jobType?: string;

  @ApiPropertyOptional({ description: 'Filter by voyage' })
  @IsOptional()
  @IsString()
  voyageId?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['jobNumber', 'title', 'openingDate', 'createdAt', 'updatedAt'],
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
