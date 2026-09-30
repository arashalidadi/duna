import {
  IsBoolean,
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
import { CargoStatus, CargoType, InspectionStatus, LoadingStatus, WeightUnit } from '@prisma/client';

export class CreateCargoDto {
  @IsString()
  @MaxLength(40)
  customerId: string;

  @IsString()
  @MaxLength(40)
  portId: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  yardId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  destinationPortId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pol?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pod?: string;

  @IsEnum(CargoType)
  cargoType: CargoType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  specification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  chassisNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  vin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  weight?: string;

  @IsOptional()
  @IsEnum(WeightUnit)
  weightUnit?: WeightUnit;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000000)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000000)
  packages?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  chassis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  serial?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000000)
  units?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  packageType?: string;

  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  arrivalReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  manifestNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comments?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;

  // Phase 3A: party and financial fields
  @IsOptional()
  @IsString()
  @MaxLength(40)
  shipperId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  consigneeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  jobId?: string;

  @IsOptional()
  @IsString()
  // Prisma Decimal(18,2): allow numeric string like "12345.67"
  cargoValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  cargoValueCurrency?: string;
}

export class UpdateCargoDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  portId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  yardId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  destinationPortId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pol?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pod?: string;

  @IsOptional()
  @IsEnum(CargoType)
  cargoType?: CargoType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  specification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  chassisNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  vin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  weight?: string;

  @IsOptional()
  @IsEnum(WeightUnit)
  weightUnit?: WeightUnit;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000000)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000000)
  packages?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  chassis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  serial?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000000)
  units?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  packageType?: string;

  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  arrivalReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  manifestNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comments?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  clearYard?: boolean;

  @IsOptional()
  @IsBoolean()
  clearDestination?: boolean;

  // Phase 3A: party and financial fields
  @IsOptional()
  @IsString()
  @MaxLength(40)
  shipperId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  consigneeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  jobId?: string;

  @IsOptional()
  @IsString()
  // Prisma Decimal(18,2): allow numeric string like "12345.67"
  cargoValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  cargoValueCurrency?: string;
}

export class ChangeCargoStatusDto {
  @IsEnum(CargoStatus)
  status: CargoStatus;
}

export class ListCargoQueryDto {
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
  portId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  yardId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  destinationPortId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pol?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pod?: string;

  @IsOptional()
  @IsEnum(CargoType)
  cargoType?: CargoType;

  @IsOptional()
  @IsEnum(CargoStatus)
  status?: CargoStatus;

  @IsOptional()
  @IsEnum(InspectionStatus)
  inspectionStatus?: InspectionStatus;

  @IsOptional()
  @IsEnum(LoadingStatus)
  loadingStatus?: LoadingStatus;

  @IsOptional()
  @IsDateString()
  arrivalFrom?: string;

  @IsOptional()
  @IsDateString()
  arrivalTo?: string;

  // Inventory-state filters
  @IsOptional()
  @IsString()
  @IsIn(['true', 'false'])
  inYard?: string;
}