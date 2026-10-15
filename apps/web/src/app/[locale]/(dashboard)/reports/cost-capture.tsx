'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { AccountingAccount, PaginatedResult, VoyageListItem } from '@shipping/shared';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

type Category = { id: string; code: string; name: string; isActive: boolean };
type ManifestRef = { id: string; manifestNumber: string; status: string };
type JournalRef = { id: string; journalNumber: string };
const selectClass = 'h-10 w-full rounded-md border border-input bg-card px-2 text-sm';

export function CostCapture() {
  const t = useTranslations('reportsUi');
  const { hasPermission } = useAuth();
  const canManage = ['report:cost_manage', 'expense:post', 'voyage:read', 'journal:read', 'journal:post']
    .every(hasPermission);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [voyages, setVoyages] = useState<VoyageListItem[]>([]);
  const [manifests, setManifests] = useState<ManifestRef[]>([]);
  const [voyageSearch, setVoyageSearch] = useState('');
  const [form, setForm] = useState({ voyageId: '', manifestId: '', categoryId: '', expenseAccountId: '',
    creditAccountId: '', vatAccountId: '', amount: '', inputVatAmount: '', taxPaidAt: '',
    journalDate: '', reference: '', description: '', currencyCode: 'USD', exchangeRate: '', rateOverrideReason: '' });
  const hasPositiveVat = Number(form.inputVatAmount) > 0;
  const [category, setCategory] = useState({ code: '', name: '' });
  const [posted, setPosted] = useState<JournalRef | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    const [c, a] = await Promise.all([api.get<Category[]>('/reports/cost-categories'),
      canManage ? api.get<AccountingAccount[]>('/ledger/accounts') : Promise.resolve([])]);
    setCategories(c); setAccounts(a);
  }, [canManage]);
  useEffect(() => { void refresh().catch((e: unknown) => setError(e instanceof Error ? e.message : t('loadError'))); }, [refresh, t]);
  useEffect(() => {
    if (!canManage) return;
    let live = true;
    const timer = window.setTimeout(() => {
      api.get<PaginatedResult<VoyageListItem>>(`/voyages?pageSize=100&search=${encodeURIComponent(voyageSearch)}`)
        .then((result) => { if (live) setVoyages(result.data); })
        .catch((e: unknown) => { if (live) setError(e instanceof Error ? e.message : t('loadError')); });
    }, 200);
    return () => { live = false; clearTimeout(timer); };
  }, [canManage, voyageSearch, t]);
  useEffect(() => {
    if (!form.voyageId || !hasPermission('manifest:read')) { setManifests([]); return; }
    let live = true;
    api.get<PaginatedResult<ManifestRef>>(`/manifests?pageSize=100&voyageId=${encodeURIComponent(form.voyageId)}`)
      .then((result) => { if (live) setManifests(result.data.filter((m) => m.status !== 'CANCELLED')); })
      .catch(() => { if (live) setManifests([]); });
    return () => { live = false; };
  }, [form.voyageId, hasPermission]);
  const perform = async (fn: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); setNotice(t('savedNotice')); }
    catch (e) { setError(e instanceof Error ? e.message : t('loadError')); }
    finally { setBusy(false); }
  };
  const field = (key: keyof typeof form, label: string, type = 'text') => <label className="space-y-1 text-sm">
    {label}<Input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
  </label>;
  return <div className="space-y-5">
    <Card><CardHeader><div><CardTitle>{t('costCategories')}</CardTitle>
      <CardDescription>{t('costCategoriesHint')}</CardDescription></div></CardHeader>
      <CardContent className="space-y-3 pt-3">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm">{notice}</p>}
        <div className="flex flex-wrap gap-2">{categories.map((c) => <div key={c.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
          <span>{c.code} · {c.name}{!c.isActive && ` (${t('inactive')})`}</span>
          {canManage && <Button size="sm" variant="outline" disabled={busy}
            onClick={() => void perform(async () => {
              await api.patch(`/reports/cost-categories/${c.id}`, { isActive: !c.isActive }); await refresh();
            })}>{c.isActive ? t('deactivate') : t('activate')}</Button>}
          {canManage && <Button size="sm" variant="outline" disabled={busy}
            onClick={() => { const next = window.prompt(t('categoryName'), c.name);
              if (next?.trim() && next.trim() !== c.name) void perform(async () => {
                await api.patch(`/reports/cost-categories/${c.id}`, { name: next.trim() }); await refresh();
              }); }}>
            {t('rename')}</Button>}
        </div>)}</div>
        {canManage && <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-sm">{t('categoryCode')}
            <Input maxLength={32} value={category.code} onChange={(e) => setCategory({ ...category, code: e.target.value.toUpperCase() })} /></label>
          <label className="space-y-1 text-sm">{t('categoryName')}
            <Input maxLength={120} value={category.name} onChange={(e) => setCategory({ ...category, name: e.target.value })} /></label>
          <Button disabled={busy || !category.code || !category.name} onClick={() => void perform(async () => {
            await api.post('/reports/cost-categories', category); setCategory({ code: '', name: '' }); await refresh();
          })}>{t('addCategory')}</Button>
        </div>}
      </CardContent></Card>
    {canManage && <Card><CardHeader><div><CardTitle>{t('postCost')}</CardTitle>
      <CardDescription>{t('postCostHint')}</CardDescription></div></CardHeader>
      <CardContent className="space-y-4 pt-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">{t('searchVoyage')}
            <Input value={voyageSearch} onChange={(e) => setVoyageSearch(e.target.value)} /></label>
          <label className="space-y-1 text-sm">{t('voyage')}
            <select className={selectClass} value={form.voyageId} onChange={(e) => setForm({ ...form, voyageId: e.target.value, manifestId: '' })}>
              <option value="">{t('select')}</option>
              {form.voyageId && !voyages.some((v) => v.id === form.voyageId) && <option value={form.voyageId}>{form.voyageId}</option>}
              {voyages.map((v) => <option key={v.id} value={v.id}>{v.voyageNumber}</option>)}
            </select></label>
          <label className="space-y-1 text-sm">{t('manifestOptional')}
            <select className={selectClass} value={form.manifestId} onChange={(e) => setForm({ ...form, manifestId: e.target.value })}>
              <option value="">{t('voyageOnly')}</option>
              {manifests.map((m) => <option key={m.id} value={m.id}>{m.manifestNumber}</option>)}
            </select></label>
          <label className="space-y-1 text-sm">{t('category')}
            <select className={selectClass} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">{t('select')}</option>
              {categories.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select></label>
          <label className="space-y-1 text-sm">{t('expenseAccount')}
            <select className={selectClass} value={form.expenseAccountId} onChange={(e) => setForm({ ...form, expenseAccountId: e.target.value })}>
              <option value="">{t('select')}</option>{accounts.filter((a) => a.isActive && a.type === 'EXPENSE').map((a) =>
                <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
          <label className="space-y-1 text-sm">{t('creditAccount')}
            <select className={selectClass} value={form.creditAccountId} onChange={(e) => setForm({ ...form, creditAccountId: e.target.value })}>
              <option value="">{t('select')}</option>{accounts.filter((a) => a.isActive &&
                (!hasPositiveVat || a.type === 'ASSET')).map((a) =>
                <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
          {field('amount', t('grossAmount'))}{field('inputVatAmount', t('vatAmountZero'))}
          <label className="space-y-1 text-sm">{t('vatAssetAccount')}
            <select className={selectClass} disabled={!hasPositiveVat}
              value={form.vatAccountId} onChange={(e) => setForm({ ...form, vatAccountId: e.target.value })}>
              <option value="">{t('select')}</option>{accounts.filter((a) => a.isActive && a.type === 'ASSET')
                .map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
          {field('taxPaidAt', t('taxPaidAt'), 'date')}{field('currencyCode', t('currency'))}
          {field('journalDate', t('journalDate'), 'date')}{field('description', t('description'))}
          {field('reference', t('reference'))}
          {hasPermission('currency_rate:override') && <>{field('exchangeRate', t('rateOverride'))}
            {field('rateOverrideReason', t('reason'))}</>}
        </div>
        <p className="text-sm text-muted-foreground">{t('vatCostHint')}</p>
        <Button disabled={busy || !form.voyageId || !form.categoryId || !form.expenseAccountId ||
          !form.creditAccountId || !form.amount || form.inputVatAmount === '' || !form.description.trim()}
          onClick={() => void perform(async () => {
            const created = await api.post<JournalRef>('/reports/costs', {
              ...form, manifestId: form.manifestId || undefined,
              taxPaidAt: hasPositiveVat && form.taxPaidAt ? `${form.taxPaidAt}T00:00:00.000Z` : undefined,
              vatAccountId: hasPositiveVat ? form.vatAccountId || undefined : undefined,
              journalDate: form.journalDate ? `${form.journalDate}T00:00:00.000Z` : undefined,
              exchangeRate: form.exchangeRate || undefined,
              rateOverrideReason: form.exchangeRate ? form.rateOverrideReason : undefined,
              reference: form.reference || undefined,
            });
            setPosted(created); setForm({ ...form, amount: '', description: '', inputVatAmount: '', vatAccountId: '', taxPaidAt: '' });
          })}>{t('postCost')}</Button>
        {posted && <p role="status" className="text-sm">{t('postedJournal')}: <Link className="underline" href="/accounting">
          {posted.journalNumber}</Link> · {posted.id}</p>}
      </CardContent></Card>}
  </div>;
}
