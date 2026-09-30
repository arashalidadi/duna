export interface StorageFile {
  fileName: string;
  mimeType: string;
  size: bigint | number;
  buffer?: Buffer;
}
