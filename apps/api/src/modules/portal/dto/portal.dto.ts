import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const BOOKING_LIST_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'] as const;

export class CreateBookingDto {
  @IsString()
  @MaxLength(255)
  cargoDescription!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  originPortId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  destinationPortId?: string;

  @IsOptional()
  @IsDateString()
  requestedShipDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  containers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000)
  weightKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class RespondBookingDto {
  @IsIn(['ACCEPTED', 'DECLINED'])
  decision!: 'ACCEPTED' | 'DECLINED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  responseNote?: string;
}

export class ListBookingsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(BOOKING_LIST_STATUSES)
  status?: string;

  // Office-only filter; portal routes ignore any client-supplied value.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;
}
