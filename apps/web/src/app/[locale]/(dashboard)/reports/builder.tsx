'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { downloadReport } from '@/lib/api/report-download';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TableScroll } from '@/components/ui/table-scroll';

type Field = { field: string; kind: string; relationshipOrCalculated: boolean; description: string | null };
type Source = { source: string; dateField: string; basis: string; fields: Field[] };
type Filter = { field: string; op: 'eq' | 'neq' | 'contains' | 'gte' | 'lte' | 'in'; value: string };
type Metric = { op: 'sum' | 'avg' | 'count' | 'min' | 'max'; field?: string; as: string };
type Spec = { source: string; columns: string[]; from?: string; to?: string; groupBy: string[];
  filters: Filter[]; metrics: Metric[]; sort?: { field: string; direction: 'asc' | 'desc' } };
type Result = { kind: string; basis: string; grouped: boolean; count: number; warning: string;
  rows: Record<string, string | string[] | null>[]; totals: Record<string, string | null>; definition: Spec };
type Saved = { id: string; name: string; definition: Spec; updatedAt: string };
const selectClass = 'h-10 w-full rounded-md border border-input bg-card px-2 text-sm';
const sourceRoutes: Record<string, string> = { invoices: '/invoices', vouchers: '/vouchers', jobs: '/jobs',
  job_cost_items: '/jobs', journal_lines: '/accounting', voyage_costs: '/accounting',
  bills: '/bills', manifests: '/manifest', releases: '/release-orders', deliveries: '/delivery-orders',
  customers: '/customers', customer_history: '/customers', proformas: '/proformas', quotations: '/quotations' };
const initial = (source: Source): Spec => ({ source: source.source,
  columns: source.fields.slice(0, 6).map((field) => field.field), groupBy: [], filters: [], metrics: [] });

