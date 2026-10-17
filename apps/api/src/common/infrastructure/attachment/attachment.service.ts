import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../auth/types';
import { AuditService } from '../audit/audit.service';
import { STORAGE_ADAPTER_TOKEN } from '../storage/storage.token';
import type { StorageAdapter } from '../storage/storage-adapter.interface';
import {
  ATTACHMENT_MIME_RULES,
  ATTACHMENT_ENTITY_TYPES,
  AttachmentEntityType,
  DEFAULT_MAX_ATTACHMENT_BYTES,
  IdentityAttachmentCategory,
  isAllowedMimeType,
  isIdentityCategory,
  matchesMagicBytes,
  sanitizeFilename,
} from './attachment-policy';
import {
  AttachmentTokenException,
  signAttachmentToken,
  verifyAttachmentToken,
} from './attachment-url';
import type {
  AttachmentListOptions,
  AttachmentListResult,
  AttachmentSummary,
  DownloadedFile,
  UploadedDocument,
} from './attachment.types';

const IDENTITY_PERMISSION = 'attachment:identity';
const DEFAULT_URL_TTL_SECONDS = 300;
const MAX_URL_TTL_SECONDS = 900;

const summaryFields = {
  id: true,
  entityType: true,
  entityId: true,
  category: true,
  filename: true,
  mimeType: true,
  size: true,
  uploadedById: true,
  uploadedAt: true,
} as const;

export interface AttachmentRequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface UploadAttachmentInput extends AttachmentRequestContext {
  user: AuthenticatedUser;
  entityType: AttachmentEntityType;
  entityId: string;
  category: IdentityAttachmentCategory;
  file: UploadedDocument | undefined;
}

/**
 * Attachment service (Phase 4). Identity-document categories (DEC-092) require the
 * `attachment:identity` permission in addition to the base attachment permission. The primary
 * administrator is exempt (DEC-116). Storage keys never leave the server, downloads need a
 * short-lived signed token (DEC-090), and every create, URL issue, download and delete is audited
 * (DEC-089). Physical deletion is not performed: delete is a soft delete until a retention policy
 * is decided (DEC-091, OQ-12).
 */
