'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type {
  Discharge,
  DischargeItem,
  DischargeStatus,
  PaginatedResult,
  ActualLoading,
} from '@shipping/shared';
import { PackageMinus, Plus, Eye, CheckCircle2, XCircle, Play, Save, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateTime } from '@/lib/date';
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

const PAGE_SIZE = 25;

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-card px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring';

const STATUSES: DischargeStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const RESULT_META: Record<string, { variant: 'neutral' | 'success' | 'warning' }> = {
  FULL: { variant: 'success' },
  PARTIAL: { variant: 'warning' },
  NOT_DISCHARGED: { variant: 'neutral' },
};

function statusVariant(s: DischargeStatus): 'neutral' | 'info' | 'success' | 'danger' {
  if (s === 'IN_PROGRESS') return 'info';
  if (s === 'COMPLETED') return 'success';
  if (s === 'CANCELLED') return 'danger';
  return 'neutral';
}

interface ItemDraft {
  [itemId: string]: string;
}

export default function DischargePage() {
  const t = useTranslations('discharge');
  const tc = useTranslations('common');
  const nav = useTranslations('nav');
  const { hasPermission } = useAuth();
  const locale = useLocale();

  const [data, setData] = useState<PaginatedResult<Discharge> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [completedLoadings, setCompletedLoadings] = useState<ActualLoading[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ actualLoadingId: '', notes: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<Discharge | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [itemDrafts, setItemDrafts] = useState<ItemDraft>({});

  const [confirmStart, setConfirmStart] = useState<Discharge | null>(null);
  const [confirmComplete, setConfirmComplete] = useState<Discharge | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Discharge | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Discharge | null>(null);

  const canCreate = hasPermission('discharge:create');
  const canUpdate = hasPermission('discharge:update');
  const canComplete = hasPermission('discharge:complete');
  const canCancel = hasPermission('discharge:cancel');
  const canDelete = hasPermission('discharge:delete');

  const load = useCallback(
    async (
      p = page,
      s = search,
      st = statusFilter,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
        if (s) params.set('search', s);
        if (st) params.set('status', st);
        const res = await api.get<PaginatedResult<Discharge>>(`/discharge?${params.toString()}`);
        setData(res);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : tc('errors.generic'));
      } finally {
        setLoading(false);
      }
    },
    [page, search, statusFilter, tc],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!createOpen) return;
    (async () => {
      try {
        const [alRes, dsRes] = await Promise.all([
          api.get<PaginatedResult<ActualLoading>>('/actual-loading?status=COMPLETED&pageSize=100'),
          api.get<PaginatedResult<Discharge>>('/discharge?pageSize=100'),
        ]);
        const consumed = new Set(dsRes.data.map((d) => d.actualLoadingId));
        setCompletedLoadings(alRes.data.filter((a) => !consumed.has(a.id)));
      } catch {
        setCompletedLoadings([]);
      }
    })();
  }, [createOpen]);

  function openCreate() {
    setFormError(null);
    setCreateForm({ actualLoadingId: '', notes: '' });
    setCreateOpen(true);
  }

  async function submitCreate() {
    setFormError(null);
    if (!createForm.actualLoadingId) {
      setFormError(t('create.errors.loadingRequired'));
      return;
    }
    setSaving(true);
    try {
      await api.post<Discharge>('/discharge', {
        actualLoadingId: createForm.actualLoadingId,
        notes: createForm.notes.trim() || undefined,
      });
      setCreateOpen(false);
      await load(1, search, statusFilter);
      setPage(1);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tc('errors.generic'));
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(row: Discharge) {
    setDetail(null);
    setFormError(null);
    setItemDrafts({});
    setDetailOpen(true);
    try {
      const d = await api.get<Discharge>(`/discharge/${row.id}`);
      setDetail(d);
      setItemDrafts(
        Object.fromEntries(
          (d.items ?? []).map((it) => [it.id, it.dischargeQuantity === null ? '' : String(it.dischargeQuantity)]),
        ),
      );
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tc('errors.generic'));
      setDetailOpen(false);
    }
  }

  async function refreshDetail() {
    if (!detail) return;
    try {
      const d = await api.get<Discharge>(`/discharge/${detail.id}`);
      setDetail(d);
      setItemDrafts(
        Object.fromEntries(
          (d.items ?? []).map((it) => [it.id, it.dischargeQuantity === null ? '' : String(it.dischargeQuantity)]),
        ),
      );
    } catch {
      /* keep stale detail */
    }
  }

  function updateDraft(itemId: string, value: string) {
    setItemDrafts((prev) => ({ ...prev, [itemId]: value }));
  }

  function parseDraft(raw: string): number | undefined {
    if (raw.trim() === '') return undefined;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return NaN;
    return n;
  }

  async function submitItem(item: DischargeItem) {
    if (!detail) return;
    const qty = parseDraft(itemDrafts[item.id] ?? '');
    const expected = item.expectedQuantity ?? null;
    if (qty !== undefined && (Number.isNaN(qty) || qty < 0)) {
      setFormError(t('items.errors.nonnegative'));
      return;
    }
    if (qty !== undefined && expected !== null && qty > expected) {
      setFormError(t('items.errors.exceeds', { expected }));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api.patch<Discharge>(`/discharge/${detail.id}/items/${item.id}`, {
        dischargeQuantity: qty,
        notes: item.notes ?? undefined,
      });
      await refreshDetail();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : tc('errors.generic'));
    } finally {
      setSaving(false);
    }
  }

  async function act(fn: () => Promise<unknown>) {
    setSaving(true);
    try {
      await fn();
      await refreshDetail();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tc('errors.generic'));
    } finally {
      setSaving(false);
    }
  }

  const rows = data?.data ?? [];
  const meta = data?.meta ?? { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 };
  const editable = (d: Discharge | null) => !!d && (d.status === 'NOT_STARTED' || d.status === 'IN_PROGRESS');

  function voyageOf(d: Discharge): string {
    return d.actualLoading?.loadList?.voyage?.voyageNumber ?? '—';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('page.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('page.description')}</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="me-1.5 h-4 w-4" />
            {t('actions.create')}
          </Button>
        )}
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
            <option value="">{t('list.allStatuses')}</option>
            {STATUSES.map((s) => (
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="p-3 text-start">{t('fields.number')}</th>
                    <th className="p-3 text-start">{t('fields.loading')}</th>
                    <th className="p-3 text-start">{t('fields.voyage')}</th>
                    <th className="p-3 text-start">{t('fields.vessel')}</th>
                    <th className="p-3 text-start">{t('fields.status')}</th>
                    <th className="p-3 text-end">{t('fields.lines')}</th>
                    <th className="p-3 text-end">{t('fields.expected')}</th>
                    <th className="p-3 text-end">{t('fields.discharged')}</th>
                    <th className="p-3 text-end">{tc('actions.title')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="whitespace-nowrap p-3 font-mono text-xs">
                        {d.dischargeNumber}
                        <div className="text-[10px] text-muted-foreground">
                          {d.createdAt ? formatDateTime(d.createdAt, locale) : ''}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs">{d.actualLoading?.actualLoadingNumber ?? '—'}</td>
                      <td className="p-3 font-mono text-xs">{voyageOf(d)}</td>
                      <td className="max-w-[160px] truncate p-3">
                        {d.actualLoading?.loadList?.voyage?.vessel?.name ?? '—'}
                      </td>
                      <td className="p-3">
                        <Badge variant={statusVariant(d.status)}>{t(`status.${d.status}`)}</Badge>
                      </td>
                      <td className="p-3 text-end">{d.itemsCount ?? 0}</td>
                      <td className="p-3 text-end font-mono">{d.expectedTotal ?? 0}</td>
                      <td className="p-3 text-end font-mono">
                        <span className={((d.dischargedTotal ?? 0) < (d.expectedTotal ?? 0)) ? 'text-amber-600' : 'text-green-600'}>
                          {d.dischargedTotal ?? 0}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" title={t('actions.view')} onClick={() => void openDetail(d)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {d.status === 'NOT_STARTED' && canUpdate && (
                            <Button variant="ghost" size="icon" title={t('actions.start')} onClick={() => setConfirmStart(d)}>
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {d.status === 'IN_PROGRESS' && canComplete && (
                            <Button variant="ghost" size="icon" title={t('actions.complete')} onClick={() => setConfirmComplete(d)}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          {editable(d) && canCancel && (
                            <Button variant="ghost" size="icon" title={t('actions.cancel')} onClick={() => setConfirmCancel(d)}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {editable(d) && canDelete && (
                            <Button variant="ghost" size="icon" title={tc('actions.delete')} onClick={() => setConfirmDelete(d)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

      {/* create dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          if (!saving) setCreateOpen(o);
        }}
        title={t('create.title')}
        description={t('create.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              {tc('actions.cancel')}
            </Button>
            <Button onClick={() => void submitCreate()} disabled={saving}>
              {saving ? tc('actions.saving') : tc('actions.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="space-y-1.5">
            <Label>{t('create.loadingLabel')}</Label>
            <select
              className={SELECT_CLASS + ' w-full'}
              value={createForm.actualLoadingId}
              onChange={(e) => setCreateForm({ ...createForm, actualLoadingId: e.target.value })}
            >
              <option value="">{t('create.loadingPlaceholder')}</option>
              {completedLoadings.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.actualLoadingNumber} — {a.loadList?.voyage?.voyageNumber ?? ''}
                  {a.loadList?.voyage?.vessel?.name ? ` (${a.loadList.voyage.vessel.name})` : ''}
                </option>
              ))}
            </select>
            {completedLoadings.length === 0 && (
              <p className="text-xs text-muted-foreground">{t('create.noLoadings')}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.notes')}</Label>
            <Input value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} />
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
        title={detail ? `${detail.dischargeNumber}` : t('detail.title')}
        description={detail ? `${t('fields.loading')}: ${detail.actualLoading?.actualLoadingNumber ?? '—'} · ${voyageOf(detail)}` : undefined}
        footer={
          detail && (
            <div className="flex flex-wrap justify-end gap-2">
              {detail.status === 'NOT_STARTED' && canUpdate && (
                <Button variant="outline" onClick={() => setConfirmStart(detail)} disabled={saving}>
                  <Play className="me-1.5 h-4 w-4" />
                  {t('actions.start')}
                </Button>
              )}
              {detail.status === 'IN_PROGRESS' && canComplete && (
                <Button onClick={() => setConfirmComplete(detail)} disabled={saving}>
                  <CheckCircle2 className="me-1.5 h-4 w-4" />
                  {t('actions.complete')}
                </Button>
              )}
              {editable(detail) && canCancel && (
                <Button variant="outline" onClick={() => setConfirmCancel(detail)} disabled={saving}>
                  <XCircle className="me-1.5 h-4 w-4" />
                  {t('actions.cancel')}
                </Button>
              )}
            </div>
          )
        }
      >
        {!detail ? (
          <PageLoader />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(detail.status)}>{t(`status.${detail.status}`)}</Badge>
              {detail.actualLoading?.loadList?.voyage?.destinationPort && (
                <span className="text-sm text-muted-foreground">
                  {t('fields.pod')}:{' '}
                  {detail.actualLoading.loadList.voyage.destinationPort.name} (
                  {detail.actualLoading.loadList.voyage.destinationPort.code})
                </span>
              )}
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="p-2 text-start">{t('items.cargo')}</th>
                    <th className="p-2 text-start">{t('items.result')}</th>
                    <th className="p-2 text-end">{t('items.expected')}</th>
                    <th className="p-2 text-end">{t('items.discharged')}</th>
                    {editable(detail) && <th className="p-2 text-end">{tc('actions.title')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {(detail.items ?? []).map((it) => (
                    <tr key={it.id} className="border-b last:border-0">
                      <td className="p-2">
                        <span className="font-mono text-xs">{it.cargo?.reference ?? it.cargoId}</span>
                        {it.cargo?.customer?.name ? (
                          <div className="text-[10px] text-muted-foreground">{it.cargo.customer.name}</div>
                        ) : null}
                      </td>
                      <td className="p-2">
                        <Badge variant={RESULT_META[it.result]?.variant ?? 'neutral'}>{t(`items.result.${it.result}`)}</Badge>
                      </td>
                      <td className="p-2 text-end font-mono">{it.expectedQuantity ?? '—'}</td>
                      <td className="p-2 text-end">
                        {editable(detail) ? (
                          <Input
                            className="h-8 w-24 text-end font-mono"
                            value={itemDrafts[it.id] ?? ''}
                            onChange={(e) => updateDraft(it.id, e.target.value)}
                            inputMode="numeric"
                            placeholder={String(it.expectedQuantity ?? '')}
                          />
                        ) : (
                          <span className="font-mono">{it.dischargeQuantity ?? '—'}</span>
                        )}
                      </td>
                      {editable(detail) && (
                        <td className="p-2 text-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void submitItem(it)} disabled={saving}>
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 text-sm font-semibold">
                    <td className="p-2" colSpan={2}>
                      {t('items.totals')}
                    </td>
                    <td className="p-2 text-end font-mono">{detail.expectedTotal ?? 0}</td>
                    <td className="p-2 text-end font-mono">{detail.dischargedTotal ?? 0}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {detail.notes && <p className="text-sm text-muted-foreground">{detail.notes}</p>}
            <div className="text-xs text-muted-foreground">
              <div>
                {t('detail.createdOn')}: {formatDateTime(detail.createdAt, locale)}
              </div>
              {detail.completedAt && (
                <div>
                  {t('detail.completedOn')}: {formatDateTime(detail.completedAt, locale)}
                </div>
              )}
              {detail.cancelledAt && (
                <div>
                  {t('detail.cancelledOn')}: {formatDateTime(detail.cancelledAt, locale)}
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>

      {/* start confirm */}
      <ConfirmDialog
        open={!!confirmStart}
        onOpenChange={(o) => {
          if (!o) setConfirmStart(null);
        }}
        title={t('confirm.start.title')}
        description={confirmStart ? t('confirm.start.description', { number: confirmStart.dischargeNumber }) : ''}
        confirmLabel={t('actions.start')}
        loading={saving}
        onConfirm={() =>
          void (async () => {
            const target = confirmStart;
            setConfirmStart(null);
            if (target) await act(() => api.post(`/discharge/${target.id}/start`));
          })()
        }
      />

      {/* complete confirm */}
      <ConfirmDialog
        open={!!confirmComplete}
        onOpenChange={(o) => {
          if (!o) setConfirmComplete(null);
        }}
        title={t('confirm.complete.title')}
        description={confirmComplete ? t('confirm.complete.description', { number: confirmComplete.dischargeNumber }) : ''}
        confirmLabel={t('actions.complete')}
        loading={saving}
        onConfirm={() =>
          void (async () => {
            const target = confirmComplete;
            setConfirmComplete(null);
            if (target) await act(() => api.post(`/discharge/${target.id}/complete`, {}));
          })()
        }
      />

      {/* cancel with reason */}
      <Dialog
        open={!!confirmCancel}
        onOpenChange={(o) => {
          if (!o) setConfirmCancel(null);
        }}
        title={t('cancel.title')}
        description={t('cancel.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmCancel(null)} disabled={saving}>
              {tc('actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={saving || !cancelReason.trim()}
              onClick={() =>
                void (async () => {
                  const target = confirmCancel;
                  setConfirmCancel(null);
                  if (target) await act(() => api.post(`/discharge/${target.id}/cancel`, { cancelReason }));
                })()
              }
            >
              {saving ? tc('actions.saving') : t('actions.cancel')}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label>{t('cancel.reason')}</Label>
          <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={t('cancel.reasonPlaceholder')} />
        </div>
      </Dialog>

      {/* delete confirm */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null);
        }}
        title={t('confirm.delete.title')}
        description={confirmDelete ? t('confirm.delete.description', { number: confirmDelete.dischargeNumber }) : ''}
        confirmLabel={tc('actions.delete')}
        loading={saving}
        onConfirm={() =>
          void (async () => {
            const target = confirmDelete;
            setConfirmDelete(null);
            if (target) await act(() => api.del(`/discharge/${target.id}`));
          })()
        }
      />
    </div>
  );
}
