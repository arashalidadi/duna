/**
 * Contract for pluggable storage adapters (local dev / S3-compatible prod).
 * Kept structural-only so infrastructure stays independent of Nest decorators.
 */
export interface StorageAdapter {
  saveFile(file: StoredFile): Promise<string>;
  getFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
}

export interface StoredFile {
  fileName: string;
  mimeType: string;
  size: bigint | number;
  buffer?: Buffer;
}

export interface StorageUploadResult {
  storageKey: string;
  storageAdapter: string;
}
