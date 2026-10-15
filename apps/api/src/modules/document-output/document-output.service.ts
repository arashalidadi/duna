import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable,
  NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { DocumentTemplateService } from '../../common/infrastructure/templates/document-template.service';
import { CompanySettingsService } from '../company-settings/company-settings.service';
import { DocumentDataService } from './document-data.service';
import { DocumentRendererService } from './document-renderer.service';
import { defaultLayout, DOCUMENT_TYPES, isDocumentType, READ_PERMISSION, validateLayout,
  type DocumentData, type DocumentFormat, type DocumentType } from './document-layout';
import { restoreIssuedData } from './document-issue-snapshot';
import type { DocumentIdentity } from '../company-settings/company-settings.service';

export interface RenderedFile { bytes: Buffer; mimeType: string; filename: string; inline: boolean; }
const formats: DocumentFormat[] = ['pdf', 'print', 'xlsx'];
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

/** Render scope is the intersection of document:render AND the underlying read permission. */
@Injectable()
export class DocumentOutputService {
  constructor(private readonly prisma: PrismaService, private readonly templates: DocumentTemplateService,
    private readonly data: DocumentDataService, private readonly renderer: DocumentRendererService,
    private readonly company: CompanySettingsService) {}

  /** Office PDFs are never portal projections, regardless of an accidental grant. */
  private officeOnly(actor: AuthenticatedUser) {
    if (!actor.isPrimaryAdmin && (actor.portalAgentId || actor.portalCustomerId)) {
      throw new ForbiddenException('Portal principals use their scoped document views');
    }
  }

  catalogue(actor: AuthenticatedUser) {
    this.officeOnly(actor);
    return DOCUMENT_TYPES.map((type) => ({ type, readPermission: READ_PERMISSION[type] }));
  }

  private access(actor: AuthenticatedUser, type: string): asserts type is DocumentType {
    if (!isDocumentType(type)) throw new BadRequestException('Unknown document type');
    this.officeOnly(actor);
    if (actor.isPrimaryAdmin) return;
    if (!actor.permissions?.includes('document:render') || !actor.permissions.includes(READ_PERMISSION[type])) {
      throw new ForbiddenException('Document rendering and source read permissions required');
    }
  }

  private verify(row: { content: Uint8Array; sha256: string }): Buffer {
    const bytes = Buffer.from(row.content);
    if (hash(bytes) !== row.sha256) {
      throw new ServiceUnavailableException('Archived document failed integrity verification');
    }
    return bytes;
  }

  private file(type: DocumentType, number: string, format: DocumentFormat, bytes: Buffer): RenderedFile {
    // No user-provided header text, path separators or control characters.
    const safe = number.replace(/[^a-z0-9_-]/gi, '-').slice(0, 72) || 'document';
    return { bytes, filename: `${type}-${safe}-${format}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`,
      mimeType: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
      inline: format === 'print' };
  }

