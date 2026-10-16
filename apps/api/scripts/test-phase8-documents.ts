import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';
import { captureIssuedDocument } from '../src/modules/document-output/document-issue-snapshot';
import { DocumentDataService } from '../src/modules/document-output/document-data.service';
import { projectRecordedDocument } from '../src/modules/document-output/document-record-projection';
import { DocumentOutputService } from '../src/modules/document-output/document-output.service';
import { DocumentRendererService } from '../src/modules/document-output/document-renderer.service';
import { DOCUMENT_TYPES, defaultLayout, validateLayout, type DocumentData } from '../src/modules/document-output/document-layout';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { VoucherService } from '../src/modules/voucher/voucher.service';
import { DocumentAssetsService, inspectArtworkImage } from '../src/modules/document-output/document-assets.service';
import type { AuditService } from '../src/common/infrastructure/audit/audit.service';
import type { StorageAdapter } from '../src/common/infrastructure/storage/storage-adapter.interface';
import type { DocumentTemplateService } from '../src/common/infrastructure/templates/document-template.service';
import type { CompanySettingsService } from '../src/modules/company-settings/company-settings.service';
import type { AuthenticatedUser } from '../src/common/auth/types';

function png(): Buffer {
  const signature = Buffer.from('89504e470d0a1a0a', 'hex');
  const crc = (bytes: Buffer) => {
    let result = 0xffffffff;
    for (const byte of bytes) {
      result ^= byte;
      for (let i = 0; i < 8; i++) result = (result >>> 1) ^ (result & 1 ? 0xedb88320 : 0);
    }
    return (result ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, bytes: Buffer) => {
    const name = Buffer.from(type);
    const length = Buffer.alloc(4); length.writeUInt32BE(bytes.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc(Buffer.concat([name, bytes])));
    return Buffer.concat([length, name, bytes, checksum]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4);
  header[8] = 8; header[9] = 6; // one RGBA pixel
  return Buffer.concat([signature, chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))), chunk('IEND', Buffer.alloc(0))]);
}

const fixture = png();
const calls: string[] = [];
const assets = { bytes: async (_id: string, kind: string) => { calls.push(kind); return fixture; } };
const renderer = new DocumentRendererService(assets as unknown as DocumentAssetsService);
const identity = { companyName: 'Recorded company', legalName: null, registrationNumber: null,
  taxNumber: 'TRN-original', address: null, city: null, country: null,
  phone: null, email: null, defaultCurrency: 'USD' };
const owner: AuthenticatedUser = { id: 'owner', email: 'owner@example.test', roles: [], permissions: [], isPrimaryAdmin: true };
const portal: AuthenticatedUser = { ...owner, id: 'portal', isPrimaryAdmin: false,
  portalAgentId: 'agent-1', permissions: ['portal:access'] };

