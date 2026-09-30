import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
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

  @IsOptional()
  @IsString()
  tugVesselId?: string;

  @IsOptional()
  @IsString()
  bargeVesselId?: string;

  @IsString()
  originPortId: string;

  @IsString()
  destinationPortId: string;

  /**
   * Optional additional destinations for a multi-destination expedition.
   * Each entry becomes its own leg with a destination-scoped number
   * (e.g. 1/26). Omit for a single-destination voyage — the shape every
   * existing caller uses (unchanged behaviour).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  destinations?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateVoyageDto {
  @IsOptional()
  @IsString()
  vesselId?: string;

  /** Optional pairing. Send null or '' to detach the tug from this voyage. */
  @IsOptional()
  @IsString()
  tugVesselId?: string | null;

  /** Optional pairing. Send null or '' to detach the barge from this voyage. */
  @IsOptional()
  @IsString()
  bargeVesselId?: string | null;

  @IsOptional()
  @IsString()
  originPortId?: string;

  @IsOptional()
  @IsString()
  destinationPortId?: string;

  /**
   * DRAFT-only leg management: the ADDITIONAL destination legs (beyond the
   * primary `destinationPortId`, which stays leg 1). The given list is the
   * desired state — kept legs keep their number and are renumbered by
   * position, added legs get a fresh destination-scoped allocation, legs
   * missing from the list are soft-deleted. Omit to leave legs untouched.
   * SCHEDULED voyages reject it (route frozen).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  destinations?: string[];

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
