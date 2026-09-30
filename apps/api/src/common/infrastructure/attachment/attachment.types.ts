export interface AttachmentUploadOptions {
  entityType: string;
  entityId: string;
  category: string;
  storedFile: {
    fileName: string;
    mimeType: string;
    size: bigint | number;
    buffer?: Buffer;
  };
  uploadedById?: string | null;
}

export interface AttachmentRecord {
  id: string;
  entityType: string;
  entityId: string;
  category: string;
  storageAdapter: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  size: number;
  contentType: string | null;
  uploadedById: string | null;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface AttachmentListOptions {
  entityType?: string;
  entityId?: string;
  category?: string;
  uploadedById?: string;
  limit?: number;
  offset?: number;
}

export interface AttachmentListResult {
  items: AttachmentSummary[];
  total: number;
}

export interface AttachmentSummary {
  id: string;
  entityType: string;
  entityId: string;
  category: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedById: string | null;
  uploadedAt: Date;
}

export interface FileStreamResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}
