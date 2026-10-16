import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional,
  IsString, Max, MaxLength, Min } from 'class-validator';

export class CreatePortDto {
  @IsString() @IsNotEmpty() @MaxLength(20) code: string;
  @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @IsString() @IsNotEmpty() @MaxLength(100) country: string;
  @IsString() @IsNotEmpty() @MaxLength(100) city: string;
  @IsString() @IsNotEmpty() @MaxLength(10) abbreviation: string;
  @IsOptional() @IsString() @MaxLength(200) displayName?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20)
  @IsString({ each: true }) @MaxLength(100, { each: true }) aliases?: string[];
}

export class UpdatePortDto {
  @IsOptional() @IsString() @MaxLength(20) code?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(10) abbreviation?: string;
  @IsOptional() @IsString() @MaxLength(200) displayName?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20)
  @IsString({ each: true }) @MaxLength(100, { each: true }) aliases?: string[];
  // Preserve the pre-existing PATCH contract; the service applies the same
  // dependency/verification guard as PATCH /:id/active.
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListPortsQueryDto {
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @IsIn(['true', 'false']) isActive?: string;
}

export class SetPortActiveDto { @IsBoolean() isActive: boolean; }
