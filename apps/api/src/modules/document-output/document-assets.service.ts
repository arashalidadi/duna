import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException,
  PayloadTooLargeException, ServiceUnavailableException, UnsupportedMediaTypeException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { STORAGE_ADAPTER_TOKEN } from '../../common/infrastructure/storage/storage.token';
import type { StorageAdapter } from '../../common/infrastructure/storage/storage-adapter.interface';
import type { DocumentLayout } from './document-layout';

export const ASSET_KINDS = ['LOGO', 'LETTERHEAD', 'STAMP', 'SIGNATURE'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const MIME: Record<string, { extension: string; magic: number[] }> = {
  'image/png': { extension: 'png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'image/jpeg': { extension: 'jpg', magic: [0xff, 0xd8, 0xff] },
};
export type UploadedAsset = { buffer: Buffer; size: number; mimetype: string };

/** Reject compressed image bombs and malformed files before storing artwork. */
export function inspectArtworkImage(bytes: Buffer, mimeType: string): void {
  let width = 0; let height = 0;
  if (mimeType === 'image/png') {
    if (bytes.length < 33 || bytes.toString('ascii', 12, 16) !== 'IHDR') {
      throw new BadRequestException('Malformed PNG artwork');
    }
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20);
  } else if (mimeType === 'image/jpeg') {
    let pos = 2;
    const frames = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    while (pos + 4 <= bytes.length) {
      if (bytes[pos++] !== 0xff) break;
      while (bytes[pos] === 0xff) pos++;
      const marker = bytes[pos++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (pos + 2 > bytes.length) break;
      const size = bytes.readUInt16BE(pos);
      if (size < 2 || pos + size > bytes.length) break;
      if (frames.has(marker) && size >= 7) {
        height = bytes.readUInt16BE(pos + 3); width = bytes.readUInt16BE(pos + 5);
        break;
      }
      pos += size;
    }
  }
  if (!width || !height || width > 4_000 || height > 4_000 || width * height > 16_000_000) {
    throw new BadRequestException('Artwork must be a valid image of at most 4,000 × 4,000 pixels');
  }
}

/** Company artwork is separate from identity documents; no identity policy is weakened. */
@Injectable()
export class DocumentAssetsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService,
    @Inject(STORAGE_ADAPTER_TOKEN) private readonly storage: StorageAdapter) {}

  async list(user: AuthenticatedUser) {
    const rows = await this.prisma.documentAsset.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    await this.audit.record({ action: 'document_asset.list_metadata', entityType: 'DocumentAsset',
      entityId: 'collection', actorId: user.id, actorEmail: user.email,
      metadata: { returned: rows.length } });
    return rows.map(({ storageKey: _key, ...visible }) => visible);
  }

  async upload(user: AuthenticatedUser, kind: AssetKind, name: string, file?: UploadedAsset) {
    if (!(ASSET_KINDS as readonly string[]).includes(kind) || !name?.trim() || name.length > 100) {
      throw new BadRequestException('Invalid asset kind or name');
    }
    if (!file?.buffer?.length || !Number.isInteger(file.size) || file.size !== file.buffer.length) {
      throw new BadRequestException('An image file is required');
    }
    if (file.size > MAX_ASSET_BYTES) throw new PayloadTooLargeException('Asset exceeds 2 MiB');
    const rule = MIME[file.mimetype];
    if (!rule) throw new UnsupportedMediaTypeException('Only PNG or JPEG company artwork is accepted');
    if (!rule.magic.every((byte, i) => file.buffer[i] === byte)) {
      throw new BadRequestException('Asset bytes do not match their declared MIME type');
    }
    inspectArtworkImage(file.buffer, file.mimetype);
    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const key = await this.storage.saveFile({ fileName: `artwork.${rule.extension}`,
      size: file.size, mimeType: file.mimetype, buffer: file.buffer });
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.documentAsset.create({ data: { kind, name: name.trim(),
          storageKey: key, mimeType: file.mimetype, size: file.size,
          sha256: hash, createdById: user.id } });
        await this.audit.recordIn(tx, { action: 'document_asset.upload', entityType: 'DocumentAsset',
          entityId: saved.id, actorId: user.id, actorEmail: user.email,
          afterData: { kind, name: saved.name, sha256: hash } });
        return saved;
      });
      const { storageKey: _key, ...visible } = row;
      return visible;
    } catch (error) {
      await this.storage.deleteFile(key).catch(() => undefined);
      throw error;
    }
  }

  async approve(id: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      // Approval and retirement must read the same locked version that is
      // audited; otherwise concurrent decisions can log stale states.
      await tx.$queryRaw`SELECT "id" FROM "DocumentAsset" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.documentAsset.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Company asset not found');
      if (before.deactivatedAt) throw new ConflictException('A retired asset cannot be reapproved; upload a new version');
      if (before.isApproved) return this.publicRow(before);
      const after = await tx.documentAsset.update({ where: { id }, data: { isApproved: true, approvedAt: new Date() } });
      await this.audit.recordIn(tx, { action: 'document_asset.approve', entityType: 'DocumentAsset',
        entityId: id, actorId: user.id, actorEmail: user.email, beforeData: { isApproved: false },
        afterData: { isApproved: true, sha256: after.sha256 } });
      return this.publicRow(after);
    });
  }

  async retire(id: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "DocumentAsset" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.documentAsset.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Company asset not found');
      if (before.deactivatedAt) return this.publicRow(before);
      const after = await tx.documentAsset.update({ where: { id },
        data: { isApproved: false, deactivatedAt: new Date() } });
      await this.audit.recordIn(tx, { action: 'document_asset.retire', entityType: 'DocumentAsset',
        entityId: id, actorId: user.id, actorEmail: user.email,
        beforeData: { isApproved: before.isApproved }, afterData: { isApproved: false } });
      return this.publicRow(after);
    });
  }

  /** A new assignment may reference only currently approved, type-matched assets. */
  async assertBindable(layout: DocumentLayout): Promise<void> {
    for (const [field, kind] of [
      ['logoAssetId', 'LOGO'], ['letterheadAssetId', 'LETTERHEAD'],
      ['stampAssetId', 'STAMP'], ['signatureAssetId', 'SIGNATURE'],
    ] as const) {
      const id = layout[field];
      if (!id) continue;
      const asset = await this.prisma.documentAsset.findFirst({
        where: { id, kind, isApproved: true, deactivatedAt: null } });
      if (!asset) throw new BadRequestException(`An approved ${kind.toLowerCase()} asset is required`);
    }
  }

  /** Server-private artwork; every successful byte access is audited before returning it. */
  async bytes(id: string, kind: AssetKind, actor: AuthenticatedUser, at?: Date | null,
    source?: { documentType: string; documentNumber: string; format: string }): Promise<Buffer> {
    const asset = await this.prisma.documentAsset.findUnique({ where: { id } });
    if (!asset || asset.kind !== kind || !asset.approvedAt ||
      (at ? asset.approvedAt > at || !!(asset.deactivatedAt && asset.deactivatedAt <= at) :
        !asset.isApproved || !!asset.deactivatedAt)) {
      throw new NotFoundException('Approved artwork not found');
    }
    let content: Buffer;
    try {
      content = await this.storage.getFile(asset.storageKey);
      if (createHash('sha256').update(content).digest('hex') !== asset.sha256) {
        throw new ServiceUnavailableException('Company artwork failed integrity verification');
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Company artwork is not available');
    }
    // Fail closed: do not release sensitive bytes when the audit insert fails.
    await this.audit.record({ action: 'document_asset.read', entityType: 'DocumentAsset',
      entityId: id, actorId: actor.id, actorEmail: actor.email,
      metadata: { kind, sha256: asset.sha256, source: source ?? null } });
    return content;
  }

  private publicRow<T extends { storageKey: string }>(row: T): Omit<T, 'storageKey'> {
    const { storageKey: _key, ...visible } = row;
    return visible;
  }
}
