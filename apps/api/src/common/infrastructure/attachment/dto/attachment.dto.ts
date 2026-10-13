import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import {
  ATTACHMENT_ENTITY_TYPES,
  AttachmentEntityType,
  IDENTITY_ATTACHMENT_CATEGORIES,
  IdentityAttachmentCategory,
} from '../attachment-policy';

export class UploadAttachmentDto {
  @IsIn([...ATTACHMENT_ENTITY_TYPES])
  entityType!: AttachmentEntityType;

  @IsString()
  @Length(1, 64)
  entityId!: string;

  @IsIn([...IDENTITY_ATTACHMENT_CATEGORIES])
  category!: IdentityAttachmentCategory;
}

export class ListAttachmentsDto {
  @IsOptional()
  @IsIn([...ATTACHMENT_ENTITY_TYPES])
  entityType?: AttachmentEntityType;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  entityId?: string;

  @IsOptional()
  @IsIn([...IDENTITY_ATTACHMENT_CATEGORIES])
  category?: IdentityAttachmentCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class DownloadQueryDto {
  @IsString()
  @Length(1, 2048)
  token!: string;
}
