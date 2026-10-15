import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { CATALOGUE, availableCatalogue, parseSpec,
  type FieldInfo, type ReportFilter, type ReportMetric, type ReportSpec } from './report-catalogue';
import { ReportDatasets, type DataRow } from './report-datasets';
import { money } from './report-math';

function isNumeric(kind: FieldInfo['kind']) { return kind === 'number' || kind === 'money'; }
function compare(a: string | null, b: string | null, kind: FieldInfo['kind']): number {
  if (a === b) return 0;
  if (a === null) return 1; // null last in both directions
  if (b === null) return -1;
  if (isNumeric(kind)) {
    try { return new Prisma.Decimal(a).comparedTo(new Prisma.Decimal(b)); }
    catch { throw new BadRequestException('Numeric comparison requires a decimal operand'); }
  }
  return a.localeCompare(b);
}
function matches(row: DataRow, filter: ReportFilter, kind: FieldInfo['kind']): boolean {
  const value = row[filter.field];
  if (filter.op === 'in') return filter.value.split(',').map((v) => v.trim()).includes(value ?? '');
  if (filter.value.toLowerCase() === 'null') return filter.op === 'eq' ? value === null :
    filter.op === 'neq' ? value !== null : false;
  if (value === null) return filter.op === 'neq';
  if (filter.op === 'contains') return value.toLocaleLowerCase().includes(filter.value.toLocaleLowerCase());
  // A YYYY-MM-DD filter against an ISO timestamp compares whole UTC calendar days.
  const left = kind === 'date' ? value.slice(0, 10) : value;
  const right = kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(filter.value)
    ? filter.value : filter.value;
  const c = compare(left, right, kind);
  if (filter.op === 'eq') return c === 0;
  if (filter.op === 'neq') return c !== 0;
  if (filter.op === 'gte') return c >= 0;
  return c <= 0;
}

function aggregate(rows: DataRow[], metric: ReportMetric, spec: ReportSpec): string {
  if (metric.op === 'count') return String(rows.length);
  const field = metric.field!;
  const info: FieldInfo = (CATALOGUE[spec.source].fields as Record<string, FieldInfo>)[field];
  const valid = rows.filter((r) => r[field] !== null && r[field] !== undefined);
  if (info.kind === 'money' && ['sum', 'avg'].includes(metric.op) && valid.length !== rows.length) {
    throw new ConflictException(`Cannot ${metric.op} ${field}: a source has no recorded amount. Filter unknown values explicitly; no partial financial total returned.`);
  }
  if (info.kind === 'money' && valid.length) {
    const unit = info.base ? 'baseCurrencyCode' : 'currencyCode';
    const codes = new Set(valid.map((r) => r[unit]));
    if (codes.has(null) || codes.size !== 1) {
      throw new ConflictException(`Cannot ${metric.op} ${field}: mixed/unknown ${unit}. Filter to one currency or group by ${unit}.`);
    }
    if (['vouchers', 'customer_history', 'job_cost_items'].includes(spec.source)) {
      const dimension = spec.source === 'vouchers' ? 'type' : 'kind';
      if (new Set(valid.map((r) => r[dimension])).size > 1) {
        throw new ConflictException(`Cannot ${metric.op} ${field} across unlike ${dimension} values. Filter/group by ${dimension}.`);
      }
    }
    if (spec.source === 'invoices' && ['gross', 'tax', 'baseAmount'].includes(field) &&
        new Set(valid.map((r) => r.status)).size > 1) {
      throw new ConflictException('Invoice gross/tax across DRAFT, ISSUED and CANCELLED must be separated by status');
    }
  }
  if (!valid.length) return ''; // unknown, never mislabel as zero
  const nums = valid.map((r) => {
    try { return new Prisma.Decimal(r[field]!); }
    catch { throw new ConflictException(`Invalid numeric source for ${field}`); }
  });
  const result = metric.op === 'sum' || metric.op === 'avg'
    ? nums.reduce((sum, x) => sum.plus(x), new Prisma.Decimal(0))
      .div(metric.op === 'avg' ? nums.length : 1)
    : metric.op === 'min' ? Prisma.Decimal.min(...nums) : Prisma.Decimal.max(...nums);
  return info.kind === 'money' ? money(result) : result.toDecimalPlaces(2).toString();
}

export interface BuiltReport {
  kind: 'saved-custom-report';
  source: ReportSpec['source'];
  basis: string;
  definition: ReportSpec;
  rows: Array<Record<string, string | null | string[]>>;
  totals: Record<string, string | null>;
  count: number;
  grouped: boolean;
  warning: string;
}

@Injectable()
export class ReportBuilderService {
  constructor(private readonly prisma: PrismaService, private readonly data: ReportDatasets,
    private readonly audit: AuditService) {}

  catalogue(actor: AuthenticatedUser) { return availableCatalogue(actor); }

