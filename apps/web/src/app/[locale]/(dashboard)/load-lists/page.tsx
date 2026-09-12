'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  LoadList,
  LoadListItem,
  LoadListStatus,
  LoadListDetail,
  CargoEligibleItem,
  PaginatedResult,
  VoyageListItem,
} from '@shipping/shared';
import { Plus, Eye, CheckCircle2, XCircle, Trash2, ListChecks, ClipboardList, ArrowUpDown } from 'lucide-react';
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

const STATUSES: LoadListStatus[] = ['DRAFT', 'FINALIZED', 'CANCELLED'];

const STATUS_META: Record<
  LoadListStatus,
  { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' }
> = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  FINALIZED: { label: 'Finalized', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
};

interface CreateLoadListForm {
  voyageId: string;
  notes: string;
}

interface AddItemForm {
  cargoId: string;
  plannedQuantity: string;
  notes: string;
}

const EMPTY_CREATE_FORM: CreateLoadListForm = { voyageId: '', notes: '' };
const EMPTY_ADD_ITEM_FORM: AddItemForm = { cargoId: '', plannedQuantity: '', notes: '' };

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { timeZone: 'Asia/Dubai' });
}

function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric' });
}

export default function LoadListsPage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [voyageFilter, setVoyageFilter] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const [voyages, setVoyages] = useState<any[]>([]);
  const [eligibleCargo, setEligibleCargo] = useState<any[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemLoadListId, setAddItemLoadListId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<{ voyageId: string; notes: string }>({ voyageId: '', notes: '' });
  const [addItemForm, setAddItemForm] = useState<{ cargoId: string; plannedQuantity: string; notes: string }>({ cargoId: '', plannedQuantity: '', notes: '' });
  const [confirmingFinalize, setConfirmingFinalize] = useState<any | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<any | null>(null);
  const [confirmingDeleteItem, setConfirmingDeleteItem] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const canCreate = hasPermission('load_list:create');
  const canUpdate = hasPermission('load_list:update');
  const canDelete = hasPermission('load_list:delete');
  const canFinalize = hasPermission('load_list:finalize');
  const canCancel = hasPermission('load_list:cancel');
  const canRead = hasPermission('load_list:read');

  const load = useCallback(
    async (p: number, q: string, status: string, voyageId: string, from: string, to: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), pageSize: String(25) });
      if (q) params.set('search', q);
      if (status) params.set('status', status);
      if (voyageId) params.set('voyageId', voyageId);
      if (from) params.set('createdFrom', from);
      if (to) params.set('createdTo', to);
      try {
        setData(await api.get(`/load-lists?${params.toString()}`));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load load lists');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(page, search, statusFilter, voyageFilter, createdFrom, createdTo);
  }, [load, page, search, statusFilter, voyageFilter, createdFrom, createdTo]);

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

  function updateCreateField<K extends keyof { voyageId: string; notes: string }>(key: K, value: string) {
    setCreateForm((f) => ({ ...f, [key]: value }));
  }

  function updateAddItemField<K extends keyof { cargoId: string; plannedQuantity: string; notes: string }>(key: K, value: string) {
    setAddItemForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setFormError(null);
    setCreateForm({ voyageId: '', notes: '' });
    setCreateOpen(true);
  }

  function renderCreateDialog() {
    return (
      <Dialog
        open={createOpen}
        onOpenChange={(open) => !open && setCreateOpen(false)}
        title="New load list"
        description="Select the voyage for this load list. Only DRAFT and SCHEDULED voyages are available."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={submitCreate}>
              Create load list
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ll-voyage" className="block">
              Voyage *
            </Label>
            <select
              id="ll-voyage"
              className={SELECT_CLASS + ' w-full'}
              value={createForm.voyageId}
              onChange={(e) => updateCreateField('voyageId', e.target.value)}
              autoFocus
            >
              <option value="">Select voyage…</option>
              {voyages
                .filter((v: any) => ['DRAFT', 'SCHEDULED'].includes(v.status))
                .map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.voyageNumber} — {v.vessel?.name} — {v.originPort?.code} → {v.destinationPort?.code} ({v.status})
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ll-notes" className="block">
              Notes
            </Label>
            <textarea
              id="ll-notes"
              className="min-h-[56px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Optional notes for this load list"
              value={createForm.notes}
              onChange={(e) => updateCreateField('notes', e.target.value)}
            />
          </div>
          {formError && (
            <p className="text-xs text-destructive" role="alert">
              {formError}
            </p>
          )}
        </div>
      </Dialog>
    );
  }

  async function loadEligibleCargo(loadListId: string) {
    try {
      const detail = await api.get<LoadListDetail>(`/load-lists/${loadListId}`);
      if (!detail.voyage) return;
      const res = await api.get<PaginatedResult<CargoEligibleItem>>(`/load-lists/eligible-cargo?voyageId=${detail.voyage.id}&eligibleOnly=true&pageSize=100`);
      setEligibleCargo(res.data);
    } catch {
      setEligibleCargo([]);
    }
  }

  async function submitCreate() {
    setFormError(null);
    if (!createForm.voyageId) {
      setFormError('Select a voyage for this load list.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/load-lists', { voyageId: createForm.voyageId, notes: createForm.notes.trim() || undefined });
      setCreateOpen(false);
      await load(page, search, statusFilter, voyageFilter, createdFrom, createdTo);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create load list');
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(row: any) {
    setViewing(row);
    setDetail(null);
    try {
      const d = await api.get<LoadListDetail>(`/load-lists/${row.id}`);
      setDetail(d);
      if (d.status === 'DRAFT' && hasPermission('load_list:update')) {
        await loadEligibleCargo(row.id);
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to load load list');
      setViewing(null);
    }
  }

  async function openAddItem(loadListId: string) {
    setAddItemLoadListId(loadListId);
    setAddItemForm({ cargoId: '', plannedQuantity: '', notes: '' });
    setFormError(null);
    await loadEligibleCargo(loadListId);
    setAddItemOpen(true);
  }

  async function submitAddItem() {
    if (!addItemLoadListId) return;
    setFormError(null);
    if (!addItemForm.cargoId) {
      setFormError('Select cargo to add.');
      return;
    }
    const plannedQty = addItemForm.plannedQuantity ? parseInt(addItemForm.plannedQuantity, 10) : undefined;
    if (plannedQty !== undefined && (isNaN(plannedQty) || plannedQty < 1)) {
      setFormError('Planned quantity must be a positive integer.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/load-lists/${addItemLoadListId}/items', {
        cargoId: addItemForm.cargoId,
        plannedQuantity: plannedQty,
        notes: addItemForm.notes.trim() || undefined,
      });
      setAddItemOpen(false);
      setAddItemLoadListId(null);
      if (viewing) {
        const d = await api.get(`/load-lists/${viewing.id}`);
        setDetail(d);
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to add cargo');
    } finally {
      setSaving(false);
    }
  }

  async function submitAddItemsBulk() {
    if (!addItemLoadListId) return;
    const selectedIds = eligibleCargo.filter((c: any) => c.selected).map((c: any) => c.id);
    if (selectedIds.length === 0) {
      setFormError('Select at least one cargo to add.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/load-lists/${addItemLoadListId}/items/bulk', {
        items: selectedIds.map((id: string) => ({ cargoId: id })),
      });
      setAddItemOpen(false);
      setAddItemLoadListId(null);
      if (viewing) {
        const d = await api.get(`/load-lists/${viewing.id}`);
        setDetail(d);
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to add cargo');
    } finally {
      setSaving(false);
    }
  }

  async function openDeleteItem(item: any) {
    setConfirmingDeleteItem(item);
  }

  async function submitDeleteItem() {
    if (!confirmingDeleteItem || !viewing) return;
    setSaving(true);
    try {
      await api.del('/load-lists/${viewing.id}/items/${confirmingDeleteItem.id}');
      setConfirmingDeleteItem(null);
      const d = await api.get('/load-lists/${viewing.id}');
      setDetail(d);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to remove cargo');
    } finally {
      setSaving(false);
    }
  }

  async function submitFinalize() {
    if (!confirmingFinalize) return;
    setSaving(true);
    try {
      const updated = await api.post('/load-lists/${confirmingFinalize.id}/finalize');
      setConfirmingFinalize(null);
      if (viewing) setDetail(updated);
      await load(page, search, statusFilter, voyageFilter, createdFrom, createdTo);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to finalize load list');
    } finally {
      setSaving(false);
    }
  }

  function openCancel(row: any) {
    setCancelReason('');
    setFormError(null);
    setConfirmingCancel(row);
  }

  async function submitCancel() {
    if (!confirmingCancel) return;
    setFormError(null);
    if (!cancelReason.trim()) {
      setFormError('A cancellation reason is required.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.post('/load-lists/${confirmingCancel.id}/cancel', { cancelReason: cancelReason.trim() });
      setConfirmingCancel(null);
      setCancelReason('');
      if (viewing) setDetail(updated);
      await load(page, search, statusFilter, voyageFilter, createdFrom, createdTo);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to cancel load list');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: "Load Lists" }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">Load Lists</h1>
          <p className="text-sm text-muted-foreground">
            Plan cargo for specific voyages. Only cargo with APPROVED inspection may be added.
            Draft lists can be edited; finalized lists are immutable.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New load list
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Load List register</CardTitle>
          <CardDescription>Planned cargo for voyages. Live records only.</CardDescription>
        </CardHeader>
        <CardContent className="border-b border-border pb-3 pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Input
                placeholder="Search load list no., voyage no., vessel"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                aria-label="Search load lists"
              />
            </div>
            <select
              className={SELECT_CLASS}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {(["DRAFT", "FINALIZED", "CANCELLED"] as LoadListStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
            <select
              className={SELECT_CLASS}
              value={voyageFilter}
              onChange={(e) => { setVoyageFilter(e.target.value); setPage(1); }}
              aria-label="Filter by voyage"
            >
              <option value="">All voyages</option>
              {voyages.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.voyageNumber} — {v.vessel?.name}
                </option>
              ))}
            </select>
            <Input
              type="date"
              className={SELECT_CLASS + " min-w-[140px]"}
              value={createdFrom}
              onChange={(e) => { setCreatedFrom(e.target.value); setPage(1); }}
              placeholder="From"
            />
            <Input
              type="date"
              className={SELECT_CLASS + " min-w-[140px]"}
              value={createdTo}
              onChange={(e) => { setCreatedTo(e.target.value); setPage(1); }}
              placeholder="To"
            />
          </div>
        </CardContent>

        {loading ? (
          <PageLoader label="Loading load lists..." />
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
              title="No load lists found"
              description="Try a different search or filter, or create a new load list."
            />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Load List No.</th>
                  <th className="px-3 py-2 font-medium">Voyage</th>
                  <th className="px-3 py-2 font-medium">Vessel</th>
                  <th className="px-3 py-2 font-medium">Route</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Cargo count</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((row: any) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 text-[13px] font-medium text-foreground">
                      {row.loadListNumber}
                    </td>
                    <td className="px-3 py-2">{row.voyage?.voyageNumber ?? "—"}</td>
                    <td className="px-3 py-2">{row.voyage?.vessel?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      {row.voyage?.originPort?.code} → {row.voyage?.destinationPort?.code}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_META[row.status as LoadListStatus].variant} dot>
                        {STATUS_META[row.status as LoadListStatus].label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-center">{row._count?.items ?? row.items?.length ?? 0}</td>
                    <td className="px-3 py-2">{row.createdAt ? fmtShortDate(row.createdAt) : "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openDetail(row)}
                            aria-label={`View ${row.loadListNumber}`}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canUpdate && row.status === "DRAFT" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setFormError(null); setAddItemForm({ cargoId: "", plannedQuantity: "", notes: "" }); setAddItemLoadListId(row.id); setAddItemOpen(true); }}
                            aria-label={`Add cargo to ${row.loadListNumber}`}
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canFinalize && row.status === "DRAFT" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                            onClick={() => setConfirmingFinalize(row)}
                            aria-label={`Finalize ${row.loadListNumber}`}
                          >
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {(canCancel && (row.status === "DRAFT" || row.status === "FINALIZED")) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => { setCancelReason(""); setFormError(null); setConfirmingCancel(row); }}
                            aria-label={`Cancel ${row.loadListNumber}`}
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
          </div>
        )}

        {data && data.meta.totalPages > 1 && (
          <CardFooter className="block px-0">
            <Pagination
              page={page}
              pageSize={25}
              totalItems={data.meta.totalItems}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
            />
          </CardFooter>
        )}
      </Card>

      {renderCreateDialog()}
      <ConfirmDialog
        open={!!confirmingFinalize}
        onOpenChange={(open) => !open && setConfirmingFinalize(null)}
        title="Finalize load list"
        description={`Finalize ${confirmingFinalize?.loadListNumber}? This will re-validate all cargo eligibility against current inspection status. Finalized lists cannot be edited.`}
        confirmLabel="Finalize"
        loading={saving}
        onConfirm={submitFinalize}
      />

      <Dialog
        open={!!confirmingCancel}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingCancel(null);
            setCancelReason("");
          }
        }}
        title="Cancel load list"
        description={`Cancel ${confirmingCancel?.loadListNumber}? You must provide a reason. Cancelled lists cannot be edited.`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => { setConfirmingCancel(null); setCancelReason(""); }}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" loading={saving} onClick={submitCancel}>
              Cancel load list
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason" className="block">
            Cancellation reason *
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

      <ConfirmDialog
        open={!!confirmingDeleteItem}
        onOpenChange={(open) => !open && setConfirmingDeleteItem(null)}
        title="Remove cargo from load list"
        description={`Remove ${confirmingDeleteItem?.cargo?.reference} from this load list? This only removes the planning relationship; the cargo and its inspection remain unchanged.`}
        confirmLabel="Remove"
        destructive
        loading={saving}
        onConfirm={submitDeleteItem}
      />
    </div>
  );
}