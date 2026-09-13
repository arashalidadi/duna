import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ToInt = () =>
  Transform(({ value }) => (value === undefined || value === '' || value === null ? undefined : Number(value)));

const LetterDirectionValues = ['INCOMING', 'OUTGOING'] as const;
const LetterStatusValues = ['DRAFT', 'SENT', 'RECEIVED', 'ARCHIVED'] as const;

const isoDate = () =>
  IsDateString({}, { message: 'letterDate must be an ISO date string (YYYY-MM-DD)' });

export class CreateLetterDto {
  @ApiPropertyOptional({ description: 'Auto-generated LET-YYMM-##### when omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  letterNumber?: string;

  @ApiProperty({ enum: LetterDirectionValues })
  @IsIn(LetterDirectionValues as unknown as string[])
  direction!: 'INCOMING' | 'OUTGOING';

  @ApiPropertyOptional({ description: 'ISO date (defaults to today)' })
  @IsOptional()
  @isoDate()
  @MaxLength(30)
  letterDate?: string;

  @ApiProperty({ description: 'Subject / summary line' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @ApiPropertyOptional({ description: 'Full letter text' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ description: 'Counterpart reference number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  refNumber?: string;

  @ApiPropertyOptional({ description: 'Sender person/organization (free text)' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fromContact?: string;

  @ApiPropertyOptional({ description: 'Recipient person/organization (free text)' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  toContact?: string;

  @ApiPropertyOptional({ description: 'Optional link to a customer record' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Thread parent (reply-to letter id)' })
  @IsOptional()
  @IsString()
  replyToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateLetterDto extends PartialType(CreateLetterDto) {}

export class ListLetterQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', minimum: 1, default: 1 })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @ToInt()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Search by number, subject, ref, contacts' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: LetterStatusValues })
  @IsOptional()
  @IsIn(LetterStatusValues as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ enum: LetterDirectionValues })
  @IsOptional()
  @IsIn(LetterDirectionValues as unknown as string[])
  direction?: string;

  @ApiPropertyOptional({ description: 'Filter by customer' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Only thread replies of this letter' })
  @IsOptional()
  @IsString()
  replyToId?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['letterNumber', 'letterDate', 'subject', 'createdAt', 'updatedAt'],
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
