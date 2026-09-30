import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_ADAPTER_TOKEN } from '../storage/storage.token';
import type { StorageAdapter } from '../storage/storage-adapter.interface';
import type {
  AttachmentListOptions,
  AttachmentListResult,
  AttachmentRecord,
  AttachmentSummary,
  AttachmentUploadOptions,
  FileStreamResult,
} from './attachment.types';

const attachmentSummaryFields = {
  id: true,
  entityType: true,
  entityId: true,
  category: true,
  storageKey: true,
  filename: true,
  mimeType: true,
  size: true,
  uploadedById: true,
  uploadedAt: true,
} as const;

/**
 * Generic file-attachment infrastructure (Phase 1). Storage is delegated to the
 * injected adapter; metadata rows live in FileAttachment. Soft-delete keeps the
 * row; deleteWithStorage also removes the backing file (best effort).
 */
@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER_TOKEN) private readonly storage: StorageAdapter
  ) {}

  async upload(options: AttachmentUploadOptions): Promise<AttachmentRecord> {
    const storageKey = await this.storage.saveFile(options.storedFile);
    const entity = await this.prisma.fileAttachment.create({
      data: {
        entityType: options.entityType,
        entityId: options.entityId,
        category: options.category,
        storageAdapter: 'local',
        storageKey,
        filename: options.storedFile.fileName,
        mimeType: options.storedFile.mimeType,
        size: options.storedFile.size,
        contentType: null,
        uploadedById: options.uploadedById ?? null,
        uploadedAt: new Date(),
      },
    });
    this.logger.debug(
      `Attachment created: ${entity.id} for ${options.entityType}:${options.entityId}`
    );
    return this.mapRecord(entity);
  }

  async getById(id: string): Promise<AttachmentRecord> {
    const attachment = await this.prisma.fileAttachment.findUnique({ where: { id } });
    if (!attachment) {
      throw new NotFoundException(`Attachment not found: ${id}`);
    }
    return this.mapRecord(attachment);
  }

  async getByEntity(entityType: string, entityId: string): Promise<AttachmentRecord[]> {
    const rows = await this.prisma.fileAttachment.findMany({
      where: { entityType, entityId, deletedAt: null },
      orderBy: { uploadedAt: 'desc' },
    });
    return rows.map((r) => this.mapRecord(r));
  }

  async getByCategory(category: string): Promise<AttachmentRecord[]> {
    const rows = await this.prisma.fileAttachment.findMany({
      where: { category, deletedAt: null },
      orderBy: { uploadedAt: 'desc' },
    });
    return rows.map((r) => this.mapRecord(r));
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.prisma.fileAttachment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Attachment not found: ${id}`);
    }
    await this.prisma.fileAttachment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async deleteWithStorage(id: string): Promise<void> {
    const existing = await this.prisma.fileAttachment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Attachment not found: ${id}`);
    }
    try {
      await this.storage.deleteFile(existing.storageKey);
    } catch (e) {
      this.logger.warn(
        `Failed to delete storage file for attachment ${id}: ${(e as Error).message}`
      );
    }
    await this.prisma.fileAttachment.delete({ where: { id } });
  }

  async readFile(id: string): Promise<Buffer> {
    const attachment = await this.getById(id);
    if (attachment.storageAdapter !== 'local') {
      throw new BadRequestException(
        `Cannot read attachment with non-local storage: ${attachment.id}`
      );
    }
    return this.storage.getFile(attachment.storageKey);
  }

  async getFileStream(id: string): Promise<FileStreamResult> {
    const attachment = await this.getById(id);
    const buffer = await this.readFile(id);
    return { buffer, mimeType: attachment.mimeType, filename: attachment.filename };
  }

  async list(options?: AttachmentListOptions): Promise<AttachmentListResult> {
    const limit = Math.min(options?.limit ?? 100, 500);
    const offset = options?.offset ?? 0;
    const where = {
      deletedAt: null,
      ...(options?.entityType ? { entityType: options.entityType } : {}),
      ...(options?.entityId ? { entityId: options.entityId } : {}),
      ...(options?.category ? { category: options.category } : {}),
      ...(options?.uploadedById ? { uploadedById: options.uploadedById } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.fileAttachment.findMany({
        where,
        orderBy: { uploadedAt: 'desc' },
        skip: offset,
        take: limit,
        select: attachmentSummaryFields,
      }),
      this.prisma.fileAttachment.count({ where }),
    ]);
    return {
      items: rows as unknown as AttachmentSummary[],
      total,
    };
  }

  private mapRecord(row: {
    id: string;
    entityType: string;
    entityId: string;
    category: string;
    storageAdapter: string;
    storageKey: string;
    filename: string;
    mimeType: string;
    size: bigint | number;
    contentType: string | null;
    uploadedById: string | null;
    uploadedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): AttachmentRecord {
    return {
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      category: row.category,
      storageAdapter: row.storageAdapter,
      storageKey: row.storageKey,
      filename: row.filename,
      mimeType: row.mimeType,
      size: typeof row.size === 'bigint' ? Number(row.size) : row.size,
      contentType: row.contentType,
      uploadedById: row.uploadedById,
      uploadedAt: row.uploadedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }
}
