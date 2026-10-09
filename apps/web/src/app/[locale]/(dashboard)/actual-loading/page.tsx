'use client';
import { TableScroll } from '@/components/ui/table-scroll';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';

import { useLocale as useUiLocale } from 'next-intl';
import { DomainLabel } from '@/components/ui/domain-label';

import { useTranslations as useUiTranslations } from 'next-intl';

import { useCallback, useEffect, useState } from 'react';
import type {
  ActualLoading,
  ActualLoadingDetail,
  ActualLoadingItem,
  ActualLoadingStatus,
  LoadingResult,
  PaginatedResult,
  VoyageListItem,
  LoadList,
} from '@shipping/shared';
import { Plus, Eye, CheckCircle2, XCircle, Play, Save } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
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

const STATUSES: ActualLoadingStatus[] = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const STATUS_META: Record<
  ActualLoadingStatus,
  { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }
> = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  IN_PROGRESS: { label: 'In progress', variant: 'info' },
  PARTIALLY_LOADED: { label: 'Partially loaded', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  FINALIZED: { label: 'Finalized', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

const RESULT_META: Record<
  LoadingResult,
  { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' }
> = {
  FULL: { label: 'Full', variant: 'success' },
  PARTIAL: { label: 'Partial', variant: 'warning' },
  NOT_LOADED: { label: 'Not loaded', variant: 'neutral' },
};

interface CreateForm {
  loadListId: string;
  notes: string;
}

interface ItemDraft {
  [loadListItemId: string]: string; // raw input, validated on save
}

function fmtDate(iso: string, displayLocale: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(displayLocale, { timeZone: 'Asia/Dubai' });
}

function fmtShortDate(iso: string | null | undefined, displayLocale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(displayLocale, {
    timeZone: 'Asia/Dubai',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ActualLoadingPage() {
  const uiLocale = useUiLocale();
  const ui = useUiTranslations('legacyUi');
  const { hasPermission } = useAuth();
  const [data, setData] = useState<PaginatedResult<ActualLoading> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState('');
  const [voyageFilter, setVoyageFilter] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const [voyages, setVoyages] = useState<VoyageListItem[]>([]);
  const [finalizedLoadLists, setFinalizedLoadLists] = useState<LoadList[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({ loadListId: '', notes: '' });

  const [viewing, setViewing] = useState<ActualLoading | null>(null);
  const [detail, setDetail] = useState<ActualLoadingDetail | null>(null);
  const [itemDrafts, setItemDrafts] = useState<ItemDraft>({});

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingStart, setConfirmingStart] = useState<ActualLoading | null>(null);
  const [confirmingComplete, setConfirmingComplete] = useState<ActualLoading | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<ActualLoading | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const canCreate = hasPermission('actual_loading:create');
  const canUpdate = hasPermission('actual_loading:update');
  const canComplete = hasPermission('actual_loading:complete');
  const canCancel = hasPermission('actual_loading:cancel');
  const canRead = hasPermission('actual_loading:read');

  const load = useCallback(
    async (p: number, q: string, status: string, voyageId: string, from: string, to: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      if (status) params.set('status', status);
      if (voyageId) params.set('voyageId', voyageId);
      if (from) params.set('createdFrom', from);
      if (to) params.set('createdTo', to);
      try {
        setData(
          await api.get<PaginatedResult<ActualLoading>>(`/actual-loading?${params.toString()}`)
        );
      } catch (e) {
        setError(e instanceof ApiError ? e.message : ui('failedToLoadActualLoadingRecords'));
      } finally {
        setLoading(false);
      }
    },
    [ui]
  );

  useEffect(() => {
    load(page, debouncedSearch, statusFilter, voyageFilter, createdFrom, createdTo);
  }, [load, page, debouncedSearch, statusFilter, voyageFilter, createdFrom, createdTo]);

  useEffect(() => {
    (async () => {
      try {
        const voyageRes = await api.get<PaginatedResult<VoyageListItem>>('/voyages?pageSize=100');
        setVoyages(voyageRes.data);
      } catch {
        /* filters degrade gracefully */
      }
    })();
  }, []);

  useEffect(() => {
    if (!createOpen) return;
    (async () => {
      try {
        const res = await api.get<PaginatedResult<LoadList>>(
          '/load-lists?status=FINALIZED&pageSize=100'
        );
        setFinalizedLoadLists(res.data);
      } catch {
        setFinalizedLoadLists([]);
      }
    })();
  }, [createOpen]);

  function openCreate() {
    setFormError(null);
    setCreateForm({ loadListId: '', notes: '' });
    setCreateOpen(true);
  }

  async function submitCreate() {
    setFormError(null);
    if (!createForm.loadListId) {
      setFormError(ui('selectAFinalizedLoadList'));
      return;
    }
    setSaving(true);
    try {
      await api.post<ActualLoading>('/actual-loading', {
        loadListId: createForm.loadListId,
        notes: createForm.notes.trim() || undefined,
      });
      setCreateOpen(false);
      setCreateForm({ loadListId: '', notes: '' });
      await load(page, search, statusFilter, voyageFilter, createdFrom, createdTo);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToCreateActualLoading'));
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(row: ActualLoading) {
    setViewing(row);
    setDetail(null);
    setFormError(null);
    setItemDrafts({});
    try {
      const d = await api.get<ActualLoadingDetail>(`/actual-loading/${row.id}`);
      setDetail(d);
      setItemDrafts(
        Object.fromEntries(
          d.items.map((it) => [
            it.loadListItemId,
            it.actualQuantity === null ? '' : String(it.actualQuantity),
          ])
        )
      );
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToLoadActualLoading'));
    }
  }

  function updateDraft(loadListItemId: string, value: string) {
    setItemDrafts((prev) => ({ ...prev, [loadListItemId]: value }));
  }

  function parseDraft(raw: string): number | undefined {
    const n = parseInt(raw, 10);
    if (raw.trim() === '') return undefined;
    if (Number.isNaN(n)) return NaN;
    return n;
  }

  async function submitDraft(item: ActualLoadingItem) {
    if (!viewing) return;
    const actualQuantity = parseDraft(itemDrafts[item.loadListItemId]);
    const planned = item.loadListItem?.plannedQuantity ?? null;
    if (actualQuantity !== undefined && (Number.isNaN(actualQuantity) || actualQuantity < 0)) {
      setFormError(ui('actualQuantityMustBeANonNegativeInteger'));
      return;
    }
    if (actualQuantity !== undefined && planned !== null && actualQuantity > planned) {
      setFormError(
        ui('actualQuantityValueExceedsPlannedQuantityValue', {
          value0: String(actualQuantity),
          value1: String(planned),
        })
      );
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api.patch<ActualLoadingItem>(
        `/actual-loading/${viewing.id}/items/${item.loadListItemId}`,
        { actualQuantity, notes: item.notes ?? undefined }
      );
      const d = await api.get<ActualLoadingDetail>(`/actual-loading/${viewing.id}`);
      setDetail(d);
      setItemDrafts(
        Object.fromEntries(
          d.items.map((it) => [
            it.loadListItemId,
            it.actualQuantity === null ? '' : String(it.actualQuantity),
          ])
        )
      );
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToSaveQuantity'));
    } finally {
      setSaving(false);
    }
  }

  async function submitStart() {
    if (!confirmingStart) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated = await api.post<ActualLoadingDetail>(
        `/actual-loading/${confirmingStart.id}/start`
      );
      setConfirmingStart(null);
      if (viewing) setDetail(updated);
      await load(page, search, statusFilter, voyageFilter, createdFrom, createdTo);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToStartLoading'));
    } finally {
      setSaving(false);
    }
  }

  async function submitComplete() {
    if (!confirmingComplete) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated = await api.post<ActualLoadingDetail>(
        `/actual-loading/${confirmingComplete.id}/complete`,
        {
          notes: viewing?.notes ?? undefined,
        }
      );
      setConfirmingComplete(null);
      if (viewing) setDetail(updated);
      await load(page, search, statusFilter, voyageFilter, createdFrom, createdTo);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToCompleteLoading'));
    } finally {
      setSaving(false);
    }
  }

  async function submitCancel() {
    if (!confirmingCancel) return;
    setFormError(null);
    if (!cancelReason.trim()) {
      setFormError(ui('aCancellationReasonIsRequired'));
      return;
    }
    setSaving(true);
    try {
      const updated = await api.post<ActualLoadingDetail>(
        `/actual-loading/${confirmingCancel.id}/cancel`,
        {
          cancelReason: cancelReason.trim(),
        }
      );
      setConfirmingCancel(null);
      setCancelReason('');
      if (viewing) setDetail(updated);
      await load(page, search, statusFilter, voyageFilter, createdFrom, createdTo);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToCancelLoading'));
    } finally {
      setSaving(false);
    }
  }

  const editable =
    detail !== null && (detail.status === 'DRAFT' || detail.status === 'IN_PROGRESS');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: ui('actualLoading') }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">{ui('actualLoading')}</h1>
          <p className="text-sm text-muted-foreground">
            {ui('recordActualLoadedQuantitiesAgainstTheFinalizedLoadListTrackFull')}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {ui('newActualLoading')}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{ui('actualLoadingRegister')}</CardTitle>
          <CardDescription>{ui('executedLoadingOperationsLiveRecordsOnly')}</CardDescription>
        </CardHeader>
        <CardContent className="border-b border-border pb-3 pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Input
                placeholder={ui('searchActualLoadingNoLoadListNoVoyageNo')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label={ui('searchActualLoading')}
              />
            </div>
            <select
              className={SELECT_CLASS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label={ui('filterByStatus')}
            >
              <option value="">{ui('allStatuses')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  <DomainLabel value={STATUS_META[s].label} />
                </option>
              ))}
            </select>
            <select
              className={SELECT_CLASS}
              value={voyageFilter}
              onChange={(e) => {
                setVoyageFilter(e.target.value);
                setPage(1);
              }}
              aria-label={ui('filterByVoyage')}
            >
              <option value="">{ui('allVoyages')}</option>
              {voyages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.voyageNumber} — {v.vessel?.name}
                </option>
              ))}
            </select>
            <Input
              type="date"
              className={SELECT_CLASS + ' min-w-[140px]'}
              value={createdFrom}
              onChange={(e) => {
                setCreatedFrom(e.target.value);
                setPage(1);
              }}
              placeholder={ui('from')}
            />
            <Input
              type="date"
              className={SELECT_CLASS + ' min-w-[140px]'}
              value={createdTo}
              onChange={(e) => {
                setCreatedTo(e.target.value);
                setPage(1);
              }}
              placeholder={ui('to')}
            />
          </div>
        </CardContent>

        {loading ? (
          <PageLoader label={ui('loadingActualLoadingRecords')} />
        ) : error ? (
          <CardContent>
            <ErrorState
              message={error}
              onRetry={() => load(page, search, statusFilter, voyageFilter, createdFrom, createdTo)}
            />
          </CardContent>
        ) : data && data.data.length === 0 ? (
          <CardContent>
            <EmptyState
              title={ui('noActualLoadingRecordsFound')}
              description={ui('tryADifferentSearchOrFilterOrCreateANewActual')}
            />
          </CardContent>
        ) : (
          <TableScroll className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{ui('no')}</th>
                  <th className="px-3 py-2 font-medium">{ui('loadList')}</th>
                  <th className="px-3 py-2 font-medium">{ui('voyageVessel')}</th>
                  <th className="px-3 py-2 font-medium">{ui('route')}</th>
                  <th className="px-3 py-2 font-medium">{ui('status')}</th>
                  <th className="px-3 py-2 text-end font-medium">{ui('items')}</th>
                  <th className="px-3 py-2 font-medium">{ui('created')}</th>
                  <th className="px-3 py-2 text-end font-medium">{ui('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs text-foreground/90">
                      {row.actualLoadingNumber}
                    </td>
                    <td className="px-3 py-2">{row.loadList?.loadListNumber ?? '—'}</td>
                    <td className="px-3 py-2">
                      {row.loadList?.voyage?.voyageNumber ?? '—'}
                      {row.loadList?.voyage?.vessel?.name
                        ? ` · ${row.loadList.voyage.vessel.name}`
                        : ''}
                    </td>
                    <td className="px-3 py-2">
                      {row.loadList?.voyage?.originPort?.code} →{' '}
                      {row.loadList?.voyage?.destinationPort?.code}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_META[row.status].variant} dot>
                        <DomainLabel value={STATUS_META[row.status].label} />
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {row._count?.items ?? row.items?.length ?? 0}
                    </td>
                    <td className="px-3 py-2">{fmtShortDate(row.createdAt, uiLocale)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openDetail(row)}
                            aria-label={ui('viewValue', {
                              value0: String(row.actualLoadingNumber),
                            })}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canUpdate && row.status === 'DRAFT' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setConfirmingStart(row)}
                            aria-label={ui('startValue', {
                              value0: String(row.actualLoadingNumber),
                            })}
                          >
                            <Play className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canComplete && row.status === 'IN_PROGRESS' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setConfirmingComplete(row)}
                            aria-label={ui('completeValue', {
                              value0: String(row.actualLoadingNumber),
                            })}
                          >
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canCancel && (row.status === 'DRAFT' || row.status === 'IN_PROGRESS') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setCancelReason('');
                              setFormError(null);
                              setConfirmingCancel(row);
                            }}
                            aria-label={ui('cancelValue', {
                              value0: String(row.actualLoadingNumber),
                            })}
                          >
                            <XCircle className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}

        {data && data.meta.totalPages > 1 && (
          <CardFooter className="block px-0">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={data.meta.totalItems}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
            />
          </CardFooter>
        )}
      </Card>

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => !open && setCreateOpen(false)}
        title={ui('newActualLoading')}
        description={ui('selectAFINALIZEDLoadListToStartLoadingOneActualLoading')}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              {ui('cancel')}
            </Button>
            <Button size="sm" loading={saving} onClick={submitCreate}>
              {ui('createActualLoading')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="al-loadlist" className="block">
              {ui('loadListRequired')}
            </Label>
            <select
              id="al-loadlist"
              className={SELECT_CLASS + ' w-full'}
              value={createForm.loadListId}
              onChange={(e) => setCreateForm((f) => ({ ...f, loadListId: e.target.value }))}
            >
              <option value="">{ui('selectFinalizedLoadList')}</option>
              {finalizedLoadLists.map((ll) => (
                <option key={ll.id} value={ll.id}>
                  {ll.loadListNumber} — {ll.voyage?.voyageNumber} — {ll.voyage?.vessel?.name}
                </option>
              ))}
            </select>
            {finalizedLoadLists.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {ui('noFinalizedLoadListsAvailableFinalizeALoadListFirst')}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="al-notes" className="block">
              {ui('notes')}
            </Label>
            <textarea
              id="al-notes"
              className="min-h-[56px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={ui('optionalNotesForThisLoadingOperation')}
              value={createForm.notes}
              onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          {formError && (
            <p className="text-xs text-destructive" role="alert">
              {formError}
            </p>
          )}
        </div>
      </Dialog>

      {/* Detail dialog */}
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing ? viewing.actualLoadingNumber : ui('actualLoading_m7i2l5z')}
        description={
          detail
            ? `${detail.loadList?.loadListNumber} · ${detail.loadList?.voyage?.voyageNumber} · ${
                detail.loadList?.voyage?.originPort?.code
              } → ${detail.loadList?.voyage?.destinationPort?.code}`
            : ui('loading')
        }
        footer={
          <>
            {editable && (
              <p className="mr-auto text-xs text-muted-foreground">
                {detail?.status === 'IN_PROGRESS' ? ui('inProgress') : ui('notStarted')}{' '}
                {ui('quantitiesCanBeEdited')}
              </p>
            )}
            {detail?.status === 'CANCELLED' && (
              <p className="mr-auto text-xs text-muted-foreground">{ui('cancelledImmutable')}</p>
            )}
            {detail?.status === 'COMPLETED' && (
              <p className="mr-auto text-xs text-muted-foreground">{ui('completedImmutable')}</p>
            )}
            {canCancel && editable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCancelReason('');
                  setFormError(null);
                  setConfirmingCancel(viewing);
                }}
              >
                {ui('cancelLoading')}
              </Button>
            )}
            {canComplete && detail?.status === 'IN_PROGRESS' && (
              <Button size="sm" onClick={() => setConfirmingComplete(detail)}>
                <CheckCircle2 className="h-4 w-4" />
                {ui('completeLoading')}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setViewing(null)}>
              {ui('close')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {detail && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span>
                  {ui('status_m1k6dje7')}{' '}
                  <Badge variant={STATUS_META[detail.status].variant} dot>
                    <DomainLabel value={STATUS_META[detail.status].label} />
                  </Badge>
                </span>
                <span className="text-muted-foreground">
                  {ui('created')}
                  <span className="tabular-nums">{fmtDate(detail.createdAt, uiLocale)}</span>
                </span>
                {detail.completedAt && (
                  <span className="text-muted-foreground">
                    {ui('completed')}
                    <span className="tabular-nums">{fmtDate(detail.completedAt, uiLocale)}</span>
                  </span>
                )}
                {detail.cancelledAt && (
                  <span className="text-muted-foreground">
                    {ui('cancelled')}
                    <span className="tabular-nums">{fmtDate(detail.cancelledAt, uiLocale)}</span>
                  </span>
                )}
              </div>
              {detail.notes && <p className="text-sm text-muted-foreground">{detail.notes}</p>}
            </div>
          )}

          {formError && (
            <p className="text-xs text-destructive" role="alert">
              {formError}
            </p>
          )}

          {detail === null ? (
            <PageLoader label={ui('loadingActualLoadingDetail')} />
          ) : detail.items.length === 0 && !editable ? (
            <EmptyState
              title={ui('noItemsRecorded')}
              description={ui('thisActualLoadingHasNoRecordedQuantities')}
            />
          ) : detail.items.length === 0 ? (
            <EmptyState
              title={ui('noItemsYet')}
              description={ui('startLoadingThenEnterActualQuantitiesPerCargo')}
            />
          ) : (
            <TableScroll className="overflow-x-auto">
              <table className="w-full text-start">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">{ui('cargo')}</th>
                    <th className="px-2 py-1.5 text-end font-medium">{ui('planned')}</th>
                    <th className="px-2 py-1.5 text-end font-medium">{ui('actual')}</th>
                    <th className="px-2 py-1.5 text-end font-medium">{ui('remaining')}</th>
                    <th className="px-2 py-1.5 font-medium">{ui('result')}</th>
                    {editable && <th className="px-2 py-1.5 text-end font-medium">{ui('save')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => {
                    const planned = item.loadListItem?.plannedQuantity ?? null;
                    const parsed = parseDraft(itemDrafts[item.loadListItemId]);
                    const actual =
                      parsed !== undefined && !Number.isNaN(parsed) ? parsed : item.actualQuantity;
                    const remaining = planned !== null && actual !== null ? planned - actual : null;
                    const exceeds =
                      parsed !== undefined &&
                      !Number.isNaN(parsed) &&
                      planned !== null &&
                      parsed > planned;
                    return (
                      <tr key={item.id} className="border-b border-border/60 last:border-0">
                        <td className="px-2 py-1.5">
                          <div className="text-[13px] font-medium">
                            {item.cargo?.reference ?? '—'}
                          </div>
                          {item.cargo?.serialNumber && (
                            <div className="font-mono text-xs text-muted-foreground">
                              {item.cargo.serialNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-end text-[13px] tabular-nums">
                          {planned === null ? '—' : planned}
                        </td>
                        <td className="px-2 py-1.5 text-end">
                          {editable ? (
                            <Input
                              type="number"
                              min={0}
                              max={planned ?? undefined}
                              className={
                                'h-8 w-24 text-end tabular-nums ' +
                                (exceeds
                                  ? 'border-destructive/50 focus-visible:ring-destructive/40'
                                  : '')
                              }
                              value={itemDrafts[item.loadListItemId]}
                              onChange={(e) => updateDraft(item.loadListItemId, e.target.value)}
                              aria-label={ui('actualQuantityForValue', {
                                value0: String(item.cargo?.reference),
                              })}
                            />
                          ) : (
                            <span className="text-[13px] tabular-nums">
                              {item.actualQuantity === null ? '—' : item.actualQuantity}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-end text-[13px] tabular-nums">
                          {remaining === null ? '—' : remaining}
                        </td>
                        <td className="px-2 py-1.5">
                          <Badge variant={RESULT_META[item.result].variant} dot>
                            <DomainLabel value={RESULT_META[item.result].label} />
                          </Badge>
                        </td>
                        {editable && (
                          <td className="px-2 py-1.5 text-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              loading={saving}
                              onClick={() => submitDraft(item)}
                              aria-label={ui('saveQuantityForValue', {
                                value0: String(item.cargo?.reference),
                              })}
                            >
                              <Save className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          )}
        </div>
      </Dialog>

      {/* Start confirm */}
      <ConfirmDialog
        open={!!confirmingStart}
        onOpenChange={(open) => !open && setConfirmingStart(null)}
        title={ui('startLoading')}
        description={ui('startValueLoadingWillMoveToInProgressAfterWhichQuantities', {
          value0: String(confirmingStart?.actualLoadingNumber),
        })}
        confirmLabel={ui('startLoading')}
        loading={saving}
        onConfirm={submitStart}
        error={formError}
      />

      {/* Complete confirm */}
      <ConfirmDialog
        open={!!confirmingComplete}
        onOpenChange={(open) => !open && setConfirmingComplete(null)}
        title={ui('completeLoading')}
        description={ui('completeValueAllItemsWillBeReValidatedCargoMustStill', {
          value0: String(confirmingComplete?.actualLoadingNumber),
        })}
        confirmLabel={ui('completeLoading')}
        loading={saving}
        onConfirm={submitComplete}
        error={formError}
      />

      {/* Cancel dialog */}
      <Dialog
        open={!!confirmingCancel}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingCancel(null);
            setCancelReason('');
          }
        }}
        title={ui('cancelLoading')}
        description={ui('cancelValueYouMustProvideAReasonCancelledLoadingIsImmutable', {
          value0: String(confirmingCancel?.actualLoadingNumber),
        })}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setConfirmingCancel(null);
                setCancelReason('');
              }}
            >
              {ui('keepLoading')}
            </Button>
            <Button variant="destructive" size="sm" loading={saving} onClick={submitCancel}>
              {ui('cancelLoading')}
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason" className="block">
            {ui('cancellationReasonRequired')}
          </Label>
          <textarea
            id="cancel-reason"
            autoFocus
            className="min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          {formError && (
            <p className="text-xs text-destructive" role="alert">
              {formError}
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}
