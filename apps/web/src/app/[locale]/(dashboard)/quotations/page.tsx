'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type {
  Quotation,
  QuotationListResult,
  QuotationStatus,
  CustomerListItem,
} from '@shipping/shared';
import {
  Plus, Eye, Send, CheckCircle2, Ban, XCircle, ArrowRightLeft, Quote, Trash2,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateShort, formatDateTime } from '@/lib/date';
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

function statusVariant(s: QuotationStatus): 'info' | 'success' | 'danger' | 'outline' {
  if (s === 'ACCEPTED') return 'success';
  if (s === 'SENT') return 'info';
  if (s === 'REJECTED' || s === 'CANCELLED') return 'danger';
  return 'outline';
}

function money(v: string): string {
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuotationsPage() {
  const t = useTranslations('quotation');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { hasPermission } = useAuth();

  // list
  const [rows, setRows] = useState<Quotation[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | QuotationStatus>('ALL');
  const [convertibleOnly, setConvertibleOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (convertibleOnly) params.set('convertible', 'true');
      const res = await api.get<QuotationListResult>(`/quotations?${params.toString()}`);
      setRows(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, convertibleOnly, tc]);

  useEffect(() => { void load(); }, [load]);

  // detail
  const [detail, setDetail] = useState<Quotation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const d = await api.get<Quotation>(`/quotations/${id}`);
      setDetail(d);
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // create
  const [createOpen, setCreateOpen] = useState(false);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [form, setForm] = useState({
    customerId: '', title: '', currencyCode: 'USD', taxRate: '0', discountAmount: '0',
    validUntil: '', notes: '',
    items: [{ description: '', quantity: '1', unitPrice: '' }],
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const openCreate = async () => {
    setCreateOpen(true);
    setFormError('');
    setForm({
      customerId: '', title: '', currencyCode: 'USD', taxRate: '0', discountAmount: '0',
      validUntil: '', notes: '',
      items: [{ description: '', quantity: '1', unitPrice: '' }],
    });
    setCustomersLoading(true);
    try {
      const res = await api.get<{ data: CustomerListItem[] }>('/customers?pageSize=100');
      setCustomers(res.data);
    } catch { /* best-effort */ } finally { setCustomersLoading(false); }
  };

  const computedTotals = (() => {
    const items = form.items.map((i) => ({
      qty: Number(i.quantity) || 0,
      price: Number(i.unitPrice) || 0,
    }));
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    const discount = Number(form.discountAmount) || 0;
    const rate = Number(form.taxRate) || 0;
    const taxable = Math.max(subtotal - discount, 0);
    const tax = Number(((taxable * rate) / 100).toFixed(2));
    return { subtotal, tax, total: taxable + tax };
  })();

  const submitCreate = async () => {
    if (!form.customerId) { setFormError(t('create.errors.customerRequired')); return; }
    const items = form.items
      .filter((i) => i.description.trim() || Number(i.unitPrice) > 0)
      .map((i) => ({
        description: i.description.trim() || undefined,
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unitPrice) || 0,
      }));
    if (items.length === 0) { setFormError(t('create.errors.itemsRequired')); return; }
    setCreating(true);
    setFormError('');
    try {
      await api.post('/quotations', {
        customerId: form.customerId,
        ...(form.title.trim() ? { title: form.title.trim() } : {}),
        currencyCode: form.currencyCode,
        taxRate: Number(form.taxRate) || 0,
        discountAmount: Number(form.discountAmount) || 0,
        ...(form.validUntil ? { validUntil: form.validUntil } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        items,
      });
      setCreateOpen(false);
      setPage(1);
      await load();
    } catch (e: any) {
      setFormError(e instanceof ApiError ? e.message : tc('errors.generic'));
    } finally {
      setCreating(false);
    }
  };

  // lifecycle
  const [sendTarget, setSendTarget] = useState<Quotation | null>(null);
  const [sending, setSending] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<Quotation | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Quotation | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Quotation | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [convertTarget, setConvertTarget] = useState<Quotation | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<{ proformaNumber: string } | null>(null);

  const doSend = async () => {
    if (!sendTarget) return;
    setSending(true);
    try {
      await api.post(`/quotations/${sendTarget.id}/send`, {});
      setSendTarget(null);
      setDetailOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
    } finally { setSending(false); }
  };

  const doAccept = async () => {
    if (!acceptTarget) return;
    setAccepting(true);
    try {
      await api.post(`/quotations/${acceptTarget.id}/accept`, {});
      setAcceptTarget(null);
      setDetailOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
    } finally { setAccepting(false); }
  };

  const doReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setRejecting(true);
    try {
      await api.post(`/quotations/${rejectTarget.id}/reject`, { rejectReason: rejectReason.trim() });
      setRejectTarget(null);
      setRejectReason('');
      setDetailOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
    } finally { setRejecting(false); }
  };

  const doCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await api.post(`/quotations/${cancelTarget.id}/cancel`, { cancelReason: cancelReason.trim() });
      setCancelTarget(null);
      setCancelReason('');
      setDetailOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
    } finally { setCancelling(false); }
  };

  const doConvert = async () => {
    if (!convertTarget) return;
    setConverting(true);
    try {
      const res = await api.post<{ proforma: { proformaNumber: string } }>(
        `/quotations/${convertTarget.id}/convert`, {}
      );
      setConvertResult({ proformaNumber: res.proforma.proformaNumber });
      setDetailOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
      setConvertTarget(null);
    } finally { setConverting(false); }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: tc('nav.home'), href: '/dashboard' }, { label: t('page.title') }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Quote className="size-6 text-primary" />
            {t('page.title')}
          </h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </div>
        {hasPermission('quotation:create') && (
          <Button onClick={() => void openCreate()}><Plus className="size-4" />{t('actions.create')}</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('list.title')}</CardTitle>
          <CardDescription>{t('list.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}>
              <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('list.search')} className="w-64" />
              <Button type="submit" variant="outline" size="sm">{tc('actions.search')}</Button>
            </form>
            <select className={SELECT_CLASS} value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}>
              <option value="ALL">{t('list.allStatuses')}</option>
              <option value="DRAFT">{t('status.DRAFT')}</option>
              <option value="SENT">{t('status.SENT')}</option>
              <option value="ACCEPTED">{t('status.ACCEPTED')}</option>
              <option value="REJECTED">{t('status.REJECTED')}</option>
              <option value="CANCELLED">{t('status.CANCELLED')}</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={convertibleOnly}
                onChange={(e) => { setConvertibleOnly(e.target.checked); setPage(1); }}
                className="size-4 rounded border-input" />
              {t('list.convertibleOnly')}
            </label>
            <span className="ms-auto text-sm text-muted-foreground">{tc('list.total')}: {meta.totalItems}</span>
          </div>

          {loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : rows.length === 0 ? (
            <EmptyState title={t('list.empty.title')} description={t('list.empty.description')} />
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground">
                      <th className="p-3 text-start font-medium">{t('fields.number')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.customer')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.issueDate')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.validUntil')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.total')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.convertedTo')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.status')}</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((q) => (
                      <tr key={q.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="p-3">
                          <button className="font-mono text-primary underline-offset-4 hover:underline"
                            onClick={() => void openDetail(q.id)}>{q.quotationNumber}</button>
                        </td>
                        <td className="p-3">{q.customer?.name ?? '—'}</td>
                        <td className="p-3">{q.issueDate ? formatDateShort(q.issueDate, locale) : '—'}</td>
                        <td className="p-3">{q.validUntil ? formatDateShort(q.validUntil, locale) : '—'}</td>
                        <td className="p-3 font-medium">
                          {money(q.totalAmount)} <span className="text-xs text-muted-foreground">{q.currencyCode}</span>
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {q.proforma?.proformaNumber ? (
                            <span className="text-primary">{q.proforma.proformaNumber}</span>
                          ) : '—'}
                        </td>
                        <td className="p-3"><Badge variant={statusVariant(q.status)}>{t(`status.${q.status}`)}</Badge></td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => void openDetail(q.id)}><Eye className="size-4" /></Button>
                            {q.status === 'DRAFT' && hasPermission('quotation:send') && (
                              <Button size="sm" variant="ghost" className="text-success-foreground" title={t('actions.send')}
                                onClick={() => setSendTarget(q)}><Send className="size-4" /></Button>
                            )}
                            {q.status === 'SENT' && hasPermission('quotation:accept') && (
                              <Button size="sm" variant="ghost" className="text-success-foreground" title={t('actions.accept')}
                                onClick={() => setAcceptTarget(q)}><CheckCircle2 className="size-4" /></Button>
                            )}
                            {q.status === 'SENT' && hasPermission('quotation:reject') && (
                              <Button size="sm" variant="ghost" className="text-destructive" title={t('actions.reject')}
                                onClick={() => { setRejectTarget(q); setRejectReason(''); }}><Ban className="size-4" /></Button>
                            )}
                            {q.status === 'ACCEPTED' && !q.proforma && hasPermission('quotation:convert') && (
                              <Button size="sm" variant="ghost" className="text-info-foreground" title={t('actions.convert')}
                                onClick={() => { setConvertTarget(q); setConvertResult(null); }}>
                                <ArrowRightLeft className="size-4" />
                              </Button>
                            )}
                            {(q.status === 'DRAFT' || q.status === 'SENT') && hasPermission('quotation:cancel') && (
                              <Button size="sm" variant="ghost" className="text-warning-foreground" title={t('actions.cancelOrder')}
                                onClick={() => { setCancelTarget(q); setCancelReason(''); }}><XCircle className="size-4" /></Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={meta.page} pageSize={meta.pageSize} totalItems={meta.totalItems} totalPages={meta.totalPages} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}
        title={t('create.title')} description={t('create.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{tc('actions.cancel')}</Button>
            <Button onClick={() => void submitCreate()} disabled={creating || customersLoading}>
              {creating ? t('create.creating') : tc('actions.save')}
            </Button>
          </>
        }>
        <div className="grid gap-4">
          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.customer')}</Label>
              <select className={SELECT_CLASS + ' w-full'} value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })} disabled={customersLoading}>
                <option value="">{customersLoading ? tc('list.loading') : t('create.selectCustomer')}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.currency')}</Label>
              <select className={SELECT_CLASS + ' w-full'} value={form.currencyCode}
                onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}>
                {['USD', 'AED', 'IRR', 'EUR', 'TRY', 'CNY'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.title')}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t('create.titlePlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.validUntil')}</Label>
              <Input type="date" value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.taxRate')}</Label>
              <Input type="number" min="0" max="100" step="0.5" value={form.taxRate}
                onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.discount')}</Label>
              <Input type="number" min="0" step="0.01" value={form.discountAmount}
                onChange={(e) => setForm({ ...form, discountAmount: e.target.value })} />
            </div>
          </div>

          {/* items */}
          <div className="space-y-2">
            <Label>{t('create.itemsTitle')}</Label>
            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_120px_36px] items-center gap-2">
                <Input placeholder={t('create.itemDescription')} value={item.description}
                  onChange={(e) => {
                    const items = [...form.items];
                    items[idx] = { ...items[idx], description: e.target.value };
                    setForm({ ...form, items });
                  }} />
                <Input type="number" min="1" placeholder={t('create.qty')} value={item.quantity}
                  onChange={(e) => {
                    const items = [...form.items];
                    items[idx] = { ...items[idx], quantity: e.target.value };
                    setForm({ ...form, items });
                  }} />
                <Input type="number" min="0" step="0.01" placeholder={t('create.unitPrice')} value={item.unitPrice}
                  onChange={(e) => {
                    const items = [...form.items];
                    items[idx] = { ...items[idx], unitPrice: e.target.value };
                    setForm({ ...form, items });
                  }} />
                <Button type="button" size="sm" variant="ghost" className="text-destructive"
                  onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline"
              onClick={() => setForm({ ...form, items: [...form.items, { description: '', quantity: '1', unitPrice: '' }] })}>
              <Plus className="size-4" />{t('create.addItem')}
            </Button>
          </div>

          {/* live totals */}
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between"><span>{t('totals.subtotal')}</span><span>{money(computedTotals.subtotal.toFixed(2))}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t('totals.tax')}</span><span>{money(computedTotals.tax.toFixed(2))}</span></div>
            <div className="mt-1 flex justify-between border-t pt-1 font-medium"><span>{t('totals.total')}</span><span>{money(computedTotals.total.toFixed(2))}</span></div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('fields.notes')}</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Dialog>

      {/* detail */}
      <Dialog open={detailOpen} onOpenChange={(o) => { setDetailOpen(o); if (!o) setDetail(null); }}
        title={detail ? detail.quotationNumber : t('detail.title')}>
        {detailLoading || !detail ? (
          <PageLoader />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(detail.status)}>{t(`status.${detail.status}`)}</Badge>
              {detail.proforma?.proformaNumber && (
                <Badge variant="outline">{t('detail.convertedBadge', { number: detail.proforma.proformaNumber })}</Badge>
              )}
              <span className="text-sm text-muted-foreground">{detail.customer?.name}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {detail.title && <div className="col-span-2"><dt className="text-muted-foreground">{t('fields.title')}</dt><dd className="font-medium">{detail.title}</dd></div>}
              <div><dt className="text-muted-foreground">{t('fields.issueDate')}</dt>
                <dd>{detail.issueDate ? formatDateTime(detail.issueDate, locale) : '—'}</dd></div>
              <div><dt className="text-muted-foreground">{t('fields.validUntil')}</dt>
                <dd>{detail.validUntil ? formatDateShort(detail.validUntil, locale) : '—'}</dd></div>
              <div><dt className="text-muted-foreground">{t('totals.subtotal')}</dt><dd>{money(detail.subtotal)}</dd></div>
              <div><dt className="text-muted-foreground">{t('totals.tax')}</dt><dd>{money(detail.taxAmount)} ({Number(detail.taxRate)}%)</dd></div>
              <div className="col-span-2 border-t pt-2"><dt className="text-muted-foreground">{t('totals.total')}</dt>
                <dd className="text-lg font-bold">{money(detail.totalAmount)} {detail.currencyCode}</dd></div>
              {detail.items && detail.items.length > 0 && (
                <div className="col-span-2">
                  <dt className="mb-1 text-muted-foreground">{t('detail.items')}</dt>
                  <dd>
                    <div className="overflow-hidden rounded-md border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40 text-muted-foreground">
                            <th className="p-2 text-start">#</th>
                            <th className="p-2 text-start">{t('fields.description')}</th>
                            <th className="p-2 text-end">{t('create.qty')}</th>
                            <th className="p-2 text-end">{t('create.unitPrice')}</th>
                            <th className="p-2 text-end">{t('detail.lineTotal')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.items.map((it) => (
                            <tr key={it.id} className="border-b last:border-b-0">
                              <td className="p-2">{it.sequence}</td>
                              <td className="p-2">{it.description ?? '—'}</td>
                              <td className="p-2 text-end">{it.quantity}</td>
                              <td className="p-2 text-end">{money(it.unitPrice)}</td>
                              <td className="p-2 text-end">{money(it.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </dd>
                </div>
              )}
              {detail.notes && <div className="col-span-2"><dt className="text-muted-foreground">{t('fields.notes')}</dt><dd>{detail.notes}</dd></div>}
              {detail.rejectReason && (
                <div className="col-span-2"><dt className="text-muted-foreground">{t('fields.rejectReason')}</dt>
                  <dd className="text-destructive">{detail.rejectReason}</dd></div>
              )}
              {detail.cancelReason && (
                <div className="col-span-2"><dt className="text-muted-foreground">{t('fields.cancelReason')}</dt>
                  <dd className="text-destructive">{detail.cancelReason}</dd></div>
              )}
            </dl>
          </div>
        )}
      </Dialog>

      {/* send confirm */}
      <ConfirmDialog
        open={!!sendTarget} onOpenChange={(o) => { if (!o) setSendTarget(null); }}
        title={t('confirm.send.title')} description={t('confirm.send.description')}
        confirmLabel={t('actions.send')} loading={sending}
        onConfirm={() => void doSend()}
      />

      {/* accept confirm */}
      <ConfirmDialog
        open={!!acceptTarget} onOpenChange={(o) => { if (!o) setAcceptTarget(null); }}
        title={t('confirm.accept.title')} description={t('confirm.accept.description')}
        confirmLabel={t('actions.accept')} loading={accepting}
        onConfirm={() => void doAccept()}
      />

      {/* reject with reason */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) setRejectTarget(null); }}
        title={t('confirm.reject.title')} description={t('confirm.reject.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>{tc('actions.cancel')}</Button>
            <Button variant="destructive" disabled={rejecting || !rejectReason.trim()} onClick={() => void doReject()}>
              {rejecting ? t('actions.rejecting') : t('actions.reject')}
            </Button>
          </>
        }>
        <div className="space-y-1.5">
          <Label>{t('confirm.reject.reason')}</Label>
          <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('confirm.reject.reasonPlaceholder')} />
        </div>
      </Dialog>

      {/* cancel with reason */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null); }}
        title={t('confirm.cancel.title')} description={t('confirm.cancel.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>{tc('actions.cancel')}</Button>
            <Button variant="destructive" disabled={cancelling || !cancelReason.trim()} onClick={() => void doCancel()}>
              {cancelling ? t('actions.cancelling') : t('actions.cancelOrder')}
            </Button>
          </>
        }>
        <div className="space-y-1.5">
          <Label>{t('confirm.cancel.reason')}</Label>
          <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t('confirm.cancel.reasonPlaceholder')} />
        </div>
      </Dialog>

      {/* convert confirm + result */}
      <Dialog open={!!convertTarget} onOpenChange={(o) => { if (!o) { setConvertTarget(null); setConvertResult(null); } }}
        title={convertResult ? t('convert.resultTitle') : t('convert.title')}
        description={convertResult ? undefined : t('convert.description')}
        footer={
          convertResult ? (
            <Button onClick={() => { setConvertTarget(null); setConvertResult(null); }}>{tc('actions.save')}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setConvertTarget(null)}>{tc('actions.cancel')}</Button>
              <Button onClick={() => void doConvert()} disabled={converting}>
                {converting ? t('convert.converting') : t('actions.convert')}
              </Button>
            </>
          )
        }>
        {convertResult ? (
          <div className="rounded-md border border-success/40 bg-success/10 p-3 text-sm">
            <p>{t('convert.resultLine', { number: convertResult.proformaNumber })}</p>
            <p className="mt-1 text-muted-foreground">{t('convert.resultHint')}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {convertTarget ? t('convert.body', {
              number: convertTarget.quotationNumber,
              total: money(convertTarget.totalAmount),
              currency: convertTarget.currencyCode,
            }) : ''}
          </p>
        )}
      </Dialog>
    </div>
  );
}
