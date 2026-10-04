'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import type {
  BillOfLading,
  BillOfLadingDetail,
  BillOfLadingItem,
  BillEligibleManifestItem,
  BillStatus,
  BillType,
  FreightTerms,
  CustomerListItem,
  Manifest,
  PaginatedResult,
} from '@shipping/shared';
import {
  Plus,
  Eye,
  CheckCircle2,
  XCircle,
  Stamp,
  Save,
  Trash2,
} from 'lucide-react';
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

// P4-U4 (ADR-046 ruling 1): four-state lifecycle. ISSUED is retained in the enum
// (additive migration) but unreachable post-backfill, so it is not offered as a filter.
const STATUSES: BillStatus[] = ['DRAFT', 'FINAL', 'APPROVED', 'RELEASED', 'CANCELLED'];
const BILL_TYPES: BillType[] = ['HOUSE', 'MASTER'];
const FREIGHT_TERMS: FreightTerms[] = ['PREPAID', 'COLLECT'];

function statusVariant(
  s: BillStatus
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  switch (s) {
    case 'DRAFT':
      return 'neutral';
    case 'FINAL':
      return 'warning';
    case 'APPROVED':
    case 'RELEASED':
    case 'ISSUED': // legacy value (backfilled rows are APPROVED)
      return 'success';
    default:
      // CANCELLED, plus a ?? fallback for any future value (no blank/undefined badge)
      return 'danger';
  }
}

interface CreateForm {
  manifestId: string;
  billType: BillType;
  freightTerms: string;
  carrierName: string;
  placeOfIssue: string;
  originals: string;
  freightAmount: string;
  currencyCode: string;
  notifyParty: string;
  goodsDescription: string;
  shipmentMarks: string;
  notes: string;
}

const EMPTY_CREATE: CreateForm = {
  manifestId: '',
  billType: 'HOUSE',
  freightTerms: '',
  carrierName: '',
  placeOfIssue: '',
  originals: '',
  freightAmount: '',
  currencyCode: '',
  notifyParty: '',
  goodsDescription: '',
  shipmentMarks: '',
  notes: '',
};

interface HeaderDraft {
  billType: BillType;
  freightTerms: string;
  carrierName: string;
  placeOfIssue: string;
  dateOfIssue: string;
  originals: string;
  freightAmount: string;
  currencyCode: string;
  notifyParty: string;
  goodsDescription: string;
  shipmentMarks: string;
  notes: string;
}