export function ReportBuilder() {
  const t = useTranslations('reportsUi');
  const { hasPermission } = useAuth();
  const [catalogue, setCatalogue] = useState<Source[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const source = useMemo(() => catalogue.find((item) => item.source === spec?.source), [catalogue, spec?.source]);
  const refreshSaved = useCallback(async () => {
    setSaved(await api.get<Saved[]>('/reports/builder/saved'));
  }, []);
  useEffect(() => {
    let live = true;
    Promise.all([api.get<Source[]>('/reports/builder/catalogue'), api.get<Saved[]>('/reports/builder/saved')])
      .then(([options, own]) => { if (live) { setCatalogue(options); setSaved(own);
        if (options.length) setSpec((previous) => previous ?? initial(options[0])); } })
      .catch((e: unknown) => { if (live) setError(e instanceof Error ? e.message : t('loadError')); });
    return () => { live = false; };
  }, [t]);
  const perform = async (fn: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : t('loadError')); }
    finally { setBusy(false); }
  };
  const run = () => void perform(async () => {
    if (!spec) return;
    const report = await api.post<Result>('/reports/builder/run', { definition: spec });
    setResult(report);
  });
  const exportFile = (format: 'xlsx' | 'pdf') => void perform(async () => {
    if (!spec) return;
    await downloadReport(`/reports/builder/export/${format}`, { definition: spec }, `report-${spec.source}.${format}`);
  });
  if (!catalogue.length) return <Card><CardHeader><CardTitle>{t('builder')}</CardTitle></CardHeader>
    <CardContent>{error || t('noSources')}</CardContent></Card>;
  if (!spec || !source) return null;
  const allowedFields = source.fields;
  return <div className="space-y-5">
    <Card><CardHeader><div><CardTitle>{t('builder')}</CardTitle>
      <CardDescription>{t('builderHint')}</CardDescription></div></CardHeader>
      <CardContent className="space-y-5">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm">{notice}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">{t('source')}
            <select className={selectClass} value={spec.source} onChange={(e) => {
              const next = catalogue.find((c) => c.source === e.target.value);
              if (next) { setSpec(initial(next)); setResult(null); setSavedId(null); setName(''); }
            }}>{catalogue.map((item) => <option key={item.source} value={item.source}>
                {t.has(`sources.${item.source}`) ? t(`sources.${item.source}`) : item.source}
              </option>)}</select></label>
          <label className="space-y-1 text-sm">{t('from')}
            <Input type="date" value={spec.from ?? ''} onChange={(e) => setSpec({ ...spec, from: e.target.value || undefined })} /></label>
          <label className="space-y-1 text-sm">{t('to')}
            <Input type="date" value={spec.to ?? ''} onChange={(e) => setSpec({ ...spec, to: e.target.value || undefined })} /></label>
        </div>
        <p className="rounded-lg bg-muted p-3 text-sm">{source.basis} · {t('utcDates')}</p>
        <fieldset className="space-y-2"><legend className="text-sm font-medium">{t('columns')}</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{allowedFields.map((f) => <label key={f.field}
            className="flex items-center gap-2 rounded-lg border p-2 text-sm">
            <input type="checkbox" checked={spec.columns.includes(f.field)} onChange={(e) => setSpec({ ...spec,
              columns: e.target.checked ? [...spec.columns, f.field] : spec.columns.filter((c) => c !== f.field) })} />
            <span>{f.field}{f.relationshipOrCalculated && <span className="text-muted-foreground"> ↗</span>}</span>
          </label>)}</div></fieldset>
        <div className="space-y-2"><p className="text-sm font-medium">{t('filters')}</p>
          {spec.filters.map((filter, i) => <div key={i} className="grid gap-2 sm:grid-cols-[1fr_130px_1fr_auto]">
            <select aria-label={t('field')} className={selectClass} value={filter.field}
              onChange={(e) => setSpec({ ...spec, filters: spec.filters.map((f, n) => n === i ? { ...f, field: e.target.value } : f) })}>
              {allowedFields.map((f) => <option key={f.field}>{f.field}</option>)}
            </select><select aria-label={t('operator')} className={selectClass} value={filter.op}
              onChange={(e) => setSpec({ ...spec, filters: spec.filters.map((f, n) => n === i ? { ...f, op: e.target.value as Filter['op'] } : f) })}>
              {(['eq', 'neq', 'contains', 'gte', 'lte', 'in'] as const).map((op) => <option key={op}>{op}</option>)}</select>
            <Input aria-label={t('value')} value={filter.value} onChange={(e) => setSpec({ ...spec,
              filters: spec.filters.map((f, n) => n === i ? { ...f, value: e.target.value } : f) })} />
            <Button variant="outline" onClick={() => setSpec({ ...spec, filters: spec.filters.filter((_, n) => n !== i) })}>
              {t('remove')}</Button></div>)}
          <Button size="sm" variant="outline" disabled={spec.filters.length >= 8} onClick={() => setSpec({ ...spec,
            filters: [...spec.filters, { field: allowedFields[0].field, op: 'eq', value: '' }] })}>{t('addFilter')}</Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div><p className="mb-2 text-sm font-medium">{t('groupBy')}</p><div className="flex flex-wrap gap-2">
            {allowedFields.map((f) => <label key={f.field} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
              <input type="checkbox" checked={spec.groupBy.includes(f.field)} onChange={(e) => setSpec({ ...spec,
                groupBy: e.target.checked ? [...spec.groupBy, f.field] : spec.groupBy.filter((x) => x !== f.field) })} />
              {f.field}</label>)}
          </div></div>
          <div><p className="mb-2 text-sm font-medium">{t('metrics')}</p>
            {spec.metrics.map((m, i) => <div key={i} className="mb-2 grid grid-cols-[100px_1fr_1fr_auto] gap-1">
              <select aria-label={t('operator')} className={selectClass} value={m.op} onChange={(e) => setSpec({ ...spec,
                metrics: spec.metrics.map((x, n) => n === i ? { ...x, op: e.target.value as Metric['op'] } : x) })}>
                {(['sum', 'avg', 'count', 'min', 'max'] as const).map((op) => <option key={op}>{op}</option>)}</select>
              <select aria-label={t('field')} className={selectClass} value={m.field ?? ''} onChange={(e) => setSpec({ ...spec,
                metrics: spec.metrics.map((x, n) => n === i ? { ...x, field: e.target.value || undefined } : x) })}>
                <option value="">{t('rows')}</option>{allowedFields.filter((f) => f.field !== 'exchangeRate' && ['money', 'number'].includes(f.kind))
                  .map((f) => <option key={f.field}>{f.field}</option>)}</select>
              <Input aria-label={t('alias')} value={m.as} onChange={(e) => setSpec({ ...spec,
                metrics: spec.metrics.map((x, n) => n === i ? { ...x, as: e.target.value } : x) })} />
              <Button variant="outline" onClick={() => setSpec({ ...spec, metrics: spec.metrics.filter((_, n) => n !== i) })}>×</Button>
            </div>)}
            <Button size="sm" variant="outline" disabled={spec.metrics.length >= 8} onClick={() => setSpec({ ...spec,
              metrics: [...spec.metrics, { op: 'count', as: `count${spec.metrics.length + 1}` }] })}>{t('addMetric')}</Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">{t('sort')}
            <select className={selectClass} value={spec.sort?.field ?? ''} onChange={(e) => setSpec({ ...spec,
              sort: e.target.value ? { field: e.target.value, direction: spec.sort?.direction ?? 'asc' } : undefined })}>
              <option value="">{t('none')}</option>
              {(spec.groupBy.length ? [...spec.groupBy, ...spec.metrics.map((m) => m.as)] :
                Array.from(new Set([...spec.columns, ...spec.metrics.map((m) => m.as)]))).map((f) => <option key={f}>{f}</option>)}
            </select></label>
          <label className="space-y-1 text-sm">{t('direction')}
            <select className={selectClass} value={spec.sort?.direction ?? 'asc'} onChange={(e) => setSpec({ ...spec,
              sort: spec.sort ? { ...spec.sort, direction: e.target.value as 'asc' | 'desc' } : undefined })}>
              <option value="asc">{t('ascending')}</option><option value="desc">{t('descending')}</option></select></label>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button disabled={busy || !spec.columns.length} onClick={run}>{t('run')}</Button>
          {hasPermission('report:export') && <>
            <Button variant="outline" disabled={busy || !spec.columns.length} onClick={() => exportFile('xlsx')}>{t('excel')}</Button>
            <Button variant="outline" disabled={busy || !spec.columns.length} onClick={() => exportFile('pdf')}>{t('pdf')}</Button>
          </>}
          {hasPermission('report:design') && <>
            <Input className="max-w-56" aria-label={t('reportName')} placeholder={t('reportName')} value={name}
              onChange={(e) => setName(e.target.value)} />
            <Button variant="outline" disabled={busy || !name.trim()} onClick={() => void perform(async () => {
              if (savedId) await api.patch(`/reports/builder/saved/${savedId}`, { name, definition: spec });
              else { const created = await api.post<Saved>('/reports/builder/saved', { name, definition: spec });
                setSavedId(created.id); }
              await refreshSaved(); setNotice(t('savedNotice'));
            })}>{savedId ? t('updateSaved') : t('save')}</Button>
          </>}
        </div>
        {!!saved.length && <div className="border-t pt-3"><p className="mb-2 text-sm font-medium">{t('savedReports')}</p>
          <div className="flex flex-wrap gap-2">{saved.map((item) => <Button key={item.id} size="sm" variant={savedId === item.id ? 'secondary' : 'outline'}
            onClick={() => { setSpec(item.definition); setSavedId(item.id); setName(item.name); setResult(null); }}>
            {item.name}</Button>)}</div></div>}
      </CardContent></Card>
    {result && <Card><CardHeader><div><CardTitle>{t('result')} · {result.count}</CardTitle>
      <CardDescription>{result.basis}</CardDescription></div></CardHeader>
      <CardContent className="space-y-2 pt-3 text-sm">
        <p role="status" className="rounded-lg border border-amber-400/60 p-2">{result.warning}</p>
        {Object.entries(result.totals).length > 0 && <div className="flex flex-wrap gap-2">
          {Object.entries(result.totals).map(([key, val]) => <span key={key} className="rounded-lg bg-muted px-2 py-1">
            {key}: {val ?? t('noGrandTotal')}</span>)}
        </div>}
        <TableScroll><table className="min-w-full text-start text-sm"><thead><tr>
          {(result.grouped ? [...spec.groupBy, ...spec.metrics.map((m) => m.as)] : spec.columns).map((c) =>
            <th key={c} className="border-b p-2 text-start">{c}</th>)}
          <th className="border-b p-2 text-start">{t('sourceId')}</th></tr></thead><tbody>
          {result.rows.map((row, i) => <tr key={i} className="border-b">
            {(result.grouped ? [...spec.groupBy, ...spec.metrics.map((m) => m.as)] : spec.columns).map((c) =>
              <td key={c} className="max-w-72 break-words p-2">{row[c] ?? '—'}</td>)}
            <td className="max-w-60 break-all p-2 font-mono text-xs">
              {result.grouped ? (Array.isArray(row.sourceIds) ? row.sourceIds.join(', ') : '') :
                <Link className="underline" href={sourceRoutes[spec.source] ?? '/reports'}>
                  {row.sourceId ?? '—'}</Link>}
            </td></tr>)}
          </tbody></table></TableScroll>
          {!result.rows.length && <p>{t('noRows')}</p>}
      </CardContent></Card>}
  </div>;
}
