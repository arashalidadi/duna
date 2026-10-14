'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Plus } from 'lucide-react';
import type { AccountEntries, AccountingAccount, AccountType, GeneralJournal, CustomerListItem, PaginatedResult } from '@shipping/shared';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';

const selectClass = 'h-9 w-full rounded-md border border-input bg-card px-3 text-sm';
const types: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
type DraftLine = { accountId: string; customerId: string; debit: string; credit: string };
const blankLine = (): DraftLine => ({ accountId: '', customerId: '', debit: '', credit: '' });

export default function AccountingPage() {
  const t = useTranslations('financeUi');
  const { hasPermission } = useAuth();
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [journals, setJournals] = useState<GeneralJournal[]>([]);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [accountForm, setAccountForm] = useState({ code: '', name: '', type: 'ASSET' as AccountType });
  const [journalForm, setJournalForm] = useState({ description: '', currencyCode: 'USD', journalDate: '', reference: '', exchangeRate: '', rateOverrideReason: '' });
  const [lines, setLines] = useState<DraftLine[]>([blankLine(), blankLine()]);
  const [expenseForm, setExpenseForm] = useState({ expenseAccountId: '', creditAccountId: '', description: '', amount: '', currencyCode: 'USD', journalDate: '', exchangeRate: '', rateOverrideReason: '' });
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<AccountEntries | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [a, j] = await Promise.all([
        api.get<AccountingAccount[]>('/ledger/accounts'),
        api.get<GeneralJournal[]>(`/ledger/journals${customerFilter ? `?customerId=${encodeURIComponent(customerFilter)}` : ''}`),
      ]);
      setAccounts(a);
      setJournals(j);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally { setLoading(false); }
  }, [t, customerFilter]);

  useEffect(() => { if (hasPermission('journal:read')) void load(); else setLoading(false); }, [hasPermission, load]);
  useEffect(() => {
    if (!hasPermission('customer:read')) return;
    let active = true;
    const timer = setTimeout(() => {
      api.get<PaginatedResult<CustomerListItem>>(`/customers?pageSize=100&search=${encodeURIComponent(customerSearch)}`)
        .then((result) => { if (active) setCustomers(result.data); })
        .catch(() => { if (active) setCustomers([]); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [customerSearch, hasPermission]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); await load(); setNotice(t('saved')); }
    catch (e) { setError(e instanceof Error ? e.message : t('loadError')); }
    finally { setBusy(false); }
  };

  const changeLine = (index: number, patch: Partial<DraftLine>) =>
    setLines((old) => old.map((line, i) => i === index ? { ...line, ...patch } : line));

  if (loading) return <PageLoader />;
  if (!hasPermission('journal:read')) return <ErrorState message={t('notPermitted')} />;

  return <div className="space-y-6">
    <Breadcrumbs items={[{ label: t('title') }]} />
    <header><h1 className="flex items-center gap-2 text-2xl font-bold"><BookOpen className="size-6" />{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('subtitle')}</p></header>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-success">{notice}</p>}

    <Card><CardHeader><CardTitle>{t('accounts')}</CardTitle><CardDescription>{t('accountsHint')}</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => <div key={a.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
            <button className="min-w-0 flex-1 text-start hover:underline" onClick={() => void run(async () => {
              setSelectedAccount(await api.get<AccountEntries>(`/ledger/accounts/${a.id}/entries`));
            })}>
              <span className="font-mono">{a.code}</span> {a.name} · {t(`type.${a.type}`)}
            </button>
            {!a.isActive && <span className="text-xs text-muted-foreground">{t('inactive')}</span>}
            {hasPermission('account:manage') && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => {
              await api.patch(`/ledger/accounts/${a.id}`, { isActive: !a.isActive });
            })}>{a.isActive ? t('deactivate') : t('activate')}</Button>}
          </div>)}
        </div>
        {accounts.length === 0 && <p className="text-sm text-muted-foreground">{t('noAccounts')}</p>}
        {hasPermission('account:manage') && <div className="grid items-end gap-3 rounded-md border p-3 sm:grid-cols-4">
          <div><Label>{t('code')}</Label><Input value={accountForm.code} maxLength={32}
            onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value.toUpperCase() })} /></div>
          <div><Label>{t('name')}</Label><Input value={accountForm.name}
            onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} /></div>
          <div><Label>{t('accountType')}</Label><select className={selectClass} value={accountForm.type}
            onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value as AccountType })}>
            {types.map((type) => <option key={type} value={type}>{t(`type.${type}`)}</option>)}
          </select></div>
          <Button disabled={busy || !accountForm.code || !accountForm.name} onClick={() => void run(async () => {
            await api.post('/ledger/accounts', accountForm);
            setAccountForm({ code: '', name: '', type: 'ASSET' });
          })}><Plus className="size-4" />{t('addAccount')}</Button>
        </div>}
      </CardContent>
    </Card>

    {selectedAccount && <Card><CardHeader><CardTitle>{selectedAccount.account.code} — {t('accountEntries')}</CardTitle>
      <CardDescription>{t('currencyWarning')}</CardDescription></CardHeader><CardContent className="space-y-3 text-sm">
      {selectedAccount.totals.map((total) => <p key={total.currencyCode} className="rounded-md border p-2 font-medium">
        {total.currencyCode}: {t('debit')} {total.debit} · {t('credit')} {total.credit} · {t('balance')} {total.balance}
      </p>)}
      {selectedAccount.entries.map((line) => <p key={line.id} className="border-b pb-1">
        {line.journal.journalNumber} · {line.journal.description} · {line.journal.currencyCode} ·
        {t('debit')} {line.debit} / {t('credit')} {line.credit}
        {line.customerId && ` · ${t('customer')}: ${customers.find((c) => c.id === line.customerId)?.name ?? line.customerId}`}
      </p>)}
    </CardContent></Card>}

    {hasPermission('journal:post') && <Card><CardHeader><CardTitle>{t('postJournal')}</CardTitle>
      <CardDescription>{t('journalHint')}</CardDescription></CardHeader><CardContent className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2"><Label>{t('description')}</Label><Input value={journalForm.description}
          onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })} /></div>
        <div><Label>{t('currency')}</Label><Input maxLength={3} value={journalForm.currencyCode}
          onChange={(e) => setJournalForm({ ...journalForm, currencyCode: e.target.value.toUpperCase() })} /></div>
        <div><Label>{t('date')}</Label><Input type="date" value={journalForm.journalDate}
          onChange={(e) => setJournalForm({ ...journalForm, journalDate: e.target.value })} /></div>
      </div>
      {hasPermission('customer:read') && <Input aria-label={t('customerSearch')} placeholder={t('customerSearch')}
        value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />}
      {lines.map((line, index) => <div key={index} className="grid items-center gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_1fr_1fr_auto]">
        <select className={selectClass} value={line.accountId} aria-label={t('accounts')}
          onChange={(e) => changeLine(index, { accountId: e.target.value })}>
          <option value="">{t('chooseAccount')}</option>
          {accounts.filter((a) => a.isActive).map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
        </select>
        {hasPermission('customer:read') ? <select className={selectClass} aria-label={t('customer')}
          value={line.customerId} onChange={(e) => changeLine(index, { customerId: e.target.value })}>
          <option value="">{t('noCustomer')}</option>
          {line.customerId && !customers.some((c) => c.id === line.customerId) &&
            <option value={line.customerId}>{line.customerId}</option>}
          {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
        </select> : <Input aria-label={t('customerId')} placeholder={t('customerId')}
          value={line.customerId} onChange={(e) => changeLine(index, { customerId: e.target.value })} />}
        <Input aria-label={t('debit')} inputMode="decimal" placeholder={t('debit')} value={line.debit}
          onChange={(e) => changeLine(index, { debit: e.target.value })} />
        <Input aria-label={t('credit')} inputMode="decimal" placeholder={t('credit')} value={line.credit}
          onChange={(e) => changeLine(index, { credit: e.target.value })} />
        <Button variant="outline" disabled={lines.length <= 2} onClick={() => setLines(lines.filter((_, i) => i !== index))}>−</Button>
      </div>)}
      {hasPermission('currency_rate:override') && <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>{t('rateOverride')}</Label><Input inputMode="decimal" value={journalForm.exchangeRate}
          onChange={(e) => setJournalForm({ ...journalForm, exchangeRate: e.target.value })} /></div>
        <div><Label>{t('reason')}</Label><Input value={journalForm.rateOverrideReason}
          onChange={(e) => setJournalForm({ ...journalForm, rateOverrideReason: e.target.value })} /></div>
      </div>}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setLines([...lines, blankLine()])}><Plus className="size-4" />{t('addLine')}</Button>
        <Button disabled={busy || !journalForm.description.trim()} onClick={() => void run(async () => {
          await api.post('/ledger/journals', {
            ...journalForm,
            ...(journalForm.exchangeRate ? {} : { exchangeRate: undefined, rateOverrideReason: undefined }),
            ...(journalForm.journalDate ? { journalDate: new Date(journalForm.journalDate).toISOString() } : { journalDate: undefined }),
            lines: lines.map((line) => ({ ...line, customerId: line.customerId || undefined,
              debit: line.debit || '0', credit: line.credit || '0' })),
          });
          setLines([blankLine(), blankLine()]); setJournalForm({ ...journalForm, description: '', exchangeRate: '', rateOverrideReason: '' });
        })}>{t('post')}</Button>
      </div>
    </CardContent></Card>}

    {hasPermission('expense:post') && <Card><CardHeader><CardTitle>{t('expense')}</CardTitle>
      <CardDescription>{t('expenseHint')}</CardDescription></CardHeader><CardContent className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><Label>{t('category')}</Label><select className={selectClass} value={expenseForm.expenseAccountId}
          onChange={(e) => setExpenseForm({ ...expenseForm, expenseAccountId: e.target.value })}>
          <option value="">{t('chooseAccount')}</option>{accounts.filter((a) => a.isActive && a.type === 'EXPENSE')
            .map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
        </select></div>
        <div><Label>{t('creditAccount')}</Label><select className={selectClass} value={expenseForm.creditAccountId}
          onChange={(e) => setExpenseForm({ ...expenseForm, creditAccountId: e.target.value })}>
          <option value="">{t('chooseAccount')}</option>{accounts.filter((a) => a.isActive)
            .map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
        </select></div>
        <div><Label>{t('amount')}</Label><Input inputMode="decimal" value={expenseForm.amount}
          onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></div>
        <div><Label>{t('currency')}</Label><Input maxLength={3} value={expenseForm.currencyCode}
          onChange={(e) => setExpenseForm({ ...expenseForm, currencyCode: e.target.value.toUpperCase() })} /></div>
        <div><Label>{t('date')}</Label><Input type="date" value={expenseForm.journalDate}
          onChange={(e) => setExpenseForm({ ...expenseForm, journalDate: e.target.value })} /></div>
        <div><Label>{t('description')}</Label><Input value={expenseForm.description}
          onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} /></div>
      </div>
      {hasPermission('currency_rate:override') && <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>{t('rateOverride')}</Label><Input inputMode="decimal" value={expenseForm.exchangeRate}
          onChange={(e) => setExpenseForm({ ...expenseForm, exchangeRate: e.target.value })} /></div>
        <div><Label>{t('reason')}</Label><Input value={expenseForm.rateOverrideReason}
          onChange={(e) => setExpenseForm({ ...expenseForm, rateOverrideReason: e.target.value })} /></div>
      </div>}
      <Button disabled={busy || !expenseForm.expenseAccountId || !expenseForm.creditAccountId || !expenseForm.amount || !expenseForm.description}
        onClick={() => void run(async () => {
          await api.post('/ledger/expenses', { ...expenseForm,
            ...(expenseForm.exchangeRate ? {} : { exchangeRate: undefined, rateOverrideReason: undefined }),
            ...(expenseForm.journalDate ? { journalDate: new Date(expenseForm.journalDate).toISOString() } : { journalDate: undefined }) });
          setExpenseForm({ ...expenseForm, amount: '', description: '', exchangeRate: '', rateOverrideReason: '' });
        })}>{t('postExpense')}</Button>
    </CardContent></Card>}

    <Card><CardHeader><CardTitle>{t('journals')}</CardTitle><CardDescription>{t('journalListHint')}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {hasPermission('customer:read') && <Input aria-label={t('customerSearch')} placeholder={t('customerSearch')}
          value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />}
        <div><Label>{t('customerFilter')}</Label>
          {hasPermission('customer:read') ? <select className={selectClass} value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}>
            <option value="">{t('allCustomers')}</option>
            {customerFilter && !customers.some((c) => c.id === customerFilter) &&
              <option value={customerFilter}>{customerFilter}</option>}
            {customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select> : <Input value={customerFilter} placeholder={t('allCustomers')}
            onChange={(e) => setCustomerFilter(e.target.value)} />}
        </div>
        {journals.map((j) => <div key={j.id} className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{j.journalNumber} · {j.description}</p>
            <span>{j.currencyCode} → {j.baseCurrencyCode} · {j.rateSource}</span></div>
          <p>{j.kind === 'OFFICE_EXPENSE' ? t('expense') : t('postJournal')}{j.reversedAt ? ` · ${t('reversed')}` : ''}</p>
          {j.lines.map((line) => <p key={line.id} className="text-muted-foreground">{line.account.code} · {line.account.name} ·
            {t('debit')} {line.debit} / {t('credit')} {line.credit} {j.currencyCode}
            {line.customerId && ` · ${t('customer')}: ${customers.find((c) => c.id === line.customerId)?.name ?? line.customerId}`}</p>)}
          {hasPermission('journal:reverse') && !j.reversedAt && !j.reversalOfId && <div className="mt-2 flex gap-2">
            {reversingId === j.id ? <><Input value={reverseReason} placeholder={t('reason')}
              onChange={(e) => setReverseReason(e.target.value)} />
              <Button disabled={busy || !reverseReason.trim()} onClick={() => void run(async () => {
                await api.post(`/ledger/journals/${j.id}/reverse`, { reason: reverseReason });
                setReversingId(null); setReverseReason('');
              })}>{t('reverse')}</Button></> : <Button variant="outline" size="sm"
                onClick={() => { setReversingId(j.id); setReverseReason(''); }}>{t('reverse')}</Button>}
          </div>}
        </div>)}
        {journals.length === 0 && <p className="text-sm text-muted-foreground">{t('noJournals')}</p>}
      </CardContent></Card>
  </div>;
}
