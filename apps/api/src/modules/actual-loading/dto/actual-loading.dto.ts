import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ArrayMinSize,
  IsEnum,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActualLoadingStatus } from '@shipping/shared';

const ActualLoadingStatusValues = ['DRAFT', 'IN_PROGRESS', 'PARTIALLY_LOADED', 'COMPLETED', 'FINALIZED'] as const;

export class CreateActualLoadingDto {
  @ApiProperty({ description: 'ID of the Load List to start loading for' })
  @IsNotEmpty()
  @IsString()
  loadListId: string;

  @ApiPropertyOptional({ description: 'Optional notes for the loading operation' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateActualLoadingItemDto {
  @ApiPropertyOptional({
    description: 'Actual quantity loaded (must not exceed planned quantity)',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @ValidateIf((o) => o.actualQuantity !== undefined)
  actualQuantity?: number;

  @ApiPropertyOptional({ description: 'Operational notes for this item' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class BulkUpdateActualLoadingItemsDto {
  @ApiProperty({
    description: 'Array of items to update with actual quantities',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        loadListItemId: { type: 'string', description: 'Load List Item ID' },
        actualQuantity: {
          type: 'number',
          description: 'Actual quantity loaded (must not exceed planned)',
          minimum: 0,
        },
        notes: { type: 'string', description: 'Optional notes', maxLength: 4000 },
      },
      required: ['loadListItemId'],
    },
  })
  @IsNotEmpty()
  @ArrayMinSize(1)
  items: Array<{
    loadListItemId: string;
    actualQuantity?: number;
    notes?: string;
  }>;
}

export class CompleteActualLoadingDto {
  @ApiPropertyOptional({ description: 'Completion notes' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class CancelActualLoadingDto {
  @ApiProperty({ description: 'Reason for cancellation' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(4000)
  cancelReason: string;
}

export class ListActualLoadingQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Search by actual loading number or load list number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ActualLoadingStatusValues })
  @IsOptional()
  @IsEnum(ActualLoadingStatusValues)
  status?: ActualLoadingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  loadListId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voyageId?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  createdTo?: string;

  @ApiPropertyOptional({ enum: ['actualLoadingNumber', 'status', 'createdAt', 'completedAt'] })
  @IsOptional()
  @IsIn(['actualLoadingNumber', 'status', 'createdAt', 'completedAt'])
  sort?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}