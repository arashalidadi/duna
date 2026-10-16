import { dirname, join } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { DocumentIdentity } from '../company-settings/company-settings.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { DocumentAssetsService } from './document-assets.service';
import { type DocumentData, type DocumentFormat, type DocumentLayout,
  type HeaderField, type LineField } from './document-layout';

const LABELS: Record<HeaderField | LineField, string> = {
  number: 'Number', status: 'Status', date: 'Date (UTC)', party: 'Party',
  reference: 'Reference', vessel: 'Vessel', voyage: 'Voyage', origin: 'Origin',
  destination: 'Destination', port: 'Port', currency: 'Currency', amount: 'Amount',
  subtotal: 'Subtotal', tax: 'Tax', taxNumber: 'Tax registration number',
  period: 'Period', paymentState: 'Payment condition', notes: 'Notes',
  description: 'Description', shipper: 'Shipper', consignee: 'Consignee',
  quantity: 'Quantity', units: 'Units', packages: 'Packages',
  weight: 'Weight', unitPrice: 'Unit price', debit: 'Debit', credit: 'Credit',
  balance: 'Balance',
};

function safeCell(value: string | null | undefined): string {
  const text = (value ?? '').replaceAll('\0', '');
  // Negative amounts are exact text, not formulas. Everything else with a
  // formula-leading character (including a malicious reference) stays inert.
  if (/^-[0-9]+(?:\.[0-9]+)?$/.test(text)) return text;
  return /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

/** Same allowlisted DocumentData is rendered in all three modes. No ORM objects leak. */
@Injectable()
export class DocumentRendererService {
  constructor(private readonly assets: DocumentAssetsService) {}

  async render(data: DocumentData, layout: DocumentLayout,
    identity: DocumentIdentity | null, format: DocumentFormat, actor: AuthenticatedUser,
    artworkAt: Date | null = data.issued ? data.effectiveAt : null): Promise<Buffer> {
    if (format === 'xlsx') return this.excel(data, layout, identity);
    if (data.rows.length > 600) {
      throw new BadRequestException('PDF over 600 lines; narrow the ledger date range or use Excel');
    }
    // Company marks are intentionally NEVER loaded, embedded or serialized in Print/Excel.
    const source = { documentType: data.type, documentNumber: data.number, format };
    const letterhead = layout.letterheadAssetId
      ? await this.assets.bytes(layout.letterheadAssetId, 'LETTERHEAD', actor, artworkAt, source) : null;
    const logo = layout.logoAssetId
      ? await this.assets.bytes(layout.logoAssetId, 'LOGO', actor, artworkAt, source) : null;
    const stamp = format === 'pdf' && data.issued && layout.stampAssetId
      ? await this.assets.bytes(layout.stampAssetId, 'STAMP', actor, artworkAt, source) : null;
    const signature = format === 'pdf' && data.issued && layout.signatureAssetId
      ? await this.assets.bytes(layout.signatureAssetId, 'SIGNATURE', actor, artworkAt, source) : null;

    const font = join(dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf', 'DejaVuSans.ttf');
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: layout.pageSize, layout: layout.orientation,
        margins: { top: layout.margin, right: layout.margin,
          bottom: layout.margin, left: layout.margin },
        info: { Title: `${layout.title} ${data.number}`, Author: identity?.companyName ?? 'Document output' } });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        doc.font(font);
        const usable = doc.page.width - layout.margin * 2;
        // A draft can span many pages, including pages auto-added by PDFKit
        // during a long field. Watermark every page, not just the last one.
        // This lifecycle warning is not an endorsement/approval mark.
        const watermark = () => {
          const cursor = { x: doc.x, y: doc.y };
          doc.save().opacity(0.14).fillColor('#b3533e').fontSize(45)
            .text(data.type === 'ledger' ? 'LIVE STATEMENT' : 'DRAFT',
              layout.margin, doc.page.height / 2, { align: 'center', width: usable });
          doc.restore();
          doc.x = cursor.x; doc.y = cursor.y;
        };
        if (!data.issued) {
          doc.on('pageAdded', watermark);
          watermark(); // The first page was created by the PDFDocument constructor.
        }
        if (letterhead) {
          doc.image(letterhead, layout.margin, layout.margin, { fit: [usable, 72] });
          doc.y = layout.margin + 82;
        }
        if (logo) {
          doc.image(logo, layout.margin, doc.y, { fit: [80, 56] });
          doc.y += 65;
        }
        doc.fontSize(12).fillColor('#183953')
          .text(identity?.companyName || 'Company identity not configured', { align: 'center' });
        if (identity?.address) doc.fontSize(8).fillColor('#3b5263').text(identity.address, { align: 'center' });
        // Tax invoices use the historical TRN saved on the invoice, never today's setting.
        const taxNumber = data.type === 'invoice' && data.issued
          ? data.fields.taxNumber : identity?.taxNumber;
        if (taxNumber) doc.fontSize(8).text(`TRN: ${taxNumber}`, { align: 'center' });
        doc.moveDown().fontSize(16).fillColor('#183953').text(layout.title, { align: 'center' });
        if (data.warning) doc.moveDown(0.3).fontSize(8).fillColor('#a3451d').text(data.warning);
        if (layout.note) doc.moveDown(0.3).fontSize(8).fillColor('#5b626d').text(layout.note);
        doc.moveDown(0.8);
        for (const field of layout.fields) {
          const value = data.fields[field];
          if (!value) continue;
          doc.fontSize(layout.fontSize).fillColor('#263e50').text(`${LABELS[field]}: ${value}`, {
            width: usable, lineGap: 2,
          });
        }
        if (data.rows.length) {
          doc.moveDown().fontSize(12).fillColor('#183953').text('Lines');
          for (const [index, row] of data.rows.entries()) {
            if (doc.y > doc.page.height - layout.margin - 68) doc.addPage();
            doc.moveDown(0.3).fontSize(layout.fontSize).fillColor('#183953').text(`${index + 1}.`);
            for (const col of layout.columns) {
              const value = row[col];
              if (!value) continue;
              doc.fontSize(layout.fontSize).fillColor('#263e50')
                .text(`${LABELS[col]}: ${value}`, { indent: 14, width: usable - 14 });
            }
          }
        }
        // PDF gets official approval marks ONLY when approved assets were assigned.
        // Print has no stamp/signature image, no substitute text/overlay.
        if (stamp || signature) {
          if (doc.y > doc.page.height - layout.margin - 110) doc.addPage();
          const y = Math.max(doc.y + 14, doc.page.height - layout.margin - 100);
          if (stamp) doc.image(stamp, layout.margin, y, { fit: [110, 85] });
          if (signature) doc.image(signature, doc.page.width - layout.margin - 145, y,
            { fit: [140, 85] });
        }
        doc.end();
      } catch (error) { reject(error); doc.end(); }
    });
  }

  private async excel(data: DocumentData, layout: DocumentLayout,
    identity: DocumentIdentity | null): Promise<Buffer> {
    const book = new ExcelJS.Workbook();
    book.creator = identity?.companyName ?? 'Document output';
    const sheet = book.addWorksheet('Document');
    const title = sheet.addRow([safeCell(layout.title), safeCell(data.number)]);
    title.font = { bold: true, size: 14 };
    sheet.addRow(['Company', safeCell(identity?.companyName)]);
    if (data.type === 'invoice' && data.issued) {
      sheet.addRow(['TRN', safeCell(data.fields.taxNumber)]);
    } else if (identity?.taxNumber) sheet.addRow(['TRN', safeCell(identity.taxNumber)]);
    if (layout.note) sheet.addRow(['Layout note', safeCell(layout.note)]);
    if (data.warning) sheet.addRow(['Warning', safeCell(data.warning)]);
    for (const field of layout.fields) {
      if (data.fields[field]) sheet.addRow([LABELS[field], safeCell(data.fields[field])]);
    }
    sheet.addRow([]);
    if (data.rows.length) {
      const row = sheet.addRow(layout.columns.map((c) => LABELS[c]));
      row.font = { bold: true };
      sheet.views = [{ state: 'frozen', ySplit: row.number }];
      for (const values of data.rows) {
        // Exact decimal strings are intentional; Excel floating point can lose cents.
        sheet.addRow(layout.columns.map((c) => safeCell(values[c])));
      }
    }
    for (let col = 1; col <= Math.max(2, layout.columns.length); col++) sheet.getColumn(col).width = 30;
    return Buffer.from(await book.xlsx.writeBuffer());
  }
}