@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @Inject(STORAGE_ADAPTER_TOKEN) private readonly storage: StorageAdapter
  ) {}

  /** Throws unless the principal may handle identity documents. */
  assertIdentityAccess(user: AuthenticatedUser): void {
    if (user.isPrimaryAdmin === true) {
      return;
    }
    if (!(user.permissions ?? []).includes(IDENTITY_PERMISSION)) {
      throw new ForbiddenException('Insufficient permissions for identity documents');
    }
  }

  async upload(input: UploadAttachmentInput): Promise<AttachmentSummary> {
    this.assertIdentityAccess(input.user);
    if (this.config.get<string>('ATTACHMENT_IDENTITY_CAPTURE_ENABLED') !== 'true') {
      throw new ForbiddenException(
        'Identity document capture is disabled until the retention period and lawful basis are recorded'
      );
    }
    // DEC-118: enabling a feature flag alone is insufficient. The actual
    // compliance period, authority and lawful basis must be stored and audited.
    const retention = await this.prisma.retentionPolicy.findUnique({
      where: { scope: 'IDENTITY_DOCUMENT' },
    });
    if (!retention?.minimumDays || !retention.authority || !retention.lawfulBasis) {
      throw new ForbiddenException('Identity retention period and lawful basis are not configured');
    }
    if (!ATTACHMENT_ENTITY_TYPES.includes(input.entityType)) {
      throw new BadRequestException('Unsupported entity type');
    }
    if (!isIdentityCategory(input.category)) {
      throw new BadRequestException('Unsupported attachment category');
    }

    const file = input.file;
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    if (file.size > this.maxBytes()) {
      throw new PayloadTooLargeException('File exceeds the size limit');
    }
    if (!isAllowedMimeType(file.mimetype)) {
      throw new UnsupportedMediaTypeException('File type is not allowed');
    }
    if (!matchesMagicBytes(file.buffer, file.mimetype)) {
      throw new BadRequestException('File content does not match its declared type');
    }

    await this.assertEntityExists(input.entityType, input.entityId);

    const canonicalName = `document.${ATTACHMENT_MIME_RULES[file.mimetype].extension}`;
    const storageKey = await this.storage.saveFile({
      fileName: canonicalName,
      mimeType: file.mimetype,
      size: file.size,
      buffer: file.buffer,
    });

    const row = await this.prisma.$transaction(async (tx) => {
      const saved = await this.createRow(tx, input, storageKey);
      await this.audit.recordIn(tx, { action: 'attachment.create', entityType: 'FileAttachment',
        entityId: saved.id, actorId: input.user.id, actorEmail: input.user.email,
        afterData: { entityType: saved.entityType, entityId: saved.entityId,
          category: saved.category, size: saved.size.toString() },
        ipAddress: input.ipAddress ?? null, userAgent: input.userAgent ?? null });
      return saved;
    }).catch(async (error: unknown) => {
      await this.storage.deleteFile(storageKey).catch(() => undefined);
      throw error;
    });
    return this.toSummary(row);
  }

  async list(user: AuthenticatedUser, options: AttachmentListOptions = {}): Promise<AttachmentListResult> {
    this.assertIdentityAccess(user);
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
    const offset = Math.max(options.offset ?? 0, 0);
    const where = {
      deletedAt: null,
      ...(options.entityType ? { entityType: options.entityType } : {}),
      ...(options.entityId ? { entityId: options.entityId } : {}),
      ...(options.category ? { category: options.category } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.fileAttachment.findMany({
        where,
        orderBy: { uploadedAt: 'desc' },
        skip: offset,
        take: limit,
        select: summaryFields,
      }),
      this.prisma.fileAttachment.count({ where }),
    ]);
    await this.audit.record({ action: 'attachment.list_metadata', entityType: 'FileAttachment',
      entityId: 'collection', actorId: user.id, actorEmail: user.email,
      metadata: { entityType: options.entityType ?? null, entityId: options.entityId ?? null,
        category: options.category ?? null, offset, returned: rows.length } });
    return { items: rows.map((row) => this.toSummary(row)), total };
  }

  async getById(user: AuthenticatedUser, id: string): Promise<AttachmentSummary> {
    this.assertIdentityAccess(user);
    const row = await this.findLiveRow(id);
    await this.audit.record({ action: 'attachment.read_metadata', entityType: 'FileAttachment',
      entityId: row.id, actorId: user.id, actorEmail: user.email });
    return this.toSummary(row);
  }

  /** Issues a short-lived signed download token. The caller must already be authorised. */
  async issueDownloadToken(
    user: AuthenticatedUser,
    id: string,
    context: AttachmentRequestContext
  ): Promise<{ path: string; expiresAt: string }> {
    this.assertIdentityAccess(user);
    const row = await this.findLiveRow(id);
    const secret = this.signingSecret();
    const ttl = this.urlTtlSeconds();
    const exp = Math.floor(Date.now() / 1000) + ttl;
    const token = signAttachmentToken({ aid: row.id, uid: user.id, exp }, secret);

    await this.audit.record({
      action: 'attachment.url_issued',
      entityType: 'FileAttachment',
      entityId: row.id,
      actorId: user.id,
      actorEmail: user.email,
      metadata: { expiresInSeconds: ttl },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });
    return {
      path: `attachments/download?token=${encodeURIComponent(token)}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  /**
   * Resolves a signed token into file bytes. The token is the only credential on this route, so
   * the issuing user is re-checked (active, not deleted, still holds the identity permission).
   */
  async downloadWithToken(token: string, context: AttachmentRequestContext): Promise<DownloadedFile> {
    let payload: ReturnType<typeof verifyAttachmentToken>;
    try {
      payload = verifyAttachmentToken(token, this.signingSecret(), Math.floor(Date.now() / 1000));
    } catch (error) {
      if (error instanceof AttachmentTokenException) {
        throw new UnauthorizedException('Download link is invalid or has expired');
      }
      throw error;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.uid },
      select: { id: true, email: true, isActive: true, deletedAt: true, isPrimaryAdmin: true },
    });
    if (!user || !user.isActive || user.deletedAt) {
      throw new ForbiddenException('Insufficient permissions for identity documents');
    }
    if (!user.isPrimaryAdmin) {
      const granted = await this.prisma.role.count({
        where: {
          deletedAt: null,
          users: { some: { userId: user.id } },
          permissions: { some: { permission: { code: IDENTITY_PERMISSION } } },
        },
      });
      if (granted === 0) {
        throw new ForbiddenException('Insufficient permissions for identity documents');
      }
    }

    const row = await this.findLiveRow(payload.aid);
    const buffer = await this.readStored(row.storageKey);

    await this.audit.record({
      action: 'attachment.download',
      entityType: 'FileAttachment',
      entityId: row.id,
      actorId: user.id,
      actorEmail: user.email,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });
    return { buffer, mimeType: row.mimeType, filename: row.filename };
  }

  async softDelete(user: AuthenticatedUser, id: string, context: AttachmentRequestContext): Promise<{ id: string }> {
    this.assertIdentityAccess(user);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.fileAttachment.findUnique({ where: { id } });
      if (!row || row.deletedAt) throw new NotFoundException('Attachment not found');
      const result = await tx.fileAttachment.updateMany({ where: { id, deletedAt: null },
        data: { deletedAt: new Date() } });
      if (result.count !== 1) throw new NotFoundException('Attachment not found');
      await this.audit.recordIn(tx, { action: 'attachment.delete', entityType: 'FileAttachment',
        entityId: row.id, actorId: user.id, actorEmail: user.email,
        beforeData: { entityType: row.entityType, entityId: row.entityId, category: row.category },
        afterData: { deleted: true }, ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null });
      return { id: row.id };
    });
  }

  private async createRow(tx: Prisma.TransactionClient, input: UploadAttachmentInput, storageKey: string) {
    return tx.fileAttachment.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        category: input.category,
        storageAdapter: 'local',
        storageKey,
        filename: sanitizeFilename(input.file?.originalname ?? ''),
        mimeType: input.file?.mimetype ?? 'application/octet-stream',
        size: BigInt(input.file?.size ?? 0),
        contentType: null,
        uploadedById: input.user.id,
        uploadedAt: new Date(),
      },
    });
  }

  private async findLiveRow(id: string) {
    const row = await this.prisma.fileAttachment.findUnique({ where: { id } });
    if (!row || row.deletedAt) {
      throw new NotFoundException('Attachment not found');
    }
    return row;
  }

  private async readStored(storageKey: string): Promise<Buffer> {
    try {
      return await this.storage.getFile(storageKey);
    } catch (error) {
      this.logger.error(`Attachment content unavailable: ${(error as Error).message}`);
      throw new NotFoundException('Attachment content is unavailable');
    }
  }

  private async assertEntityExists(entityType: AttachmentEntityType, entityId: string): Promise<void> {
    const found =
      entityType === 'VOUCHER'
        ? await this.prisma.voucher.findUnique({ where: { id: entityId }, select: { id: true } })
        : await this.prisma.salaryRecord.findUnique({ where: { id: entityId }, select: { id: true } });
    if (!found) {
      throw new NotFoundException(`${entityType} not found`);
    }
  }

  private toSummary(row: {
    id: string;
    entityType: string;
    entityId: string;
    category: string;
    filename: string;
    mimeType: string;
    size: bigint | number;
    uploadedById: string | null;
    uploadedAt: Date;
  }): AttachmentSummary {
    return {
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      category: row.category,
      filename: row.filename,
      mimeType: row.mimeType,
      size: Number(row.size),
      uploadedById: row.uploadedById,
      uploadedAt: row.uploadedAt,
    };
  }

  private maxBytes(): number {
    const configured = Number(this.config.get('ATTACHMENT_MAX_BYTES'));
    return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_ATTACHMENT_BYTES;
  }

  private urlTtlSeconds(): number {
    const configured = Number(this.config.get('ATTACHMENT_URL_TTL_SECONDS'));
    if (!Number.isInteger(configured) || configured <= 0) {
      return DEFAULT_URL_TTL_SECONDS;
    }
    return Math.min(configured, MAX_URL_TTL_SECONDS);
  }

  private signingSecret(): string {
    const secret = this.config.get<string>('ATTACHMENT_URL_SECRET');
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException('Attachment download signing is not configured');
    }
    return secret;
  }
}
