export interface AttachmentSummary {
  id: string;
  entityType: string;
  entityId: string;
  category: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedById: string | null;
  uploadedAt: Date;
}

export interface AttachmentListOptions {
  entityType?: string;
  entityId?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface AttachmentListResult {
  items: AttachmentSummary[];
  total: number;
}

export interface UploadedDocument {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface DownloadedFile {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}
