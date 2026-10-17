'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Letter, LetterListResult } from '@shipping/shared';
import { ArchiveRestore, Search, Settings2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';

const SCOPES = ['LETTER', 'IDENTITY_DOCUMENT', 'DOCUMENT_ASSET', 'DOCUMENT_TEMPLATE',
  'ISSUED_OUTPUT', 'FINANCE', 'AUDIT'] as const;
type Scope = typeof SCOPES[number];
type Policy = { scope: Scope; minimumDays: number | null; archiveAfterDays: number | null;
  secureDeleteAfterDays: number | null; authority: string | null; lawfulBasis: string | null;
  updatedAt: string | null };
type History = { items: Array<{ id: string; action: string; timestamp: string;
  actorEmail: string; metadata?: { reason?: string; mode?: string } }>;
  total: number; page: number; pageSize: number; hasMore: boolean };
const perPage = 20;
function numberOrNull(text: string): number | null {
  if (!text.trim()) return null;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1 || n > 365000) throw new Error('invalidDays');
  return n;
}
function errorMessage(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback;
}

export default function ArchivePage() {
  const t = useTranslations('archive');
  const { hasPermission } = useAuth();
  // UI hint only; the API independently rejects portal-linked principals.
  const portalOnly = hasPermission('portal:access') && !hasPermission('dashboard:read');
  const canRead = !portalOnly && hasPermission('letter:read');
  const canReopen = canRead && hasPermission('archive:reopen');
  const canRun = hasPermission('archive:create') && hasPermission('letter:archive');
  const canReadPolicy = hasPermission('retention:read');
  const canManage = hasPermission('retention:manage');
  const [rows, setRows] = useState<Letter[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Letter | null>(null);
  const historySelection = useRef<string | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState<Policy | null>(null);
  const [values, setValues] = useState({ minimumDays: '', archiveAfterDays: '',
    secureDeleteAfterDays: '', authority: '', lawfulBasis: '' });

  const reload = useCallback(async () => {
    if (!canRead) return;
    try {
      const q = new URLSearchParams({ page: String(page), pageSize: String(perPage) });
      if (search) q.set('search', search);
      const result = await api.get<LetterListResult>(`/archive/letters?${q}`);
      setRows(result.data);
      setTotal(result.meta.totalItems);
    } catch (e) { setMessage(errorMessage(e, t('failed'))); }
  }, [canRead, page, search, t]);
  const reloadPolicies = useCallback(async () => {
    if (!canReadPolicy) return;
    try { setPolicies(await api.get<Policy[]>('/archive/policies')); }
    catch (e) { setMessage(errorMessage(e, t('failed'))); }
  }, [canReadPolicy, t]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { void reloadPolicies(); }, [reloadPolicies]);

  const view = async (letter: Letter) => {
    historySelection.current = letter.id;
    setSelected(letter); setHistory(null); setReason(''); setMessage('');
    setHistoryLoading(true);
    try {
      const result = await api.get<History>(`/archive/letters/${letter.id}/history?page=1&pageSize=100`);
      if (historySelection.current === letter.id) setHistory(result);
    } catch (e) { if (historySelection.current === letter.id) setMessage(errorMessage(e, t('failed'))); }
    finally { if (historySelection.current === letter.id) setHistoryLoading(false); }
  };
  const moreHistory = async () => {
    if (!selected || !history?.hasMore || historyLoading) return;
    const id = selected.id;
    setHistoryLoading(true); setMessage('');
    try {
      const next = await api.get<History>(`/archive/letters/${id}/history?page=${history.page + 1}&pageSize=100`);
      if (historySelection.current === id) setHistory((previous) => previous
        ? { ...next, items: [...previous.items, ...next.items] } : previous);
    } catch (e) { if (historySelection.current === id) setMessage(errorMessage(e, t('failed'))); }
    finally { if (historySelection.current === id) setHistoryLoading(false); }
  };
  const reopen = async () => {
    if (!selected || reason.trim().length < 10) { setMessage(t('reasonRequired')); return; }
    setBusy(true); setMessage('');
    try {
      await api.post(`/archive/letters/${selected.id}/reopen`, { reason: reason.trim() });
      historySelection.current = null; setSelected(null); await reload();
    } catch (e) { setMessage(errorMessage(e, t('failed'))); }
    finally { setBusy(false); }
  };
  const run = async () => {
    if (!window.confirm(t('confirmRun'))) return;
    setBusy(true); setMessage('');
    try {
      const result = await api.post<{ configured: boolean; archived: number }>('/archive/letters/run');
      setMessage(result.configured ? t('runResult', { count: result.archived }) : t('notConfigured'));
      await reload();
    } catch (e) { setMessage(errorMessage(e, t('failed'))); }
    finally { setBusy(false); }
  };
  const openPolicy = (policy: Policy) => {
    setEditing(policy); setMessage('');
    setValues({ minimumDays: String(policy.minimumDays ?? ''),
      archiveAfterDays: String(policy.archiveAfterDays ?? ''),
      secureDeleteAfterDays: String(policy.secureDeleteAfterDays ?? ''),
      authority: policy.authority ?? '', lawfulBasis: policy.lawfulBasis ?? '' });
  };
  const savePolicy = async () => {
    if (!editing) return;
    setBusy(true); setMessage('');
    try {
      await api.patch(`/archive/policies/${editing.scope}`, {
        minimumDays: numberOrNull(values.minimumDays),
        archiveAfterDays: editing.scope === 'LETTER' ? numberOrNull(values.archiveAfterDays) : null,
        secureDeleteAfterDays: numberOrNull(values.secureDeleteAfterDays),
        authority: values.authority.trim() || null,
        lawfulBasis: editing.scope === 'IDENTITY_DOCUMENT' ? values.lawfulBasis.trim() || null : null,
      });
      setEditing(null); await reloadPolicies();
    } catch (e) { setMessage(e instanceof Error && e.message === 'invalidDays'
      ? t('invalidDays') : errorMessage(e, t('failed'))); }
    finally { setBusy(false); }
  };

  if (!canRead) return <p className="p-6">{t('noAccess')}</p>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p></div>
      {canRun && <Button onClick={() => void run()} disabled={busy}>
        <ArchiveRestore className="h-4 w-4" /> {t('run')}</Button>}
    </div>
    {message && <p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}
    <Card><CardHeader><CardTitle>{t('letters')}</CardTitle></CardHeader><CardContent className="space-y-4">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => {
        e.preventDefault(); setPage(1); setSearch(query.trim());
      }}><Input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search')} className="max-w-sm" aria-label={t('search')} />
        <Button type="submit" variant="outline"><Search className="h-4 w-4" />{t('search')}</Button></form>
      {rows.length ? <ul className="divide-y">
        {rows.map((letter) => <li key={letter.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div><p className="font-mono text-xs">{letter.letterNumber}</p>
            <p className="text-sm">{letter.subject}</p></div>
          <Button variant="outline" size="sm" onClick={() => void view(letter)}>{t('history')}</Button>
        </li>)}
      </ul> : <p className="py-5 text-sm text-muted-foreground">{t('empty')}</p>}
      {total > perPage && <Pagination page={page} pageSize={perPage} totalItems={total}
        totalPages={Math.ceil(total / perPage)} onPageChange={setPage} />}
    </CardContent></Card>
    {canReadPolicy && <Card><CardHeader><CardTitle>{t('policies')}</CardTitle></CardHeader>
      <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">{t('policyWarning')}</p>
        <ul className="divide-y">{policies.map((policy) => <li key={policy.scope}
          className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div><p className="font-medium">{t(`scope.${policy.scope}`)}</p>
            <p className="text-xs text-muted-foreground">{t('minimum')}: {policy.minimumDays ?? t('unset')}
              {policy.scope === 'LETTER' ? ` · ${t('automatic')}: ${policy.archiveAfterDays ?? t('off')}` : ''}</p></div>
          {canManage && <Button variant="outline" size="sm" onClick={() => openPolicy(policy)}>
            <Settings2 className="h-4 w-4" /> {t('configure')}</Button>}
        </li>)}</ul>
      </CardContent></Card>}
    <Dialog open={!!selected} onOpenChange={(open) => {
      if (!busy && !open) { historySelection.current = null; setSelected(null); }
    }}
      title={selected?.letterNumber} description={selected?.subject}
      footer={canReopen ? <><Button variant="outline" onClick={() => setSelected(null)}>{t('cancel')}</Button>
        <Button disabled={busy} onClick={() => void reopen()}>{t('reopen')}</Button></> : undefined}>
      <div className="space-y-4">
        {history?.items.map((item) => <div key={item.id} className="border-b pb-2 text-sm">
          <p>{item.action === 'letter.reopen' ? t('reopen') : t('archived')} · {item.actorEmail}</p>
          <p className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleString()} · {item.metadata?.reason}</p>
        </div>)}
        {history?.hasMore && <Button type="button" variant="outline" disabled={historyLoading}
          onClick={() => void moreHistory()}>{t('moreHistory')}</Button>}
        {canReopen && <div className="space-y-1"><Label htmlFor="reopen-reason">{t('reason')}</Label>
          <Input id="reopen-reason" maxLength={500} value={reason}
            onChange={(e) => setReason(e.target.value)} placeholder={t('reasonHint')} /></div>}
        {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      </div>
    </Dialog>
    <Dialog open={!!editing} onOpenChange={(open) => { if (!busy && !open) setEditing(null); }}
      title={editing ? t(`scope.${editing.scope}`) : t('configure')}
      footer={<><Button variant="outline" onClick={() => setEditing(null)}>{t('cancel')}</Button>
        <Button disabled={busy} onClick={() => void savePolicy()}>{t('save')}</Button></>}>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('policyWarning')}</p>
        {(['minimumDays', 'secureDeleteAfterDays'] as const).map((field) =>
          <div key={field} className="space-y-1"><Label htmlFor={field}>{t(field)}</Label>
            <Input id={field} type="number" min="1" max="365000" value={values[field]}
              onChange={(e) => setValues({ ...values, [field]: e.target.value })} /></div>)}
        {editing?.scope === 'LETTER' && <div className="space-y-1"><Label htmlFor="archiveAfterDays">{t('automatic')}</Label>
          <Input id="archiveAfterDays" type="number" min="1" max="365000" value={values.archiveAfterDays}
            onChange={(e) => setValues({ ...values, archiveAfterDays: e.target.value })} /></div>}
        <div className="space-y-1"><Label htmlFor="authority">{t('authority')}</Label>
          <Input id="authority" maxLength={500} value={values.authority}
            onChange={(e) => setValues({ ...values, authority: e.target.value })} /></div>
        {editing?.scope === 'IDENTITY_DOCUMENT' && <div className="space-y-1"><Label htmlFor="lawfulBasis">{t('lawfulBasis')}</Label>
          <Input id="lawfulBasis" maxLength={500} value={values.lawfulBasis}
            onChange={(e) => setValues({ ...values, lawfulBasis: e.target.value })} /></div>}
        {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      </div>
    </Dialog>
  </div>;
}
