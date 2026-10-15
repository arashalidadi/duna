import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException,
  ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../auth/types';
import { AuditService } from '../audit/audit.service';
import { STORAGE_ADAPTER_TOKEN } from '../storage/storage.token';
import type { StorageAdapter } from '../storage/storage-adapter.interface';
import { DocumentAssetsService } from '../../../modules/document-output/document-assets.service';
import { type DocumentLayout, type DocumentType, isDocumentType, validateLayout } from '../../../modules/document-output/document-layout';
import type { CreateTemplateDto, CreateTemplateVersionDto,
  TemplateRecord, TemplateVersionRecord } from './document-template.types';

const MAX_LAYOUT_BYTES = 128 * 1024;
const versionSelect = { id: true, templateId: true, version: true, label: true,
  mimeType: true, size: true, contentHash: true, isActive: true, createdAt: true } as const;
const templateSelect = { id: true, documentType: true, name: true, description: true,
  isActive: true, currentVersionId: true, createdAt: true,
  versions: { select: versionSelect, orderBy: { version: 'desc' as const }, take: 100 } } as const;

type Version = Prisma.DocumentTemplateVersionGetPayload<{ select: typeof versionSelect }>;
type Template = Prisma.DocumentTemplateGetPayload<{ select: typeof templateSelect }>;

/**
 * Immutable, hash-verified JSON layouts. Management, approval and real-record
 * rendering have separate permissions; no client supplies a storage key or actor.
 * Assignment history is append-only. There is deliberately no delete endpoint.
 */
