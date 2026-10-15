import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { StandardReportsService } from './standard-reports.service';
import { ReportBuilderService } from './report-builder.service';
import { ReportExportService, type ExportData, type ExportTable } from './report-export.service';
import { ReportDefinitionDto, SaveReportDto } from './dto/reports.dto';
import { allowed } from './report-catalogue';

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
}
function table(name: string, columns: string[], rows: object[], numeric: string[] = []): ExportTable {
  return { name, columns, numeric, rows: rows.map((row) =>
    Object.fromEntries(columns.map((field) => [field, text((row as Record<string, unknown>)[field])]))) };
}
function arg(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' && typeof value !== 'number') throw new BadRequestException(`${key} is required`);
  return String(value);
}

@ApiTags('reports / builder & exports')
@Controller('reports/builder')
export class ReportDownloadController {
  constructor(private readonly standard: StandardReportsService, private readonly builder: ReportBuilderService,
    private readonly exporter: ReportExportService, private readonly audit: AuditService) {}

  @Get('catalogue')
  @RequirePermissions('report:read')
  catalogue(@CurrentUser() actor: AuthenticatedUser) { return this.builder.catalogue(actor); }

  @Post('run')
  @RequirePermissions('report:read')
  run(@Body() dto: ReportDefinitionDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.builder.run(dto.definition, actor);
  }

  @Get('saved')
  @RequirePermissions('report:read')
  saved(@CurrentUser() actor: AuthenticatedUser) { return this.builder.saved(actor); }

  @Get('saved/:id')
  @RequirePermissions('report:read')
  get(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.builder.get(id, actor);
  }

  @Post('saved')
  @RequirePermissions(['report:read', 'report:design'])
  save(@Body() dto: SaveReportDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.builder.save(dto.name, dto.definition, actor);
  }

  @Patch('saved/:id')
  @RequirePermissions(['report:read', 'report:design'])
  update(@Param('id') id: string, @Body() dto: SaveReportDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.builder.update(id, dto.name, dto.definition, actor);
  }

  @Post('saved/:id/run')
  @RequirePermissions('report:read')
  runSaved(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.builder.runSaved(id, actor);
  }

  @Post('export/:format')
  @RequirePermissions(['report:read', 'report:export'])
  async exportCustom(@Param('format') format: string, @Body() dto: ReportDefinitionDto,
    @CurrentUser() actor: AuthenticatedUser, @Res() res: Response) {
    const report = await this.builder.run(dto.definition, actor);
    await this.send(this.exporter.custom(report), format, actor, res, 'custom-report');
  }

  @Post('saved/:id/export/:format')
  @RequirePermissions(['report:read', 'report:export'])
  async exportSaved(@Param('id') id: string, @Param('format') format: string,
    @CurrentUser() actor: AuthenticatedUser, @Res() res: Response) {
    const report = await this.builder.runSaved(id, actor);
    await this.send(this.exporter.custom(report), format, actor, res, 'saved-report');
  }

  @Post('standard/:kind/export/:format')
  @RequirePermissions(['report:read', 'report:export'])
  async exportStandard(@Param('kind') kind: string, @Param('format') format: string,
    @Body() filters: Record<string, unknown>, @CurrentUser() actor: AuthenticatedUser, @Res() res: Response) {
    const data = await this.standardData(kind, filters ?? {}, actor);
    await this.send(data, format, actor, res, kind);
  }

  private require(actor: AuthenticatedUser, permissions: string[]) {
    if (permissions.some((p) => !allowed(actor, p))) throw new ForbiddenException('Underlying report permissions required');
  }

