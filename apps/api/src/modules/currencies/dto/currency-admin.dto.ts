import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCurrencyDto {
  @ApiProperty({ example: 'AUD' })
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  symbol!: string;
}

export class UpdateCurrencyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  symbol?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateRateDto {
  @ApiProperty({ description: 'Original currency (one unit)' })
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currencyCode!: string;

  @ApiProperty({ description: 'Number of units of the company base currency per 1 original unit; decimal string', example: '3.672500000000' })
  @IsString()
  @IsNotEmpty()
  rate!: string;

  @ApiProperty({ description: 'Effective UTC date/time, inclusive' })
  @IsDateString()
  effectiveAt!: string;

  @ApiProperty({ description: 'Rate provenance (bank, agreed source, etc.)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  source!: string;
}

export class UpdateDraftRateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  rate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  source?: string;
}
