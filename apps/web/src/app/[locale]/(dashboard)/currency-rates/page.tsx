'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import type { ManagedRate } from '@shipping/shared';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';

type Currency = { id: string; code: string; name: string; symbol: string; isActive: boolean };
type Policy = 'MANUAL' | 'OLDEST_DUE' | 'OLDEST_ISSUED';
type Settings = { defaultCurrency: string; supportedCurrencies: string[]; allocationPolicy: Policy };
const selectClass = 'h-9 w-full rounded-md border border-input bg-card px-3 text-sm';
const localDateTime = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export default function CurrencyRatesPage() {
  const t = useTranslations('financeUi');
  const { hasPermission } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rates, setRates] = useState<ManagedRate[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [newCurrency, setNewCurrency] = useState({ code: '', name: '', symbol: '' });
  const [draft, setDraft] = useState({ currencyCode: '', rate: '', effectiveAt: '', source: '' });
  const [edit, setEdit] = useState<{ id: string; rate: string; effectiveAt: string; source: string } | null>(null);
  const [policy, setPolicy] = useState<Policy>('MANUAL');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [c, r, s] = await Promise.all([
        api.get<Currency[]>(hasPermission('currency:manage') ? '/currencies/manage' : '/currencies'),
        api.get<ManagedRate[]>('/currencies/rates'),
        hasPermission('settings:read') ? api.get<Settings>('/company-settings') : Promise.resolve(null),
      ]);
      setCurrencies(c); setRates(r); setSettings(s);
      if (s) setPolicy(s.allocationPolicy);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : t('loadError')); }
    finally { setLoading(false); }
  }, [hasPermission, t]);

  useEffect(() => { if (hasPermission('currency_rate:read') && hasPermission('currency:read')) void load(); else setLoading(false); }, [hasPermission, load]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await work(); await load(); setNotice(t('saved')); }
    catch (e) { setError(e instanceof Error ? e.message : t('loadError')); }
    finally { setBusy(false); }
  };

  if (loading) return <PageLoader />;
  if (!hasPermission('currency_rate:read') || !hasPermission('currency:read')) return <ErrorState message={t('notPermitted')} />;

  return <div className="space-y-6">
    <Breadcrumbs items={[{ label: t('ratesTitle') }]} />
    <header><h1 className="flex items-center gap-2 text-2xl font-bold"><Globe className="size-6" />{t('ratesTitle')}</h1>
      <p className="text-sm text-muted-foreground">{t('ratesHint')}</p></header>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-success">{notice}</p>}

    <Card><CardHeader><CardTitle>{t('currencies')}</CardTitle><CardDescription>{t('currencyHint')}</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-sm">{currencies.map((c) => <div key={c.id} className="flex items-center gap-2 rounded-md border p-2">
          <span className={!c.isActive ? 'text-muted-foreground line-through' : ''}>{c.code} · {c.name} ({c.symbol})</span>
          {hasPermission('currency:manage') && <Button size="sm" variant="outline" disabled={busy}
            onClick={() => void run(async () => { await api.patch(`/currencies/${c.code}`, { isActive: !c.isActive }); })}>
            {c.isActive ? t('deactivate') : t('activate')}
          </Button>}
        </div>)}</div>
        {hasPermission('currency:manage') && <div className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-4">
          <div><Label>{t('code')}</Label><Input maxLength={3} value={newCurrency.code}
            onChange={(e) => setNewCurrency({ ...newCurrency, code: e.target.value.toUpperCase() })} /></div>
          <div><Label>{t('name')}</Label><Input value={newCurrency.name}
            onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })} /></div>
          <div><Label>{t('symbol')}</Label><Input value={newCurrency.symbol}
            onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })} /></div>
          <Button disabled={busy || !newCurrency.code || !newCurrency.name || !newCurrency.symbol} onClick={() => void run(async () => {
            await api.post('/currencies', newCurrency);
            setNewCurrency({ code: '', name: '', symbol: '' });
          })}>{t('addCurrency')}</Button>
        </div>}
        <p className="text-xs text-muted-foreground">{t('settingsHint')} <Link className="underline" href="/settings">{t('settingsLink')}</Link></p>
      </CardContent>
    </Card>

    {settings && <Card><CardHeader><CardTitle>{t('allocationPolicy')}</CardTitle>
      <CardDescription>{t('policyHint')}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-end gap-3">
      <div className="min-w-[240px]"><Label>{t('defaultPolicy')}</Label>
        <select className={selectClass} value={policy} disabled={!hasPermission('settings:update') || busy}
          onChange={(e) => setPolicy(e.target.value as Policy)}>
          <option value="MANUAL">{t('policy.MANUAL')}</option>
          <option value="OLDEST_DUE">{t('policy.OLDEST_DUE')}</option>
          <option value="OLDEST_ISSUED">{t('policy.OLDEST_ISSUED')}</option>
        </select></div>
      {hasPermission('settings:update') && <Button disabled={busy || policy === settings.allocationPolicy}
        onClick={() => void run(async () => { await api.patch('/company-settings', { allocationPolicy: policy }); })}>{t('savePolicy')}</Button>}
    </CardContent></Card>}

    <Card><CardHeader><CardTitle>{t('datedRates')}</CardTitle><CardDescription>{t('rateDirection', { base: settings?.defaultCurrency ?? 'base' })}</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {hasPermission('currency_rate:create') && <div className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-5">
          <div><Label>{t('currency')}</Label><select className={selectClass} value={draft.currencyCode}
            onChange={(e) => setDraft({ ...draft, currencyCode: e.target.value })}>
            <option value="">{t('chooseCurrency')}</option>{currencies.filter((c) => c.isActive && c.code !== settings?.defaultCurrency)
              .map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select></div>
          <div><Label>{t('rate')}</Label><Input inputMode="decimal" placeholder="0.000000000001" value={draft.rate}
            onChange={(e) => setDraft({ ...draft, rate: e.target.value })} /></div>
          <div><Label>{t('effectiveAt')}</Label><Input type="datetime-local" value={draft.effectiveAt}
            onChange={(e) => setDraft({ ...draft, effectiveAt: e.target.value })} /></div>
          <div><Label>{t('source')}</Label><Input value={draft.source}
            onChange={(e) => setDraft({ ...draft, source: e.target.value })} /></div>
          <Button disabled={busy || !draft.currencyCode || !draft.rate || !draft.effectiveAt || !draft.source}
            onClick={() => void run(async () => {
              await api.post('/currencies/rates', { ...draft, effectiveAt: new Date(draft.effectiveAt).toISOString() });
              setDraft({ currencyCode: '', rate: '', effectiveAt: '', source: '' });
            })}>{t('createDraft')}</Button>
        </div>}
        {rates.map((rate) => <div key={rate.id} className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{rate.currencyCode} / {rate.baseCurrencyCode} · {rate.rate} · {new Date(rate.effectiveAt).toLocaleString()} · {rate.source}</span>
            <span>{rate.status === 'APPROVED' ? t('approved') : t('draft')}</span>
          </div>
          {rate.status === 'DRAFT' && <div className="mt-2 flex flex-wrap gap-2">
            {hasPermission('currency_rate:update') && <Button variant="outline" size="sm"
              onClick={() => setEdit({ id: rate.id, rate: rate.rate, source: rate.source, effectiveAt: localDateTime(rate.effectiveAt) })}>{t('editDraft')}</Button>}
            {hasPermission('currency_rate:approve') && <Button size="sm" disabled={busy}
              onClick={() => void run(async () => { await api.post(`/currencies/rates/${rate.id}/approve`); })}>{t('approve')}</Button>}
          </div>}
          {edit?.id === rate.id && <div className="mt-3 grid items-end gap-2 sm:grid-cols-4">
            <div><Label>{t('rate')}</Label><Input inputMode="decimal" value={edit.rate}
              onChange={(e) => setEdit({ ...edit, rate: e.target.value })} /></div>
            <div><Label>{t('effectiveAt')}</Label><Input type="datetime-local" value={edit.effectiveAt}
              onChange={(e) => setEdit({ ...edit, effectiveAt: e.target.value })} /></div>
            <div><Label>{t('source')}</Label><Input value={edit.source}
              onChange={(e) => setEdit({ ...edit, source: e.target.value })} /></div>
            <Button disabled={busy || !edit.rate || !edit.effectiveAt || !edit.source} onClick={() => void run(async () => {
              await api.patch(`/currencies/rates/${rate.id}`, { rate: edit.rate, source: edit.source,
                effectiveAt: new Date(edit.effectiveAt).toISOString() }); setEdit(null);
            })}>{t('saveDraft')}</Button>
          </div>}
        </div>)}
        {rates.length === 0 && <p className="text-muted-foreground">{t('noRates')}</p>}
      </CardContent>
    </Card>
  </div>;
}
