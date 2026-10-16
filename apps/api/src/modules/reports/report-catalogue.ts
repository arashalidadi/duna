import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/auth/types';
import { range } from './report-math';

export type FieldKind = 'text' | 'date' | 'number' | 'money';
export type FieldInfo = { kind: FieldKind; permission?: string; description?: string; base?: boolean };
const t: FieldInfo = { kind: 'text' }, d: FieldInfo = { kind: 'date' };
const n: FieldInfo = { kind: 'number' }, m: FieldInfo = { kind: 'money' };
const name: FieldInfo = { kind: 'text', permission: 'customer:read' };
const voyage: FieldInfo = { kind: 'text', permission: 'voyage:read' };
const bill: FieldInfo = { kind: 'text', permission: 'bill:read' };
const invoice: FieldInfo = { kind: 'text', permission: 'invoice:read' };
const base: FieldInfo = { kind: 'money', base: true };
export const CATALOGUE = {
  invoices: { permission: 'invoice:read', date: 'issueDate', basis: 'All nondeleted invoice statuses; only ISSUED netIncome/outstanding are financial, with preserved line tax (historic header fallback marked taxSource). No general-journal invoice entry. CURRENT paid amount; baseNetIncome requires recorded FX snapshot.',
    fields: { id: t, invoiceNumber: t, status: t, customerId: t, customerName: name, voyageId: t,
      voyageNumber: voyage, billNumbers: bill, jobNumbers: { kind: 'text', permission: 'job:read' },
      issueDate: d, dueDate: d, currencyCode: t, gross: m, tax: m, netIncome: m,
      paid: m, outstanding: m, baseAmount: base, baseNetIncome: base, baseCurrencyCode: t,
      taxSource: t, exchangeRate: n, rateSource: t, rateEffectiveAt: d,
      currencyRateId: { kind: 'text', permission: 'currency_rate:read' },
      rateOverrideReason: { kind: 'text', permission: 'currency_rate:read' },
      customerPostingId: t, allocationIds: { kind: 'text', permission: 'voucher:read' } } },
  vouchers: { permission: 'voucher:read', date: 'voucherDate', basis: 'Posted receipts/refunds. PAYMENT is a refund, not revenue. allocated includes ALL active refs; invoiceAllocated is invoice-specific. B/L-only allocations never settle invoices.',
    fields: { id: t, voucherNumber: t, type: t, customerId: t, customerName: name,
      invoiceNumber: invoice, voucherDate: d, currencyCode: t, amount: m,
      baseAmount: base, baseCurrencyCode: t, exchangeRate: n, rateSource: t, rateEffectiveAt: d,
      currencyRateId: { kind: 'text', permission: 'currency_rate:read' },
      rateOverrideReason: { kind: 'text', permission: 'currency_rate:read' },
      allocated: m, invoiceAllocated: m, unallocated: m, allocationIds: t } },
  customers: { permission: 'customer:read', date: 'createdAt', basis: 'Customer master, not receivables or the accounting ledger.',
    fields: { id: t, code: t, name: t, personKind: t, active: t, createdAt: d } },
  customer_history: { permission: 'customer:read', extra: ['invoice:read', 'voucher:read', 'job:read'], date: 'date',
    basis: 'Operational customer history: issued invoices, posted vouchers and nondeleted jobs. Mixed money types are not combined into a balance.',
    fields: { id: t, customerId: t, customerName: name, kind: t, documentNumber: t, date: d,
      status: t, currencyCode: t, amount: m, voyageId: t } },
  jobs: { permission: 'job:read', date: 'openingDate', basis: 'Jobs and operations; cost items are operational, not posted general-ledger expense.',
    fields: { id: t, jobNumber: t, title: t, status: t, jobType: t, customerId: t,
      customerName: name, voyageId: t, voyageNumber: voyage, openingDate: d,
      completedAt: d, currencyCode: t } },
  job_cost_items: { permission: 'job:read', date: 'itemDate', basis: 'Operational job estimates ONLY; not journal-backed voyage costs or recognized P&L.',
    fields: { id: t, jobId: t, jobNumber: t, kind: t, category: t, description: t,
      itemDate: d, currencyCode: t, amount: m } },
  journal_lines: { permission: 'journal:read', date: 'journalDate', basis: 'ACTUAL general-journal entries. Reversals are included as opposite postings, by journalDate.',
    fields: { id: t, journalId: t, journalNumber: t, journalDate: d, kind: t,
      accountId: t, accountCode: t, accountName: t, accountType: t, customerId: t,
      currencyCode: t, debit: m, credit: m, netDebit: m,
      baseCurrencyCode: t, baseDebit: base, baseCredit: base, baseNetDebit: base,
      exchangeRate: n, rateSource: t, rateEffectiveAt: d,
      currencyRateId: { kind: 'text', permission: 'currency_rate:read' },
      rateOverrideReason: { kind: 'text', permission: 'currency_rate:read' },
      reversalOfId: t } },
  voyage_costs: { permission: 'expense:read', extra: ['journal:read'], date: 'journalDate',
    basis: 'Only unreversed, posted voyage cost journals. Input VAT NULL is UNKNOWN (not zero); legacy manifest columns ignored.',
    fields: { id: t, voyageId: t, voyageNumber: voyage, manifestId: t, manifestNumber: { kind: 'text', permission: 'manifest:read' },
      categoryCode: t, categoryName: t, journalId: t, journalNumber: t, journalDate: d,
      currencyCode: t, netAmount: m, inputVat: m, baseNetAmount: base,
      baseCurrencyCode: t, exchangeRate: n, rateSource: t, rateEffectiveAt: d,
      currencyRateId: { kind: 'text', permission: 'currency_rate:read' },
      rateOverrideReason: { kind: 'text', permission: 'currency_rate:read' } } },
  bills: { permission: 'bill:read', date: 'createdAt', basis: 'Internal B/L document register, including drafts; not exposed in the agent portal.',
    fields: { id: t, billNumber: t, status: t, manifestId: t, manifestNumber: { kind: 'text', permission: 'manifest:read' },
      voyageId: t, voyageNumber: voyage, createdAt: d, issuedAt: d,
      currencyCode: t, freightAmount: m } },
  manifests: { permission: 'manifest:read', date: 'createdAt', basis: 'Manifest document register; legacy cost columns excluded.',
    fields: { id: t, manifestNumber: t, status: t, voyageId: t, voyageNumber: voyage,
      vesselName: t, manifestDate: d, createdAt: d, totalQuantity: n, totalPackages: n } },
  releases: { permission: 'release:read', extra: ['bill:read'], date: 'releaseDate',
    basis: 'User-recorded state at release, not a current invoice settlement.',
    fields: { id: t, releaseNumber: t, releaseDate: d, billId: t, billNumber: t,
      manifestId: t, paymentState: t, financialOverride: t, overrideReason: t } },
  deliveries: { permission: 'delivery:read', extra: ['bill:read'], date: 'issueDate',
    basis: 'Issued D/O register, not proof of invoice payment.',
    fields: { id: t, docNumber: t, issueDate: d, billId: t, billNumber: t,
      recipient: t, portName: t } },
  proformas: { permission: 'proforma:read', date: 'issueDate', basis: 'Proforma documents are quotations, not issued income.',
    fields: { id: t, proformaNumber: t, status: t, customerId: t, customerName: name,
      issueDate: d, validUntil: d, currencyCode: t, total: m, tax: m, linkedInvoiceId: t } },
  quotations: { permission: 'quotation:read', date: 'issueDate', basis: 'Quotation documents are offers, not realized income.',
    fields: { id: t, quotationNumber: t, status: t, customerId: t, customerName: name,
      issueDate: d, validUntil: d, currencyCode: t, total: m, tax: m, linkedProformaId: t } },
} as const satisfies Record<string, { permission: string; extra?: string[]; date: string; basis: string;
  fields: Record<string, FieldInfo> }>;
