import { Injectable } from '@nestjs/common';

/**
 * Minimal local filesystem storage adapter used in development.
 * Production uses an S3-compatible adapter implementing the same interface.
 */
@Injectable()
export class LocalStorageService {
  async saveFile(file: { fileName: string; mimeType: string; size: bigint | number; buffer?: Buffer }) {
    return `local:${file.fileName}`;
  }

  async getFile(key: string): Promise<Buffer> {
    throw new Error('LocalStorageService.getFile not implemented');
  }

  async deleteFile(key: string): Promise<void> {
    // No-op: placeholder keys (`local:<fileName>`) have no backing file in dev.
  }
}
