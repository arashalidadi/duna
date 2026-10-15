import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { DOCUMENT_TYPES, type DocumentLayout, type DocumentType } from '../../../modules/document-output/document-layout';

export class CreateTemplateDto {
  @IsIn(DOCUMENT_TYPES)
  documentType!: DocumentType;
  @IsString() @IsNotEmpty() @MaxLength(100)
  name!: string;
  @IsOptional() @IsString() @MaxLength(500)
  description?: string;
}

export class CreateTemplateVersionDto {
  /** Accepted only for the legacy /version route; all content is still uploaded as validated JSON. */
  @IsOptional() @IsString() @MaxLength(70)
  templateId?: string;
  @IsOptional() @IsString() @MaxLength(100)
  label?: string;
  @IsObject()
  layout!: DocumentLayout;
}

export interface TemplateVersionRecord {
  id: string;
  templateId: string;
  version: number;
  label: string | null;
  mimeType: string;
  size: number;
  contentHash: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface TemplateRecord {
  id: string;
  documentType: string;
  name: string;
  description: string | null;
  isActive: boolean;
  currentVersionId: string | null;
  createdAt: Date;
  versions: TemplateVersionRecord[];
}