  /** A preview may select an unassigned version, but never bypass the source read check. */
  async output(actor: AuthenticatedUser, typeInput: string, id: string, formatInput: string,
    opts: { previewVersionId?: string; fromDate?: string; toDate?: string; currencyCode?: string } = {}): Promise<RenderedFile> {
    this.access(actor, typeInput);
    const type = typeInput;
    if (!formats.includes(formatInput as DocumentFormat)) throw new BadRequestException('Invalid document output format');
    const format = formatInput as DocumentFormat;
    if (opts.previewVersionId && !actor.isPrimaryAdmin && !actor.permissions?.includes('document:manage')) {
      throw new ForbiddenException('Previewing an unassigned version requires template management permission');
    }
    if (type !== 'ledger' && (opts.fromDate || opts.toDate || opts.currencyCode)) {
      throw new BadRequestException('Ledger filters are only available for a ledger');
    }
    if (type === 'ledger') {
      for (const date of [opts.fromDate, opts.toDate]) {
        if (date && (!/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))?$/.test(date) ||
          !Number.isFinite(Date.parse(date)) ||
          new Date(`${date.slice(0, 10)}T00:00:00.000Z`).toISOString().slice(0, 10) !== date.slice(0, 10))) {
          throw new BadRequestException('Invalid ledger date');
        }
      }
      if (opts.fromDate && opts.toDate && Date.parse(opts.fromDate) > Date.parse(opts.toDate)) {
        throw new BadRequestException('Ledger start date is after end date');
      }
      if (opts.currencyCode && !/^[A-Z]{3}$/.test(opts.currencyCode)) {
        throw new BadRequestException('Invalid ledger currency code');
      }
    }
    // New records are captured inside their issuance transaction, before any
    // customer/company/source mutation can affect a future first download.
    const frozen = type === 'ledger' ? null : await this.prisma.documentIssuedSnapshot.findUnique({
      where: { documentType_recordId: { documentType: type, recordId: id } },
      select: { data: true, identity: true, fallbackLayout: true, templateVersionId: true, createdAt: true },
    });
    const source: DocumentData = frozen ? restoreIssuedData(frozen.data)
      : await this.data.get(type, id, type === 'ledger' ? opts : undefined);
    if (frozen && (source.type !== type || source.id !== id)) {
      throw new ConflictException('Issued document snapshot does not match its record');
    }
    // Legacy issued rows predate this capture table. They can be output, but
    // MUST NOT be represented as issuance-time snapshots. Subsequent downloads
    // return the first archived bytes even if the live status changes.
    const data: DocumentData = source.issued && !frozen ? { ...source,
      warning: [source.warning, 'Legacy record: reconstructed on first render; original issuance-time appearance cannot be verified.']
        .filter(Boolean).join(' '),
    } : source;
    const revisionKey = frozen ? `issued:${data.effectiveAt?.toISOString()}`
      : `legacy:${data.effectiveAt?.toISOString() ?? data.number}`;
    if (data.issued && !opts.previewVersionId) {
      const previous = await this.prisma.documentRenderedOutput.findUnique({
        where: { documentType_recordId_format_revisionKey: { documentType: type, recordId: id,
          format, revisionKey } }, select: { content: true, sha256: true } });
      if (previous) return this.file(type, data.number, format, this.verify(previous));
    }

    const versionId = opts.previewVersionId ?? (frozen ? frozen.templateVersionId
      : data.issued && !data.effectiveAt ? null
        : await this.templates.versionAt(type, data.issued ? data.effectiveAt : null));
    if (opts.previewVersionId) {
      const v = await this.prisma.documentTemplateVersion.findUnique({ where: { id: opts.previewVersionId },
        select: { template: { select: { documentType: true } } } });
      if (!v || v.template.documentType !== type) throw new BadRequestException('Preview version belongs to another document type');
    }
    if (frozen && !versionId && !frozen.fallbackLayout) {
      throw new ConflictException('Issued fallback layout is missing');
    }
    const layout = versionId ? await this.templates.readLayout(versionId)
      : frozen ? validateLayout(frozen.fallbackLayout) : defaultLayout(type);
    const identity: DocumentIdentity | null = frozen ? frozen.identity as unknown as DocumentIdentity | null
      : await this.company.getDocumentIdentity();
    // A displayed date can be backdated. Approval/retirement eligibility for
    // frozen artwork is evaluated at actual issuance (snapshot creation), not
    // the document's display date. Explicit previews use today's approvals.
    const artworkAt = opts.previewVersionId ? null : frozen?.createdAt ?? data.effectiveAt;
    const bytes = await this.renderer.render(data, layout, identity, format, artworkAt);
    if (!data.issued || opts.previewVersionId) return this.file(type, data.number, format, bytes);
    if (bytes.length > 8 * 1024 * 1024) throw new ConflictException('Rendered output exceeds 8 MiB archive limit');

    try {
      const saved = await this.prisma.documentRenderedOutput.create({ data: {
        documentType: type, recordId: id, format, revisionKey, templateVersionId: versionId,
        content: bytes, sha256: hash(bytes), createdById: actor.id,
        snapshot: JSON.parse(JSON.stringify({ data, identity, layout })) as Prisma.InputJsonValue,
      }, select: { content: true, sha256: true } });
      return this.file(type, data.number, format, this.verify(saved));
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      // Parallel first downloads raced: return the FIRST immutable render, never overwrite it.
      const first = await this.prisma.documentRenderedOutput.findUnique({
        where: { documentType_recordId_format_revisionKey: { documentType: type, recordId: id,
          format, revisionKey } }, select: { content: true, sha256: true } });
      if (!first) throw error;
      return this.file(type, data.number, format, this.verify(first));
    }
  }

  async history(actor: AuthenticatedUser, typeInput: string, id: string) {
    this.access(actor, typeInput);
    if (!/^[a-zA-Z0-9_-]{5,70}$/.test(id)) throw new BadRequestException('Invalid record id');
    const rows = await this.prisma.documentRenderedOutput.findMany({
      where: { documentType: typeInput, recordId: id }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, format: true, revisionKey: true, templateVersionId: true,
        sha256: true, createdAt: true, createdById: true } });
    return rows;
  }

  async archived(actor: AuthenticatedUser, archiveId: string): Promise<RenderedFile> {
    if (!/^[a-zA-Z0-9_-]{5,70}$/.test(archiveId)) throw new BadRequestException('Invalid archive id');
    const row = await this.prisma.documentRenderedOutput.findUnique({ where: { id: archiveId } });
    if (!row) throw new NotFoundException('Archived document not found');
    this.access(actor, row.documentType);
    const data = row.snapshot as unknown as { data?: { number?: string } };
    return this.file(row.documentType, data?.data?.number ?? row.recordId,
      row.format as DocumentFormat, this.verify(row));
  }
}