@Injectable()
export class DocumentTemplateService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService,
    private readonly assets: DocumentAssetsService,
    @Inject(STORAGE_ADAPTER_TOKEN) private readonly storage: StorageAdapter) {}

  private version(row: Version): TemplateVersionRecord {
    return { id: row.id, templateId: row.templateId, version: row.version,
      label: row.label, mimeType: row.mimeType, size: Number(row.size),
      contentHash: row.contentHash, isActive: row.isActive, createdAt: row.createdAt };
  }
  private template(row: Template): TemplateRecord {
    return { id: row.id, documentType: row.documentType, name: row.name,
      description: row.description, isActive: row.isActive,
      currentVersionId: row.currentVersionId, createdAt: row.createdAt,
      versions: row.versions.map((v) => this.version(v)) };
  }

  list(documentType?: string): Promise<TemplateRecord[]> {
    if (documentType && !isDocumentType(documentType)) throw new BadRequestException('Unknown document type');
    return this.prisma.documentTemplate.findMany({ where: { deletedAt: null,
      ...(documentType ? { documentType } : {}) }, select: templateSelect,
      orderBy: { createdAt: 'desc' }, take: 200 }).then((rows) => rows.map((r) => this.template(r)));
  }

  /** Preserve the pre-Phase-8 paginated list envelope for existing callers. */
  async listPage(options: { documentType?: string; activeOnly?: boolean; limit?: number; offset?: number }) {
    if (options.documentType && !isDocumentType(options.documentType)) throw new BadRequestException('Unknown document type');
    if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
      throw new BadRequestException('Invalid limit');
    }
    if (options.offset !== undefined && (!Number.isInteger(options.offset) || options.offset < 0)) {
      throw new BadRequestException('Invalid offset');
    }
    const where = { deletedAt: null,
      ...(options.documentType ? { documentType: options.documentType } : {}),
      ...(options.activeOnly !== undefined ? { isActive: options.activeOnly } : {}) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.documentTemplate.findMany({ where, select: templateSelect,
        orderBy: { createdAt: 'desc' }, skip: options.offset ?? 0,
        take: Math.min(options.limit ?? 100, 500) }),
      this.prisma.documentTemplate.count({ where }),
    ]);
    return { items: rows.map((r) => this.template(r)), total };
  }

  async getByName(name: string): Promise<TemplateRecord | null> {
    const row = await this.prisma.documentTemplate.findFirst({ where: { name, deletedAt: null }, select: templateSelect });
    return row ? this.template(row) : null;
  }

  async getActiveVersion(templateId: string): Promise<TemplateVersionRecord> {
    const active = await this.prisma.documentTemplateVersion.findFirst({
      where: { templateId, isActive: true, template: { deletedAt: null, isActive: true } },
      orderBy: { version: 'desc' }, select: versionSelect,
    });
    if (!active) throw new NotFoundException('No active version found');
    return this.version(active);
  }

  async get(id: string): Promise<TemplateRecord> {
    const row = await this.prisma.documentTemplate.findFirst({ where: { id, deletedAt: null }, select: templateSelect });
    if (!row) throw new NotFoundException('Template not found');
    return this.template(row);
  }

  async create(dto: CreateTemplateDto, actor: AuthenticatedUser): Promise<TemplateRecord> {
    if (!isDocumentType(dto.documentType) || !dto.name?.trim()) throw new BadRequestException('Invalid template');
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.documentTemplate.create({ data: {
        documentType: dto.documentType, name: dto.name.trim(),
        description: dto.description?.trim() || null, createdById: actor.id,
        isActive: false, format: 'PDF_EXCEL',
      }, select: templateSelect });
      await this.audit.recordIn(tx, { action: 'document_template.create', entityType: 'DocumentTemplate',
        entityId: created.id, actorId: actor.id, actorEmail: actor.email,
        afterData: { name: created.name, documentType: created.documentType } });
      return created;
    });
    return this.template(row);
  }

  async addVersion(id: string, dto: CreateTemplateVersionDto, actor: AuthenticatedUser): Promise<TemplateVersionRecord> {
    const layout = validateLayout(dto.layout);
    const bytes = Buffer.from(JSON.stringify(layout), 'utf8');
    if (bytes.length > MAX_LAYOUT_BYTES) throw new BadRequestException('Template JSON exceeds 128 KiB');
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    const storageKey = await this.storage.saveFile({ fileName: 'template.json', mimeType: 'application/json',
      size: bytes.length, buffer: bytes });
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        // Versions for a template are serialized even under simultaneous editors.
        const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "DocumentTemplate" WHERE "id" = ${id} FOR UPDATE`;
        if (!locked.length) throw new NotFoundException('Template not found');
        const template = await tx.documentTemplate.findUnique({ where: { id }, select: { deletedAt: true } });
        if (template?.deletedAt) throw new ConflictException('Template was retired');
        const prior = await tx.documentTemplateVersion.findFirst({ where: { templateId: id },
          orderBy: { version: 'desc' }, select: { version: true } });
        const created = await tx.documentTemplateVersion.create({ data: {
          templateId: id, version: (prior?.version ?? 0) + 1,
          label: dto.label?.trim() || null, storageKey,
          storageAdapter: 'local', mimeType: 'application/json', size: BigInt(bytes.length),
          contentHash, isActive: false,
        }, select: versionSelect });
        await this.audit.recordIn(tx, { action: 'document_template.version', entityType: 'DocumentTemplateVersion',
          entityId: created.id, actorId: actor.id, actorEmail: actor.email,
          afterData: { templateId: id, version: created.version, contentHash } });
        return created;
      });
      return this.version(row);
    } catch (error) {
      await this.storage.deleteFile(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async getVersion(id: string, n: number): Promise<TemplateVersionRecord> {
    if (!Number.isSafeInteger(n) || n < 1) throw new BadRequestException('Invalid template version');
    const version = await this.prisma.documentTemplateVersion.findUnique({
      where: { templateId_version: { templateId: id, version: n } }, select: versionSelect });
    if (!version) throw new NotFoundException('Template version not found');
    return this.version(version);
  }

  async readLayout(versionId: string): Promise<DocumentLayout> {
    const version = await this.prisma.documentTemplateVersion.findUnique({ where: { id: versionId } });
    if (!version || version.mimeType !== 'application/json' || !version.contentHash ||
      version.storageAdapter !== 'local') {
      throw new ConflictException('This template version is not a Phase-8 JSON layout');
    }
    let bytes: Buffer;
    try { bytes = await this.storage.getFile(version.storageKey); }
    catch { throw new ServiceUnavailableException('Template content is unavailable'); }
    if (bytes.length !== Number(version.size) ||
      createHash('sha256').update(bytes).digest('hex') !== version.contentHash) {
      throw new ServiceUnavailableException('Template content failed integrity verification');
    }
    try { return validateLayout(JSON.parse(bytes.toString('utf8'))); }
    catch { throw new ServiceUnavailableException('Template content is invalid'); }
  }

  /** Activation is an atomic, audited change to a type's one current assignment. */
  async assign(id: string, n: number, actor: AuthenticatedUser): Promise<TemplateVersionRecord> {
    const version = await this.getVersion(id, n);
    const layout = await this.readLayout(version.id);
    await this.assets.assertBindable(layout);
    const current = await this.prisma.$transaction(async (tx) => {
      const template = await tx.documentTemplate.findUnique({ where: { id } });
      if (!template || template.deletedAt || !isDocumentType(template.documentType)) {
        throw new NotFoundException('Template not found');
      }
      // PostgreSQL transaction-scoped lock also serializes two different templates of this type.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${template.documentType}))`;
      const before = await tx.documentTemplateAssignment.findFirst({ where: { documentType: template.documentType },
        orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }], select: { versionId: true } });
      await tx.documentTemplate.updateMany({ where: { documentType: template.documentType, deletedAt: null },
        data: { isActive: false, currentVersionId: null } });
      await tx.documentTemplateVersion.updateMany({ where: { template: { documentType: template.documentType } },
        data: { isActive: false } });
      await tx.documentTemplateVersion.update({ where: { id: version.id }, data: { isActive: true } });
      await tx.documentTemplate.update({ where: { id },
        data: { isActive: true, currentVersionId: version.id } });
      await tx.documentTemplateAssignment.create({ data: {
        documentType: template.documentType, templateId: id, versionId: version.id,
        assignedById: actor.id,
      } });
      await this.audit.recordIn(tx, { action: 'document_template.assign', entityType: 'DocumentTemplate',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { versionId: before?.versionId ?? null }, afterData: { versionId: version.id } });
      return tx.documentTemplateVersion.findUniqueOrThrow({ where: { id: version.id }, select: versionSelect });
    });
    return this.version(current);
  }

  async deactivate(id: string, actor: AuthenticatedUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const template = await tx.documentTemplate.findUnique({ where: { id } });
      if (!template || template.deletedAt) throw new NotFoundException('Template not found');
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${template.documentType}))`;
      if (!template.isActive) return;
      await tx.documentTemplate.update({ where: { id }, data: { isActive: false, currentVersionId: null } });
      await tx.documentTemplateVersion.updateMany({ where: { templateId: id }, data: { isActive: false } });
      await tx.documentTemplateAssignment.create({ data: {
        documentType: template.documentType, assignedById: actor.id,
      } });
      await this.audit.recordIn(tx, { action: 'document_template.deactivate', entityType: 'DocumentTemplate',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { versionId: template.currentVersionId }, afterData: { versionId: null } });
    });
  }

  /** For historical output, choose the assignment active AT issuance, not now. */
  async versionAt(type: DocumentType, at?: Date | null): Promise<string | null> {
    const assignment = await this.prisma.documentTemplateAssignment.findFirst({
      where: { documentType: type, ...(at ? { assignedAt: { lte: at } } : {}) },
      orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }], select: { versionId: true },
    });
    return assignment?.versionId ?? null;
  }
}
