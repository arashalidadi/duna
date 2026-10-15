'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, getAccessToken } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfigFieldControl, type ConfigFieldInput, type ConfigOption } from '@/components/configuration/config-field-input';

type DocType = { code: string; name: string; category: string; isActive: boolean };
type Policy = { relationships: string[]; searchable: boolean; exportable: boolean;
  layoutTitle: string; isActive: boolean };
type Field = ConfigFieldInput & { displayLocation: string; sortOrder: number; active?: boolean };
type Summary = { id: string; number: string; status: string; statusLabel?: string;
  revision: number; issuedAt: string | null;
  createdAt: string; typeCode?: string };
type Detail = Summary & { typeCode: string; values: Record<string, unknown>; links: Record<string, string>;
  fieldValues: { key: string; value: unknown; snapshot: { options?: ConfigOption[] } }[];
  definition: { id: string; version: number; definition: { name: string; layout: { title: string };
    relationships: string[] } } };
type Transition = { to: string; label: string; requiresApproval: boolean; supportsException: boolean };
type Approval = { id: string; status: string; fromStatus: string; toStatus: string;
  fromLabel?: string; toLabel?: string; requestedById: string; requestedAt: string;
  decidedById?: string | null };
type Pending = Approval & { recordId: string; scope: string };

function valuesFor(fields: Field[]) {
  return Object.fromEntries(fields.filter((f) => f.kind === 'BOOLEAN').map((f) => [f.key, false]));
}
async function download(id: string, format: 'pdf' | 'print' | 'xlsx') {
  const tab = format === 'print' ? window.open('', '_blank') : null;
  if (tab) tab.opener = null;
  const token = getAccessToken();
  try {
    const response = await fetch(`${api.baseUrl}/configuration/documents/${encodeURIComponent(id)}/output/${format}`, {
      cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      throw new Error(body && typeof body === 'object' && 'error' in body && body.error &&
        typeof body.error === 'object' && 'message' in body.error && typeof body.error.message === 'string'
        ? body.error.message : `Output failed (${response.status})`);
    }
    const url = URL.createObjectURL(await response.blob());
    if (tab) tab.location.href = url;
    else { const a = document.createElement('a'); a.href = url;
      a.download = `document-${id}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`;
      document.body.append(a); a.click(); a.remove(); }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) { tab?.close(); throw e; }
}

export default function ConfiguredDocumentsPage() {
  const t = useTranslations('phase9');
  const { hasPermission } = useAuth();
  const [catalogue, setCatalogue] = useState<DocType[]>([]);
  const [code, setCode] = useState('');
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [records, setRecords] = useState<Summary[]>([]);
  const [createValues, setCreateValues] = useState<Record<string, unknown>>({});
  const [createLinks, setCreateLinks] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});
  const [editLinks, setEditLinks] = useState<Record<string, string>>({});
  const [detailFields, setDetailFields] = useState<Field[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const typeRequest = useRef(0);
  const loadCatalogue = useCallback(async () => {
    const rows = await api.get<DocType[]>('/configuration/documents/catalog');
    setCatalogue(rows); setCode((old) => rows.some((r) => r.code === old) ? old : rows[0]?.code ?? '');
  }, []);
  useEffect(() => { if (hasPermission('config_document:read')) void loadCatalogue().catch((e: unknown) =>
    setError(e instanceof Error ? e.message : t('loadFailed'))); }, [hasPermission, loadCatalogue, t]);
  const loadType = useCallback(async (typeCode: string) => {
    const request = ++typeRequest.current;
    const path = encodeURIComponent(typeCode);
    const [info, defs, docs, approvals] = await Promise.all([
      api.get<Policy>(`/configuration/documents/by-type/${path}/policy`),
      api.get<Field[]>(`/configuration/documents/by-type/${path}/fields`),
      api.get<Summary[]>(`/configuration/documents/by-type/${path}`),
      hasPermission('config_document:approve') && hasPermission('workflow:approve')
        ? api.get<Pending[]>(`/configuration/approvals/pending/${encodeURIComponent(`CUSTOM:${typeCode}`)}`)
        : Promise.resolve([] as Pending[]),
    ]);
    if (request !== typeRequest.current) return; // an older type request must not replace the new selection
    setPolicy(info); setFields(defs); setCreateValues(valuesFor(defs)); setCreateLinks({});
    setRecords(docs); setPending(approvals);
  }, [hasPermission]);
  useEffect(() => { if (code) void loadType(code).catch((e: unknown) =>
    setError(e instanceof Error ? e.message : t('loadFailed'))); }, [code, loadType, t]);
  async function open(id: string) {
    const request = typeRequest.current;
    const [doc, rules, requests, edges] = await Promise.all([
      api.get<Detail>(`/configuration/documents/${id}`),
      api.get<Field[]>(`/configuration/documents/by-type/${encodeURIComponent(code)}/fields?recordId=${encodeURIComponent(id)}`),
      api.get<Approval[]>(`/configuration/documents/${id}/approvals`),
      api.get<Transition[]>(`/configuration/documents/${id}/available-transitions`),
    ]);
    if (request !== typeRequest.current) return;
    setDetail(doc); setDetailFields(rules); setEditValues(doc.values); setEditLinks(doc.links);
    setApprovals(requests); setTransitions(edges);
  }
  async function act(fn: () => Promise<unknown>, after = true) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); if (after && code) { await loadType(code); if (detail) await open(detail.id); } }
    catch (e) { setError(e instanceof Error ? e.message : t('saveFailed')); }
    finally { setBusy(false); }
  }
  if (!hasPermission('config_document:read')) return <p>{t('noAccess')}</p>;
  const selected = catalogue.find((x) => x.code === code);
  return <div className="space-y-4">
    <Breadcrumbs items={[{ label: t('configuredDocuments') }]} />
    <div><h1 className="text-2xl font-semibold">{t('configuredDocuments')}</h1>
      <p className="text-sm text-muted-foreground">{t('customDocumentNotice')}</p></div>
    {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="rounded-md bg-success/10 p-3 text-sm">{message}</p>}
    <Card><CardHeader><CardTitle>{t('documentTypes')}</CardTitle></CardHeader><CardContent className="space-y-3">
      <select className="h-9 w-full max-w-xs rounded-md border bg-card px-2" value={code}
        onChange={(e) => { typeRequest.current++; setCode(e.target.value); setDetail(null);
          setPolicy(null); setFields([]); setRecords([]); setPending([]); }} aria-label={t('selectType')}>
          {catalogue.map((row) => <option key={row.code} value={row.code}>
            {row.name} · {row.category}{row.isActive ? '' : ` · ${t('inactive')}`}</option>)}
      </select>
      {!catalogue.length && <p className="text-sm text-muted-foreground">{t('noConfiguredTypes')}</p>}
      {code && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void act(async () => {
        setRecords(await api.get<Summary[]>(`/configuration/documents/by-type/${encodeURIComponent(code)}` +
          (search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '')));
      }, false); }}><Input value={search} disabled={!policy?.searchable}
        onChange={(e) => setSearch(e.target.value)} placeholder={t('searchNumber')} />
        <Button variant="outline" type="submit" disabled={!policy?.searchable}>{t('search')}</Button></form>}
      {records.map((row) => <button key={row.id} type="button" className="flex w-full items-center justify-between border-b px-2 py-2 text-start text-sm hover:bg-muted"
        onClick={() => void open(row.id).catch((e: unknown) => setError(e instanceof Error ? e.message : t('loadFailed')))}>
        <span className="font-mono">{row.number}</span><span>{row.statusLabel ?? row.status}</span></button>)}
    </CardContent></Card>
    {!!selected?.isActive && policy?.isActive && hasPermission('config_document:create') && <Card><CardHeader><CardTitle>{t('newDocument')} · {selected.name}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {fields.map((field) => <div key={field.key} className="space-y-1">
          <Label htmlFor={`config-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
          <ConfigFieldControl field={field} value={createValues[field.key] ?? null} disabled={busy}
            onChange={(value) => setCreateValues((old) => ({ ...old, [field.key]: value }))} />
        </div>)}
        {policy?.relationships.map((kind) => <div key={kind}><Label htmlFor={`link-${kind}`}>{kind} · {t('recordId')}</Label>
          <Input id={`link-${kind}`} value={createLinks[kind] ?? ''}
            onChange={(e) => setCreateLinks((old) => ({ ...old, [kind]: e.target.value }))} /></div>)}
        <Button disabled={busy} onClick={() => void act(async () => {
          const result = await api.post<Summary>(`/configuration/documents/by-type/${encodeURIComponent(code)}`, {
            values: Object.fromEntries(Object.entries(createValues).filter(([, v]) => v !== null && v !== undefined && v !== '')),
            links: Object.fromEntries(Object.entries(createLinks).filter(([, id]) => id.trim())) });
          await loadType(code); await open(result.id);
          setMessage(`${t('created')}: ${result.number}`);
        }, false)}>{t('createDocument')}</Button>
      </CardContent></Card>}
    {detail && <Card><CardHeader><CardTitle>{detail.number} · {detail.statusLabel ?? detail.status}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(['pdf', 'xlsx', 'print'] as const).map((format) => <Button key={format} size="sm" variant="outline" disabled={busy || !hasPermission('config_document:render')}
            onClick={() => void act(() => download(detail.id, format), false)}>{t(format)}</Button>)}
        </div>
        {detailFields.map((field) => {
          const historical = detail.fieldValues.find((v) => v.key === field.key)?.snapshot.options ?? [];
          return <div key={field.key} className="space-y-1"><Label htmlFor={`config-${field.key}`}>{field.label}</Label>
            <ConfigFieldControl field={field} value={editValues[field.key] ?? null}
              disabled={busy || !!detail.issuedAt || field.active === false || !hasPermission('config_document:update')}
              historicalOptions={historical.map((o) => ({ ...o,
                isActive: field.options.some((a) => a.id === o.id && a.isActive) }))}
              onChange={(value) => setEditValues((old) => ({ ...old, [field.key]: value }))} /></div>;
        })}
        {Object.entries(detail.values).filter(([key]) => !detailFields.some((f) => f.key === key))
          .map(([key, value]) => <p key={key} className="text-sm">{key}: {String(value)}</p>)}
        {detail.definition.definition.relationships.map((kind) => <div key={kind}><Label htmlFor={`edit-link-${kind}`}>{kind}</Label>
          <Input id={`edit-link-${kind}`} value={editLinks[kind] ?? ''} disabled={busy || !!detail.issuedAt}
            onChange={(e) => setEditLinks((old) => ({ ...old, [kind]: e.target.value }))} /></div>)}
        {!detail.issuedAt && hasPermission('config_document:update') && <Button variant="outline" disabled={busy}
          onClick={() => void act(async () => { await api.patch(`/configuration/documents/${detail.id}`, {
            expectedRevision: detail.revision,
            values: Object.fromEntries(Object.entries(editValues).filter(([key, value]) =>
              value !== undefined && JSON.stringify(value) !== JSON.stringify(detail.values[key]))),
            links: Object.fromEntries(Object.entries(editLinks).filter(([, id]) => id.trim())) });
          })}>{t('saveDocument')}</Button>}
        {!!transitions.length && <div className="space-y-2 rounded-md border p-3">
          <h3 className="text-sm font-semibold">{t('transitions')}</h3>
          <Label htmlFor="transition-reason">{t('exceptionReason')}</Label>
          <Input id="transition-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex flex-wrap gap-2">{transitions.map((edge) => {
            const approved = approvals.find((r) => r.toStatus === edge.to && r.fromStatus === detail.status &&
              r.status === 'APPROVED');
            return <Button key={edge.to} size="sm" variant="outline" disabled={busy}
              onClick={() => void act(async () => {
                const response = await api.post<{ pendingApproval?: Approval }>(`/configuration/documents/${detail.id}/transition`, {
                  to: edge.to, expectedRevision: detail.revision,
                  ...(approved ? { approvalId: approved.id } : {}),
                  ...(reason.trim() ? { reason: reason.trim() } : {}) });
                if (response.pendingApproval) setMessage(t('pendingApproval')); else setMessage(t('transitionApplied'));
              })}>{edge.label}{edge.requiresApproval ? ` · ${approved ? t('useApproval') : t('requestApproval')}` : ''}</Button>;
          })}</div>
        </div>}
        <section className="space-y-1"><h3 className="text-sm font-semibold">{t('approvalHistory')}</h3>
          {approvals.map((r) => <p key={r.id} className="text-xs">
            {r.fromLabel ?? r.fromStatus} → {r.toLabel ?? r.toStatus}: {r.status} · {r.id}</p>)}
        </section>
      </CardContent></Card>}
    {pending.length > 0 && <Card><CardHeader><CardTitle>{t('pendingApprovals')}</CardTitle></CardHeader>
      <CardContent className="space-y-2">{pending.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-2 border-b p-2 text-sm">
        <span className="flex-1">{item.recordId} · {item.fromStatus} → {item.toStatus}</span>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void act(() =>
          api.post(`/configuration/approvals/${item.id}/decide`, { approve: true }))}>{t('approve')}</Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void act(() =>
          api.post(`/configuration/approvals/${item.id}/decide`, { approve: false }))}>{t('reject')}</Button>
      </div>)}</CardContent></Card>}
  </div>;
}
