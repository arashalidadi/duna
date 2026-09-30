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
  CreateTemplateDto,
  CreateTemplateVersionDto,
  TemplateListOptions,
  TemplateListResult,
  TemplateRecord,
  TemplateVersionRecord,
} from './document-template.types';

/**
 * Versioned document-template registry (ADR-009). One logical template per
 * document type; exactly one version may be active at a time and switching it
 * is an atomic deactivation of the previous active version.
 */
@Injectable()
export class DocumentTemplateService {
  private readonly logger = new Logger(DocumentTemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER_TOKEN) private readonly storage: StorageAdapter
  ) {}

  async createTemplate(dto: CreateTemplateDto): Promise<TemplateRecord> {
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { name: dto.name },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (existing) {
      throw new BadRequestException(`Template with name "${dto.name}" already exists`);
    }

    const template = await this.prisma.documentTemplate.create({
      data: {
        documentType: dto.documentType,
        name: dto.name,
        description: dto.description ?? null,
        createdById: dto.createdById ?? null,
        format: 'PDF',
      },
      include: { versions: { take: 1, orderBy: { version: 'desc' } } },
    });
    return this.mapTemplate(template);
  }

  async createVersion(
    templateId: string,
    dto: CreateTemplateVersionDto
  ): Promise<TemplateVersionRecord> {
    const template = await this.prisma.documentTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new NotFoundException(`Template not found: ${templateId}`);
    }

    const maxVersion = await this.prisma.documentTemplateVersion.count({
      where: { templateId },
    });
    const version = maxVersion + 1;

    const versionRecord = await this.prisma.documentTemplateVersion.create({
      data: {
        templateId,
        version,
        label: dto.label ?? null,
        storageKey: dto.storageKey,
        storageAdapter: 'local',
        mimeType: dto.mimeType,
        size: BigInt(dto.size ?? 0),
        isActive: false,
      },
      include: { template: true },
    });
    return this.mapVersion(versionRecord);
  }

  async getTemplate(id: string): Promise<TemplateRecord> {
    const template = await this.prisma.documentTemplate.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 100 },
      },
    });
    if (!template) {
      throw new NotFoundException(`Template not found: ${id}`);
    }
    return this.mapTemplate(template);
  }

  async getTemplateByName(name: string): Promise<TemplateRecord | null> {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { name },
      include: { versions: { orderBy: { version: 'desc' }, take: 100 } },
    });
    if (!template) return null;
    return this.mapTemplate(template);
  }

  async listTemplates(options?: TemplateListOptions): Promise<TemplateListResult> {
    const limit = Math.min(options?.limit ?? 100, 500);
    const offset = options?.offset ?? 0;
    const where = {
      ...(options?.documentType ? { documentType: options.documentType } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.documentTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          versions: { orderBy: { version: 'desc' }, take: 100 },
        },
      }),
      this.prisma.documentTemplate.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.mapTemplate(r)),
      total,
    };
  }

  async getVersion(templateId: string, version: number): Promise<TemplateVersionRecord> {
    const versionRecord = await this.prisma.documentTemplateVersion.findUnique({
      where: { templateId_version: { templateId, version } },
    });
    if (!versionRecord) {
      throw new NotFoundException(`Version ${version} not found for template ${templateId}`);
    }
    return this.mapVersion(versionRecord);
  }

  async getActiveVersion(templateId: string): Promise<TemplateVersionRecord> {
    const active = await this.prisma.documentTemplateVersion.findFirst({
      where: {
        templateId,
        isActive: true,
      },
      orderBy: { version: 'desc' },
    });
    if (!active) {
      throw new NotFoundException(`No active version found for template ${templateId}`);
    }
    return this.mapVersion(active);
  }

  async setActiveVersion(
    templateId: string,
    version: number
  ): Promise<TemplateVersionRecord> {
    const target = await this.prisma.documentTemplateVersion.findUnique({
      where: { templateId_version: { templateId, version } },
    });
    if (!target) {
      throw new NotFoundException(`Version ${version} not found for template ${templateId}`);
    }
    await this.prisma.documentTemplateVersion.updateMany({
      where: { templateId },
      data: { isActive: false },
    });
    const updated = await this.prisma.documentTemplateVersion.update({
      where: { templateId_version: { templateId, version } },
      data: { isActive: true },
    });
    return this.mapVersion(updated);
  }

  async readTemplateVersionContent(
    templateId: string,
    version: number
  ): Promise<Buffer> {
    const versionRecord = await this.getVersion(templateId, version);
    if (versionRecord.storageAdapter !== 'local') {
      throw new BadRequestException(
        `Cannot read version with non-local storage: ${versionRecord.id}`
      );
    }
    return this.storage.getFile(versionRecord.storageKey);
  }

  private mapTemplate(row: {
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
    versions?: unknown[];
  }): TemplateRecord {
    const versions = row.versions as
    | {
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
      }[]
    | undefined;

    return {
      id: row.id,
      documentType: row.documentType,
      name: row.name,
      description: row.description,
      format: row.format,
      storageAdapter: row.storageAdapter,
      isActive: row.isActive,
      currentVersionId: row.currentVersionId,
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      versions: versions?.map((v) => this.mapVersion(v)) ?? [],
    };
  }

  private mapVersion(row: {
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
  }): TemplateVersionRecord {
    return {
      id: row.id,
      templateId: row.templateId,
      version: row.version,
      label: row.label,
      storageKey: row.storageKey,
      storageAdapter: row.storageAdapter,
      mimeType: row.mimeType,
      size: row.size,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