  private async standardData(kind: string, f: Record<string, unknown>, actor: AuthenticatedUser): Promise<ExportData> {
    if (kind === 'pnl') {
      this.require(actor, ['invoice:read', 'voucher:read', 'journal:read', 'expense:read']);
      const r = await this.standard.pnl({ year: f.year === undefined ? undefined : Number(arg(f, 'year')),
        voyageId: f.voyageId === undefined ? undefined : arg(f, 'voyageId') });
      const reportRows = r.rows.flatMap((row) => row.byCurrency.map((currency) => ({
        voyageId: row.voyageId, voyageNumber: row.voyageNumber,
        manifestId: row.manifestId, manifestNumber: row.manifestNumber,
        periodDate: row.periodDate, dateBasis: row.dateBasis,
        ...currency, baseCurrencyCode: row.base?.currencyCode ?? null,
        baseProfit: row.base?.profit ?? null, reconciled: row.reconciled,
      })));
      const traces = r.rows.flatMap((row) => row.sources.map((s) => ({ manifestId: row.manifestId, ...s })));
      const warnings = r.rows.flatMap((row) => row.warnings.map((warning) => ({ manifestId: row.manifestId, warning })));
      return { title: r.complete ? 'Manifest / voyage P&L — operational summary' : 'UNRECONCILED Manifest / voyage P&L summary',
        basis: r.reconciliation + '\n' + r.annual.conversionRule,
        warning: r.complete ? undefined : 'Source warnings or missing conversion prohibit a reconciled accounting P&L. Not the general ledger.',
        tables: [
          table('Manifest P&L', ['voyageNumber', 'manifestNumber', 'periodDate', 'dateBasis',
            'currencyCode', 'grossInvoiced', 'billedVat', 'netIncome', 'netCost', 'netProfit',
            'baseCurrencyCode', 'baseProfit', 'reconciled'], reportRows,
          ['grossInvoiced', 'billedVat', 'netIncome', 'netCost', 'netProfit', 'baseProfit']),
          table('Annual by currency', ['currencyCode', 'grossInvoiced', 'billedVat',
            'netIncome', 'netCost', 'netProfit'], r.annual.byCurrency,
          ['grossInvoiced', 'billedVat', 'netIncome', 'netCost', 'netProfit']),
          table('Trace sources', ['manifestId', 'kind', 'id', 'journalId', 'journalNumber',
            'journalLineIds', 'customerPostingId', 'billIds', 'allocationIds', 'categoryCode',
            'gross', 'vat', 'inputVat', 'net', 'currencyCode', 'baseCurrencyCode', 'baseNet',
            'exchangeRate', 'rateEffectiveAt', 'rateSource', 'currencyRateId', 'rateOverrideReason'], traces),
          table('Warnings', ['manifestId', 'warning'], warnings),
        ] };
    }
    if (kind === 'vat') {
      this.require(actor, ['invoice:read', 'voucher:read', 'journal:read', 'expense:read']);
      const r = await this.standard.vat(Number(arg(f, 'year')), Number(arg(f, 'quarter')));
      return { title: r.complete ? 'Recorded VAT reconciliation (not tax return)' : 'INCOMPLETE recorded VAT reconciliation',
        basis: r.basis, warning: r.complete ? undefined :
          `Unclassified expenses: ${r.unclassifiedExpenseCount}; unassigned receipts or historic header VAT may remain. Never file this as a tax return.`,
        tables: [table('VAT by currency', ['currencyCode', 'billed', 'collected', 'paid', 'difference'], r.totals,
          ['billed', 'collected', 'paid', 'difference']),
        table('Billed', ['invoiceId', 'invoiceNumber', 'currencyCode', 'amount', 'source', 'lineIds',
          'correctedFrom', 'correctionIds'], r.billed, ['amount']),
        table('Collected', ['invoiceId', 'voucherId', 'allocationId', 'date', 'currencyCode', 'paid', 'vat'], r.collected, ['paid', 'vat']),
        table('Paid', ['taxRecordId', 'journalId', 'journalNumber', 'journalLineIds', 'paidAt',
          'currencyCode', 'amount', 'baseAmount', 'baseCurrencyCode', 'exchangeRate',
          'rateSource', 'rateEffectiveAt', 'currencyRateId'], r.paid, ['amount', 'baseAmount']),
        table('Allocation sources', ['invoiceId', 'voucherId', 'allocationId', 'amount',
          'voucherType', 'baseAmount', 'rateSource', 'rateEffectiveAt', 'currencyRateId',
          'adjustmentIds', 'correctedFrom'], r.allocationSources),
        table('Unassigned receipts', ['currencyCode', 'amount'], r.unassignedReceipts, ['amount'])] };
    }
    if (kind === 'overdue') {
      this.require(actor, ['invoice:read', 'voucher:read']);
      const r = await this.standard.overdue(arg(f, 'asOf'));
      return { title: r.reconciled ? 'Overdue issued invoices — current balances' : 'UNRECONCILED overdue invoice balances',
        basis: r.basis, warning: r.reconciled ? undefined : 'At least one paidAmount does not match active allocations and historic direct vouchers.',
        tables: [table('Overdue', ['invoiceId', 'invoiceNumber', 'customerId', 'voyageId',
          'dueDate', 'currencyCode', 'total', 'paid', 'unpaid', 'paidAmountReconciled', 'trace'],
          r.rows, ['total', 'paid', 'unpaid']),
        table('Totals by currency', ['currencyCode', 'amount'], r.totals, ['amount'])] };
    }
    if (kind === 'releases' || kind === 'released-unpaid') {
      this.require(actor, ['release:read', 'invoice:read', 'voucher:read', 'bill:read']);
      const r = await this.standard.releases(arg(f, 'from'), arg(f, 'to'), kind === 'released-unpaid');
      return { title: kind === 'releases' ? 'Release history' : 'Released but unpaid / unidentified now', basis: r.basis,
        tables: [table('Releases', ['releaseId', 'releaseNumber', 'releaseDate', 'billId', 'billNumber',
          'manifestId', 'voyageId', 'consigneeId', 'items', 'paymentStateAtRelease',
          'financialOverride', 'overrideReason', 'invoiceBalances', 'unpaidNow',
          'unidentifiedPayment'], r.rows)] };
    }
    if (kind === 'statement') {
      this.require(actor, ['ledger:read', 'customer:read', 'invoice:read', 'voucher:read']);
      const r = await this.standard.statement(arg(f, 'customerId'), arg(f, 'currencyCode'),
        arg(f, 'from'), arg(f, 'to'));
      return { title: 'Derived customer statement — NOT general ledger', basis: r.warning,
        tables: [table('Balance summary', ['customerId', 'customerName', 'fromDate', 'toDate',
          'currencyCode', 'openingBalance', 'totalDebit', 'totalCredit', 'closingBalance'], [r.summary],
          ['openingBalance', 'totalDebit', 'totalCredit', 'closingBalance']),
        table('Opening sources', ['date', 'kind', 'documentNumber', 'documentId', 'currencyCode',
          'debit', 'credit', 'trace'], r.openingEntries, ['debit', 'credit']),
        table('Source entries', ['date', 'kind', 'documentNumber', 'documentId',
          'invoiceId', 'voucherId', 'description', 'currencyCode', 'debit', 'credit', 'balance', 'trace'], r.entries,
          ['debit', 'credit', 'balance'])] };
    }
    throw new BadRequestException('Unknown standard report');
  }

  private async send(data: ExportData, format: string, actor: AuthenticatedUser, res: Response, kind: string) {
    if (format !== 'xlsx' && format !== 'pdf') throw new BadRequestException('Export format must be xlsx or pdf');
    const buffer = format === 'xlsx' ? await this.exporter.excel(data) : await this.exporter.pdf(data);
    await this.audit.record({ action: 'report.export', entityType: 'Report', entityId: kind,
      actorId: actor.id, actorEmail: actor.email,
      metadata: { format, tables: data.tables.map((t) => ({ name: t.name, rows: t.rows.length })) } });
    res.setHeader('Content-Type', format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="duna-${kind}-${Date.now()}.${format}"`);
    res.setHeader('Cache-Control', 'no-store, private');
    res.send(buffer);
  }
}
