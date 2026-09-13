import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const ToInt = () =>
  Transform(({ value }) => (value === undefined || value === '' || value === null ? undefined : Number(value)));

const DischargeStatusValues = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export class CreateDischargeDto {
  @ApiProperty({ description: 'Completed Actual Loading being discharged at destination' })
  @IsString()
  @IsNotEmpty()
  actualLoadingId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateDischargeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateDischargeItemDto {
  @ApiPropertyOptional({ description: 'Actual quantity discharged (null = not recorded yet)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  dischargeQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CompleteDischargeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CancelDischargeDto {
  @ApiProperty({ description: 'Audit reason (required)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  cancelReason!: string;
}

export class ListDischargeQueryDto {
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

  @ApiPropertyOptional({ description: 'Search by discharge number, voyage, vessel, port names' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: DischargeStatusValues })
  @IsOptional()
  @IsIn(DischargeStatusValues as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by voyage (via actual loading chain)' })
  @IsOptional()
  @IsString()
  voyageId?: string;

  @ApiPropertyOptional({ description: 'Filter by source actual loading' })
  @IsOptional()
  @IsString()
  actualLoadingId?: string;

  @ApiPropertyOptional({ description: 'ISO date range on createdAt' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({ enum: ['dischargeNumber', 'status', 'createdAt', 'completedAt'] })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
