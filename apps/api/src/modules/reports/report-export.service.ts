import { ConflictException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { dirname, join } from 'node:path';
import { Prisma } from '@prisma/client';
import { CATALOGUE, type FieldInfo } from './report-catalogue';
import type { BuiltReport } from './report-builder.service';

export type ExportTable = { name: string; columns: string[];
  rows: Array<Record<string, string | null>>; numeric?: string[] };
export type ExportData = { title: string; basis: string; warning?: string;
  tables: ExportTable[] };
const safeText = (value: string | null | undefined) => {
  const text = (value ?? '').replaceAll(String.fromCharCode(0), '');
  // No spreadsheet formula injection, including cells with leading whitespace.
  return /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
};

/** Exports are built from the SAME permission-filtered report response as the
 * on-screen table. No raw ORM payload is passed to a renderer. */
@Injectable()
export class ReportExportService {
  custom(report: BuiltReport): ExportData {
    const cols = report.grouped
      ? [...report.definition.groupBy, ...report.definition.metrics.map((m) => m.as), 'sourceIds']
      : [...report.definition.columns, 'sourceId', 'sourceType'];
    const info = CATALOGUE[report.source].fields as Record<string, FieldInfo>;
    const numeric = cols.filter((field) => field !== 'exchangeRate' &&
      (info[field]?.kind === 'number' || info[field]?.kind === 'money' ||
      report.definition.metrics.some((m) => m.as === field)));
    return { title: `Custom report: ${report.source}`, basis: report.basis,
      warning: report.warning, tables: [
        { name: 'Data', columns: cols, numeric,
          rows: report.rows.map((r) => Object.fromEntries(cols.map((col) => [col,
            Array.isArray(r[col]) ? r[col].join(', ') : r[col] ?? null]))) },
        { name: 'Metrics', columns: ['metric', 'value'],
          rows: Object.entries(report.totals).map(([metric, value]) => ({ metric, value })) },
      ] };
  }

  async excel(data: ExportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Duna Reports';
    workbook.created = new Date();
    const intro = workbook.addWorksheet('Read me');
    for (const [key, value] of [['Report', data.title], ['Basis', data.basis],
      ['Warning', data.warning ?? ''], ['Generated UTC', new Date().toISOString()],
      ['Amounts', 'Original currency unless explicitly labelled base. Large monetary values stay exact decimal text.']]) {
      intro.addRow([key, safeText(value)]);
    }
    intro.getColumn(1).width = 22;
    intro.getColumn(2).width = 90;
    intro.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
    for (const [index, table] of data.tables.entries()) {
      const sheet = workbook.addWorksheet(table.name.slice(0, 26) + (index ? ` ${index + 1}` : ''));
      sheet.addRow(table.columns);
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173B53' } };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      if (table.rows.length) sheet.autoFilter = { from: { row: 1, column: 1 },
        to: { row: table.rows.length + 1, column: table.columns.length } };
      for (const row of table.rows) sheet.addRow(table.columns.map((col) => {
        const v = row[col];
        if (v == null) return null;
        // XLSX numbers are IEEE doubles (up to 15 significant digits). Export
        // a numeric cell only when it will not lose a cent. Calculations on the
        // server never use this float; otherwise use an exact decimal string.
        if (table.numeric?.includes(col) && /^-?\d+(\.\d+)?$/.test(v) &&
            new Prisma.Decimal(v).abs().lessThan('1000000000000')) return Number(v);
        return safeText(v);
      }));
      table.columns.forEach((column, j) => {
        sheet.getColumn(j + 1).width = Math.min(48, Math.max(14, column.length + 6));
        if (table.numeric?.includes(column)) sheet.getColumn(j + 1).numFmt = '#,##0.00';
      });
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async pdf(data: ExportData): Promise<Buffer> {
    if (data.tables.reduce((sum, table) => sum + table.rows.length, 0) > 600) {
      throw new ConflictException('PDF over 600 rows; narrow filters or export Excel. No partial PDF was returned.');
    }
    const fontPath = join(dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf', 'DejaVuSans.ttf');
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 42, autoFirstPage: true,
        info: { Title: data.title, Author: 'Duna Reports' } });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        doc.font(fontPath).fontSize(17).fillColor('#173B53').text(data.title);
        doc.moveDown(0.5).fontSize(8.5).fillColor('#29394a')
          .text(`Generated UTC: ${new Date().toISOString()}`)
          .text(`Basis: ${data.basis}`);
        if (data.warning) doc.fillColor('#98310d').text(`IMPORTANT: ${data.warning}`);
        for (const table of data.tables) {
          doc.addPage();
          doc.fontSize(14).fillColor('#173B53').text(table.name).moveDown(0.5);
          doc.fontSize(9);
          for (const [i, row] of table.rows.entries()) {
            // A stacked table fits variable user-selected columns on A4 without
            // truncating source IDs, Arabic/Persian names or money precision.
            if (doc.y > 735) doc.addPage();
            doc.fillColor('#173B53').text(`${i + 1}.`, { continued: false });
            for (const col of table.columns) {
              const value = row[col] ?? '—';
              doc.fillColor('#35495b').text(`${col}: ${value}`, { indent: 14, width: 500 });
            }
            doc.moveDown(0.7);
          }
          if (!table.rows.length) doc.fillColor('#35495b').text('No matching records.');
        }
        doc.end();
      } catch (error) { reject(error); doc.end(); }
    });
  }
}
