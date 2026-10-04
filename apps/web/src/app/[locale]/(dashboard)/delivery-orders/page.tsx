'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import type {
  DeliveryOrder,
  DeliveryOrderListResult,
  DeliveryReleaseStatus,
  BillOfLading,
  PaginatedResult,
} from '@shipping/shared';
import { Plus, Eye, XCircle, Trash2, Truck } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateShort, formatDateTime } from '@/lib/date';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog } from '@/components/ui/dialog';
import { PageLoader } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';

const PAGE_SIZE = 20;

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-card px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring';

function statusVariant(s: DeliveryReleaseStatus): 'success' | 'danger' {
  return s === 'ISSUED' ? 'success' : 'danger';
}

export default function DeliveryOrdersPage() {
  const t = useTranslations('deliveryOrder');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { hasPermission } = useAuth();

  const [rows, setRows] = useState<DeliveryOrder[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DeliveryReleaseStatus>('ALL');

  const [bills, setBills] = useState<BillOfLading[]>([]);
  const [detail, setDetail] = useState<DeliveryOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ billOfLadingId: '', recipient: '', vehiclePlate: '', notes: '' });
  const [cancelTarget, setCancelTarget] = useState<DeliveryOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await api.get<DeliveryOrderListResult>(`/delivery-orders?${params.toString()}`);
      setRows(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, tc]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!createOpen) return;
    void (async () => {
      try {
        const res = await api.get<PaginatedResult<BillOfLading>>('/bills?status=APPROVED&pageSize=100');
        setBills(res.data);
      } catch { /* best-effort */ }
    })();
  }, [createOpen]);

  const openCreate = () => {
    setForm({ billOfLadingId: '', recipient: '', vehiclePlate: '', notes: '' });
    setFormError('');
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!form.billOfLadingId) { setFormError(t('create.errors.billRequired')); return; }
    if (!form.recipient.trim()) { setFormError(t('create.errors.recipientRequired')); return; }
    setCreating(true);
    setFormError('');
    try {
      await api.post('/delivery-orders', {
        billOfLadingId: form.billOfLadingId,
        recipient: form.recipient.trim(),
        ...(form.vehiclePlate ? { vehiclePlate: form.vehiclePlate } : {}),
        ...(form.notes ? { notes: form.notes } : {}),
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
      const d = await api.get<DeliveryOrder>(`/delivery-orders/${id}`);
      setDetail(d);
      setDetailOpen(true);
    } catch { /* handled globally */ }
  };

  const doCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    setBusy(true);
    try {
      await api.post(`/delivery-orders/${cancelTarget.id}/cancel`, { reason: cancelReason });
      setCancelTarget(null);
      setCancelReason('');
      if (detailOpen) setDetailOpen(false);
      await load();
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.del(`/delivery-orders/${deleteTarget.id}`);
      setDeleteTarget(null);
      await load();
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: tc('nav.home'), href: '/dashboard' }, { label: t('page.title') }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Truck className="size-6 text-primary" />
            {t('page.title')}
          </h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </div>
        {hasPermission('delivery:create') && (
          <Button onClick={openCreate}><Plus className="size-4" />{t('actions.create')}</Button>
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
              <option value="ISSUED">{t('status.ISSUED')}</option>
              <option value="CANCELLED">{t('status.CANCELLED')}</option>
            </select>
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
                      <th className="p-3 text-start font-medium">{t('fields.docNumber')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.bill')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.recipient')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.vehiclePlate')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.issueDate')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.status')}</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((d) => (
                      <tr key={d.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="p-3">
                          <button className="font-mono text-primary underline-offset-4 hover:underline"
                            onClick={() => void openDetail(d.id)}>{d.docNumber}</button>
                        </td>
                        <td className="p-3 font-mono text-xs">{d.billOfLading?.billNumber ?? '—'}</td>
                        <td className="p-3">{d.recipient}</td>
                        <td className="p-3 font-mono text-xs">{d.vehiclePlate ?? '—'}</td>
                        <td className="p-3">{formatDateShort(d.issueDate, locale)}</td>
                        <td className="p-3"><Badge variant={statusVariant(d.status)}>{t(`status.${d.status}`)}</Badge></td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => void openDetail(d.id)}><Eye className="size-4" /></Button>
                            {d.status === 'ISSUED' && hasPermission('delivery:cancel') && (
                              <Button size="sm" variant="ghost" className="text-warning-foreground"
                                onClick={() => { setCancelTarget(d); setCancelReason(''); }}><XCircle className="size-4" /></Button>
                            )}
                            {d.status === 'CANCELLED' && hasPermission('delivery:delete') && (
                              <Button size="sm" variant="ghost" className="text-destructive"
                                onClick={() => setDeleteTarget(d)}><Trash2 className="size-4" /></Button>
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
            <Button onClick={() => void submitCreate()} disabled={creating}>
              {creating ? t('create.creating') : tc('actions.save')}
            </Button>
          </>
        }>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>{t('fields.bill')}</Label>
            <select className={SELECT_CLASS + ' w-full'} value={form.billOfLadingId}
              onChange={(e) => setForm({ ...form, billOfLadingId: e.target.value })}>
              <option value="">{t('create.selectBill')}</option>
              {bills.map((b) => <option key={b.id} value={b.id}>{b.billNumber}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.recipient')}</Label>
            <Input value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })}
              placeholder={t('create.recipientPlaceholder')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.vehiclePlate')}</Label>
            <Input value={form.vehiclePlate} onChange={(e) => setForm({ ...form, vehiclePlate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.notes')}</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </div>
      </Dialog>

      {/* detail */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen} title={detail ? detail.docNumber : ''}>
        {detail ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(detail.status)}>{t(`status.${detail.status}`)}</Badge>
              <span className="font-mono text-xs text-muted-foreground">{detail.billOfLading?.billNumber}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-muted-foreground">{t('fields.recipient')}</dt>
                <dd className="font-medium">{detail.recipient}</dd></div>
              <div><dt className="text-muted-foreground">{t('fields.vehiclePlate')}</dt>
                <dd className="font-mono text-xs">{detail.vehiclePlate ?? '—'}</dd></div>
              <div><dt className="text-muted-foreground">{t('fields.issueDate')}</dt>
                <dd>{formatDateTime(detail.issueDate, locale)}</dd></div>
              <div><dt className="text-muted-foreground">{t('fields.notes')}</dt>
                <dd>{detail.notes ?? '—'}</dd></div>
              {detail.cancelReason && (
                <div className="col-span-2"><dt className="text-muted-foreground">{t('fields.cancelReason')}</dt>
                  <dd className="text-destructive">{detail.cancelReason}</dd></div>
              )}
            </dl>
          </div>
        ) : <PageLoader />}
      </Dialog>

      {/* cancel */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null); }}
        title={t('confirm.cancel.title')} description={t('confirm.cancel.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>{tc('actions.cancel')}</Button>
            <Button variant="destructive" disabled={busy || !cancelReason.trim()} onClick={() => void doCancel()}>
              {busy ? t('actions.cancelling') : t('actions.cancelOrder')}
            </Button>
          </>
        }>
        <div className="space-y-1.5">
          <Label>{t('confirm.cancel.reason')}</Label>
          <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t('confirm.cancel.reasonPlaceholder')} />
        </div>
      </Dialog>

      {/* delete */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title={t('confirm.delete.title')} description={t('confirm.delete.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{tc('actions.cancel')}</Button>
            <Button variant="destructive" disabled={busy} onClick={() => void doDelete()}>
              {busy ? tc('list.loading') : tc('actions.delete')}
            </Button>
          </>
        } />
    </div>
  );
}
