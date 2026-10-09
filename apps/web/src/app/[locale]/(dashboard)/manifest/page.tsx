'use client';
import { TableScroll } from '@/components/ui/table-scroll';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { DomainLabel } from '@/components/ui/domain-label';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import type {
  AgentListItem,
  ConsigneeListItem,
  Manifest,
  ManifestDetail,
  ManifestEligibleCargo,
  ManifestItem,
  ManifestStatus,
  PaginatedResult,
  ShipperListItem,
  VoyageListItem,
} from '@shipping/shared';
import { Plus, Eye, CheckCircle2, XCircle, Send, Stamp, Save, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateShort, formatDateTime } from '@/lib/date';
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

const STATUSES: ManifestStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED'];

function statusVariant(s: ManifestStatus): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  switch (s) {
    case 'DRAFT':
      return 'neutral';
    case 'SUBMITTED':
      return 'info';
    case 'APPROVED':
      return 'success';
    default:
      return 'danger';
  }
}

interface CreateForm {
  voyageId: string;
  shipperId: string;
  consigneeId: string;
  agentId: string;
  notifyParty: string;
  description: string;
  notes: string;
}

const EMPTY_CREATE: CreateForm = {
  voyageId: '',
  shipperId: '',
  consigneeId: '',
  agentId: '',
  notifyParty: '',
  description: '',
  notes: '',
};

interface HeaderDraft {
  shipperId: string;
  consigneeId: string;
  agentId: string;
  notifyParty: string;
  description: string;
  notes: string;
  gasCost: string;
  lashingCost: string;
  shipperCost: string;
  podCost: string;
  polCost: string;
  currencyCode: string;
}

interface ItemDraft {
  blNumber: string;
  notes: string;
}

