'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { Plus, Eye, XCircle, Trash2, CreditCard } from 'lucide-react';
import type {
  Voucher,
  VoucherListResult,
  VoucherType,
  VoucherMethod,
  VoucherStatus,
  CustomerListItem,
  PaginatedResult,
  Invoice,
} from '@shipping/shared';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateTime, formatDateShort } from '@/lib/date';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { PageLoader } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';

const PAGE_SIZE = 20;

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-card px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring';

const TYPES: VoucherType[] = ['RECEIPT', 'PAYMENT'];
const METHODS: VoucherMethod[] = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'];

function typeVariant(t: VoucherType): 'success' | 'warning' {
  return t === 'RECEIPT' ? 'success' : 'warning';
}
function statusVariant(s: VoucherStatus): 'default' | 'danger' {
  return s === 'POSTED' ? 'default' : 'danger';
}

export default function VouchersPage() {
  const t = useTranslations('voucher');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { hasPermission } = useAuth();

  const [rows, setRows] = useState<Voucher[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | VoucherType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | VoucherStatus>('ALL');

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [detail, setDetail] = useState<Voucher | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    type: 'RECEIPT' as VoucherType,
    customerId: '',
    invoiceId: '',
    amount: '',
    currencyCode: 'USD',
    method: 'BANK_TRANSFER' as VoucherMethod,
    reference: '',
    description: '',
    note: '',
    voucherDate: '',
  });

  const [cancelTarget, setCancelTarget] = useState<Voucher | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Voucher | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await api.get<VoucherListResult>(`/vouchers?${params.toString()}`);
      setRows(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!createOpen) return;
    void (async () => {
      try {
        const [c, i] = await Promise.all([
          api.get<PaginatedResult<CustomerListItem>>('/customers?pageSize=100'),
          api.get<PaginatedResult<Invoice>>('/invoices?status=ISSUED&pageSize=100'),
        ]);
        setCustomers(c.data);
        setInvoices(i.data);
      } catch {
        /* options load best-effort */
      }
    })();
  }, [createOpen]);

  const openCreate = () => {
    setForm({
      type: 'RECEIPT', customerId: '', invoiceId: '', amount: '', currencyCode: 'USD',
      method: 'BANK_TRANSFER', reference: '', description: '', note: '', voucherDate: '',
    });
    setFormError('');
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!form.customerId) { setFormError(t('create.errors.customerRequired')); return; }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setFormError(t('create.errors.amountRequired')); return; }
    setCreating(true);
    setFormError('');
    try {
      await api.post('/vouchers', {
        type: form.type,
        customerId: form.customerId,
        ...(form.invoiceId ? { invoiceId: form.invoiceId } : {}),
        amount,
        ...(form.currencyCode ? { currencyCode: form.currencyCode } : {}),
        method: form.method,
        ...(form.reference ? { reference: form.reference } : {}),
        ...(form.description ? { description: form.description } : {}),
        ...(form.note ? { note: form.note } : {}),
        ...(form.voucherDate ? { voucherDate: new Date(form.voucherDate).toISOString() } : {}),
      });
      setCreateOpen(false);
      setPage(1);
      await load();
    } catch (e: any) {
      setFormError(e?.message ?? tc('errors.generic'));
    } finally {
      setCreating(false);
    }
  };

  const openDetail = async (id: string) => {
    try {
      const v = await api.get<Voucher>(`/vouchers/${id}`);
      setDetail(v);
      setDetailOpen(true);
    } catch {
      /* handled globally */
    }
  };

  const doCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    setBusy(true);
    try {
      await api.post(`/vouchers/${cancelTarget.id}/cancel`, { reason: cancelReason });
      setCancelTarget(null);
      setCancelReason('');
      if (detailOpen) setDetailOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.del(`/vouchers/${deleteTarget.id}`);
      setDeleteTarget(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const fmtMoney = (v: string | null | undefined, cur?: string) =>
    v == null ? '—' : `${Number(v).toLocaleString(locale, { maximumFractionDigits: 2 })}${cur ? ' ' + cur : ''}`;

  const invoiceOptions = invoices.filter((i) => !form.customerId || i.customerId === form.customerId);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: tc('nav.home'), href: '/dashboard' }, { label: t('page.title') }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CreditCard className="size-6 text-primary" />
            {t('page.title')}
          </h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </div>
        {hasPermission('voucher:create') && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t('actions.create')}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('list.title')}</CardTitle>
          <CardDescription>{t('list.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
            >
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('list.search')}
                className="w-64"
              />
              <Button type="submit" variant="outline" size="sm">{tc('actions.search')}</Button>
            </form>
            <select className={SELECT_CLASS} value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as any); setPage(1); }}>
              <option value="ALL">{t('list.allTypes')}</option>
              {TYPES.map((v) => <option key={v} value={v}>{t(`type.${v}`)}</option>)}
            </select>
            <select className={SELECT_CLASS} value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}>
              <option value="ALL">{t('list.allStatuses')}</option>
              <option value="POSTED">{t('status.POSTED')}</option>
              <option value="CANCELLED">{t('status.CANCELLED')}</option>
            </select>
            <span className="ms-auto text-sm text-muted-foreground">
              {tc('list.total')}: {meta.totalItems}
            </span>
          </div>

          {loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : rows.length === 0 ? (
            <EmptyState
              title={t('list.empty.title')}
              description={t('list.empty.description')}
              action={hasPermission('voucher:create') ? (
                <Button size="sm" onClick={openCreate}>{t('actions.create')}</Button>
              ) : undefined}
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground">
                      <th className="p-3 text-start font-medium">{t('fields.voucherNumber')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.type')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.customer')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.invoice')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.amount')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.method')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.voucherDate')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.status')}</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((v) => (
                      <tr key={v.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="p-3">
                          <button className="font-mono text-primary underline-offset-4 hover:underline"
                            onClick={() => void openDetail(v.id)}>
                            {v.voucherNumber}
                          </button>
                        </td>
                        <td className="p-3"><Badge variant={typeVariant(v.type)}>{t(`type.${v.type}`)}</Badge></td>
                        <td className="p-3">{v.customer?.name ?? '—'}</td>
                        <td className="p-3 font-mono text-xs">{v.invoice?.invoiceNumber ?? '—'}</td>
                        <td className="p-3 font-semibold">{fmtMoney(v.amount, v.currencyCode)}</td>
                        <td className="p-3">{t(`method.${v.method}`)}</td>
                        <td className="p-3">{formatDateShort(v.voucherDate, locale)}</td>
                        <td className="p-3"><Badge variant={statusVariant(v.status)}>{t(`status.${v.status}`)}</Badge></td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => void openDetail(v.id)}>
                              <Eye className="size-4" />
                            </Button>
                            {v.status === 'POSTED' && hasPermission('voucher:cancel') && (
                              <Button size="sm" variant="ghost" className="text-warning-foreground"
                                onClick={() => { setCancelTarget(v); setCancelReason(''); }}>
                                <XCircle className="size-4" />
                              </Button>
                            )}
                            {v.status === 'CANCELLED' && hasPermission('voucher:delete') && (
                              <Button size="sm" variant="ghost" className="text-destructive"
                                onClick={() => setDeleteTarget(v)}>
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={meta.page}
                pageSize={meta.pageSize}
                totalItems={meta.totalItems}
                totalPages={meta.totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}
        title={t('create.title')} description={t('create.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{tc('actions.cancel')}</Button>
            <Button onClick={() => void submitCreate()} disabled={creating}>
              {creating ? t('create.creating') : t('actions.save')}
            </Button>
          </>
        }>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.type')}</Label>
              <select className={SELECT_CLASS + ' w-full'} value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as VoucherType })}>
                {TYPES.map((v) => <option key={v} value={v}>{t(`type.${v}`)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.method')}</Label>
              <select className={SELECT_CLASS + ' w-full'} value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value as VoucherMethod })}>
                {METHODS.map((m) => <option key={m} value={m}>{t(`method.${m}`)}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.customer')}</Label>
            <select className={SELECT_CLASS + ' w-full'} value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value, invoiceId: '' })}>
              <option value="">{t('create.selectCustomer')}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.invoice')}</Label>
            <select className={SELECT_CLASS + ' w-full'} value={form.invoiceId}
              onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}>
              <option value="">{t('create.noInvoice')}</option>
              {invoiceOptions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} — {Number(i.totalAmount).toLocaleString()} {i.currencyCode}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.amount')}</Label>
              <Input type="number" min="0.01" step="0.01" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.currencyCode')}</Label>
              <Input maxLength={3} value={form.currencyCode}
                onChange={(e) => setForm({ ...form, currencyCode: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.voucherDate')}</Label>
              <Input type="date" value={form.voucherDate}
                onChange={(e) => setForm({ ...form, voucherDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.reference')}</Label>
            <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.description')}</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </div>
      </Dialog>

      {/* detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}
        title={detail ? detail.voucherNumber : ''}>
        {detail ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={typeVariant(detail.type)}>{t(`type.${detail.type}`)}</Badge>
              <Badge variant={statusVariant(detail.status)}>{t(`status.${detail.status}`)}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-muted-foreground">{t('fields.customer')}</dt>
                <dd className="font-medium">{detail.customer?.name ?? '—'}</dd></div>
              <div><dt className="text-muted-foreground">{t('fields.invoice')}</dt>
                <dd className="font-mono text-xs">{detail.invoice?.invoiceNumber ?? '—'}</dd></div>
              <div><dt className="text-muted-foreground">{t('fields.amount')}</dt>
                <dd className="font-semibold">{fmtMoney(detail.amount, detail.currencyCode)}</dd></div>
              <div><dt className="text-muted-foreground">{t('fields.method')}</dt>
                <dd>{t(`method.${detail.method}`)}</dd></div>
              <div><dt className="text-muted-foreground">{t('fields.reference')}</dt>
                <dd className="font-mono text-xs">{detail.reference ?? '—'}</dd></div>
              <div><dt className="text-muted-foreground">{t('fields.voucherDate')}</dt>
                <dd>{formatDateTime(detail.voucherDate, locale)}</dd></div>
              <div className="col-span-2"><dt className="text-muted-foreground">{t('fields.description')}</dt>
                <dd>{detail.description ?? '—'}</dd></div>
              {detail.cancelReason && (
                <div className="col-span-2"><dt className="text-muted-foreground">{t('fields.cancelReason')}</dt>
                  <dd className="text-destructive">{detail.cancelReason}</dd></div>
              )}
            </dl>
            {detail.status === 'POSTED' && hasPermission('voucher:cancel') && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => { setCancelTarget(detail); setCancelReason(''); }}>
                  <XCircle className="size-4" />
                  {t('actions.cancelVoucher')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <PageLoader />
        )}
      </Dialog>

      {/* cancel dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null); }}
        title={t('confirm.cancel.title')} description={t('confirm.cancel.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>{tc('actions.cancel')}</Button>
            <Button variant="destructive" disabled={busy || !cancelReason.trim()}
              onClick={() => void doCancel()}>
              {busy ? t('actions.cancelling') : t('actions.cancelVoucher')}
            </Button>
          </>
        }>
        <div className="space-y-1.5">
          <Label>{t('confirm.cancel.reason')}</Label>
          <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t('confirm.cancel.reasonPlaceholder')} />
        </div>
      </Dialog>

      {/* delete dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title={t('confirm.delete.title')}
        description={t('confirm.delete.description')}
        confirmLabel={tc('actions.delete')}
        destructive
        loading={busy}
        onConfirm={() => void doDelete()}
      />
    </div>
  );
}
