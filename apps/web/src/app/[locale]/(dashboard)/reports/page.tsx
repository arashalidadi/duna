'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BarChart3 } from 'lucide-react';
import type { PaginatedResult, VoyageListItem } from '@shipping/shared';
import { api } from '@/lib/api/client';
import { downloadReport } from '@/lib/api/report-download';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TableScroll } from '@/components/ui/table-scroll';
import { ErrorState } from '@/components/ui/error-state';
import { ReportBuilder } from './builder';
import { CostCapture } from './cost-capture';

type Tab = 'pnl' | 'vat' | 'overdue' | 'releases' | 'released-unpaid' | 'statement' | 'builder' | 'costs';
type Totals = { currencyCode: string; grossInvoiced: string; billedVat: string; netIncome: string;
  netCost: string; netProfit: string };
type PnlRow = { voyageId: string; voyageNumber: string; manifestId: string | null; manifestNumber: string | null;
  periodDate: string; dateBasis: string; byCurrency: Totals[]; base: { currencyCode: string; profit: string } | null;
  warning?: string; reconciled: boolean; sources: Record<string, unknown>[]; warnings: string[] };
type Pnl = { kind: string; complete: boolean; reconciliation: string; rows: PnlRow[];
  annual: { byCurrency: Totals[]; base: { currencyCode: string; profit: string } | null; warning?: string;
    conversionRule: string } };
type Vat = { kind: string; complete: boolean; basis: string; year: number; quarter: number;
  unclassifiedExpenseCount: number; skippedAllocations: number;
  totals: { currencyCode: string; billed: string; collected: string; paid: string; difference: string }[];
  billed: { invoiceId: string; invoiceNumber: string; currencyCode: string; amount: string; source: string; lineIds: string[] }[];
  collected: { invoiceId: string; voucherId: string; allocationId: string; date: string; currencyCode: string; vat: string }[];
  paid: { journalId: string; journalNumber: string; amount: string; currencyCode: string; paidAt: string;
    taxRecordId: string; journalLineIds: string[] }[];
  allocationSources: Record<string, unknown>[];
  unassignedReceipts: { currencyCode: string; amount: string }[] };
type Overdue = { kind: string; basis: string; reconciled: boolean; rows: { invoiceId: string; invoiceNumber: string;
  customerId: string; dueDate: string; currencyCode: string; total: string; paid: string; unpaid: string;
  paidAmountReconciled: boolean; trace: Record<string, unknown> }[];
  totals: { currencyCode: string; amount: string }[] };
type Release = { kind: string; basis: string; rows: { releaseId: string; releaseNumber: string;
  releaseDate: string; billId: string; billNumber: string; manifestId: string | null;
  paymentStateAtRelease: string | null; financialOverride: boolean; unpaidNow: boolean;
  unidentifiedPayment: boolean; items: { id: string; goodsDescription: string | null; packages: number | null }[];
  invoiceBalances: { invoiceId: string; number: string; currencyCode: string; outstanding: string }[] }[] };
type Statement = { kind: string; warning: string; summary: { currencyCode: string;
  openingBalance: string; totalDebit: string; totalCredit: string; closingBalance: string };
  entries: { documentId: string; documentNumber: string; kind: string; date: string; debit: string;
    credit: string; balance: string; currencyCode: string; trace: Record<string, unknown> }[];
  openingEntries: { documentId: string; documentNumber: string; date: string; currencyCode: string;
    debit: string; credit: string; trace: Record<string, unknown> }[];
  lastIssuedStatement: { id: string; createdAt: string } | null; daysSinceLastStatement: number | null };
type Issued = { id: string; createdAt: string; periodFrom: string; periodTo: string };
type CustomerRef = { id: string; name: string; code: string };
const selectClass = 'h-10 w-full rounded-md border border-input bg-card px-2 text-sm';
const today = new Date().toISOString().slice(0, 10);
const yearNow = new Date().getUTCFullYear();
const quarterNow = Math.floor(new Date().getUTCMonth() / 3) + 1;
const permissions: Record<Tab, string[]> = {
  pnl: ['invoice:read', 'voucher:read', 'journal:read', 'expense:read'],
  vat: ['invoice:read', 'voucher:read', 'journal:read', 'expense:read'],
  overdue: ['invoice:read', 'voucher:read'],
  releases: ['release:read', 'invoice:read', 'voucher:read', 'bill:read'],
  'released-unpaid': ['release:read', 'invoice:read', 'voucher:read', 'bill:read'],
  statement: ['ledger:read', 'customer:read', 'invoice:read', 'voucher:read'], builder: [],
  costs: ['expense:read'],
};

