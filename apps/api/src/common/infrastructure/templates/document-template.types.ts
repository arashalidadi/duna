export type DocumentTemplateFormat = 'PDF' | 'EXCEL' | 'PDF_EXCEL';

export interface CreateTemplateDto {
  documentType: string;
  name: string;
  description?: string | null;
  createdById?: string | null;
}

export interface CreateTemplateVersionDto {
  templateId: string;
  label?: string | null;
  storageKey: string;
  mimeType: string;
  size?: number | bigint;
}

export interface TemplateVersionRecord {
  id: string;
  templateId: string;
  version: number;
  label: string | null;
  storageKey: string;
  storageAdapter: string;
  mimeType: string;
  size: bigint | number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateRecord {
  id: string;
  documentType: string;
  name: string;
  description: string | null;
  format: string;
  storageAdapter: string;
  isActive: boolean;
  currentVersionId: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  versions: TemplateVersionRecord[];
}

export interface TemplateListOptions {
  documentType?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface TemplateListResult {
  items: TemplateRecord[];
  total: number;
}