export default function BillsOfLadingPage() {
  const t = useTranslations('bill');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const { hasPermission } = useAuth();

  const [data, setData] = useState<PaginatedResult<BillOfLading> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [approvedManifests, setApprovedManifests] = useState<Manifest[]>([]);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BillOfLadingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [headerDraft, setHeaderDraft] = useState<HeaderDraft | null>(null);
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);

  const [eligible, setEligible] = useState<BillEligibleManifestItem[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<{
    manifestItemId: string;
    goodsDescription: string;
    marksAndNumbers: string;
    packages: string;
    grossWeight: string;
    volume: string;
  }>({ manifestItemId: '', goodsDescription: '', marksAndNumbers: '', packages: '', grossWeight: '', volume: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [confirmIssue, setConfirmIssue] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [confirmRemoveItem, setConfirmRemoveItem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get<PaginatedResult<BillOfLading>>(
        `/bills?${params.toString()}`
      );
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadCreateOptions = useCallback(async () => {
    try {
      const [manifests, custs] = await Promise.all([
        api.get<PaginatedResult<Manifest>>('/manifests?status=APPROVED&pageSize=100&sort=approvedAt&order=desc'),
        api.get<PaginatedResult<CustomerListItem>>('/customers?pageSize=100'),
      ]);
      setApprovedManifests(manifests.data);
      setCustomers(custs.data);
    } catch {
      /* options are best-effort; create dialog shows empty list */
    }
  }, []);

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE);
    setCreateError(null);
    setCreateOpen(true);
    void loadCreateOptions();
  };

  const createBill = async () => {
    if (!createForm.manifestId) {
      setCreateError(t('create.errors.manifestRequired'));
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const payload: Record<string, unknown> = {
        manifestId: createForm.manifestId,
        billType: createForm.billType,
      };
      if (createForm.freightTerms) payload.freightTerms = createForm.freightTerms;
      if (createForm.carrierName) payload.carrierName = createForm.carrierName;
      if (createForm.placeOfIssue) payload.placeOfIssue = createForm.placeOfIssue;
      if (createForm.originals) payload.originals = Number(createForm.originals);
      if (createForm.freightAmount) payload.freightAmount = createForm.freightAmount;
      if (createForm.currencyCode) payload.currencyCode = createForm.currencyCode;
      if (createForm.notifyParty) payload.notifyParty = createForm.notifyParty;
      if (createForm.goodsDescription) payload.goodsDescription = createForm.goodsDescription;
      if (createForm.shipmentMarks) payload.shipmentMarks = createForm.shipmentMarks;
      if (createForm.notes) payload.notes = createForm.notes;
      const created = await api.post<BillOfLading>('/bills', payload);
      setCreateOpen(false);
      setViewingId(created.id);
      await openDetail(created.id);
    } catch (e) {
      setCreateError(e instanceof ApiError ? e.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  const openDetail = useCallback(async (id: string) => {
    setViewingId(id);
    setDetailLoading(true);
    setDetail(null);
    setHeaderError(null);
    setActionError(null);
    try {
      const d = await api.get<BillOfLadingDetail>(`/bills/${id}`);
      setDetail(d);
      setHeaderDraft({
        billType: d.billType,
        freightTerms: d.freightTerms ?? '',
        carrierName: d.carrierName ?? '',
        placeOfIssue: d.placeOfIssue ?? '',
        dateOfIssue: d.dateOfIssue ? d.dateOfIssue.slice(0, 10) : '',
        originals: d.originals != null ? String(d.originals) : '',
        freightAmount: d.freightAmount != null ? String(d.freightAmount) : '',
        currencyCode: d.currencyCode ?? '',
        notifyParty: d.notifyParty ?? '',
        goodsDescription: d.goodsDescription ?? '',
        shipmentMarks: d.shipmentMarks ?? '',
        notes: d.notes ?? '',
      });
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to load bill');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshDetail = useCallback(async () => {
    if (viewingId) await openDetail(viewingId);
  }, [viewingId, openDetail]);

  const saveHeader = async () => {
    if (!viewingId || !headerDraft) return;
    setSavingHeader(true);
    setHeaderError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (headerDraft.billType !== (detail?.billType ?? '')) payload.billType = headerDraft.billType;
      payload.freightTerms = headerDraft.freightTerms || null;
      payload.carrierName = headerDraft.carrierName || null;
      payload.placeOfIssue = headerDraft.placeOfIssue || null;
      payload.dateOfIssue = headerDraft.dateOfIssue || null;
      payload.originals = headerDraft.originals ? Number(headerDraft.originals) : null;
      payload.freightAmount = headerDraft.freightAmount || null;
      payload.currencyCode = headerDraft.currencyCode || null;
      payload.notifyParty = headerDraft.notifyParty || null;
      payload.goodsDescription = headerDraft.goodsDescription || null;
      payload.shipmentMarks = headerDraft.shipmentMarks || null;
      payload.notes = headerDraft.notes || null;
      await api.patch<BillOfLadingDetail>(`/bills/${viewingId}`, payload);
      await refreshDetail();
    } catch (e) {
      setHeaderError(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSavingHeader(false);
    }
  };

  const loadEligible = useCallback(async () => {
    if (!detail) return;
    try {
      const rows = await api.get<BillEligibleManifestItem[]>(
        `/bills/eligible-items?manifestId=${detail.manifestId}`
      );
      setEligible(rows);
    } catch {
      setEligible([]);
    }
  }, [detail]);

  const openAddItem = () => {
    setAddForm({
      manifestItemId: '',
      goodsDescription: '',
      marksAndNumbers: '',
      packages: '',
      grossWeight: '',
      volume: '',
    });
    setAddError(null);
    setAddOpen(true);
    void loadEligible();
  };

  const addItem = async () => {
    if (!viewingId) return;
    if (!addForm.manifestItemId) {
      setAddError(t('items.errors.lineRequired'));
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const payload: Record<string, unknown> = {
        manifestItemId: addForm.manifestItemId,
      };
      if (addForm.goodsDescription) payload.goodsDescription = addForm.goodsDescription;
      if (addForm.marksAndNumbers) payload.marksAndNumbers = addForm.marksAndNumbers;
      if (addForm.packages) payload.packages = Number(addForm.packages);
      if (addForm.grossWeight) payload.grossWeight = addForm.grossWeight;
      if (addForm.volume) payload.volume = addForm.volume;
      const d = await api.post<BillOfLadingDetail>(`/bills/${viewingId}/items`, payload);
      setDetail(d);
      setAddOpen(false);
    } catch (e) {
      setAddError(e instanceof ApiError ? e.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!viewingId) return;
    try {
      const d = await api.del<BillOfLadingDetail>(`/bills/${viewingId}/items/${itemId}`);
      setDetail(d);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to remove');
    } finally {
      setConfirmRemoveItem(null);
    }
  };

  const issueBill = async () => {
    if (!viewingId) return;
    setConfirmIssue(false);
    try {
      const d = await api.post<BillOfLadingDetail>(`/bills/${viewingId}/issue`, {});
      setDetail(d);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to issue');
    }
  };

  const cancelBill = async () => {
    if (!viewingId) return;
    if (!cancelReason.trim()) return;
    setConfirmCancel(false);
    try {
      const d = await api.post<BillOfLadingDetail>(`/bills/${viewingId}/cancel`, {
        cancelReason: cancelReason.trim(),
      });
      setDetail(d);
      setCancelReason('');
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to cancel');
    }
  };

  const deleteBill = async () => {
    if (!viewingId) return;
    setConfirmDelete(false);
    try {
      await api.del<BillOfLadingDetail>(`/bills/${viewingId}`);
      setViewingId(null);
      setDetail(null);
      await load();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to delete');
    }
  };

  const fmtWeight = (v: string | null | undefined) =>
    v == null ? '—' : Number(v).toLocaleString();
  const fmtVolume = (v: string | null | undefined) =>
    v == null ? '—' : Number(v).toFixed(3);

  const totalPages = data?.meta.totalPages ?? 1;
  const canCreate = hasPermission('bill:create');
  const canUpdate = hasPermission('bill:update');
  const canDelete = hasPermission('bill:delete');
  const canIssue = hasPermission('bill:issue');
  const canCancel = hasPermission('bill:cancel');
  const isDraft = detail?.status === 'DRAFT';

  const selectedManifest = approvedManifests.find(
    (m) => m.id === createForm.manifestId
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: tNav('operations'), href: '/dashboard' },
          { label: tNav('billOfLading') },
        ]}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('page.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('page.description')}</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="ms-2 h-4 w-4" />
            {t('actions.create')}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <CardTitle>{t('list.title')}</CardTitle>
              <CardDescription>
                {t('list.description', {
                  count: data?.meta.totalItems ?? 0,
                })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={t('list.search')}
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                className="md:w-64"
              />
              <select
                className={SELECT_CLASS}
                value={statusFilter}
                onChange={(e) => {
                  setPage(1);
                  setStatusFilter(e.target.value);
                }}
              >
                <option value="">{t('list.allStatuses')}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : !data || data.data.length === 0 ? (
            <EmptyState
              title={t('list.empty.title')}
              description={t('list.empty.description')}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-start">{t('fields.billNumber')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.status')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.billType')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.manifest')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.vessel')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.route')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.consignee')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.itemsCount')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.totalPackages')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.totalGrossWeight')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.issuedAt')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b transition-colors hover:bg-muted/40 cursor-pointer"
                      onClick={() => void openDetail(b.id)}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{b.billNumber}</td>
                      <td className="px-3 py-2">
                        <Badge variant={statusVariant(b.status)}>{t(`status.${b.status}`)}</Badge>
                      </td>
                      <td className="px-3 py-2">{t(`billType.${b.billType}`)}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {b.manifest?.manifestNumber ?? '—'}
                      </td>
                      <td className="px-3 py-2">{b.vesselName}</td>
                      <td className="px-3 py-2 text-xs">
                        {b.manifest?.polPort?.code ?? '?'} → {b.manifest?.podPort?.code ?? '?'}
                      </td>
                      <td className="px-3 py-2">
                        {b.consignee?.name ?? b.notifyParty ?? '—'}
                      </td>
                      <td className="px-3 py-2">{b._count?.items ?? 0}</td>
                      <td className="px-3 py-2">{b.totalPackages}</td>
                      <td className="px-3 py-2">{fmtWeight(b.totalGrossWeight)}</td>
                      <td className="px-3 py-2 text-xs">
                        {b.issuedAt ? formatDateTime(b.issuedAt, locale) : '—'}
                      </td>
                      <td className="px-3 py-2 text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openDetail(b.id);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && totalPages > 1 && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={data.meta.totalItems}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t('create.title')}
        description={t('create.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('actions.close')}
            </Button>
            <Button onClick={() => void createBill()} disabled={creating}>
              {creating ? t('create.creating') : t('actions.create')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>{t('create.manifest')}</Label>
            <select
              className={SELECT_CLASS}
              value={createForm.manifestId}
              onChange={(e) => setCreateForm({ ...createForm, manifestId: e.target.value })}
            >
              <option value="">{t('create.selectManifest')}</option>
              {approvedManifests.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.manifestNumber} — {m.vesselName} ({m.polPort?.code ?? '?'} →{' '}
                  {m.podPort?.code ?? '?'})
                </option>
              ))}
            </select>
            {selectedManifest && (
              <p className="text-xs text-muted-foreground">
                {t('create.manifestInfo', {
                  items: selectedManifest._count?.items ?? 0,
                  weight: Number(selectedManifest.totalWeight).toLocaleString(),
                })}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('fields.billType')}</Label>
              <select
                className={SELECT_CLASS}
                value={createForm.billType}
                onChange={(e) =>
                  setCreateForm({ ...createForm, billType: e.target.value as BillType })
                }
              >
                {BILL_TYPES.map((bt) => (
                  <option key={bt} value={bt}>
                    {t(`billType.${bt}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('fields.freightTerms')}</Label>
              <select
                className={SELECT_CLASS}
                value={createForm.freightTerms}
                onChange={(e) => setCreateForm({ ...createForm, freightTerms: e.target.value })}
              >
                <option value="">{t('freightTerms.none')}</option>
                {FREIGHT_TERMS.map((ft) => (
                  <option key={ft} value={ft}>
                    {t(`freightTerms.${ft}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('fields.carrierName')}</Label>
              <Input
                value={createForm.carrierName}
                onChange={(e) => setCreateForm({ ...createForm, carrierName: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('fields.placeOfIssue')}</Label>
              <Input
                value={createForm.placeOfIssue}
                onChange={(e) => setCreateForm({ ...createForm, placeOfIssue: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('fields.originals')}</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={createForm.originals}
                onChange={(e) => setCreateForm({ ...createForm, originals: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('fields.freightAmount')}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={createForm.freightAmount}
                onChange={(e) => setCreateForm({ ...createForm, freightAmount: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('fields.currencyCode')}</Label>
              <Input
                maxLength={3}
                placeholder="USD"
                value={createForm.currencyCode}
                onChange={(e) =>
                  setCreateForm({ ...createForm, currencyCode: e.target.value.toUpperCase() })
                }
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('fields.notifyParty')}</Label>
            <Input
              value={createForm.notifyParty}
              onChange={(e) => setCreateForm({ ...createForm, notifyParty: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('fields.goodsDescription')}</Label>
            <Input
              value={createForm.goodsDescription}
              onChange={(e) =>
                setCreateForm({ ...createForm, goodsDescription: e.target.value })
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('fields.shipmentMarks')}</Label>
            <Input
              value={createForm.shipmentMarks}
              onChange={(e) => setCreateForm({ ...createForm, shipmentMarks: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('fields.notes')}</Label>
            <Input
              value={createForm.notes}
              onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            />
          </div>
          {createError && (
            <p className="text-sm text-destructive">{createError}</p>
          )}
        </div>
      </Dialog>

      {/* Detail dialog */}
      <Dialog
        open={!!viewingId}
        onOpenChange={(o) => {
          if (!o) {
            setViewingId(null);
            setDetail(null);
            void load();
          }
        }}
        title={detail ? `${detail.billNumber}` : t('detail.loading')}
        description={
          detail
            ? `${t(`status.${detail.status}`)} — ${detail.manifest?.manifestNumber ?? ''} (${detail.manifest?.polPort?.code ?? '?'} → ${detail.manifest?.podPort?.code ?? '?'})`
            : undefined
        }
      >
        {detailLoading || !detail ? (
          <PageLoader />
        ) : (
          <div className="space-y-6">
            {actionError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionError}
              </p>
            )}

            {/* Header (editable in DRAFT) */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('detail.headerTitle')}</h3>
                {isDraft && canUpdate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void saveHeader()}
                    disabled={savingHeader}
                  >
                    <Save className="ms-1 h-3.5 w-3.5" />
                    {savingHeader ? t('detail.saving') : t('actions.save')}
                  </Button>
                )}
              </div>
              {headerDraft && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.billType')}</Label>
                    <select
                      className={SELECT_CLASS}
                      disabled={!isDraft}
                      value={headerDraft.billType}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, billType: e.target.value as BillType })
                      }
                    >
                      {BILL_TYPES.map((bt) => (
                        <option key={bt} value={bt}>
                          {t(`billType.${bt}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.freightTerms')}</Label>
                    <select
                      className={SELECT_CLASS}
                      disabled={!isDraft}
                      value={headerDraft.freightTerms}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, freightTerms: e.target.value })
                      }
                    >
                      <option value="">{t('freightTerms.none')}</option>
                      {FREIGHT_TERMS.map((ft) => (
                        <option key={ft} value={ft}>
                          {t(`freightTerms.${ft}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.carrierName')}</Label>
                    <Input
                      disabled={!isDraft}
                      value={headerDraft.carrierName}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, carrierName: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.placeOfIssue')}</Label>
                    <Input
                      disabled={!isDraft}
                      value={headerDraft.placeOfIssue}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, placeOfIssue: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.dateOfIssue')}</Label>
                    <Input
                      type="date"
                      disabled={!isDraft}
                      value={headerDraft.dateOfIssue}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, dateOfIssue: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.originals')}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      disabled={!isDraft}
                      value={headerDraft.originals}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, originals: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.freightAmount')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={!isDraft}
                      value={headerDraft.freightAmount}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, freightAmount: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.currencyCode')}</Label>
                    <Input
                      maxLength={3}
                      disabled={!isDraft}
                      value={headerDraft.currencyCode}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, currencyCode: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.notifyParty')}</Label>
                    <Input
                      disabled={!isDraft}
                      value={headerDraft.notifyParty}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, notifyParty: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    <Label className="text-xs">{t('fields.goodsDescription')}</Label>
                    <Input
                      disabled={!isDraft}
                      value={headerDraft.goodsDescription}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, goodsDescription: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    <Label className="text-xs">{t('fields.shipmentMarks')}</Label>
                    <Input
                      disabled={!isDraft}
                      value={headerDraft.shipmentMarks}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, shipmentMarks: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-3 grid gap-1.5">
                    <Label className="text-xs">{t('fields.notes')}</Label>
                    <Input
                      disabled={!isDraft}
                      value={headerDraft.notes}
                      onChange={(e) => setHeaderDraft({ ...headerDraft, notes: e.target.value })}
                    />
                  </div>
                </div>
              )}
              {headerError && <p className="text-sm text-destructive">{headerError}</p>}
              <div className="grid grid-cols-3 gap-3 rounded-md border p-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">{t('fields.totalPackages')}</p>
                  <p className="text-lg font-semibold">{detail.totalPackages}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('fields.totalGrossWeight')}</p>
                  <p className="text-lg font-semibold">{fmtWeight(detail.totalGrossWeight)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('fields.totalVolume')}</p>
                  <p className="text-lg font-semibold">{fmtVolume(detail.totalVolume)}</p>
                </div>
              </div>
            </section>

            {/* Items */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('items.title')}</h3>
                {isDraft && canUpdate && (
                  <Button size="sm" onClick={openAddItem}>
                    <Plus className="ms-1 h-3.5 w-3.5" />
                    {t('items.add')}
                  </Button>
                )}
              </div>
              {detail.items.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  {t('items.empty')}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-2 text-start">#</th>
                        <th className="px-2 py-2 text-start">{t('items.cargo')}</th>
                        <th className="px-2 py-2 text-start">{t('items.goodsDescription')}</th>
                        <th className="px-2 py-2 text-start">{t('items.marks')}</th>
                        <th className="px-2 py-2 text-start">{t('items.packages')}</th>
                        <th className="px-2 py-2 text-start">{t('items.packageType')}</th>
                        <th className="px-2 py-2 text-start">{t('items.grossWeight')}</th>
                        <th className="px-2 py-2 text-start">{t('items.volume')}</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((it: BillOfLadingItem) => (
                        <tr key={it.id} className="border-b last:border-0">
                          <td className="px-2 py-1.5 text-xs text-muted-foreground">{it.sequence}</td>
                          <td className="px-2 py-1.5 font-mono text-xs">
                            {it.cargo?.reference ?? '—'}
                          </td>
                          <td className="px-2 py-1.5">{it.goodsDescription ?? '—'}</td>
                          <td className="px-2 py-1.5 text-xs">{it.marksAndNumbers ?? '—'}</td>
                          <td className="px-2 py-1.5">{it.packages ?? '—'}</td>
                          <td className="px-2 py-1.5 text-xs">{it.packageType ?? '—'}</td>
                          <td className="px-2 py-1.5">{fmtWeight(it.grossWeight)}</td>
                          <td className="px-2 py-1.5">{fmtVolume(it.volume)}</td>
                          <td className="px-2 py-1.5 text-end">
                            {isDraft && canUpdate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmRemoveItem(it.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Lifecycle actions */}
            <section className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
              {isDraft && canDelete && (
                <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="ms-1 h-4 w-4" />
                  {t('actions.delete')}
                </Button>
              )}
              {(detail.status === 'DRAFT' || detail.status === 'FINAL') && canIssue && (
                <Button onClick={() => setConfirmIssue(true)}>
                  <Stamp className="ms-1 h-4 w-4" />
                  {t('actions.issue')}
                </Button>
              )}
              {(detail.status === 'DRAFT' || detail.status === 'FINAL') && canCancel && (
                <Button variant="destructive" onClick={() => setConfirmCancel(true)}>
                  <XCircle className="ms-1 h-4 w-4" />
                  {t('actions.cancel')}
                </Button>
              )}
              {detail.status === 'APPROVED' && (
                <Badge variant="success">
                  <CheckCircle2 className="ms-1 h-3.5 w-3.5" />
                  {t('detail.issuedOn', {
                    date: detail.dateOfIssue
                      ? formatDateShort(detail.dateOfIssue, locale)
                      : formatDateTime(detail.issuedAt ?? detail.createdAt, locale),
                  })}
                </Badge>
              )}
            </section>
          </div>
        )}
      </Dialog>

      {/* Add item dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title={t('items.addTitle')}
        description={t('items.addDescription')}
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {t('actions.close')}
            </Button>
            <Button onClick={() => void addItem()} disabled={adding}>
              {adding ? t('items.adding') : t('items.add')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>{t('items.selectLine')}</Label>
            <select
              className={SELECT_CLASS}
              value={addForm.manifestItemId}
              onChange={(e) => {
                const line = eligible.find((el) => el.id === e.target.value);
                setAddForm({
                  manifestItemId: e.target.value,
                  goodsDescription: line?.cargo?.specification ?? '',
                  marksAndNumbers: '',
                  packages: line?.packages != null ? String(line.packages) : '',
                  grossWeight: line?.weight != null ? String(Number(line.weight)) : '',
                  volume: '',
                });
              }}
            >
              <option value="">{t('items.selectLinePlaceholder')}</option>
              {eligible.map((el) => (
                <option key={el.id} value={el.id}>
                  #{el.sequence} — {el.cargo?.reference ?? el.cargoId}
                  {el.packages != null ? ` (${el.packages} pkg)` : ''}
                </option>
              ))}
            </select>
            {eligible.length === 0 && (
              <p className="text-xs text-muted-foreground">{t('items.noEligible')}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('items.goodsDescription')}</Label>
              <Input
                value={addForm.goodsDescription}
                onChange={(e) => setAddForm({ ...addForm, goodsDescription: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('items.marks')}</Label>
              <Input
                value={addForm.marksAndNumbers}
                onChange={(e) => setAddForm({ ...addForm, marksAndNumbers: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('items.packages')}</Label>
              <Input
                type="number"
                min={0}
                value={addForm.packages}
                onChange={(e) => setAddForm({ ...addForm, packages: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('items.grossWeight')}</Label>
              <Input
                type="number"
                step="0.001"
                min={0}
                value={addForm.grossWeight}
                onChange={(e) => setAddForm({ ...addForm, grossWeight: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('items.volume')}</Label>
              <Input
                type="number"
                step="0.001"
                min={0}
                value={addForm.volume}
                onChange={(e) => setAddForm({ ...addForm, volume: e.target.value })}
              />
            </div>
          </div>
          {addError && <p className="text-sm text-destructive">{addError}</p>}
        </div>
      </Dialog>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmIssue}
        onOpenChange={setConfirmIssue}
        title={t('confirm.issue.title')}
        description={t('confirm.issue.description')}
        confirmLabel={t('actions.issue')}
        onConfirm={() => void issueBill()}
      />
      <Dialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t('confirm.cancel.title')}
        description={t('confirm.cancel.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              {t('actions.close')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void cancelBill()}
              disabled={!cancelReason.trim()}
            >
              {t('actions.cancel')}
            </Button>
          </>
        }
      >
        <div className="grid gap-1.5">
          <Label>{t('confirm.cancel.reason')}</Label>
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t('confirm.cancel.reasonPlaceholder')}
          />
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('confirm.delete.title')}
        description={t('confirm.delete.description')}
        confirmLabel={t('actions.delete')}
        destructive
        onConfirm={() => void deleteBill()}
      />
      <ConfirmDialog
        open={!!confirmRemoveItem}
        onOpenChange={(o) => !o && setConfirmRemoveItem(null)}
        title={t('confirm.removeItem.title')}
        description={t('confirm.removeItem.description')}
        confirmLabel={t('items.remove')}
        destructive
        onConfirm={() => confirmRemoveItem && void removeItem(confirmRemoveItem)}
      />
    </div>
  );
}
