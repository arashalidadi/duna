import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { BadRequestException, ConflictException, ForbiddenException, Injectable,
  NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { AuthenticatedUser } from '../../common/auth/types';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentAssetsService } from '../document-output/document-assets.service';
import type { RenderedFile } from '../document-output/document-output.service';
import { DocumentConfigService } from './document-config.service';
import type { DocumentSpec } from './configuration.policy';

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
type Format = 'pdf' | 'print' | 'xlsx';
type Value = { key: string; value: unknown; snapshot: {
  label?: string; options?: { id: string; code: string; label: string }[] } };
type Snapshot = {
  number: string; status: string; statusLabel?: string; issuedAt: string; definitionVersionId: string;
  identity: { companyName?: string | null; address?: string | null; taxNumber?: string | null } | null;
  layout: DocumentSpec['layout']; values: Value[]; relationships: Record<string, unknown>;
  warning: string;
};
const safeCell = (value: string) => /^[\s]*[=+\-@\t\r]/.test(value) && !/^-[0-9]+(?:\.[0-9]+)?$/.test(value)
  ? `'${value.replaceAll('\0', '')}` : value.replaceAll('\0', '');
function display(value: Value): string {
  const raw = value.value;
  if (raw === null || raw === undefined || typeof raw === 'object' && !Array.isArray(raw)) return '—';
  if (value.snapshot?.options?.length) {
    const ids = Array.isArray(raw) ? raw : [raw];
    return ids.map((id) => value.snapshot.options?.find((o) => o.id === id)?.label ?? '—').join(', ');
  }
  if (Array.isArray(raw)) return raw.map((s) => String(s)).join(', ');
  return String(raw);
}

/** Configurable documents have their own versioned layout; they cannot assume
 * the 11 fixed Phase-8 renderers, types, field allowlists or financial projections.
 * Issued bytes share Phase-8's append-only archive and SHA-256 verification. */
@Injectable()
export class ConfigDocumentOutputService {
  constructor(private readonly prisma: PrismaService, private readonly documents: DocumentConfigService,
    private readonly assets: DocumentAssetsService) {}

