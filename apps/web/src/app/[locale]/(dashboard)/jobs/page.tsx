'use client';
import { TableScroll } from '@/components/ui/table-scroll';

import { useLocale as useUiLocale } from 'next-intl';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { Job, JobListResult, JobStatus, JobItemKind, JobCostItem } from '@shipping/shared';
import { api, ApiError } from '@/lib/api/client';
import { formatDateTime, formatDateShort } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { PageLoader } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import {
  Eye,
  Pencil,
  Trash2,
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

const PAGE_SIZE = 20;

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-card px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring';

const JOB_STATUSES: JobStatus[] = ['DRAFT', 'OPEN', 'COMPLETED', 'CANCELLED'];
const ITEM_KINDS: JobItemKind[] = ['INCOME', 'COST'];
const CURRENCIES = ['USD', 'IRR', 'AED', 'EUR', 'TRY', 'CNY'];
const JOB_TYPES = ['IMPORT_CLEARANCE', 'EXPORT', 'TRANSIT', 'CUSTOMS', 'TRANSPORT', 'OTHER'];

function statusVariant(s: JobStatus): 'info' | 'success' | 'danger' | 'outline' {
  if (s === 'OPEN') return 'info';
  if (s === 'COMPLETED') return 'success';
  if (s === 'CANCELLED') return 'danger';
  return 'outline';
}

function money(v: string | number, displayLocale: string): string {
  return Number(v).toLocaleString(displayLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function dateShort(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

type Ref = { id: string; code?: string; name?: string; voyageNumber?: string };

const emptyForm = {
  title: '',
  description: '',
  jobType: '',
  customerId: '',
  voyageId: '',
  currencyCode: 'USD',
  notes: '',
};

const emptyItem = {
  kind: 'COST' as JobItemKind,
  category: '',
  description: '',
  amount: '',
  itemDate: '',
  notes: '',
};

export default function JobsPage() {
  const uiLocale = useUiLocale();
  const t = useTranslations('jobs');
  const tc = useTranslations('common');
  const locale = useLocale();

  const [rows, setRows] = useState<Job[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const [customers, setCustomers] = useState<Ref[]>([]);
  const [voyages, setVoyages] = useState<Ref[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Job | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const [itemForm, setItemForm] = useState(emptyItem);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<Job | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await api.get<JobListResult>(`/jobs?${params.toString()}`);
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tc('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const c = await api.get<{ data: Ref[] }>('/customers?pageSize=100');
        setCustomers(c.data);
        const v = await api.get<{ data: Ref[] }>('/voyages?pageSize=100');
        setVoyages(v.data);
      } catch {
        /* selects stay empty */
      }
    })();
  }, []);

  // ── create / edit ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setCreateOpen(true);
  };

  const openEdit = (j: Job) => {
    setEditing(j);
    setForm({
      title: j.title,
      description: (j as unknown as { description?: string }).description ?? '',
      jobType: j.jobType ?? '',
      customerId: j.customerId ?? '',
      voyageId: j.voyageId ?? '',
      currencyCode: j.currencyCode,
      notes: j.notes ?? '',
    });
    setFormError(null);
    setCreateOpen(true);
  };

  const submit = async () => {
    if (!form.title.trim()) {
      setFormError(t('form.errors.titleRequired'));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description || undefined,
        jobType: form.jobType || undefined,
        customerId: form.customerId || undefined,
        voyageId: form.voyageId || undefined,
        currencyCode: form.currencyCode,
        notes: form.notes || undefined,
      };
      if (editing) await api.patch(`/jobs/${editing.id}`, payload);
      else await api.post('/jobs', payload);
      setCreateOpen(false);
      setPage(1);
      void load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : tc('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  // ── detail + items ─────────────────────────────────────────────────────────

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    setItemForm(emptyItem);
    setEditingItemId(null);
    setItemError(null);
    try {
      setDetail(await api.get<Job>(`/jobs/${id}`));
    } catch {
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = useCallback(async (id: string) => {
    try {
      setDetail(await api.get<Job>(`/jobs/${id}`));
    } catch {
      /* keep stale */
    }
  }, []);

  const itemsEditable = (j: Job | null) => !!j && (j.status === 'DRAFT' || j.status === 'OPEN');

  const submitItem = async () => {
    if (!detail) return;
    if (!itemForm.description.trim() || !itemForm.amount) {
      setItemError(t('items.errors.descAmountRequired'));
      return;
    }
    setActing(true);
    setItemError(null);
    try {
      const payload = {
        kind: itemForm.kind,
        category: itemForm.category || undefined,
        description: itemForm.description.trim(),
        amount: itemForm.amount,
        itemDate: itemForm.itemDate || undefined,
        notes: itemForm.notes || undefined,
      };
      if (editingItemId) await api.patch(`/jobs/${detail.id}/items/${editingItemId}`, payload);
      else await api.post(`/jobs/${detail.id}/items`, payload);
      setItemForm(emptyItem);
      setEditingItemId(null);
      await refreshDetail(detail.id);
    } catch (e) {
      setItemError(e instanceof ApiError ? e.message : tc('errors.generic'));
    } finally {
      setActing(false);
    }
  };

  const editItem = (it: JobCostItem) => {
    setEditingItemId(it.id);
    setItemForm({
      kind: it.kind,
      category: it.category ?? '',
      description: it.description,
      amount: String(Number(it.amount)),
      itemDate: it.itemDate ? dateShort(it.itemDate) : '',
      notes: it.notes ?? '',
    });
  };

  const removeItem = async (itemId: string) => {
    if (!detail) return;
    setActing(true);
    try {
      await api.del(`/jobs/${detail.id}/items/${itemId}`);
      await refreshDetail(detail.id);
    } finally {
      setActing(false);
    }
  };

  const act = async (fn: () => Promise<unknown>) => {
    if (!detail) return;
    setActing(true);
    try {
      await fn();
      await refreshDetail(detail.id);
      void load();
    } catch {
      void load();
    } finally {
      setActing(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('page.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('page.description')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="me-1.5 h-4 w-4" />
          {t('actions.create')}
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
              setPage(1);
            }}
          >
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('list.search')}
              className="w-56"
            />
            <Button type="submit" variant="outline" size="sm">
              {tc('actions.search')}
            </Button>
          </form>
          <select
            className={SELECT_CLASS}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">{t('list.allStatuses')}</option>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
          <span className="ms-auto text-sm text-muted-foreground">
            {tc('list.total')}: {meta.totalItems}
          </span>
        </CardContent>
      </Card>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('list.empty.title')} description={t('list.empty.description')} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <TableScroll className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="p-3 text-start">{t('fields.number')}</th>
                    <th className="p-3 text-start">{t('fields.title')}</th>
                    <th className="p-3 text-start">{t('fields.customer')}</th>
                    <th className="p-3 text-start">{t('fields.voyage')}</th>
                    <th className="p-3 text-start">{t('fields.status')}</th>
                    <th className="p-3 text-end">{t('fields.income')}</th>
                    <th className="p-3 text-end">{t('fields.cost')}</th>
                    <th className="p-3 text-end">{t('fields.profit')}</th>
                    <th className="p-3 text-end">{tc('actions.title')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((j) => (
                    <tr key={j.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="whitespace-nowrap p-3 font-mono text-xs">
                        {j.jobNumber}
                        <div className="text-[10px] text-muted-foreground">
                          {formatDateShort(j.openingDate, locale)}
                        </div>
                      </td>
                      <td className="max-w-[240px] truncate p-3" title={j.title}>
                        {j.title}
                        {j.jobType ? (
                          <span className="ms-1 text-[10px] text-muted-foreground">
                            ({j.jobType})
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[140px] truncate p-3">{j.customer?.name ?? '—'}</td>
                      <td className="p-3 font-mono text-xs">{j.voyage?.voyageNumber ?? '—'}</td>
                      <td className="p-3">
                        <Badge variant={statusVariant(j.status)}>{t(`status.${j.status}`)}</Badge>
                      </td>
                      <td className="p-3 text-end text-success">
                        <span className="inline-flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {money(j.totalIncome ?? '0', uiLocale)}
                        </span>
                      </td>
                      <td className="p-3 text-end text-red-600">
                        <span className="inline-flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          {money(j.totalCost ?? '0', uiLocale)}
                        </span>
                      </td>
                      <td className="p-3 text-end font-semibold">
                        {money(j.profit ?? '0', uiLocale)}{' '}
                        <span className="text-[10px] text-muted-foreground">{j.currencyCode}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('actions.view')}
                            onClick={() => void openDetail(j.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(j.status === 'DRAFT' || j.status === 'OPEN') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t('actions.edit')}
                              onClick={() => openEdit(j)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {j.status === 'DRAFT' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={tc('actions.delete')}
                              onClick={() => setDeleteTarget(j)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <div className="p-3">
              <Pagination
                page={meta.page}
                pageSize={meta.pageSize}
                totalItems={meta.totalItems}
                totalPages={meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* create / edit dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          if (!saving) setCreateOpen(o);
        }}
        title={editing ? t('form.editTitle') : t('form.title')}
        description={t('form.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              {tc('actions.cancel')}
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? tc('actions.saving') : tc('actions.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="space-y-1.5">
            <Label>{t('fields.title')} *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.jobType')}</Label>
              <select
                className={SELECT_CLASS + ' w-full'}
                value={form.jobType}
                onChange={(e) => setForm({ ...form, jobType: e.target.value })}
              >
                <option value="">{t('form.noType')}</option>
                {JOB_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {t(`type.${x}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.currency')}</Label>
              <select
                className={SELECT_CLASS + ' w-full'}
                value={form.currencyCode}
                onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.customer')}</Label>
              <select
                className={SELECT_CLASS + ' w-full'}
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              >
                <option value="">{t('form.noCustomer')}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.voyage')}</Label>
              <select
                className={SELECT_CLASS + ' w-full'}
                value={form.voyageId}
                onChange={(e) => setForm({ ...form, voyageId: e.target.value })}
              >
                <option value="">{t('form.noVoyage')}</option>
                {voyages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.voyageNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.description')}</Label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-input bg-card p-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.notes')}</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
      </Dialog>

      {/* detail dialog */}
      <Dialog
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setDetail(null);
        }}
        title={detail ? `${detail.jobNumber} — ${detail.title}` : t('detail.title')}
        footer={
          detail && (
            <div className="flex flex-wrap justify-end gap-2">
              {detail.status === 'DRAFT' && (
                <Button
                  variant="outline"
                  onClick={() => void act(() => api.post(`/jobs/${detail.id}/start`))}
                  disabled={acting}
                >
                  <Play className="me-1.5 h-4 w-4" />
                  {t('actions.start')}
                </Button>
              )}
              {detail.status === 'OPEN' && (
                <Button
                  onClick={() => void act(() => api.post(`/jobs/${detail.id}/complete`))}
                  disabled={acting}
                >
                  <CheckCircle2 className="me-1.5 h-4 w-4" />
                  {t('actions.complete')}
                </Button>
              )}
              {(detail.status === 'DRAFT' || detail.status === 'OPEN') && (
                <Button variant="outline" onClick={() => setCancelTarget(detail)} disabled={acting}>
                  <XCircle className="me-1.5 h-4 w-4" />
                  {t('actions.cancel')}
                </Button>
              )}
            </div>
          )
        }
      >
        {detailLoading || !detail ? (
          <PageLoader />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(detail.status)}>{t(`status.${detail.status}`)}</Badge>
              {detail.jobType ? (
                <Badge variant="outline">{t(`type.${detail.jobType}`)}</Badge>
              ) : null}
              <span className="text-sm text-muted-foreground">
                {t('fields.customer')}: {detail.customer?.name ?? '—'}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {detail.voyage?.voyageNumber ?? ''}
              </span>
            </div>
            {detail.description && <p className="text-sm">{detail.description}</p>}

            {/* items table */}
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="p-2 text-start">{t('items.kind')}</th>
                    <th className="p-2 text-start">{t('items.description')}</th>
                    <th className="p-2 text-start">{t('items.category')}</th>
                    <th className="p-2 text-end">{t('items.amount')}</th>
                    {itemsEditable(detail) && (
                      <th className="p-2 text-end">{tc('actions.title')}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(detail.items ?? []).map((it) => (
                    <tr key={it.id} className="border-b last:border-0">
                      <td className="p-2">
                        <Badge variant={it.kind === 'INCOME' ? 'success' : 'danger'}>
                          {t(`items.${it.kind}`)}
                        </Badge>
                      </td>
                      <td className="p-2">
                        {it.description}
                        {it.itemDate ? (
                          <span className="ms-1 text-[10px] text-muted-foreground">
                            {formatDateShort(it.itemDate, locale)}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-2 text-xs">{it.category ?? '—'}</td>
                      <td className="p-2 text-end font-mono">{money(it.amount, uiLocale)}</td>
                      {itemsEditable(detail) && (
                        <td className="p-2 text-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => editItem(it)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => void removeItem(it.id)}
                            disabled={acting}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 text-sm font-semibold">
                    <td className="p-2" colSpan={3}>
                      {t('items.totals')}
                    </td>
                    <td className="p-2 text-end">
                      {t('fields.income')}: {money(detail.totalIncome ?? '0', uiLocale)} ·{' '}
                      {t('fields.cost')}: {money(detail.totalCost ?? '0', uiLocale)} ·{' '}
                      {t('fields.profit')}: {money(detail.profit ?? '0', uiLocale)}{' '}
                      {detail.currencyCode}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* add / edit item form */}
            {itemsEditable(detail) && (
              <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {editingItemId ? t('items.editing') : t('items.addTitle')}
                </p>
                {itemError && <p className="text-sm text-destructive">{itemError}</p>}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <select
                    className={SELECT_CLASS}
                    value={itemForm.kind}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, kind: e.target.value as JobItemKind })
                    }
                  >
                    {ITEM_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(`items.${k}`)}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder={t('items.category')}
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  />
                  <Input
                    placeholder={t('items.description')}
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  />
                  <Input
                    placeholder={t('items.amount')}
                    value={itemForm.amount}
                    onChange={(e) => setItemForm({ ...itemForm, amount: e.target.value })}
                    inputMode="decimal"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Input
                    type="date"
                    value={itemForm.itemDate}
                    onChange={(e) => setItemForm({ ...itemForm, itemDate: e.target.value })}
                    className="w-44"
                  />
                  <div className="flex gap-2">
                    {editingItemId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingItemId(null);
                          setItemForm(emptyItem);
                        }}
                      >
                        {tc('actions.cancel')}
                      </Button>
                    )}
                    <Button size="sm" onClick={() => void submitItem()} disabled={acting}>
                      {editingItemId ? tc('actions.save') : t('items.add')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              <div>
                {t('detail.openedOn')}: {formatDateTime(detail.openingDate, locale)}
              </div>
              {detail.completedAt && (
                <div>
                  {t('detail.completedOn')}: {formatDateTime(detail.completedAt, locale)}
                </div>
              )}
              {detail.cancelledAt && (
                <div>
                  {t('detail.cancelledOn')}: {formatDateTime(detail.cancelledAt, locale)} —{' '}
                  {detail.cancelReason}
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>

      {/* cancel with reason */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(o) => {
          if (!o) setCancelTarget(null);
        }}
        title={t('cancel.title')}
        description={t('cancel.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={acting}>
              {tc('actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={acting || !cancelReason.trim()}
              onClick={() =>
                void (async () => {
                  if (!cancelTarget) return;
                  const id = cancelTarget.id;
                  setCancelTarget(null);
                  await act(() => api.post(`/jobs/${id}/cancel`, { cancelReason }));
                })()
              }
            >
              {acting ? tc('actions.saving') : t('actions.cancel')}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label>{t('cancel.reason')}</Label>
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t('cancel.reasonPlaceholder')}
          />
        </div>
      </Dialog>

      {/* delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={t('confirm.delete.title')}
        description={
          deleteTarget ? t('confirm.delete.description', { number: deleteTarget.jobNumber }) : ''
        }
        confirmLabel={tc('actions.delete')}
        loading={acting}
        onConfirm={() =>
          void (async () => {
            const target = deleteTarget;
            setDeleteTarget(null);
            await act(() => api.del(`/jobs/${target?.id}`));
          })()
        }
        error={formError}
      />
    </div>
  );
}
