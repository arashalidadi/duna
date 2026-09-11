import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListPermissionsQueryDto {
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
  @MaxLength(50)
  module?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}