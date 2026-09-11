import {
  IsInt,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const VOYAGE_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;

/** Allowed sort fields (whitelist to prevent sort-injection). */
export const VOYAGE_SORT_FIELDS = [
  'voyageNumber',
  'status',
  'plannedDepartureAt',
  'plannedArrivalAt',
  'createdAt',
] as const;

export class CreateVoyageDto {
  @IsString()
  vesselId: string;

  @IsString()
  originPortId: string;

  @IsString()
  destinationPortId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateVoyageDto {
  // A DRAFT voyage may re-target vessel/ports. Once SCHEDULED these become
  // read-only; only notes may change.
  @IsOptional()
  @IsString()
  vesselId?: string;

  @IsOptional()
  @IsString()
  originPortId?: string;

  @IsOptional()
  @IsString()
  destinationPortId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ScheduleVoyageDto {
  @IsISO8601()
  plannedDepartureAt: string;

  @IsISO8601()
  plannedArrivalAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CancelVoyageDto {
  @IsString()
  @MaxLength(1000)
  cancelReason: string;
}

export class ListVoyageQueryDto {
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
  @IsIn(VOYAGE_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  vesselId?: string;

  @IsOptional()
  @IsString()
  originPortId?: string;

  @IsOptional()
  @IsString()
  destinationPortId?: string;

  @IsOptional()
  @IsISO8601()
  departureFrom?: string;

  @IsOptional()
  @IsISO8601()
  departureTo?: string;

  @IsOptional()
  @IsIn(VOYAGE_SORT_FIELDS)
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: string;
}