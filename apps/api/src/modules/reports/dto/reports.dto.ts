import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCostCategoryDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,31}$/)
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}
export class UpdateCostCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class IssueStatementDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currencyCode!: string;

  @ApiProperty({ description: 'UTC calendar date YYYY-MM-DD' })
  @IsString()
  from!: string;

  @ApiProperty({ description: 'UTC calendar date YYYY-MM-DD' })
  @IsString()
  to!: string;
}

export class ReportDefinitionDto {
  @ApiProperty({ description: 'Allowlisted report specification, see GET /reports/catalogue' })
  @IsObject()
  definition!: Record<string, unknown>;
}
export class SaveReportDto extends ReportDefinitionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}
