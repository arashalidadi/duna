import { BadRequestException } from '@nestjs/common';

/** DEC-099: Payment and Receipt are separate output types over Voucher rows. */
export const DOCUMENT_TYPES = [
  'loading-list', 'bill', 'manifest', 'invoice', 'delivery-order', 'release-order',
  'salary-slip', 'voucher', 'payment', 'receipt', 'ledger',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentFormat = 'pdf' | 'print' | 'xlsx';

export const READ_PERMISSION: Record<DocumentType, string> = {
  'loading-list': 'load_list:read', bill: 'bill:read', manifest: 'manifest:read',
  invoice: 'invoice:read', 'delivery-order': 'delivery:read', 'release-order': 'release:read',
  'salary-slip': 'salary:read', voucher: 'voucher:read', payment: 'voucher:read',
  receipt: 'voucher:read', ledger: 'ledger:read',
};

/** Only values placed in this projection may reach a renderer or a template. */
export const HEADER_FIELDS = [
  'number', 'status', 'date', 'party', 'reference', 'vessel', 'voyage',
  'origin', 'destination', 'port', 'currency', 'amount', 'subtotal', 'tax',
  'taxNumber', 'period', 'paymentState', 'notes',
] as const;
export const LINE_FIELDS = [
  'reference', 'description', 'shipper', 'consignee', 'quantity', 'units', 'packages', 'weight', 'unitPrice',
  'amount', 'tax', 'currency', 'debit', 'credit', 'balance',
] as const;
export type HeaderField = (typeof HEADER_FIELDS)[number];
export type LineField = (typeof LINE_FIELDS)[number];

export interface DocumentData {
  type: DocumentType;
  id: string;
  number: string;
  status: string;
  /** The document's original issuance/finalization date, not the time of download. */
  effectiveAt: Date | null;
  /** False for editable drafts and live ledger statements; those are never archived. */
  issued: boolean;
  fields: Partial<Record<HeaderField, string>>;
  rows: Array<Partial<Record<LineField, string>>>;
  warning?: string;
}

/** Declarative JSON only. No HTML, Javascript, external URLs, arbitrary ORM paths or formulas. */
export interface DocumentLayout {
  title: string;
  pageSize: 'A4' | 'LETTER';
  orientation: 'portrait' | 'landscape';
  margin: number;
  fontSize: number;
  fields: HeaderField[];
  columns: LineField[];
  note?: string;
  logoAssetId?: string;
  letterheadAssetId?: string;
  stampAssetId?: string;
  signatureAssetId?: string;
}

const headerSet = new Set<string>(HEADER_FIELDS);
const lineSet = new Set<string>(LINE_FIELDS);
const keys = new Set([
  'title', 'pageSize', 'orientation', 'margin', 'fontSize', 'fields', 'columns', 'note',
  'logoAssetId', 'letterheadAssetId', 'stampAssetId', 'signatureAssetId',
]);

export function isDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}

/** Strict bounds keep both hostile uploads and accidental giant print jobs out. */
export function validateLayout(raw: unknown): DocumentLayout {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException('Template layout must be a JSON object');
  }
  const v = raw as Record<string, unknown>;
  if (Object.keys(v).some((k) => !keys.has(k))) {
    throw new BadRequestException('Unknown template layout property');
  }
  const bounded = (value: unknown, max: number, optional = false): value is string =>
    (optional && value === undefined) || (typeof value === 'string' && value.length <= max && (optional || value.trim().length > 0));
  if (!bounded(v.title, 100) ||
    (v.pageSize !== 'A4' && v.pageSize !== 'LETTER') ||
    (v.orientation !== 'portrait' && v.orientation !== 'landscape') ||
    typeof v.margin !== 'number' || !Number.isInteger(v.margin) || v.margin < 24 || v.margin > 90 ||
    typeof v.fontSize !== 'number' || !Number.isInteger(v.fontSize) || v.fontSize < 8 || v.fontSize > 16 ||
    !Array.isArray(v.fields) || v.fields.length < 1 || v.fields.length > HEADER_FIELDS.length ||
    v.fields.some((field: unknown) => typeof field !== 'string' || !headerSet.has(field)) ||
    new Set(v.fields).size !== v.fields.length ||
    !Array.isArray(v.columns) || v.columns.length > LINE_FIELDS.length ||
    v.columns.some((field: unknown) => typeof field !== 'string' || !lineSet.has(field)) ||
    new Set(v.columns).size !== v.columns.length ||
    !bounded(v.note, 500, true)) {
    throw new BadRequestException('Invalid template layout');
  }
  for (const field of ['logoAssetId', 'letterheadAssetId', 'stampAssetId', 'signatureAssetId']) {
    if (v[field] !== undefined &&
      (typeof v[field] !== 'string' || !/^[a-z0-9_-]{8,50}$/i.test(v[field] as string))) {
      throw new BadRequestException(`Invalid ${field}`);
    }
  }
  return v as unknown as DocumentLayout;
}

/** Safe, deliberately generic fallback; never presented as an official company template. */
export function defaultLayout(type: DocumentType): DocumentLayout {
  return {
    title: type.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    pageSize: 'A4', orientation: 'portrait', margin: 42, fontSize: 10,
    fields: [...HEADER_FIELDS], columns: [...LINE_FIELDS],
    note: 'Generic system layout — official company template not supplied.',
  };
}
