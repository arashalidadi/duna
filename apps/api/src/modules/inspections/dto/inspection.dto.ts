import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { InspectionStatus } from '@prisma/client';

export class CreateInspectionDto {
  @IsString()
  @MaxLength(40)
  cargoId: string;

  @IsOptional()
  @IsDateString()
  inspectionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  inspectorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  findings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  condition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  verificationNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  remarks?: string;
}

export class UpdateInspectionDto {
  @IsOptional()
  @IsDateString()
  inspectionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  inspectorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  findings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  condition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  verificationNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  remarks?: string;
}

export class RejectInspectionDto {
  @IsString()
  @MaxLength(4000)
  rejectionReason: string;
}

/**
 * Allow-listed sortable fields (ADR-025). Arbitrary column sorting is rejected.
 */
const SORTABLE: string[] = ['inspectionNumber', 'inspectionDate', 'createdAt'];
const SORT_ORDER: string[] = ['asc', 'desc'];

export class ListInspectionQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(InspectionStatus)
  status?: InspectionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cargoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  yardId?: string;

  @IsOptional()
  @IsDateString()
  inspectionFrom?: string;

  @IsOptional()
  @IsDateString()
  inspectionTo?: string;

  @IsOptional()
  @IsIn(SORTABLE)
  sort?: string;

  @IsOptional()
  @IsIn(SORT_ORDER)
  order?: 'asc' | 'desc';
}