  async run(input: unknown, actor: AuthenticatedUser): Promise<BuiltReport> {
    const spec = parseSpec(input, actor);
    const source = CATALOGUE[spec.source];
    const field = (f: string): FieldInfo => (source.fields as Record<string, FieldInfo>)[f] ??
      { kind: spec.metrics.some((m) => m.as === f && m.op === 'count') ? 'number' : 'money' };
    const raw = await this.data.load(spec);
    const rows = raw.filter((r) => spec.filters.every((f) => matches(r, f, field(f.field).kind)));
    let combinedTotalUnavailable = false;
    const totals: Record<string, string | null> = {};
    for (const metric of spec.metrics) {
      try { totals[metric.as] = aggregate(rows, metric, spec); }
      catch (error) {
        if (!(error instanceof ConflictException) || !spec.groupBy.length) throw error;
        // Per-group totals can be meaningful even where combining groups would
        // sum different currencies or document types. Do not invent a grand total.
        totals[metric.as] = null;
        combinedTotalUnavailable = true;
      }
    }
    let output: BuiltReport['rows'];
    if (spec.groupBy.length) {
      const groups = new Map<string, DataRow[]>();
      for (const row of rows) {
        const key = JSON.stringify(spec.groupBy.map((f) => row[f]));
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }
      output = [...groups.values()].map((subset) => ({
        ...Object.fromEntries(spec.groupBy.map((f) => [f, subset[0][f]])),
        ...Object.fromEntries(spec.metrics.map((m) => [m.as, aggregate(subset, m, spec)])),
        sourceIds: subset.map((r) => r.id!),
      }));
    } else {
      output = rows.map((row) => ({
        ...Object.fromEntries(spec.columns.map((f) => [f, row[f]])),
        sourceId: row.id, sourceType: spec.source === 'customer_history' ? row.kind : spec.source,
      }));
    }
    if (spec.sort) {
      const kind = field(spec.sort.field).kind;
      const sign = spec.sort.direction === 'asc' ? 1 : -1;
      output.sort((a, b) => {
        // Keep unknowns at the bottom in both directions.
        const av = a[spec.sort!.field], bv = b[spec.sort!.field];
        if (av == null) return bv == null ? 0 : 1;
        if (bv == null) return -1;
        return sign * compare(String(av), String(bv), kind);
      });
    }
    return { kind: 'saved-custom-report', source: spec.source, basis: source.basis,
      definition: spec, rows: output, count: rows.length, totals,
      grouped: spec.groupBy.length > 0,
      warning: `A custom report is an allowlisted source summary, not the general ledger. Monetary metrics fail closed on mixed/unknown currencies and NULL values do not become zeros. The source basis and trace IDs apply to exports too.${combinedTotalUnavailable ? ' Some grand totals are unavailable across distinct groups; per-group amounts retain their own units.' : ''}` };
  }

  async saved(actor: AuthenticatedUser) {
    // The single primary owner retains full authority; ordinary users only see
    // their own saved specifications. Both paths still recheck live source grants.
    const rows = await this.prisma.savedReport.findMany({
      where: actor.isPrimaryAdmin ? {} : { createdById: actor.id },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 250 });
    return rows.flatMap((r) => {
      try { parseSpec(r.definition, actor); }
      catch { return []; } // revoked permissions: do not reveal the saved definition
      return [{ id: r.id, name: r.name, definition: r.definition,
        createdAt: r.createdAt, updatedAt: r.updatedAt }];
    });
  }

  async get(id: string, actor: AuthenticatedUser) {
    const row = await this.prisma.savedReport.findFirst({
      where: { id, ...(actor.isPrimaryAdmin ? {} : { createdById: actor.id }) },
    });
    if (!row) throw new NotFoundException('Saved report not found');
    parseSpec(row.definition, actor);
    return row;
  }

  async save(name: string, input: unknown, actor: AuthenticatedUser) {
    const spec = parseSpec(input, actor);
    if (!name?.trim() || name.length > 120) throw new BadRequestException('Name is required (at most 120 characters)');
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.savedReport.count({ where: { createdById: actor.id } });
      if (count >= 250) throw new ConflictException('Saved report limit reached; reuse an existing report');
      const row = await tx.savedReport.create({ data: { name: name.trim(), definition: spec,
        createdById: actor.id } });
      await this.audit.recordIn(tx, { action: 'report.save', entityType: 'SavedReport', entityId: row.id,
        actorId: actor.id, actorEmail: actor.email, afterData: { name: row.name, definition: spec } });
      return row;
    });
  }

  async update(id: string, name: string, input: unknown, actor: AuthenticatedUser) {
    const spec = parseSpec(input, actor);
    if (!name?.trim() || name.length > 120) throw new BadRequestException('Name is required');
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.savedReport.findFirst({
        where: { id, ...(actor.isPrimaryAdmin ? {} : { createdById: actor.id }) },
      });
      if (!before) throw new NotFoundException('Saved report not found');
      const row = await tx.savedReport.update({ where: { id }, data: {
        name: name.trim(), definition: spec } });
      await this.audit.recordIn(tx, { action: 'report.update', entityType: 'SavedReport', entityId: row.id,
        actorId: actor.id, actorEmail: actor.email, beforeData: before,
        afterData: { name: row.name, definition: spec } });
      return row;
    });
  }

  async runSaved(id: string, actor: AuthenticatedUser) {
    const saved = await this.get(id, actor);
    return this.run(saved.definition, actor);
  }
}
