import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const VESSEL_TYPES = [
  'CONTAINER',
  'BULK',
  'TANKER',
  'RORO',
  'GENERAL',
  'PROJECT',
  'OTHER',
  'TUG',
  'BARGE',
  'LANDING_CRAFT',
] as const;

/** IMO number: exactly 7 digits (international standard); supplied optionally. */
const IMO_REGEX = /^\d{7}$/;

export class CreateVesselDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(IMO_REGEX, { message: 'imo must be a 7-digit IMO number' })
  imo?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  flag: string;

  @IsIn(VESSEL_TYPES)
  vesselType: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999999)
  capacityTeu?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateVesselDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(IMO_REGEX, { message: 'imo must be a 7-digit IMO number' })
  imo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  flag?: string;

  @IsOptional()
  @IsIn(VESSEL_TYPES)
  vesselType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999999)
  capacityTeu?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class SetVesselActiveDto {
  @IsBoolean()
  isActive: boolean;
}

export class ListVesselQueryDto {
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
  @IsIn(VESSEL_TYPES)
  vesselType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  flag?: string;

  @IsOptional()
  @IsString()
  @IsIn(['true', 'false'])
  isActive?: string;
}