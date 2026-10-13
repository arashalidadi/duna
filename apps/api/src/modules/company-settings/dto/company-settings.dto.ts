import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/** Empty strings clear an optional field; whitespace is trimmed. */
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

const CURRENCY_CODE = /^[A-Z]{3}$/;

export class UpdateCompanySettingsDto {
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 200)
  companyName?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 200)
  legalName?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 100)
  registrationNumber?: string | null;

  /** TRN. Stored in the existing CompanySettings.taxNumber column. No format is enforced here. */
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 100)
  taxNumber?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 500)
  address?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 100)
  city?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 100)
  country?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 50)
  phone?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsEmail()
  @Length(1, 254)
  email?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @Length(1, 255)
  website?: string | null;

  @IsOptional()
  @Matches(CURRENCY_CODE, { message: 'defaultCurrency must be an ISO 4217 code' })
  defaultCurrency?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @Matches(CURRENCY_CODE, { each: true, message: 'Each currency must be an ISO 4217 code' })
  supportedCurrencies?: string[];
}
