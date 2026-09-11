import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { LoadListStatus } from '@prisma/client';

export class CreateLoadListDto {
  @IsString()
  @MaxLength(40)
  voyageId: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateLoadListDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class AddLoadListItemDto {
  @IsString()
  @MaxLength(40)
  cargoId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @ValidateIf((o) => o.plannedQuantity !== undefined)
  plannedQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  sequence?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class BulkAddLoadListItemsDto {
  @IsArray()
  @Min(1)
  items: AddLoadListItemDto[];
}

export class CancelLoadListDto {
  @IsString()
  @MaxLength(4000)
  cancelReason: string;
}

/**
 * Allow-listed sortable fields. Arbitrary column sorting is rejected.
 */
const SORTABLE: string[] = ['loadListNumber', 'status', 'createdAt', 'finalizedAt'];
const SORT_ORDER: string[] = ['asc', 'desc'];

export class ListLoadListQueryDto {
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
  @IsEnum(LoadListStatus)
  status?: LoadListStatus;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  voyageId?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsIn(SORTABLE)
  sort?: string;

  @IsOptional()
  @IsIn(SORT_ORDER)
  order?: 'asc' | 'desc';
}

/**
 * Cargo eligibility filter for selection UI.
 */
export class EligibleCargoQueryDto {
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
  @IsString()
  @MaxLength(40)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  yardId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cargoType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  voyageId?: string;

  /**
   * If true, only return cargo with APPROVED inspection (eligible).
   * If false, return all cargo (for explaining ineligibility).
   * Default: true (eligible only).
   */
  @IsOptional()
  @IsIn(['true', 'false'])
  eligibleOnly?: string;
}