function DataTable({ columns, rows }: { columns: string[]; rows: Array<Record<string, unknown>> }) {
  return rows.length ? <TableScroll><table className="min-w-full text-sm"><thead><tr>
    {columns.map((col) => <th key={col} className="border-b p-2 text-start">{col}</th>)}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={i} className="border-b align-top">
      {columns.map((col) => <td key={col} className="max-w-72 break-words p-2" dir={col.includes('Amount') || col.includes('Vat') ? 'ltr' : undefined}>
        {row[col] === null || row[col] === undefined ? '—' : String(row[col])}</td>)}
    </tr>)}</tbody></table></TableScroll> : <p className="p-3 text-sm text-muted-foreground">—</p>;
}

export default function ReportsPage() {
  const t = useTranslations('reportsUi');
  const { hasPermission } = useAuth();
  const tabs = useMemo(() => (Object.keys(permissions) as Tab[]).filter((tab) => permissions[tab].every(hasPermission)), [hasPermission]);
  const [tab, setTab] = useState<Tab>('pnl');
  const active = tabs.includes(tab) ? tab : tabs[0];
  const [year, setYear] = useState(String(yearNow));
  const [quarter, setQuarter] = useState(String(quarterNow));
  const [from, setFrom] = useState(`${yearNow}-01-01`);
  const [to, setTo] = useState(today);
  const [asOf, setAsOf] = useState(today);
  const [voyageId, setVoyageId] = useState('');
  const [voyageSearch, setVoyageSearch] = useState('');
  const [voyages, setVoyages] = useState<VoyageListItem[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerRef[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [vat, setVat] = useState<Vat | null>(null);
  const [overdue, setOverdue] = useState<Overdue | null>(null);
  const [release, setRelease] = useState<Release | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [issues, setIssues] = useState<Issued[]>([]);
  const [issuedSnapshot, setIssuedSnapshot] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [displayed, setDisplayed] = useState<{ tab: Tab; signature: string } | null>(null);
  useEffect(() => {
    if (active !== 'pnl' || !hasPermission('voyage:read')) return;
    let live = true;
    const timer = window.setTimeout(() => {
      api.get<PaginatedResult<VoyageListItem>>(`/voyages?pageSize=100&search=${encodeURIComponent(voyageSearch)}`)
        .then((r) => { if (live) setVoyages(r.data); }).catch(() => { if (live) setVoyages([]); });
    }, 200);
    return () => { live = false; clearTimeout(timer); };
  }, [active, voyageSearch, hasPermission]);
  useEffect(() => {
    if (active !== 'statement') return;
    let live = true;
    const timer = window.setTimeout(() => {
      api.get<PaginatedResult<CustomerRef>>(`/customers?pageSize=100&search=${encodeURIComponent(customerSearch)}`)
        .then((r) => { if (live) setCustomers(r.data); }).catch(() => { if (live) setCustomers([]); });
    }, 200);
    return () => { live = false; clearTimeout(timer); };
  }, [active, customerSearch]);
  if (!hasPermission('report:read')) return <ErrorState message={t('notPermitted')} />;
  const filters = active === 'pnl' ? { year, ...(voyageId ? { voyageId } : {}) } :
    active === 'vat' ? { year, quarter } : active === 'overdue' ? { asOf } :
    active === 'statement' ? { customerId, currencyCode, from, to } : { from, to };
  const filterSignature = JSON.stringify(filters);
  const showingCurrentFilters = displayed?.tab === active && displayed.signature === filterSignature;
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, String(value)]));
  const perform = async (fn: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : t('loadError')); }
    finally { setBusy(false); }
  };
  const load = async () => {
    setDisplayed(null);
    if (active === 'pnl') setPnl(await api.get<Pnl>(`/reports/pnl?${params}`));
    else if (active === 'vat') setVat(await api.get<Vat>(`/reports/vat?${params}`));
    else if (active === 'overdue') setOverdue(await api.get<Overdue>(`/reports/overdue?${params}`));
    else if (active === 'statement') {
      if (!customerId) throw new Error(t('selectCustomer'));
      const q = new URLSearchParams({ currencyCode, from, to });
      const [s, history] = await Promise.all([
        api.get<Statement>(`/reports/statements/${encodeURIComponent(customerId)}?${q}`),
        api.get<Issued[]>(`/reports/statements/${encodeURIComponent(customerId)}/issues?currencyCode=${encodeURIComponent(currencyCode)}`),
      ]);
      setStatement(s); setIssues(history); setIssuedSnapshot(null);
    } else if (active === 'releases' || active === 'released-unpaid')
      setRelease(await api.get<Release>(`/reports/${active}?${params}`));
    setDisplayed({ tab: active, signature: filterSignature });
  };
  const exportFile = (format: 'xlsx' | 'pdf') => void perform(async () => {
    if (active === 'builder' || active === 'costs') return;
    await downloadReport(`/reports/builder/standard/${active}/export/${format}`, filters, `${active}-${year}.${format}`);
  });
  const commonControls = <div className="flex flex-wrap items-end gap-3">
    {(active === 'pnl' || active === 'vat') && <label className="space-y-1 text-sm">{t('year')}
      <Input className="w-28" type="number" min={2000} max={2100} value={year}
        onChange={(e) => setYear(e.target.value)} /></label>}
    {active === 'vat' && <label className="space-y-1 text-sm">{t('quarter')}
      <select className={selectClass} value={quarter} onChange={(e) => setQuarter(e.target.value)}>
        {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}</select></label>}
    {['releases', 'released-unpaid', 'statement'].includes(active) && <>
      <label className="space-y-1 text-sm">{t('from')}<Input type="date" value={from}
        onChange={(e) => setFrom(e.target.value)} /></label>
      <label className="space-y-1 text-sm">{t('to')}<Input type="date" value={to}
        onChange={(e) => setTo(e.target.value)} /></label></>}
    {active === 'overdue' && <label className="space-y-1 text-sm">{t('asOf')}<Input type="date" value={asOf}
      onChange={(e) => setAsOf(e.target.value)} /></label>}
    {active === 'pnl' && hasPermission('voyage:read') && <>
      <label className="space-y-1 text-sm">{t('searchVoyage')}<Input value={voyageSearch}
        onChange={(e) => setVoyageSearch(e.target.value)} /></label>
      <label className="space-y-1 text-sm">{t('voyageOptional')}
        <select className={selectClass} value={voyageId} onChange={(e) => setVoyageId(e.target.value)}>
          <option value="">{t('allVoyages')}</option>
          {voyageId && !voyages.some((v) => v.id === voyageId) && <option value={voyageId}>{voyageId}</option>}
          {voyages.map((v) => <option key={v.id} value={v.id}>{v.voyageNumber}</option>)}
        </select></label></>}
    {active === 'statement' && <>
      <label className="space-y-1 text-sm">{t('searchCustomer')}<Input value={customerSearch}
        onChange={(e) => setCustomerSearch(e.target.value)} /></label>
      <label className="space-y-1 text-sm">{t('customer')}
        <select className={selectClass} value={customerId} onChange={(e) => { setCustomerId(e.target.value); setStatement(null); }}>
          <option value="">{t('selectCustomer')}</option>
          {customerId && !customers.some((c) => c.id === customerId) && <option value={customerId}>{customerId}</option>}
          {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
        </select></label>
      <label className="space-y-1 text-sm">{t('currency')}<Input className="w-28" maxLength={3}
        value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} /></label></>}
    <Button disabled={busy || (active === 'statement' && !customerId)} onClick={() => void perform(load)}>{t('run')}</Button>
    {hasPermission('report:export') && <>
      <Button variant="outline" disabled={busy || (active === 'statement' && !customerId)} onClick={() => exportFile('xlsx')}>{t('excel')}</Button>
      <Button variant="outline" disabled={busy || (active === 'statement' && !customerId)} onClick={() => exportFile('pdf')}>{t('pdf')}</Button>
    </>}
  </div>;
  return <div className="space-y-6">
    <Breadcrumbs items={[{ label: t('title') }]} />
    <header><h1 className="flex items-center gap-2 text-2xl font-bold"><BarChart3 className="size-6" />{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('subtitle')}</p></header>
    <div role="tablist" aria-label={t('title')} className="flex flex-wrap gap-2">
      {tabs.map((item) => <Button key={item} role="tab" aria-selected={active === item}
        variant={active === item ? 'default' : 'outline'} size="sm"
        onClick={() => { setTab(item); setError(''); setNotice(''); }}>
        {t(`tabs.${item}`)}</Button>)}
    </div>
    {active === 'builder' ? <ReportBuilder /> : active === 'costs' ? <CostCapture /> : <>
      <Card><CardHeader><div><CardTitle>{t(`tabs.${active}`)}</CardTitle>
        <CardDescription>{t('utcDates')}</CardDescription></div></CardHeader>
        <CardContent className="space-y-3 pt-3">{commonControls}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="text-sm">{notice}</p>}
        </CardContent></Card>
      {active === 'pnl' && showingCurrentFilters && pnl && <Card><CardHeader><div><CardTitle>{pnl.complete ? t('pnlReconciled') : t('pnlUnreconciled')}</CardTitle>
        <CardDescription>{pnl.reconciliation}</CardDescription></div></CardHeader>
        <CardContent className="space-y-4 pt-3">
          <p className="rounded-lg border p-2 text-sm">{pnl.annual.conversionRule}</p>
          {pnl.annual.warning && <p role="alert" className="text-sm text-amber-700">{pnl.annual.warning}</p>}
          <DataTable columns={['voyageNumber', 'manifestNumber', 'periodDate', 'currencyCode', 'grossInvoiced',
            'billedVat', 'netIncome', 'netCost', 'netProfit']} rows={pnl.rows.flatMap((row) => row.byCurrency.map((c) => ({
              voyageNumber: row.voyageNumber, manifestNumber: row.manifestNumber, periodDate: row.periodDate.slice(0, 10), ...c,
            })))} />
          <h3 className="font-medium">{t('annualByCurrency')}</h3>
          <DataTable columns={['currencyCode', 'grossInvoiced', 'billedVat', 'netIncome', 'netCost', 'netProfit']} rows={pnl.annual.byCurrency} />
          {pnl.annual.base && <p className="rounded-lg bg-muted p-2 text-sm">{t('baseProfit')}: {pnl.annual.base.profit} {pnl.annual.base.currencyCode}</p>}
          {pnl.rows.map((row) => <details key={row.voyageId} className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">{row.manifestNumber ?? row.voyageNumber} · {t('trace')} · {row.dateBasis}</summary>
            {row.warnings.map((w, i) => <p key={i} role="alert" className="mt-2 text-amber-700">{w}</p>)}
            {row.sources.map((src, i) => <div key={i} className="mt-3 border-t pt-2">
              <p className="font-medium">{String(src.kind)} · {String(src.id)}</p>
              <p>{t('sourceLink')}: <Link className="underline" href={src.kind === 'invoice' ? '/invoices' : '/accounting'}>
                {String(src.kind === 'invoice' ? src.number : src.journalNumber)}</Link></p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(src, null, 2)}</pre>
            </div>)}
          </details>)}
        </CardContent></Card>}
      {active === 'vat' && showingCurrentFilters && vat && <Card><CardHeader><div><CardTitle>{vat.complete ? t('vatRecorded') : t('vatIncomplete')}</CardTitle>
        <CardDescription>{vat.basis}</CardDescription></div></CardHeader>
        <CardContent className="space-y-4 pt-3">
          <p className="rounded-lg border border-amber-400/60 p-2 text-sm">{t('vatNotReturn')} · {t('unclassified')}: {vat.unclassifiedExpenseCount} · {t('skippedAllocations')}: {vat.skippedAllocations}</p>
          <DataTable columns={['currencyCode', 'billed', 'collected', 'paid', 'difference']} rows={vat.totals} />
          {!!vat.unassignedReceipts.length && <><h3 className="font-medium">{t('unassignedReceipts')}</h3>
            <DataTable columns={['currencyCode', 'amount']} rows={vat.unassignedReceipts} /></>}
          <details className="rounded-lg border p-3"><summary className="cursor-pointer">{t('billedTrace')}</summary>
            <DataTable columns={['invoiceNumber', 'currencyCode', 'amount', 'source', 'invoiceId', 'lineIds']} rows={vat.billed} /></details>
          <details className="rounded-lg border p-3"><summary className="cursor-pointer">{t('collectedTrace')}</summary>
            <DataTable columns={['date', 'currencyCode', 'vat', 'invoiceId', 'voucherId', 'allocationId']} rows={vat.collected} />
            {vat.allocationSources.map((source, i) => <pre key={i} className="overflow-auto whitespace-pre-wrap border-b p-2 text-xs">{JSON.stringify(source, null, 2)}</pre>)}</details>
          <details className="rounded-lg border p-3"><summary className="cursor-pointer">{t('paidTrace')}</summary>
            <DataTable columns={['paidAt', 'currencyCode', 'amount', 'journalNumber', 'journalId', 'taxRecordId', 'journalLineIds']} rows={vat.paid} /></details>
        </CardContent></Card>}
      {active === 'overdue' && showingCurrentFilters && overdue && <Card><CardHeader><CardTitle>{overdue.reconciled ? t('tabs.overdue') : t('unreconciled')}</CardTitle>
        <CardDescription>{overdue.basis}</CardDescription></CardHeader><CardContent className="space-y-3 pt-3">
          <DataTable columns={['currencyCode', 'amount']} rows={overdue.totals} />
          <DataTable columns={['invoiceNumber', 'customerId', 'dueDate', 'currencyCode', 'total', 'paid', 'unpaid', 'paidAmountReconciled', 'invoiceId']} rows={overdue.rows} />
          <details className="rounded-lg border p-2"><summary className="cursor-pointer">{t('trace')}</summary>
            {overdue.rows.map((row) => <pre key={row.invoiceId} className="overflow-auto whitespace-pre-wrap border-b p-2 text-xs">
              {row.invoiceNumber} · {JSON.stringify(row.trace, null, 2)}</pre>)}</details>
        </CardContent></Card>}
      {(active === 'releases' || active === 'released-unpaid') && showingCurrentFilters && release && <Card><CardHeader><CardTitle>{t(`tabs.${active}`)}</CardTitle>
        <CardDescription>{release.basis}</CardDescription></CardHeader><CardContent className="space-y-3 pt-3">
          {release.rows.map((r) => <details key={r.releaseId} className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer">{r.releaseNumber} · {r.billNumber} · {r.paymentStateAtRelease ?? t('unknown')}
              {r.unpaidNow && ` · ${t('unpaidNow')}`}{r.unidentifiedPayment && ` · ${t('unidentifiedPayment')}`}</summary>
            <p>{t('sourceId')}: {r.releaseId} · {t('manifestOptional')}: {r.manifestId ?? '—'}</p>
            <p><Link href="/release-orders" className="underline">{t('sourceLink')}</Link></p>
            <DataTable columns={['number', 'currencyCode', 'outstanding', 'invoiceId']} rows={r.invoiceBalances} />
            <DataTable columns={['id', 'goodsDescription', 'packages']} rows={r.items} />
          </details>)}
          {!release.rows.length && <p>{t('noRows')}</p>}
        </CardContent></Card>}
      {active === 'statement' && showingCurrentFilters && statement && <Card><CardHeader><CardTitle>{t('statementNotLedger')}</CardTitle>
        <CardDescription>{statement.warning}</CardDescription></CardHeader><CardContent className="space-y-3 pt-3 text-sm">
          <p>{t('lastIssued')}: {statement.lastIssuedStatement?.createdAt ?? t('neverIssued')} · {t('daysSince')}: {statement.daysSinceLastStatement ?? '—'}</p>
          <p className="rounded-lg bg-muted p-2">{statement.summary.currencyCode} · {t('opening')}: {statement.summary.openingBalance} ·
            {t('debit')}: {statement.summary.totalDebit} · {t('credit')}: {statement.summary.totalCredit} ·
            {t('closing')}: {statement.summary.closingBalance}</p>
          <details className="rounded-lg border p-2"><summary className="cursor-pointer">{t('openingSources')} · {statement.openingEntries.length}</summary>
            <DataTable columns={['date', 'documentNumber', 'currencyCode', 'debit', 'credit', 'documentId']} rows={statement.openingEntries} /></details>
          <DataTable columns={['date', 'documentNumber', 'kind', 'currencyCode', 'debit', 'credit', 'balance', 'documentId']} rows={statement.entries} />
          <details className="rounded-lg border p-2"><summary className="cursor-pointer">{t('trace')}</summary>
            {[...statement.openingEntries, ...statement.entries].map((entry) => <pre key={entry.documentId}
              className="mb-2 max-h-48 overflow-auto whitespace-pre-wrap break-words border-b p-2 text-xs">
              {entry.documentNumber} · {JSON.stringify(entry.trace, null, 2)}</pre>)}</details>
          {hasPermission('report:statement_issue') && <Button variant="outline" disabled={busy} onClick={() => void perform(async () => {
            await api.post(`/reports/statements/${encodeURIComponent(customerId)}/issue`, { currencyCode, from, to });
            await load(); setNotice(t('statementIssued'));
          })}>{t('issueStatement')}</Button>}
          {!!issues.length && <div className="space-y-2"><h3 className="font-medium">{t('issuedHistory')}</h3>
            {issues.map((issue) => <Button key={issue.id} variant="outline" size="sm" onClick={() => void perform(async () => {
              setIssuedSnapshot(await api.get<Record<string, unknown>>(`/reports/statements/issues/${issue.id}`));
            })}>{issue.createdAt.slice(0, 10)} · {issue.periodFrom.slice(0, 10)} – {issue.periodTo.slice(0, 10)}</Button>)}
            {issuedSnapshot && <pre className="max-h-72 overflow-auto rounded-lg border p-2 text-xs">
              {JSON.stringify(issuedSnapshot, null, 2)}</pre>}
          </div>}
        </CardContent></Card>}
    </>}
  </div>;
}