async function projectionCases() {
  const date = new Date('2026-10-15T11:00:00Z');
  const bill = { billNumber: 'BOL-123', status: 'APPROVED', issuedAt: date, createdAt: date,
    dateOfIssue: date, vesselName: 'Ship', voyage: { voyageNumber: 'V-1' },
    shipper: { name: 'Shipper' }, consignee: { name: 'Consignee' },
    goodsDescription: 'Cargo', totalPackages: 2, totalGrossWeight: '12', freightAmount: '10',
    currencyCode: 'USD', notes: null, items: [{ cargo: { reference: 'CARGO' },
      goodsDescription: 'Goods', packages: 2, grossWeight: '12', marksAndNumbers: null }] };
  const payment = { voucherNumber: 'PMT-123', type: 'PAYMENT', status: 'POSTED', voucherDate: date,
    createdAt: date, customer: { name: 'Customer' }, amount: '10.20', currencyCode: 'USD',
    reference: 'P1', description: 'Refund', allocations: [] };
  const fake = {
    loadList: { findFirst: async () => ({ loadListNumber: 'LOAD-1', status: 'FINALIZED', createdAt: date,
      finalizedAt: date, notes: null, voyage: { voyageNumber: 'V-1', vessel: { name: 'Ship' },
        originPort: { name: 'A' }, destinationPort: { name: 'B' } },
      items: [{ sequence: 1, plannedQuantity: 3, cargo: { reference: 'CARGO', description: 'Goods',
        quantity: 4, packages: 2, weight: '12' } }] }) },
    billOfLading: { findFirst: async () => bill },
    manifest: { findFirst: async () => ({ manifestNumber: 'MAN-1', status: 'APPROVED', createdAt: date,
      manifestDate: date, approvedAt: date, vesselName: 'Ship', voyage: { voyageNumber: 'V-1' },
      polPort: { name: 'A' }, podPort: { name: 'B' }, totalQuantity: 3, totalPackages: 2,
      totalWeight: '12', notes: null, items: [{ blNumber: null,
        billOfLadingItem: { billOfLading: { billNumber: 'BOL-123' } },
        shipper: { name: 'Shipper' }, consignee: { name: 'Consignee' },
        cargo: { description: 'Goods' }, quantity: 3, packages: 2, weight: '12' }] }) },
    invoice: { findFirst: async () => ({ invoiceNumber: 'INV-123', status: 'ISSUED', issueDate: date,
      issuedAt: date, createdAt: date, customer: { name: 'Customer' },
      billOfLading: { billNumber: 'BOL-123' }, title: null, description: null,
      currencyCode: 'USD', subtotal: '10.00', taxAmount: '0.50', totalAmount: '10.50',
      trn: 'original-TRN', notes: null,
      items: [{ description: 'Goods', quantity: 1, unitPrice: '10.00',
        amount: '10.00', taxAmount: '0.50' }] }) },
    deliveryOrder: { findFirst: async () => ({ docNumber: 'DO-1', status: 'ISSUED', createdAt: date,
      issueDate: new Date('2026-10-01T00:00:00Z'), recipient: 'Recipient', portName: 'A', notes: null,
      billOfLading: { billNumber: 'BOL-123', vesselName: 'Ship' } }) },
    releaseOrder: { findFirst: async () => ({ docNumber: 'RO-1', status: 'ISSUED', createdAt: date,
      releaseDate: date, paymentState: 'PARTIAL', notes: null,
      billOfLading: { billNumber: 'BOL-123', vesselName: 'Ship' } }) },
    salaryRecord: { findFirst: async () => ({ recordNumber: 'SAL-1', status: 'APPROVED', createdAt: date,
      approvedAt: date, year: 2026, month: 10, employee: { name: 'Employee', code: 'E-1' },
      base: '1000', additions: '100', deductions: '50', net: '1050',
      currencyCode: 'USD', notes: null }) },
    voucher: { findFirst: async ({ where }: { where: { type?: string } }) =>
      where.type === 'RECEIPT' ? { ...payment, voucherNumber: 'RCP-123', type: 'RECEIPT' } : payment },
  };
  for (const type of DOCUMENT_TYPES.filter((t) => t !== 'ledger')) {
    const data = await projectRecordedDocument(fake as unknown as Prisma.TransactionClient, type, 'record-12345');
    assert.equal(data.issued, true, `${type} is an issued projection`);
    assert.equal(data.type, type);
    assert.ok(data.fields.number);
    assert.ok(data.effectiveAt instanceof Date);
  }
  const manifest = await projectRecordedDocument(fake as unknown as Prisma.TransactionClient, 'manifest', 'record-12345');
  assert.equal(manifest.rows[0].reference, 'BOL-123', 'new manifest line resolves its B/L reference');
  assert.equal(manifest.rows[0].shipper, 'Shipper');
  assert.deepEqual(manifest.rows.at(-1), { reference: 'TOTAL', units: '3', packages: '2', weight: '12' });
  const delivery = await projectRecordedDocument(fake as unknown as Prisma.TransactionClient, 'delivery-order', 'record-12345');
  assert.equal(delivery.effectiveAt?.toISOString(), date.toISOString(), 'backdated display date is not issuance time');
  assert.equal(delivery.fields.date, '2026-10-01');
  const inv = await projectRecordedDocument(fake as unknown as Prisma.TransactionClient, 'invoice', 'record-12345');
  assert.equal(inv.fields.taxNumber, 'original-TRN');
  const salary = await projectRecordedDocument(fake as unknown as Prisma.TransactionClient, 'salary-slip', 'record-12345');
  const salaryWorkbook = new ExcelJS.Workbook();
  await salaryWorkbook.xlsx.load(await renderer.render(salary, defaultLayout('salary-slip'), identity, 'xlsx', owner));
  assert.ok(salaryWorkbook.getWorksheet('Document')!.getRows(1, 30)!
    .flatMap((row) => row.values as unknown[]).includes('-50'), 'negative deductions remain exact spreadsheet text');
  const ledger = await new DocumentDataService(fake as unknown as PrismaService,
    { ledger: async () => ({ summary: { customerName: 'Customer', currencyCode: 'MIXED',
      closingBalance: '300', warning: 'Mixed currencies' }, entries: [] }) } as unknown as VoucherService)
    .get('ledger', 'customer-123');
  assert.equal(ledger.issued, false);
  assert.equal(ledger.fields.amount, '', 'never display a cross-currency closing sum');
}