  private file(type: string, number: string, format: Format, bytes: Buffer): RenderedFile {
    const safeType = type.replace(/[^A-Z0-9_-]/gi, '-').slice(0, 45);
    const safeNumber = number.replace(/[^A-Z0-9_-]/gi, '-').slice(0, 70);
    return { bytes, filename: `${safeType}-${safeNumber}-${format}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`,
      mimeType: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
      inline: format === 'print' };
  }
  private verified(row: { content: Uint8Array; sha256: string }): Buffer {
    const bytes = Buffer.from(row.content);
    if (hash(bytes) !== row.sha256) throw new ServiceUnavailableException('Archived document failed integrity verification');
    return bytes;
  }
  private validateSnapshot(value: unknown, id: string): Snapshot {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ConflictException('Missing issued output snapshot');
    const v = value as Snapshot;
    if (!v.number || !v.definitionVersionId || !v.issuedAt || !Number.isFinite(Date.parse(v.issuedAt)) ||
      !v.layout?.title || !Array.isArray(v.layout.fields) || !Array.isArray(v.values)) {
      throw new ConflictException(`Issued snapshot is incomplete for ${id}`);
    }
    return v;
  }
  async render(id: string, formatInput: string, actor: AuthenticatedUser): Promise<RenderedFile> {
    if (!['pdf', 'print', 'xlsx'].includes(formatInput)) throw new BadRequestException('Invalid output format');
    const format = formatInput as Format;
    const source = await this.documents.outputSource(id, format, actor);
    const archivedType = `CUSTOM:${source.typeCode}`;
    const revisionKey = `issued:${source.row.id}`;
    if (source.row.issuedAt) {
      const prior = await this.prisma.documentRenderedOutput.findUnique({
        where: { documentType_recordId_format_revisionKey: { documentType: archivedType,
          recordId: id, format, revisionKey } } });
      if (prior) return this.file(source.typeCode, source.row.number, format, this.verified(prior));
    }
    const frozen = source.row.issuedAt ? this.validateSnapshot(source.frozen, id) : null;
    if (frozen && (frozen.number !== source.row.number || frozen.definitionVersionId !== source.row.versionId)) {
      throw new ConflictException('Issued snapshot does not match document');
    }
    const live: Snapshot = { number: source.row.number, status: source.row.status,
      statusLabel: source.row.statusLabel,
      issuedAt: '', definitionVersionId: source.row.versionId, identity: null,
      layout: source.spec.layout, values: source.values as Value[],
      relationships: source.links as Record<string, unknown>,
      warning: 'DRAFT — additional office document, NOT an invoice, ledger, payment or release authorization. Official template not supplied.' };
    const snapshot = frozen ?? live;
    if (!frozen) {
      const company = await this.prisma.companySettings.findFirst({ select: { companyName: true, address: true, taxNumber: true } });
      snapshot.identity = company;
    }
    const bytes = format === 'xlsx' ? await this.excel(snapshot)
      : await this.pdf(snapshot, format, !!frozen);
    if (!frozen) return this.file(source.typeCode, source.row.number, format, bytes);
    if (bytes.length > 8 * 1024 * 1024) throw new ConflictException('Output exceeds the archive limit');
    try {
      const saved = await this.prisma.documentRenderedOutput.create({ data: {
        documentType: archivedType, recordId: id, format, revisionKey,
        templateVersionId: null, content: bytes, sha256: hash(bytes), createdById: actor.id,
        // Input and layout were frozen in the issuance transaction, BEFORE first render.
        snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
      }, select: { content: true, sha256: true } });
      return this.file(source.typeCode, source.row.number, format, this.verified(saved));
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const first = await this.prisma.documentRenderedOutput.findUnique({
        where: { documentType_recordId_format_revisionKey: { documentType: archivedType,
          recordId: id, format, revisionKey } } });
      if (!first) throw error;
      return this.file(source.typeCode, source.row.number, format, this.verified(first));
    }
  }
  async history(id: string, actor: AuthenticatedUser) {
    const source = await this.documents.outputSource(id, 'pdf', actor);
    const rows = await this.prisma.documentRenderedOutput.findMany({ where: { documentType: `CUSTOM:${source.typeCode}`,
      recordId: id }, select: { id: true, format: true, revisionKey: true, sha256: true,
      createdAt: true, createdById: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    if (!rows.some((row) => row.format === 'xlsx')) return rows;
    try { await this.documents.outputSource(id, 'xlsx', actor); return rows; }
    catch (error) {
      if (error instanceof ForbiddenException) return rows.filter((row) => row.format !== 'xlsx');
      throw error;
    }
  }
  async archived(id: string, actor: AuthenticatedUser): Promise<RenderedFile> {
    const row = await this.prisma.documentRenderedOutput.findUnique({ where: { id } });
    if (!row || !row.documentType.startsWith('CUSTOM:')) throw new NotFoundException('Custom archive not found');
    // Repeat the type/record/field/source checks on EVERY download, even if
    // permissions changed since the bytes were first archived.
    const source = await this.documents.outputSource(row.recordId, row.format as Format, actor);
    if (row.documentType !== `CUSTOM:${source.typeCode}`) throw new ForbiddenException('Archive type mismatch');
    return this.file(source.typeCode, source.row.number, row.format as Format, this.verified(row));
  }
  private async pdf(source: Snapshot, format: 'pdf' | 'print', issued: boolean): Promise<Buffer> {
    const layout = source.layout;
    const at = issued ? new Date(source.issuedAt) : null;
    // Print has NO stamp or signature; the PDF gets only approved artwork.
    const [letterhead, logo, stamp, signature] = await Promise.all([
      layout.letterheadAssetId ? this.assets.bytes(layout.letterheadAssetId, 'LETTERHEAD', at) : null,
      layout.logoAssetId ? this.assets.bytes(layout.logoAssetId, 'LOGO', at) : null,
      format === 'pdf' && issued && layout.stampAssetId ? this.assets.bytes(layout.stampAssetId, 'STAMP', at) : null,
      format === 'pdf' && issued && layout.signatureAssetId ? this.assets.bytes(layout.signatureAssetId, 'SIGNATURE', at) : null,
    ]);
    const font = join(dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf', 'DejaVuSans.ttf');
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 45, bottom: 45, left: 45, right: 45 },
        info: { Title: `${layout.title} ${source.number}`, Author: source.identity?.companyName ?? 'Document output' } });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        doc.font(font);
        if (!issued) {
          const watermark = () => {
            const cursor = { x: doc.x, y: doc.y };
            doc.save().opacity(0.14).fillColor('#b3533e').fontSize(45)
              .text('DRAFT', 45, doc.page.height / 2, { align: 'center', width: doc.page.width - 90 });
            doc.restore(); doc.x = cursor.x; doc.y = cursor.y;
          };
          doc.on('pageAdded', watermark); watermark();
        }
        if (letterhead) { doc.image(letterhead, 45, 45, { fit: [doc.page.width - 90, 72] }); doc.y = 125; }
        if (logo) { doc.image(logo, 45, doc.y, { fit: [80, 56] }); doc.y += 62; }
        doc.fillColor('#183953').fontSize(12).text(source.identity?.companyName || 'Company identity not configured', { align: 'center' });
        if (source.identity?.address) doc.fontSize(8).text(source.identity.address, { align: 'center' });
        if (source.identity?.taxNumber) doc.fontSize(8).text(`TRN: ${source.identity.taxNumber}`, { align: 'center' });
        doc.moveDown().fontSize(16).text(layout.title, { align: 'center' });
        doc.moveDown(0.3).fontSize(9).text(`${source.number} · ${source.statusLabel ?? source.status}`);
        doc.moveDown(0.5).fontSize(8).fillColor('#555').text(source.warning);
        if (layout.note) doc.text(layout.note);
        doc.moveDown();
        for (const key of layout.fields) {
          const entry = source.values.find((v) => v.key === key);
          if (!entry) continue;
          doc.fontSize(10).fillColor('#263e50').text(`${entry.snapshot?.label ?? key}: ${display(entry)}`);
        }
        if (Object.keys(source.relationships).length) {
          doc.moveDown().fontSize(9).text('References');
          for (const [kind, entry] of Object.entries(source.relationships)) {
            const id = typeof entry === 'string' ? entry : (entry as { id?: string })?.id;
            if (id) doc.text(`${kind}: ${id}`);
          }
        }
        if (stamp || signature) {
          if (doc.y > doc.page.height - 145) doc.addPage();
          const y = Math.max(doc.y + 15, doc.page.height - 145);
          if (stamp) doc.image(stamp, 45, y, { fit: [110, 85] });
          if (signature) doc.image(signature, doc.page.width - 190, y, { fit: [140, 85] });
        }
        doc.end();
      } catch (error) { reject(error); doc.end(); }
    });
  }
  private async excel(source: Snapshot): Promise<Buffer> {
    const book = new ExcelJS.Workbook();
    book.creator = source.identity?.companyName ?? 'Document output';
    const sheet = book.addWorksheet('Document');
    sheet.addRow([safeCell(source.layout.title), safeCell(source.number)]).font = { bold: true, size: 14 };
    sheet.addRow(['Status', safeCell(source.statusLabel ?? source.status)]);
    sheet.addRow(['Company', safeCell(source.identity?.companyName ?? '')]);
    if (source.identity?.taxNumber) sheet.addRow(['TRN', safeCell(source.identity.taxNumber)]);
    if (source.layout.note) sheet.addRow(['Note', safeCell(source.layout.note)]);
    sheet.addRow(['Output note', safeCell(source.warning)]);
    for (const key of source.layout.fields) {
      const entry = source.values.find((v) => v.key === key);
      if (entry) sheet.addRow([safeCell(entry.snapshot?.label ?? key), safeCell(display(entry))]);
    }
    for (const [kind, entry] of Object.entries(source.relationships)) {
      const id = typeof entry === 'string' ? entry : (entry as { id?: string })?.id;
      if (id) sheet.addRow([safeCell(kind), safeCell(id)]);
    }
    sheet.getColumn(1).width = 32; sheet.getColumn(2).width = 65;
    return Buffer.from(await book.xlsx.writeBuffer());
  }
}