export type SourceName = keyof typeof CATALOGUE;
export const sources = Object.keys(CATALOGUE) as SourceName[];
export type ReportFilter = { field: string; op: 'eq' | 'neq' | 'contains' | 'gte' | 'lte' | 'in'; value: string };
export type ReportMetric = { op: 'sum' | 'avg' | 'min' | 'max' | 'count'; field?: string; as: string };
export type ReportSpec = { source: SourceName; columns: string[]; from?: string; to?: string;
  filters: ReportFilter[]; groupBy: string[]; metrics: ReportMetric[];
  sort?: { field: string; direction: 'asc' | 'desc' } };

export function allowed(actor: AuthenticatedUser, permission: string) {
  return actor.isPrimaryAdmin || actor.permissions.includes(permission);
}
export function assertReportPermissions(actor: AuthenticatedUser, source: SourceName, fields: string[]) {
  const entry = CATALOGUE[source];
  if (!allowed(actor, entry.permission) || ('extra' in entry && entry.extra.some((p) => !allowed(actor, p)))) {
    throw new ForbiddenException('Report source requires its underlying document permissions');
  }
  for (const field of fields) {
    const info: FieldInfo | undefined = Object.prototype.hasOwnProperty.call(entry.fields, field)
      ? (entry.fields as Record<string, FieldInfo>)[field] : undefined;
    if (!info) throw new BadRequestException(`Unrecognized field ${field}`);
    if (info.permission && !allowed(actor, info.permission)) {
      throw new ForbiddenException(`Field ${field} requires ${info.permission}`);
    }
  }
}
function record(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
function fields(input: unknown, label: string, limit: number): string[] {
  if (!Array.isArray(input) || input.length > limit || input.some((v) => typeof v !== 'string' || v.length > 60)) {
    throw new BadRequestException(`${label} must be an array of at most ${limit} field names`);
  }
  return input;
}

/** Also called on EVERY saved-report run and export, so later permission
 * revocation cannot be bypassed via a previously saved specification. */
export function parseSpec(input: unknown, actor: AuthenticatedUser): ReportSpec {
  if (!record(input) || !sources.includes(input.source as SourceName)) throw new BadRequestException('Unknown report source');
  const source = input.source as SourceName;
  const columns = fields(input.columns, 'columns', 24);
  if (!columns.length || new Set(columns).size !== columns.length) throw new BadRequestException('Choose distinct columns');
  const groupBy = input.groupBy === undefined ? [] : fields(input.groupBy, 'groupBy', 3);
  if (new Set(groupBy).size !== groupBy.length) throw new BadRequestException('Choose distinct grouping fields');
  const filters: ReportFilter[] = [];
  if (input.filters !== undefined) {
    if (!Array.isArray(input.filters) || input.filters.length > 8) throw new BadRequestException('At most 8 filters');
    for (const item of input.filters) {
      if (!record(item) || typeof item.field !== 'string' ||
          !['eq', 'neq', 'contains', 'gte', 'lte', 'in'].includes(String(item.op)) ||
          typeof item.value !== 'string' || item.value.length > 200) throw new BadRequestException('Invalid report filter');
      filters.push({ field: item.field, op: item.op as ReportFilter['op'], value: item.value });
    }
  }
  const metrics: ReportMetric[] = [];
  if (input.metrics !== undefined) {
    if (!Array.isArray(input.metrics) || input.metrics.length > 8) throw new BadRequestException('At most 8 metrics');
    for (const item of input.metrics) {
      if (!record(item) || !['sum', 'avg', 'min', 'max', 'count'].includes(String(item.op)) ||
          typeof item.as !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(item.as) ||
          (Object.prototype.hasOwnProperty.call(Object.prototype, item.as) || item.as === 'prototype') ||
          (item.field !== undefined && typeof item.field !== 'string')) throw new BadRequestException('Invalid metric');
      metrics.push({ op: item.op as ReportMetric['op'], field: item.field as string | undefined, as: item.as });
    }
  }
  if (groupBy.length && !metrics.length) throw new BadRequestException('Grouped reports require metrics');
  if (new Set(metrics.map((x) => x.as)).size !== metrics.length ||
      metrics.some((x) => columns.includes(x.as) || groupBy.includes(x.as))) throw new BadRequestException('Metric aliases must be unique');
  let sort: ReportSpec['sort'];
  if (input.sort !== undefined) {
    if (!record(input.sort) || typeof input.sort.field !== 'string' ||
        !['asc', 'desc'].includes(String(input.sort.direction))) throw new BadRequestException('Invalid report sort');
    sort = { field: input.sort.field, direction: input.sort.direction as 'asc' | 'desc' };
  }
  const from = input.from, to = input.to;
  if ((from === undefined) !== (to === undefined) ||
      (from !== undefined && (typeof from !== 'string' || typeof to !== 'string'))) {
    throw new BadRequestException('Provide both UTC date boundaries or neither');
  }
  if (typeof from === 'string' && typeof to === 'string') range(from, to);
  const required = [...columns, ...groupBy, ...filters.map((x) => x.field),
    ...metrics.flatMap((x) => x.field ? [x.field] : []),
    ...(sort && !metrics.some((x) => x.as === sort?.field) ? [sort.field] : [])];
  assertReportPermissions(actor, source, required);
  const catalogue = CATALOGUE[source];
  for (const filter of filters) {
    const info = (catalogue.fields as Record<string, FieldInfo>)[filter.field];
    if (filter.op === 'contains' && info.kind !== 'text') throw new BadRequestException('Contains only works on text fields');
    if (filter.op === 'in' && filter.value.split(',').length > 20) throw new BadRequestException('At most 20 IN values');
  }
  for (const metric of metrics) {
    if (metric.op !== 'count' && (!metric.field || metric.field === 'exchangeRate' ||
        !['number', 'money'].includes((catalogue.fields as Record<string, FieldInfo>)[metric.field].kind))) {
      throw new BadRequestException('Metrics require aggregatable numeric fields; FX rates cannot be aggregated');
    }
  }
  if (sort && groupBy.length && !groupBy.includes(sort.field) && !metrics.some((x) => x.as === sort?.field)) {
    throw new BadRequestException('Grouped sorting requires a grouping field or metric');
  }
  return { source, columns, groupBy, filters, metrics, from: from as string | undefined,
    to: to as string | undefined, sort };
}

export function availableCatalogue(actor: AuthenticatedUser) {
  return sources.flatMap((source) => {
    const entry = CATALOGUE[source];
    if (!allowed(actor, entry.permission) || ('extra' in entry && entry.extra.some((p) => !allowed(actor, p)))) return [];
    return [{ source, dateField: entry.date, basis: entry.basis,
      fields: Object.entries(entry.fields).filter(([, info]) => !info.permission || allowed(actor, info.permission))
        .map(([field, info]) => ({ field, kind: info.kind,
          relationshipOrCalculated: ['customerName', 'voyageNumber', 'billNumbers', 'jobNumbers', 'invoiceNumber',
            'outstanding', 'netIncome', 'baseNetIncome', 'invoiceAllocated', 'taxSource',
            'netDebit', 'baseNetDebit', 'unallocated'].includes(field),
          description: info.description ?? null })) }];
  });
}
