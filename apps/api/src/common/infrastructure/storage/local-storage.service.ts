import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import * as path from 'path';
import type { StorageAdapter, StoredFile } from './storage-adapter.interface';

const STORAGE_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]{1,10})?$/;

/**
 * Local filesystem storage adapter (Phase 4). Files are written under ATTACHMENT_STORAGE_DIR,
 * which must be an absolute path OUTSIDE the repository and outside any public static folder.
 *
 * Keys are random UUIDs generated here, never the client filename, so a stored key cannot be
 * used for path traversal. If the directory is not configured the adapter fails closed (503).
 */
@Injectable()
export class LocalStorageService implements StorageAdapter {
  constructor(private readonly config: ConfigService) {}

  private baseDir(): string {
    const dir = this.config.get<string>('ATTACHMENT_STORAGE_DIR');
    if (!dir || !path.isAbsolute(dir)) {
      throw new ServiceUnavailableException('Attachment storage is not configured');
    }
    return dir;
  }

  private resolveKey(key: string): string {
    if (!STORAGE_KEY_PATTERN.test(key)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return path.join(this.baseDir(), key);
  }

  async saveFile(file: StoredFile): Promise<string> {
    if (!file.buffer) {
      throw new Error('LocalStorageService.saveFile requires file content');
    }
    const dir = this.baseDir();
    const extension = path.extname(file.fileName).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const key = `${randomUUID()}${/^\.[a-z0-9]{1,10}$/.test(extension) ? extension : ''}`;
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(path.join(dir, key), file.buffer, { flag: 'wx', mode: 0o600 });
    return key;
  }

  async getFile(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await unlink(this.resolveKey(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