export default function ManifestPage() {
  const t = useTranslations('manifest');
  const tNav = useTranslations('nav');
  const { hasPermission } = useAuth();
  const locale = useLocale();

  const [data, setData] = useState<PaginatedResult<Manifest> | null>(null);
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
  // Party master lists for the manifest party selects (cutover: these replaced
  // the Customer list — party-cutover-plan.md §4).
  const [shippers, setShippers] = useState<ShipperListItem[]>([]);
  const [consignees, setConsignees] = useState<ConsigneeListItem[]>([]);
  const [agents, setAgents] = useState<AgentListItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);

  const [viewing, setViewing] = useState<Manifest | null>(null);
  const [detail, setDetail] = useState<ManifestDetail | null>(null);
  const [headerDraft, setHeaderDraft] = useState<HeaderDraft | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, ItemDraft>>({});
  const [eligible, setEligible] = useState<ManifestEligibleCargo[]>([]);
  const [newCargoId, setNewCargoId] = useState('');
  const [newBlNumber, setNewBlNumber] = useState('');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState<Manifest | null>(null);
  const [confirmingApprove, setConfirmingApprove] = useState<Manifest | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<Manifest | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState<Manifest | null>(null);

  const canRead = hasPermission('manifest:read');
  const canCreate = hasPermission('manifest:create');
  const canUpdate = hasPermission('manifest:update');
  const canSubmit = hasPermission('manifest:submit');
  const canApprove = hasPermission('manifest:approve');
  const canCancel = hasPermission('manifest:cancel');
  const canDelete = hasPermission('manifest:delete');

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
        setData(await api.get<PaginatedResult<Manifest>>(`/manifests?${params.toString()}`));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : t('errors.loadList'));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    load(page, debouncedSearch, statusFilter, voyageFilter, createdFrom, createdTo);
  }, [load, page, debouncedSearch, statusFilter, voyageFilter, createdFrom, createdTo]);

  useEffect(() => {
    (async () => {
      try {
        const [voyageRes, shipperRes, consigneeRes, agentRes] = await Promise.all([
          api.get<PaginatedResult<VoyageListItem>>('/voyages?pageSize=100'),
          api.get<PaginatedResult<ShipperListItem>>('/shippers?pageSize=100'),
          api.get<PaginatedResult<ConsigneeListItem>>('/consignees?pageSize=100'),
          api.get<PaginatedResult<AgentListItem>>('/agents?pageSize=100'),
        ]);
        setVoyages(voyageRes.data);
        setShippers(shipperRes.data);
        setConsignees(consigneeRes.data);
        setAgents(agentRes.data);
      } catch {
        /* filters degrade gracefully */
      }
    })();
  }, []);

  function openCreate() {
    setFormError(null);
    setCreateForm(EMPTY_CREATE);
    setCreateOpen(true);
  }

  async function submitCreate() {
    setFormError(null);
    if (!createForm.voyageId) {
      setFormError(t('create.errorVoyage'));
      return;
    }
    setSaving(true);
    try {
      await api.post<ManifestDetail>('/manifests', {
        voyageId: createForm.voyageId,
        shipperId: createForm.shipperId || undefined,
        consigneeId: createForm.consigneeId || undefined,
        agentId: createForm.agentId || undefined,
        notifyParty: createForm.notifyParty.trim() || undefined,
        description: createForm.description.trim() || undefined,
        notes: createForm.notes.trim() || undefined,
      });
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
      await load(page, search, statusFilter, voyageFilter, createdFrom, createdTo);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('errors.create'));
    } finally {
      setSaving(false);
    }
  }

  function headerDraftOf(d: ManifestDetail): HeaderDraft {
    return {
      shipperId: d.shipperId ?? '',
      consigneeId: d.consigneeId ?? '',
      agentId: d.agentId ?? '',
      notifyParty: d.notifyParty ?? '',
      description: d.description ?? '',
      notes: d.notes ?? '',
      gasCost: d.gasCost ?? '',
      lashingCost: d.lashingCost ?? '',
      shipperCost: d.shipperCost ?? '',
      podCost: d.podCost ?? '',
      polCost: d.polCost ?? '',
      currencyCode: d.currencyCode ?? '',
    };
  }

  async function openDetail(row: Manifest) {
    setViewing(row);
    setDetail(null);
    setHeaderDraft(null);
    setFormError(null);
    setItemDrafts({});
    setEligible([]);
    setNewCargoId('');
    setNewBlNumber('');
    try {
      const d = await api.get<ManifestDetail>(`/manifests/${row.id}`);
      setDetail(d);
      if (d.status === 'DRAFT') {
        setHeaderDraft(headerDraftOf(d));
        setItemDrafts(
          Object.fromEntries(
            d.items.map((it) => [it.id, { blNumber: it.blNumber ?? '', notes: it.notes ?? '' }])
          )
        );
        try {
          const el = await api.get<ManifestEligibleCargo[]>(
            `/manifests/eligible-cargo?voyageId=${d.voyageId}&manifestId=${d.id}`
          );
          setEligible(el);
        } catch {
          setEligible([]);
        }
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('errors.loadDetail'));
    }
  }

  async function saveHeader() {
    if (!detail || !headerDraft) return;
    setSaving(true);
    setFormError(null);
    try {
      const d = await api.patch<ManifestDetail>(`/manifests/${detail.id}`, {
        shipperId: headerDraft.shipperId || null,
        consigneeId: headerDraft.consigneeId || null,
        agentId: headerDraft.agentId || null,
        notifyParty: headerDraft.notifyParty || null,
        description: headerDraft.description || null,
        notes: headerDraft.notes || null,
        gasCost: headerDraft.gasCost === '' ? null : headerDraft.gasCost,
        lashingCost: headerDraft.lashingCost === '' ? null : headerDraft.lashingCost,
        shipperCost: headerDraft.shipperCost === '' ? null : headerDraft.shipperCost,
        podCost: headerDraft.podCost === '' ? null : headerDraft.podCost,
        polCost: headerDraft.polCost === '' ? null : headerDraft.polCost,
        currencyCode:
          headerDraft.currencyCode.trim() === '' ? null : headerDraft.currencyCode.trim(),
      });
      setDetail(d);
      setHeaderDraft(headerDraftOf(d));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('errors.save'));
    } finally {
      setSaving(false);
    }
  }

  async function addCargo() {
    if (!detail || !newCargoId) return;
    setSaving(true);
    setFormError(null);
    try {
      const d = await api.post<ManifestDetail>(`/manifests/${detail.id}/items`, {
        cargoId: newCargoId,
        blNumber: newBlNumber.trim() || undefined,
      });
      setDetail(d);
      setItemDrafts(
        Object.fromEntries(
          d.items.map((it) => [it.id, { blNumber: it.blNumber ?? '', notes: it.notes ?? '' }])
        )
      );
      setNewCargoId('');
      setNewBlNumber('');
      try {
        const el = await api.get<ManifestEligibleCargo[]>(
          `/manifests/eligible-cargo?voyageId=${d.voyageId}&manifestId=${d.id}`
        );
        setEligible(el);
      } catch {
        setEligible([]);
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('errors.addItem'));
    } finally {
      setSaving(false);
    }
  }

  function updateItemDraft(itemId: string, patch: Partial<ItemDraft>) {
    setItemDrafts((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { blNumber: '', notes: '' }), ...patch },
    }));
  }

  async function saveItem(item: ManifestItem) {
    if (!detail) return;
    const draft = itemDrafts[item.id];
    if (draft && !draft.blNumber.trim() && !draft.notes.trim()) {
      setFormError(t('errors.blOrNotes'));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const d = await api.patch<ManifestDetail>(`/manifests/${detail.id}/items/${item.id}`, {
        blNumber: draft?.blNumber.trim() || null,
        notes: draft?.notes.trim() || null,
      });
      setDetail(d);
      setItemDrafts(
        Object.fromEntries(
          d.items.map((it) => [it.id, { blNumber: it.blNumber ?? '', notes: it.notes ?? '' }])
        )
      );
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('errors.save'));
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item: ManifestItem) {
    if (!detail) return;
    setSaving(true);
    setFormError(null);
    try {
      const d = await api.del<ManifestDetail>(`/manifests/${detail.id}/items/${item.id}`);
      setDetail(d);
      setItemDrafts(
        Object.fromEntries(
          d.items.map((it) => [it.id, { blNumber: it.blNumber ?? '', notes: it.notes ?? '' }])
        )
      );
      try {
        const el = await api.get<ManifestEligibleCargo[]>(
          `/manifests/eligible-cargo?voyageId=${d.voyageId}&manifestId=${d.id}`
        );
        setEligible(el);
      } catch {
        setEligible([]);
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('errors.removeItem'));
    } finally {
      setSaving(false);
    }
  }

  async function submitManifest() {
    if (!confirmingSubmit) return;
    setSaving(true);
    setFormError(null);
    try {
      const d = await api.post<ManifestDetail>(`/manifests/${confirmingSubmit.id}/submit`);
      setConfirmingSubmit(null);
      if (viewing) setDetail(d);
      await load(page, search, statusFilter, voyageFilter, createdFrom, createdTo);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('errors.submit'));
    } finally {
      setSaving(false);
    }
  }

  async function approveManifest() {
    if (!confirmingApprove) return;
    setSaving(true);
    setFormError(null);
    try {
      const d = await api.post<ManifestDetail>(`/manifests/${confirmingApprove.id}/approve`);
      setConfirmingApprove(null);
      if (viewing) setDetail(d);
      await load(page, search, statusFilter, voyageFilter, createdFrom, createdTo);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('errors.approve'));
    } finally {
      setSaving(false);
    }
  }

  async function cancelManifest() {
    if (!confirmingCancel) return;
    setFormError(null);
    if (!cancelReason.trim()) {
      setFormError(t('errors.reasonRequired'));
      return;
    }
    setSaving(true);
    try {
      const d = await api.post<ManifestDetail>(`/manifests/${confirmingCancel.id}/cancel`, {
        cancelReason: cancelReason.trim(),
      });
      setConfirmingCancel(null);
      setCancelReason('');
      if (viewing) setDetail(d);
      await load(page, search, statusFilter, voyageFilter, createdFrom, createdTo);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('errors.cancel'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteManifest() {
    if (!confirmingDelete) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.del(`/manifests/${confirmingDelete.id}`);
      setConfirmingDelete(null);
      if (viewing?.id === confirmingDelete.id) setViewing(null);
      await load(page, search, statusFilter, voyageFilter, createdFrom, createdTo);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('errors.delete'));
    } finally {
      setSaving(false);
    }
  }

  const isDraft = detail !== null && detail.status === 'DRAFT';
  const editable = isDraft && canUpdate;

  function fmtW(w: string | null): string {
    return w === null ? '—' : w;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: tNav('manifest') }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('new')}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{t('register')}</CardTitle>
          <CardDescription>{t('registerHint')}</CardDescription>
        </CardHeader>
        <CardContent className="border-b border-border pb-3 pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label={t('searchPlaceholder')}
              />
            </div>
            <select
              className={SELECT_CLASS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label={t('table.status')}
            >
              <option value="">{t('allStatuses')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
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
              aria-label={t('table.voyage')}
            >
              <option value="">{t('allVoyages')}</option>
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
              placeholder={t('createdFrom')}
            />
            <Input
              type="date"
              className={SELECT_CLASS + ' min-w-[140px]'}
              value={createdTo}
              onChange={(e) => {
                setCreatedTo(e.target.value);
                setPage(1);
              }}
              placeholder={t('createdTo')}
            />
          </div>
        </CardContent>

        {loading ? (
          <PageLoader label={t('loading')} />
        ) : error ? (
          <CardContent>
            <ErrorState
              message={error}
              onRetry={() => load(page, search, statusFilter, voyageFilter, createdFrom, createdTo)}
            />
          </CardContent>
        ) : data && data.data.length === 0 ? (
          <CardContent>
            <EmptyState title={t('empty.title')} description={t('empty.description')} />
          </CardContent>
        ) : (
          <TableScroll className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t('table.no')}</th>
                  <th className="px-3 py-2 font-medium">{t('table.voyage')}</th>
                  <th className="px-3 py-2 font-medium">{t('table.route')}</th>
                  <th className="px-3 py-2 font-medium">{t('table.status')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('table.items')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('table.totalWeight')}</th>
                  <th className="px-3 py-2 font-medium">{t('table.created')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs text-foreground/90">
                      {row.manifestNumber}
                    </td>
                    <td className="px-3 py-2">
                      {row.voyage?.voyageNumber ?? '—'}
                      {row.vesselName ? ` · ${row.vesselName}` : ''}
                    </td>
                    <td className="px-3 py-2">
                      {row.polPort?.code ?? '—'} → {row.podPort?.code ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={statusVariant(row.status)} dot>
                        {t(`status.${row.status}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">{row._count?.items ?? 0}</td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {fmtW(row.totalWeight ?? null)}
                    </td>
                    <td className="px-3 py-2">{formatDateShort(row.createdAt, locale)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openDetail(row)}
                            aria-label={t('actions.view')}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canSubmit && row.status === 'DRAFT' && (row._count?.items ?? 0) > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setConfirmingSubmit(row)}
                            aria-label={t('actions.submit')}
                          >
                            <Send className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canApprove && row.status === 'SUBMITTED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setConfirmingApprove(row)}
                            aria-label={t('actions.approve')}
                          >
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canCancel && (row.status === 'DRAFT' || row.status === 'SUBMITTED') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setCancelReason('');
                              setFormError(null);
                              setConfirmingCancel(row);
                            }}
                            aria-label={t('actions.cancel')}
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
        title={t('create.title')}
        description={t('create.description')}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              {t('actions.close')}
            </Button>
            <Button size="sm" loading={saving} onClick={submitCreate}>
              {t('create.submit')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mf-voyage" className="block">
              {t('create.voyage')}
            </Label>
            <select
              id="mf-voyage"
              className={SELECT_CLASS + ' w-full'}
              value={createForm.voyageId}
              onChange={(e) => setCreateForm((f) => ({ ...f, voyageId: e.target.value }))}
            >
              <option value="">{t('create.selectVoyage')}</option>
              {voyages
                .filter((v) => v.status !== 'CANCELLED')
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.voyageNumber} — {v.vessel?.name} ({v.originPort?.code} →{' '}
                    {v.destinationPort?.code})
                  </option>
                ))}
            </select>
            {voyages.length === 0 && (
              <p className="text-xs text-muted-foreground">{t('create.noVoyages')}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mf-shipper" className="block">
              {t('create.shipper')}
            </Label>
            <select
              id="mf-shipper"
              className={SELECT_CLASS + ' w-full'}
              value={createForm.shipperId}
              onChange={(e) => setCreateForm((f) => ({ ...f, shipperId: e.target.value }))}
            >
              <option value="">{t('create.selectShipper')}</option>
              {shippers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mf-consignee" className="block">
              {t('create.consignee')}
            </Label>
            <select
              id="mf-consignee"
              className={SELECT_CLASS + ' w-full'}
              value={createForm.consigneeId}
              onChange={(e) => setCreateForm((f) => ({ ...f, consigneeId: e.target.value }))}
            >
              <option value="">{t('create.selectConsignee')}</option>
              {consignees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mf-agent" className="block">
              {t('create.agent')}
            </Label>
            <select
              id="mf-agent"
              className={SELECT_CLASS + ' w-full'}
              value={createForm.agentId}
              onChange={(e) => setCreateForm((f) => ({ ...f, agentId: e.target.value }))}
            >
              <option value="">{t('create.selectAgent')}</option>
              {agents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mf-notify" className="block">
              {t('create.notifyParty')}
            </Label>
            <Input
              id="mf-notify"
              value={createForm.notifyParty}
              onChange={(e) => setCreateForm((f) => ({ ...f, notifyParty: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mf-description" className="block">
              {t('create.descriptionField')}
            </Label>
            <textarea
              id="mf-description"
              className="min-h-[56px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mf-notes" className="block">
              {t('create.notes')}
            </Label>
            <textarea
              id="mf-notes"
              className="min-h-[56px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
        title={viewing ? viewing.manifestNumber : t('title')}
        description={
          detail
            ? `${detail.voyage?.voyageNumber ?? ''} · ${detail.vesselName ?? ''} · ${
                detail.polPort?.code ?? '—'
              } → ${detail.podPort?.code ?? '—'}`
            : '…'
        }
        footer={
          <>
            {detail?.status === 'DRAFT' && (
              <p className="mr-auto text-xs text-muted-foreground">{t('detail.draftHint')}</p>
            )}
            {detail?.status === 'SUBMITTED' && (
              <p className="mr-auto text-xs text-muted-foreground">{t('detail.submittedHint')}</p>
            )}
            {(detail?.status === 'APPROVED' || detail?.status === 'CANCELLED') && (
              <p className="mr-auto text-xs text-muted-foreground">{t('detail.immutable')}</p>
            )}
            {canCancel &&
              detail &&
              (detail.status === 'DRAFT' || detail.status === 'SUBMITTED') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCancelReason('');
                    setFormError(null);
                    setConfirmingCancel(detail);
                  }}
                >
                  {t('actions.cancel')}
                </Button>
              )}
            {canDelete && detail?.status === 'DRAFT' && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => setConfirmingDelete(detail)}
              >
                <Trash2 className="h-4 w-4" />
                {t('actions.delete')}
              </Button>
            )}
            {canApprove && detail?.status === 'SUBMITTED' && (
              <Button size="sm" onClick={() => setConfirmingApprove(detail)}>
                <Stamp className="h-4 w-4" />
                {t('actions.approve')}
              </Button>
            )}
            {canSubmit && detail?.status === 'DRAFT' && detail.items.length > 0 && (
              <Button size="sm" onClick={() => setConfirmingSubmit(detail)}>
                <Send className="h-4 w-4" />
                {t('actions.submit')}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setViewing(null)}>
              {t('actions.close')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {detail && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span>
                  {t('table.status')}:{' '}
                  <Badge variant={statusVariant(detail.status)} dot>
                    {t(`status.${detail.status}`)}
                  </Badge>
                </span>
                <span className="text-muted-foreground">
                  {t('table.created')}{' '}
                  <span className="tabular-nums">{formatDateTime(detail.createdAt, locale)}</span>
                </span>
                {detail.submittedAt && (
                  <span className="text-muted-foreground">
                    {t('detail.submittedAt')}{' '}
                    <span className="tabular-nums">
                      {formatDateTime(detail.submittedAt, locale)}
                    </span>
                  </span>
                )}
                {detail.approvedAt && (
                  <span className="text-muted-foreground">
                    {t('detail.approvedAt')}{' '}
                    <span className="tabular-nums">
                      {formatDateTime(detail.approvedAt, locale)}
                    </span>
                  </span>
                )}
              </div>
              {detail.cancelReason && (
                <p className="text-sm text-destructive">
                  {t('detail.cancelReason')}: {detail.cancelReason}
                </p>
              )}
            </div>
          )}

          {formError && (
            <p className="text-xs text-destructive" role="alert">
              {formError}
            </p>
          )}

          {detail === null ? (
            <PageLoader label={t('loading')} />
          ) : (
            <>
              {/* Header fields (editable in DRAFT) */}
              <div className="rounded-md border border-border p-3">
                <div className="mb-2 text-[13px] font-semibold">{t('detail.parties')}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="mf-d-shipper" className="text-xs text-muted-foreground">
                      {t('create.shipper')}
                    </Label>
                    {editable ? (
                      <select
                        id="mf-d-shipper"
                        className={SELECT_CLASS + ' w-full'}
                        value={headerDraft?.shipperId ?? ''}
                        onChange={(e) =>
                          setHeaderDraft((h) => (h ? { ...h, shipperId: e.target.value } : h))
                        }
                      >
                        <option value="">{t('create.selectShipper')}</option>
                        {shippers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-[13px]">{detail.shipper?.name ?? '—'}</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mf-d-consignee" className="text-xs text-muted-foreground">
                      {t('create.consignee')}
                    </Label>
                    {editable ? (
                      <select
                        id="mf-d-consignee"
                        className={SELECT_CLASS + ' w-full'}
                        value={headerDraft?.consigneeId ?? ''}
                        onChange={(e) =>
                          setHeaderDraft((h) => (h ? { ...h, consigneeId: e.target.value } : h))
                        }
                      >
                        <option value="">{t('create.selectConsignee')}</option>
                        {consignees.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-[13px]">{detail.consignee?.name ?? '—'}</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mf-d-agent" className="text-xs text-muted-foreground">
                      {t('create.agent')}
                    </Label>
                    {editable ? (
                      <select
                        id="mf-d-agent"
                        className={SELECT_CLASS + ' w-full'}
                        value={headerDraft?.agentId ?? ''}
                        onChange={(e) =>
                          setHeaderDraft((h) => (h ? { ...h, agentId: e.target.value } : h))
                        }
                      >
                        <option value="">{t('create.selectAgent')}</option>
                        {agents.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-[13px]">{detail.agent?.name ?? '—'}</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mf-d-notify" className="text-xs text-muted-foreground">
                      {t('create.notifyParty')}
                    </Label>
                    {editable ? (
                      <Input
                        id="mf-d-notify"
                        className="h-8"
                        value={headerDraft?.notifyParty ?? ''}
                        onChange={(e) =>
                          setHeaderDraft((h) => (h ? { ...h, notifyParty: e.target.value } : h))
                        }
                      />
                    ) : (
                      <div className="text-[13px]">{detail.notifyParty ?? '—'}</div>
                    )}
                  </div>
                </div>

                <div className="mt-3 mb-2 text-[13px] font-semibold">{t('detail.costs')}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(
                    [
                      ['gasCost', t('detail.gasCost')],
                      ['lashingCost', t('detail.lashingCost')],
                      ['shipperCost', t('detail.shipperCost')],
                      ['podCost', t('detail.podCost')],
                      ['polCost', t('detail.polCost')],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      {editable ? (
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-8 tabular-nums"
                          value={headerDraft?.[field] ?? ''}
                          onChange={(e) =>
                            setHeaderDraft((h) => (h ? { ...h, [field]: e.target.value } : h))
                          }
                        />
                      ) : (
                        <div className="text-[13px] tabular-nums">
                          {(detail as unknown as Record<string, string | null>)[field] ?? '—'}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('detail.currency')}</Label>
                    {editable ? (
                      <Input
                        className="h-8 uppercase"
                        maxLength={3}
                        value={headerDraft?.currencyCode ?? ''}
                        onChange={(e) =>
                          setHeaderDraft((h) =>
                            h ? { ...h, currencyCode: e.target.value.toUpperCase() } : h
                          )
                        }
                      />
                    ) : (
                      <div className="text-[13px]">{detail.currencyCode ?? '—'}</div>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="mf-d-desc" className="text-xs text-muted-foreground">
                      {t('create.descriptionField')}
                    </Label>
                    {editable ? (
                      <textarea
                        id="mf-d-desc"
                        className="min-h-[48px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={headerDraft?.description ?? ''}
                        onChange={(e) =>
                          setHeaderDraft((h) => (h ? { ...h, description: e.target.value } : h))
                        }
                      />
                    ) : (
                      <div className="text-[13px]">{detail.description ?? '—'}</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mf-d-notes" className="text-xs text-muted-foreground">
                      {t('create.notes')}
                    </Label>
                    {editable ? (
                      <textarea
                        id="mf-d-notes"
                        className="min-h-[48px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={headerDraft?.notes ?? ''}
                        onChange={(e) =>
                          setHeaderDraft((h) => (h ? { ...h, notes: e.target.value } : h))
                        }
                      />
                    ) : (
                      <div className="text-[13px]">{detail.notes ?? '—'}</div>
                    )}
                  </div>
                </div>

                {editable && (
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant="outline" loading={saving} onClick={saveHeader}>
                      <Save className="h-4 w-4" />
                      {t('actions.save')}
                    </Button>
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[13px] font-semibold">{t('items.title')}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {t('detail.totalWeight')}: {fmtW(detail.totalWeight ?? null)} ·{' '}
                    {t('detail.totalQuantity')}: {detail.totalQuantity ?? 0} ·{' '}
                    {t('detail.totalPackages')}: {detail.totalPackages ?? 0}
                  </div>
                </div>

                {editable && (
                  <div className="mb-3 space-y-2 rounded-md bg-muted/40 p-2">
                    <div className="text-xs font-medium">{t('items.addTitle')}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className={SELECT_CLASS + ' min-w-[200px] flex-1'}
                        value={newCargoId}
                        onChange={(e) => setNewCargoId(e.target.value)}
                        aria-label={t('items.selectEligible')}
                      >
                        <option value="">{t('items.selectEligible')}</option>
                        {eligible.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.reference} · <DomainLabel value={c.cargoType} /> · {c.weight ?? '—'}{' '}
                            kg
                          </option>
                        ))}
                      </select>
                      <Input
                        className="h-9 min-w-[160px]"
                        placeholder={t('items.blNumber')}
                        value={newBlNumber}
                        onChange={(e) => setNewBlNumber(e.target.value)}
                      />
                      <Button size="sm" loading={saving} disabled={!newCargoId} onClick={addCargo}>
                        <Plus className="h-4 w-4" />
                        {t('items.addLabel')}
                      </Button>
                    </div>
                    {eligible.length === 0 && (
                      <p className="text-xs text-muted-foreground">{t('items.eligibleEmpty')}</p>
                    )}
                  </div>
                )}

                {detail.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('items.empty')}</p>
                ) : (
                  <TableScroll className="overflow-x-auto">
                    <table className="w-full text-start">
                      <thead>
                        <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-2 py-1.5 font-medium">{t('items.seq')}</th>
                          <th className="px-2 py-1.5 font-medium">{t('items.cargo')}</th>
                          <th className="px-2 py-1.5 font-medium">{t('items.blNumber')}</th>
                          <th className="px-2 py-1.5 text-end font-medium">{t('items.weight')}</th>
                          <th className="px-2 py-1.5 text-end font-medium">
                            {t('items.quantity')}
                          </th>
                          <th className="px-2 py-1.5 text-end font-medium">
                            {t('items.packages')}
                          </th>
                          <th className="px-2 py-1.5 font-medium">{t('items.notes')}</th>
                          {editable && (
                            <th className="px-2 py-1.5 text-end font-medium">
                              {t('items.actions')}
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map((item) => (
                          <tr key={item.id} className="border-b border-border/60 last:border-0">
                            <td className="px-2 py-1.5 text-[13px] tabular-nums">
                              {item.sequence}
                            </td>
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
                            <td className="px-2 py-1.5">
                              {editable ? (
                                <Input
                                  className="h-8 w-32"
                                  value={itemDrafts[item.id]?.blNumber ?? ''}
                                  onChange={(e) =>
                                    updateItemDraft(item.id, { blNumber: e.target.value })
                                  }
                                  aria-label={t('items.blNumber')}
                                />
                              ) : (
                                <span className="text-[13px]">{item.blNumber ?? '—'}</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-end text-[13px] tabular-nums">
                              {fmtW(item.weight)}
                            </td>
                            <td className="px-2 py-1.5 text-end text-[13px] tabular-nums">
                              {item.quantity ?? '—'}
                            </td>
                            <td className="px-2 py-1.5 text-end text-[13px] tabular-nums">
                              {item.packages ?? '—'}
                            </td>
                            <td className="px-2 py-1.5">
                              {editable ? (
                                <Input
                                  className="h-8 w-40"
                                  value={itemDrafts[item.id]?.notes ?? ''}
                                  onChange={(e) =>
                                    updateItemDraft(item.id, { notes: e.target.value })
                                  }
                                  aria-label={t('items.notes')}
                                />
                              ) : (
                                <span className="text-[13px]">{item.notes ?? '—'}</span>
                              )}
                            </td>
                            {editable && (
                              <td className="px-2 py-1.5 text-end">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    loading={saving}
                                    onClick={() => saveItem(item)}
                                    aria-label={t('actions.save')}
                                  >
                                    <Save className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                    onClick={() => removeItem(item)}
                                    aria-label={t('items.remove')}
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableScroll>
                )}
              </div>
            </>
          )}
        </div>
      </Dialog>

      {/* Submit confirm */}
      <ConfirmDialog
        open={!!confirmingSubmit}
        onOpenChange={(open) => !open && setConfirmingSubmit(null)}
        title={t('confirm.submitTitle')}
        description={t('confirm.submitBody', { no: confirmingSubmit?.manifestNumber ?? '' })}
        confirmLabel={t('confirm.confirmSubmit')}
        loading={saving}
        onConfirm={submitManifest}
        error={formError}
      />

      {/* Approve confirm */}
      <ConfirmDialog
        open={!!confirmingApprove}
        onOpenChange={(open) => !open && setConfirmingApprove(null)}
        title={t('confirm.approveTitle')}
        description={t('confirm.approveBody', { no: confirmingApprove?.manifestNumber ?? '' })}
        confirmLabel={t('confirm.confirmApprove')}
        loading={saving}
        onConfirm={approveManifest}
        error={formError}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirmingDelete}
        onOpenChange={(open) => !open && setConfirmingDelete(null)}
        title={t('confirm.deleteTitle')}
        description={t('confirm.deleteBody', { no: confirmingDelete?.manifestNumber ?? '' })}
        confirmLabel={t('confirm.confirmDelete')}
        loading={saving}
        onConfirm={deleteManifest}
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
        title={t('confirm.cancelTitle')}
        description={t('confirm.cancelBody', { no: confirmingCancel?.manifestNumber ?? '' })}
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
              {t('confirm.keep')}
            </Button>
            <Button variant="destructive" size="sm" loading={saving} onClick={cancelManifest}>
              {t('confirm.confirmCancel')}
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="mf-cancel-reason" className="block">
            {t('confirm.reason')}
          </Label>
          <textarea
            id="mf-cancel-reason"
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
