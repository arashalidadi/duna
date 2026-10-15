import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import {
  ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsNotEmpty,
  IsOptional, IsString, Matches, MaxLength, ValidateNested,
} from 'class-validator';

export class CreateAccountDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._-]{0,31}$/)
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  type!: AccountType;
}

export class UpdateAccountDto {
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

export class JournalLineDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @ApiPropertyOptional({ description: 'Decimal string in original currency, two places' })
  @IsOptional()
  @IsString()
  debit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  credit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;
}

export class PostJournalDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  journalDate?: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currencyCode!: string;

  @ApiPropertyOptional({ description: 'Requires currency_rate:override and reason' })
  @IsOptional()
  @IsString()
  exchangeRate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rateOverrideReason?: string;

  @ApiProperty({ type: [JournalLineDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class PostExpenseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  expenseAccountId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  creditAccountId!: string;

  @ApiProperty({ description: 'Original currency amount as a decimal string' })
  @IsString()
  amount!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currencyCode!: string;

  @IsOptional()
  @IsDateString()
  journalDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  exchangeRate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rateOverrideReason?: string;

  @ApiPropertyOptional({ description: 'VAT portion of gross amount (original currency). Omit when no input VAT was recorded.' })
  @IsOptional()
  @IsString()
  inputVatAmount?: string;

  @ApiPropertyOptional({ description: 'Active ASSET account debited for input VAT, required with inputVatAmount.' })
  @IsOptional()
  @IsString()
  vatAccountId?: string;

  @ApiPropertyOptional({ description: 'Date input VAT was paid, explicitly recorded by operator.' })
  @IsOptional()
  @IsDateString()
  taxPaidAt?: string;
}

export class PostVoyageCostDto extends PostExpenseDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  voyageId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manifestId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  categoryId!: string;
}

export class ReverseJournalDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
