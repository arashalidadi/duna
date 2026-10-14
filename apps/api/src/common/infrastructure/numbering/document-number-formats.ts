/**
 * Document number formats for period-numbered documents (ADR-008).
 *
 * Each entry is the configuration for one number family, rendered as
 * `{CODE}-{yymm}-{#####}`. The sequence row created from it is the live,
 * administrator-visible configuration; these defaults only seed new rows.
 * Existing rows are never rewritten (their counters and formats stay).
 *
 * `sequenceFamily` decides which document types share a counter. Quotation and
 * proforma both issue PRF numbers, and proforma and invoice both issue INV numbers,
 * so each pair shares one counter.
 *
 * `clock` preserves the time basis each generator used before migration:
 * UTC for most types, server-local time for vouchers and portal bookings.
 * (Owner decision pending on a single canonical clock; see phase-2-numbering.md.)
 */
export type NumberingClock = 'utc' | 'local';

export interface PeriodicDocumentFormat {
  /** Printed prefix, e.g. `INV`. */
  code: string;
  /** `NumberingSequence.documentType` value. */
  documentType: string;
  /** Shared counter family; the sequence name is `<family>-<yymm>`. */
  sequenceFamily: string;
  clock: NumberingClock;
}

export const PERIODIC_DOCUMENT_FORMATS = {
  INVOICE: { code: 'INV', documentType: 'INVOICE', sequenceFamily: 'invoice', clock: 'utc' },
  PROFORMA: { code: 'PRF', documentType: 'PROFORMA', sequenceFamily: 'proforma', clock: 'utc' },
  QUOTATION: { code: 'QT', documentType: 'QUOTATION', sequenceFamily: 'quotation', clock: 'utc' },
  GENERAL_JOURNAL: { code: 'JRN', documentType: 'GENERAL_JOURNAL', sequenceFamily: 'journal', clock: 'utc' },
  VOUCHER_RECEIPT: {
    code: 'RCP',
    documentType: 'VOUCHER_RECEIPT',
    sequenceFamily: 'voucher-rcp',
    clock: 'local',
  },
  VOUCHER_PAYMENT: {
    code: 'PMT',
    documentType: 'VOUCHER_PAYMENT',
    sequenceFamily: 'voucher-pmt',
    clock: 'local',
  },
  CARGO: { code: 'CRG', documentType: 'CARGO', sequenceFamily: 'cargo', clock: 'utc' },
  INSPECTION: { code: 'INS', documentType: 'INSPECTION', sequenceFamily: 'inspection', clock: 'utc' },
  LOAD_LIST: { code: 'LL', documentType: 'LOAD_LIST', sequenceFamily: 'load-list', clock: 'utc' },
  ACTUAL_LOADING: {
    code: 'AL',
    documentType: 'ACTUAL_LOADING',
    sequenceFamily: 'actual-loading',
    clock: 'utc',
  },
  DISCHARGE: { code: 'DIS', documentType: 'DISCHARGE', sequenceFamily: 'discharge', clock: 'utc' },
  BOOKING_REQUEST: {
    code: 'BRK',
    documentType: 'BOOKING_REQUEST',
    sequenceFamily: 'booking-request',
    clock: 'local',
  },
  SALARY_RECORD: {
    code: 'SAL',
    documentType: 'SALARY_RECORD',
    sequenceFamily: 'salary-record',
    clock: 'utc',
  },
} as const satisfies Record<string, PeriodicDocumentFormat>;

export type PeriodicDocumentKey = keyof typeof PERIODIC_DOCUMENT_FORMATS;

/** `yymm` for a timestamp on the format's clock, e.g. `2610` for October 2026. */
export function yymmFor(date: Date, clock: NumberingClock): string {
  const year = clock === 'utc' ? date.getUTCFullYear() : date.getFullYear();
  const month = clock === 'utc' ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  return `${String(year % 100).padStart(2, '0')}${String(month).padStart(2, '0')}`;
}

export interface PeriodicSequenceRequest {
  name: string;
  documentType: string;
  scopeType: 'YEAR_PERIOD';
  scopeValue: string;
  prefix: string;
  padding: 5;
  format: '{prefix}{sequence}';
  period: 'YYYYMM';
}

/** The NumberingService request for one document key in the period containing `now`. */
export function periodicSequenceRequest(
  key: PeriodicDocumentKey,
  now: Date,
): PeriodicSequenceRequest {
  const spec: PeriodicDocumentFormat = PERIODIC_DOCUMENT_FORMATS[key];
  const yymm = yymmFor(now, spec.clock);
  return {
    name: `${spec.sequenceFamily}-${yymm}`,
    documentType: spec.documentType,
    scopeType: 'YEAR_PERIOD',
    scopeValue: yymm,
    prefix: `${spec.code}-${yymm}-`,
    padding: 5,
    format: '{prefix}{sequence}',
    period: 'YYYYMM',
  };
}

/**
 * First number to issue for a new sequence row: the highest existing number
 * with this prefix, plus one (or 1 if none). Callers pass the highest existing
 * number including soft-deleted rows, so numbers already issued are never reused.
 */
export function nextSequenceAfter(prefix: string, latestNumber: string | null): number {
  if (!latestNumber) return 1;
  const last = Number(latestNumber.slice(prefix.length));
  return Number.isFinite(last) ? last + 1 : 1;
}