async function main() {
  inspectArtworkImage(fixture, 'image/png');
  inspectArtworkImage(readFileSync(join(__dirname, '../../web/public/images/operations-network.jpg')), 'image/jpeg');
  const oversized = Buffer.from(fixture); oversized.writeUInt32BE(10_000, 16);
  assert.throws(() => inspectArtworkImage(oversized, 'image/png'), BadRequestException);
  assert.throws(() => inspectArtworkImage(Buffer.from('89504e470d0a1a0a', 'hex'), 'image/png'), BadRequestException);
  const approvedAt = new Date('2026-10-12T00:00:00Z');
  const retiredAt = new Date('2026-10-16T00:00:00Z');
  const verifiedAsset = new DocumentAssetsService({ documentAsset: { findUnique: async () => ({
    kind: 'STAMP', approvedAt, deactivatedAt: retiredAt, isApproved: false,
    storageKey: 'private', sha256: createHash('sha256').update(fixture).digest('hex'),
  }) } } as unknown as PrismaService, { record: async () => undefined } as unknown as AuditService,
  { getFile: async () => fixture } as StorageAdapter);
  assert.deepEqual(await verifiedAsset.bytes('stamp', 'STAMP', owner, new Date('2026-10-15T12:00:00Z')), fixture,
    'a retired mark is still eligible when approved at actual issuance');
  await assert.rejects(() => verifiedAsset.bytes('stamp', 'STAMP', owner, new Date('2026-10-10T00:00:00Z')),
    NotFoundException, 'the same backdated display date predates artwork approval');
  await assert.rejects(() => verifiedAsset.bytes('stamp', 'STAMP', owner, new Date('2026-10-17T00:00:00Z')),
    NotFoundException, 'a newly issued document cannot select retired artwork');
  assert.equal(DOCUMENT_TYPES.length, 11, 'DEC-099 catalog');
  assert.equal(new Set(DOCUMENT_TYPES).size, 11);
  await projectionCases();
  for (const type of DOCUMENT_TYPES) {
    const data: DocumentData = { type, id: 'record-12345', number: 'DOC-01', status: 'ISSUED',
      effectiveAt: new Date('2026-10-15T11:00:00Z'), issued: true,
      fields: { number: 'DOC-01', party: '=1+1', amount: '9007199254740993.20',
        taxNumber: 'TRN-at-issuance', status: 'ISSUED' },
      rows: [{ reference: 'REF', description: '+cmd()', amount: '9007199254740993.20' }] };
    const layout = { ...defaultLayout(type), columns: ['reference', 'description', 'amount'],
      stampAssetId: 'asset-stamp', signatureAssetId: 'asset-signature' };
    assert.equal(validateLayout(layout).title.length > 0, true);
    calls.length = 0;
    const print = await renderer.render(data, layout, identity, 'print', owner);
    assert.equal(print.subarray(0, 5).toString(), '%PDF-');
    assert.deepEqual(calls, [], `${type}: print must never read company stamp/signature bytes`);
    calls.length = 0;
    const pdf = await renderer.render(data, layout, identity, 'pdf', owner);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.deepEqual(calls, ['STAMP', 'SIGNATURE'], `${type}: PDF has only assigned approval marks`);
    assert.match(pdf.toString('latin1'), /\/Subtype\s*\/Image/, 'PDF contains approved images');
    calls.length = 0;
    const excel = await renderer.render(data, layout, identity, 'xlsx', owner);
    assert.equal(excel.subarray(0, 2).toString(), 'PK');
    assert.deepEqual(calls, [], `${type}: Excel omits approval artwork`);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(excel);
    const sheet = book.getWorksheet('Document')!;
    const values = sheet.getRows(1, sheet.rowCount)!.flatMap((row) => row.values as Array<unknown>);
    assert.ok(values.includes("'=1+1"), `${type}: input is inert spreadsheet text`);
    assert.ok(values.includes("'+cmd()"));
    assert.ok(values.includes('9007199254740993.20'), 'money remains an exact string');
    if (type === 'invoice') assert.ok(values.includes('TRN-at-issuance'), 'issued TRN does not change with company settings');
  }
  const sample: DocumentData = { type: 'invoice', id: 'sample-record', number: 'INV-123',
    status: 'DRAFT', effectiveAt: null, issued: false, fields: { number: 'INV-123' }, rows: [] };
  const beforeSwitch = new ExcelJS.Workbook();
  await beforeSwitch.xlsx.load(await renderer.render(sample, { ...defaultLayout('invoice'), title: 'Version A' }, identity, 'xlsx', owner));
  const afterSwitch = new ExcelJS.Workbook();
  await afterSwitch.xlsx.load(await renderer.render(sample, { ...defaultLayout('invoice'), title: 'Version B' }, identity, 'xlsx', owner));
  assert.equal(beforeSwitch.getWorksheet('Document')!.getCell('A1').value, 'Version A');
  assert.equal(afterSwitch.getWorksheet('Document')!.getCell('A1').value, 'Version B');
  // Instrument PDFKit's text call, not PDF internals: a long draft must get a
  // DRAFT overlay on EACH page; the live ledger gets LIVE, never DRAFT.
  const originalText = PDFDocument.prototype.text;
  let watermarks = 0;
  PDFDocument.prototype.text = function (...args: Parameters<typeof originalText>) {
    if (args[0] === 'DRAFT') watermarks++;
    return originalText.apply(this, args);
  };
  try {
    const draft: DocumentData = { type: 'bill', id: 'draft-record', number: 'B-1',
      status: 'DRAFT', effectiveAt: null, issued: false,
      fields: { number: 'B-1' }, rows: Array.from({ length: 110 }, (_, i) =>
        ({ description: `Line ${i} with several words to use vertical space` })) };
    await renderer.render(draft, defaultLayout('bill'), identity, 'print', owner);
    assert.ok(watermarks > 1, 'all draft B/L pages get a DRAFT watermark');
    calls.length = 0;
    await renderer.render(draft, { ...defaultLayout('bill'),
      stampAssetId: 'asset-stamp', signatureAssetId: 'asset-signature' }, identity, 'pdf', owner);
    assert.deepEqual(calls, [], 'draft B/L cannot carry issuance approval marks');
  } finally { PDFDocument.prototype.text = originalText; }
  assert.throws(() => validateLayout({ ...defaultLayout('invoice'), externalUrl: 'https://bad.test' }), BadRequestException);
  assert.throws(() => validateLayout({ ...defaultLayout('invoice'), columns: ['__proto__'] }), BadRequestException);
  assert.throws(() => validateLayout({ ...defaultLayout('invoice'), fields: ['number', 'number'] }), BadRequestException);
  assert.throws(() => validateLayout({ ...defaultLayout('invoice'), stampAssetId: '../secret' }), BadRequestException);

  // DB-free issuance transaction: projection, company identity and template
  // assignment are copied before their source rows can change.
  const prior = new Date('2026-10-10T00:00:00Z');
  let currentCompany = 'Company at issuance';
  let currentParty = 'Alice';
  let activeVersion: string | null = 'version-old';
  let issuedSnapshot: { data: Prisma.JsonValue; identity: Prisma.JsonValue;
    fallbackLayout: Prisma.JsonValue; templateVersionId: string | null; createdAt?: Date } | null = null;
  const tx = {
    invoice: { findFirst: async () => ({ invoiceNumber: 'INV-123', status: 'ISSUED',
      issueDate: prior, issuedAt: prior, createdAt: prior, customer: { name: currentParty },
      billOfLading: null, title: null, description: null, currencyCode: 'USD', subtotal: '1.00',
      taxAmount: '0', totalAmount: '1.00', trn: 'TRN-at-issuance', notes: null,
      items: [{ description: 'Line', quantity: 1, unitPrice: '1', amount: '1', taxAmount: '0' }] }) },
    companySettings: { findFirst: async () => ({ ...identity, companyName: currentCompany }) },
    documentTemplateAssignment: { findFirst: async () => ({ versionId: activeVersion }) },
    documentIssuedSnapshot: { create: async ({ data }: { data: typeof issuedSnapshot }) => {
      issuedSnapshot = data;
    } },
  };
  await captureIssuedDocument(tx as unknown as Prisma.TransactionClient, 'invoice', 'inv-record', 'issuer');
  assert.equal((issuedSnapshot as { data: DocumentData }).data.fields.party, 'Alice');
  assert.equal((issuedSnapshot as { identity: { companyName: string } }).identity.companyName, 'Company at issuance');
  assert.equal((issuedSnapshot as { fallbackLayout: unknown }).fallbackLayout, Prisma.JsonNull,
    'assigned versions use their immutable, hash-verified stored layout');
  const assignedSnapshot = issuedSnapshot;
  activeVersion = null;
  await captureIssuedDocument(tx as unknown as Prisma.TransactionClient, 'invoice', 'inv-fallback', 'issuer');
  assert.equal((issuedSnapshot as { fallbackLayout: { title: string } }).fallbackLayout.title, 'Invoice',
    'the generic fallback is also frozen at issuance');
  const capturedAt = new Date('2026-10-15T12:00:00Z');
  issuedSnapshot = { ...assignedSnapshot, createdAt: capturedAt };
  currentCompany = 'Renamed company'; currentParty = 'Bob'; activeVersion = 'version-new';

  let projected = 0;
  let rendered = 0;
  const stored = new Map<string, { content: Buffer; sha256: string }>();
  const db = {
    documentIssuedSnapshot: { findUnique: async () => issuedSnapshot },
    documentTemplateVersion: { findUnique: async ({ where }: { where: { id: string } }) =>
      where.id === 'version-new' ? { template: { documentType: 'invoice' } } : null },
    documentRenderedOutput: {
      findUnique: async ({ where }: { where: { documentType_recordId_format_revisionKey: object } }) =>
        stored.get(JSON.stringify(where.documentType_recordId_format_revisionKey)) ?? null,
      create: async ({ data }: { data: { documentType: string; recordId: string; format: string;
        revisionKey: string; content: Buffer; sha256: string } }) => {
        const { documentType, recordId, format, revisionKey } = data;
        stored.set(JSON.stringify({ documentType, recordId, format, revisionKey }), data);
        return data;
      },
    },
  };
  const templates = { versionAt: async () => { throw new Error('Current assignment must not be consulted'); },
    readLayout: async (id: string) => {
      assert.equal(id, rendered ? 'version-new' : 'version-old');
      return defaultLayout('invoice');
    } };
  const service = new DocumentOutputService(db as unknown as PrismaService,
    templates as unknown as DocumentTemplateService,
    { get: async () => { projected++; throw new Error('Snapshot must replace current projection'); } } as unknown as DocumentDataService,
    { render: async (data: DocumentData, _layout: unknown, snapshotIdentity: typeof identity,
      _format: string, _actor: AuthenticatedUser, artworkAt: Date | null) => {
      assert.equal(data.fields.party, 'Alice');
      assert.equal(snapshotIdentity.companyName, 'Company at issuance');
      assert.equal(artworkAt?.getTime(), rendered ? undefined : capturedAt.getTime(),
        'assigned artwork is eligible at actual capture time, not the backdated display date');
      rendered++; return Buffer.from(`frozen-${rendered}`);
    } } as unknown as DocumentRendererService,
    { getDocumentIdentity: async () => { throw new Error('Current company must not be consulted'); } } as unknown as CompanySettingsService);
  await assert.rejects(() => service.output(portal, 'invoice', 'inv-record', 'pdf'), ForbiddenException);
  const partial: AuthenticatedUser = { ...portal, portalAgentId: null, permissions: ['document:render'] };
  await assert.rejects(() => service.output(partial, 'invoice', 'inv-record', 'pdf'), ForbiddenException);
  assert.equal(projected, 0, 'denied callers do not read records');
  const reader: AuthenticatedUser = { ...portal, portalAgentId: null, permissions: ['document:render', 'invoice:read'] };
  await assert.rejects(() => service.output({ ...reader, portalAgentId: 'agent-1' }, 'invoice', 'inv-record', 'pdf'),
    ForbiddenException, 'a portal principal cannot render an unscoped office document even with mistaken grants');
  const first = await service.output(reader, 'invoice', 'inv-record', 'pdf');
  const second = await service.output(reader, 'invoice', 'inv-record', 'pdf');
  assert.equal(first.bytes.toString(), 'frozen-1');
  assert.equal(second.bytes.toString(), 'frozen-1', 'archive bytes not recomputed');
  assert.equal(rendered, 1);
  await assert.rejects(() => service.output(reader, 'invoice', 'inv-record', 'pdf', { previewVersionId: 'version-new' }), ForbiddenException);
  await assert.rejects(() => service.output(reader, 'unknown', 'inv-record', 'pdf'), BadRequestException);
  await assert.rejects(() => service.output(owner, 'ledger', 'customer-123', 'pdf',
    { fromDate: '2026-02-30' }), BadRequestException);
  const preview = await service.output(owner, 'invoice', 'inv-record', 'pdf', { previewVersionId: 'version-new' });
  assert.equal(preview.bytes.toString(), 'frozen-2', 'authorized preview is not the issued archive');

  // Historical rows cannot be backfilled with fabricated issuance state. Warn
  // on first render, then return the same archived bytes after status changes.
  let historicStatus = 'ISSUED';
  let historicRenders = 0;
  let historicWarning = '';
  const historicDb = { ...db,
    documentIssuedSnapshot: { findUnique: async () => null },
    documentRenderedOutput: {
      findUnique: db.documentRenderedOutput.findUnique,
      create: db.documentRenderedOutput.create,
    } };
  const historic = new DocumentOutputService(historicDb as unknown as PrismaService,
    { versionAt: async () => null } as unknown as DocumentTemplateService,
    { get: async () => ({ type: 'invoice', id: 'legacy-record', number: 'INV-LEGACY',
      status: historicStatus, issued: true, effectiveAt: prior,
      fields: { party: currentParty }, rows: [] }) } as unknown as DocumentDataService,
    { render: async (d: DocumentData) => {
      historicWarning = d.warning ?? ''; historicRenders++;
      return Buffer.from(`legacy-${historicRenders}`);
    } } as unknown as DocumentRendererService,
    { getDocumentIdentity: async () => identity } as unknown as CompanySettingsService);
  const legacyFirst = await historic.output(reader, 'invoice', 'legacy-record', 'pdf');
  assert.match(historicWarning, /reconstructed on first render/);
  historicStatus = 'CANCELLED'; currentParty = 'Renamed party';
  const legacyLater = await historic.output(reader, 'invoice', 'legacy-record', 'pdf');
  assert.equal(legacyLater.bytes.toString(), legacyFirst.bytes.toString());
  assert.equal(historicRenders, 1);
  console.log('Phase 8 document unit checks passed: 11 projections and 11 types × PDF/Print/Excel; marks, workbook data, issuance snapshot, permissions and archive.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
