'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import type {
  CustomerListItem,
  LedgerEntry,
  LedgerSummary,
  PaginatedResult,
} from '@shipping/shared';
import { Printer } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { formatDateShort } from '@/lib/date';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-card px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring';

const CURRENCIES = ['', 'USD', 'AED', 'IRR', 'EUR', 'TRY', 'CNY'];

function money(v: string): string {
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface LedgerResponse {
  summary: LedgerSummary;
  entries: LedgerEntry[];
}

export default function LedgerPage() {
  const t = useTranslations('ledger');
  const tc = useTranslations('common');
  const locale = useLocale();

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [currency, setCurrency] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [report, setReport] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    api
      .get<PaginatedResult<CustomerListItem>>('/customers?pageSize=200')
      .then((res) => setCustomers(res.data))
      .catch(() => setCustomers([]))
      .finally(() => setInitializing(false));
  }, []);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ customerId });
      if (currency) params.set('currencyCode', currency);
      if (fromDate) params.set('fromDate', new Date(fromDate).toISOString());
      if (toDate) params.set('toDate', new Date(toDate + 'T23:59:59').toISOString());
      const res = await api.get<LedgerResponse>(`/ledger/customers?${params.toString()}`);
      setReport(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('list.loading'));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [customerId, currency, fromDate, toDate, t]);

  useEffect(() => {
    if (customerId) void load();
  }, [customerId, load]);

  if (initializing) return <PageLoader />;

  const entries = report?.entries ?? [];
  const summary = report?.summary;
  const customerName = customers.find((c) => c.id === customerId)?.name ?? summary?.customerName ?? '';

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tc('nav.home'), href: '/dashboard' },
          { label: t('page.title') },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </div>
        {report && (
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" />
            {t('actions.print')}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('filters.title')}</CardTitle>
          <CardDescription>{t('filters.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>{t('fields.customer')}</Label>
              <select className={SELECT_CLASS + ' w-full'} value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">{t('selectCustomer')}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.currency')}</Label>
              <select className={SELECT_CLASS + ' w-full'} value={currency}
                onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c === '' ? t('allCurrencies') : c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.fromDate')}</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.toDate')}</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={() => void load()} disabled={!customerId || loading}>
              {loading ? tc('list.loading') : t('actions.run')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!customerId && !loading && (
        <EmptyState title={t('list.empty.title')} description={t('list.empty.description')} />
      )}

      {customerId && error && <ErrorState message={error} onRetry={() => void load()} />}

      {customerId && loading && !report && <PageLoader />}

      {customerId && report && summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('statement.title', { customer: customerName })}
            </CardTitle>
            <CardDescription>
              {t('statement.subtitle', { count: entries.length })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">{t('statement.opening')}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{money(summary.openingBalance)}</div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">{t('statement.period')}</div>
                <div className="mt-1 flex gap-4 text-sm tabular-nums">
                  <span className="text-danger">−{money(summary.totalDebit)}</span>
                  <span className="text-success">+{money(summary.totalCredit)}</span>
                </div>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="text-xs text-muted-foreground">{t('statement.closing')}</div>
                <div className={'mt-1 text-lg font-semibold tabular-nums ' +
                  (Number(summary.closingBalance) > 0 ? 'text-danger' : 'text-success')}>
                  {money(summary.closingBalance)}
                </div>
              </div>
            </div>

            {entries.length === 0 ? (
              <EmptyState title={t('list.empty.title')} description={t('list.empty.description')} />
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground">
                      <th className="p-3 text-start font-medium">{t('columns.date')}</th>
                      <th className="p-3 text-start font-medium">{t('columns.kind')}</th>
                      <th className="p-3 text-start font-medium">{t('columns.document')}</th>
                      <th className="p-3 text-start font-medium">{t('columns.description')}</th>
                      <th className="p-3 text-end font-medium">{t('columns.debit')}</th>
                      <th className="p-3 text-end font-medium">{t('columns.credit')}</th>
                      <th className="p-3 text-end font-medium">{t('columns.balance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={`${e.kind}-${e.documentId}`} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="whitespace-nowrap p-3 tabular-nums">
                          {formatDateShort(e.date, locale)}
                        </td>
                        <td className="p-3">
                          <Badge variant={e.kind === 'invoice' ? 'info' : 'success'}>
                            {t(`kind.${e.kind}`)}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono text-xs">{e.documentNumber}</td>
                        <td className="max-w-[280px] truncate p-3 text-muted-foreground" title={e.description ?? ''}>
                          {e.description ?? '—'}
                        </td>
                        <td className="p-3 text-end tabular-nums">
                          {Number(e.debit) > 0 ? money(e.debit) : '—'}
                        </td>
                        <td className="p-3 text-end tabular-nums">
                          {Number(e.credit) > 0 ? money(e.credit) : '—'}
                        </td>
                        <td className="p-3 text-end font-medium tabular-nums">{money(e.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
