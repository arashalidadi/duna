import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CargoStatus, InventoryStatus } from '@prisma/client';

export class PlaceCargoDto {
  @IsString()
  @MaxLength(40)
  cargoId: string;

  @IsString()
  @MaxLength(40)
  yardId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateInventoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  yardId?: string;

  @IsOptional()
  @IsEnum(InventoryStatus)
  status?: InventoryStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ListInventoryQueryDto {
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
  yardId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  portId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  destinationPortId?: string;

  @IsOptional()
  @IsEnum(InventoryStatus)
  status?: InventoryStatus;

  @IsOptional()
  @IsEnum(CargoStatus)
  cargoStatus?: CargoStatus;
}