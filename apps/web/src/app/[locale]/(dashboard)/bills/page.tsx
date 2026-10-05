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
  PaginatedResult,
  VoyageListItem,
} from '@shipping/shared';
import {
  Plus,
  Eye,
  CheckCircle2,
  XCircle,
  Stamp,
  Save,
  Trash2,
  History,
  RotateCcw,
  Send,
  FileText,
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
  /** P4-U7: voyage + cargo lines (ADR-045 decision 1 target path). The legacy
   * manifest picker was removed from the UI — the API legacy path stays (drops are
   * post-Phase-5 with explicit approval), but the shipped page no longer uses it. */
  voyageId: string;
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
  voyageId: '',
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

/** P4-U5/P4-U7: one row of GET /bills/:id/revisions (list-only, immutable). */
interface RevisionRow {
  id: string;
  revisionNumber: number;
  note: string | null;
  createdAt: string;
  createdBy: { id: string; email: string; fullName: string | null } | null;
}

/** P4-U7: GET /bills/:id/document — the ADR-009 hook payload (Phase 7 renders it). */
interface DocumentPayload {
  documentType: string;
  template: string;
  generatedAt: string;
  render: { engine: string | null; format: string; note: string };
  watermark: string | null;
  document: {
    billNumber: string;
    revision: number;
    status: string;
    billType: string;
    carrierName: string | null;
    placeOfIssue: string | null;
    notifyParty: string | null;
    goodsDescription: string | null;
    notes: string | null;
    route: { vesselName: string; voyageNumber: string | null };
    parties: { shipper: { name: string } | null; consignee: { name: string } | null };
    totals: { totalPackages: number; totalGrossWeight: string; totalVolume: string };
    items: Array<{
      sequence: number;
      cargoReference: string | null;
      goodsDescription: string | null;
      packages: number | null;
      grossWeight: string | null;
    }>;
  };
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

  const [voyages, setVoyages] = useState<VoyageListItem[]>([]);
  const [createEligible, setCreateEligible] = useState<BillEligibleManifestItem[]>([]);
  const [createCargoIds, setCreateCargoIds] = useState<string[]>([]);

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

  // P4-U7: revision history (list-only), release action/record, document hook
  const [revisions, setRevisions] = useState<RevisionRow[]>([]);
  const [revNote, setRevNote] = useState('');
  const [revBusy, setRevBusy] = useState(false);
  const [revError, setRevError] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [releaseAudit, setReleaseAudit] = useState<{
    timestamp: string;
    actorEmail: string;
  } | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [docData, setDocData] = useState<DocumentPayload | null>(null);
  const [docBusy, setDocBusy] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

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
      // P4-U7: voyage + cargo is the shipped create path (ADR-045 decision 1)
      const rows = await api.get<PaginatedResult<VoyageListItem>>(
        '/voyages?pageSize=100&sort=createdAt&order=desc'
      );
      setVoyages(rows.data);
    } catch {
      /* options are best-effort; create dialog shows empty list */
    }
  }, []);

  const loadCreateEligible = useCallback(async (voyageId: string) => {
    if (!voyageId) {
      setCreateEligible([]);
      setCreateCargoIds([]);
      return;
    }
    try {
      const rows = await api.get<BillEligibleManifestItem[]>(
        `/bills/eligible-items?voyageId=${voyageId}`
      );
      setCreateEligible(rows);
      setCreateCargoIds([]); // selection resets with the voyage
    } catch {
      setCreateEligible([]);
      setCreateCargoIds([]);
    }
  }, []);

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE);
    setCreateError(null);
    setCreateCargoIds([]);
    setCreateEligible([]);
    setCreateOpen(true);
    void loadCreateOptions();
  };

  const createBill = async () => {
    if (!createForm.voyageId) {
      setCreateError(t('create.errors.voyageRequired'));
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      // voyage + cargo (P4-U2 target path): parties/destination/vessel derive
      // server-side and the per-destination number mints automatically.
      const payload: Record<string, unknown> = {
        voyageId: createForm.voyageId,
        billType: createForm.billType,
      };
      if (createCargoIds.length > 0) payload.cargoIds = createCargoIds;
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
    setRevError(null);
    setRevNote('');
    try {
      const d = await api.get<BillOfLadingDetail>(`/bills/${id}`);
      setDetail(d);
      // P4-U7 best-effort companions (failures must not block the detail view)
      void api
        .get<RevisionRow[]>(`/bills/${id}/revisions`)
        .then(setRevisions)
        .catch(() => setRevisions([]));
      void api
        .get<{ items: Array<{ action: string; actorEmail: string; timestamp: string }> }>(
          `/bills/${id}/audit`
        )
        .then((r) => {
          const rel = r.items.find((x) => x.action === 'bill:release') ?? null;
          setReleaseAudit(rel ? { timestamp: rel.timestamp, actorEmail: rel.actorEmail } : null);
        })
        .catch(() => setReleaseAudit(null));
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
      // both modes shipped by P4-U2: voyage-mode bills key lines by cargo
      const qs = detail.manifestId
        ? `manifestId=${detail.manifestId}`
        : `voyageId=${detail.voyageId}`;
      const rows = await api.get<BillEligibleManifestItem[]>(
        `/bills/eligible-items?${qs}`
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
      // P4-U2 source modes: voyage-mode bills claim by cargoId, legacy by manifest line
      const payload: Record<string, unknown> = detail?.manifestId
        ? { manifestItemId: addForm.manifestItemId }
        : { cargoId: addForm.manifestItemId };
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

  // P4-U5/P4-U7: revision history actions (list-only — no edit/delete exists)
  const freezeRevision = async () => {
    if (!viewingId) return;
    setRevBusy(true);
    setRevError(null);
    try {
      // POST returns the single created revision — always re-GET the full list
      // (an object here would poison the array state and crash the section)
      await api.post<RevisionRow>(`/bills/${viewingId}/revisions`, {
        ...(revNote.trim() ? { note: revNote.trim() } : {}),
      });
      const rows = await api.get<RevisionRow[]>(`/bills/${viewingId}/revisions`);
      setRevisions(rows);
      setRevNote('');
      await refreshDetail(); // revision label advanced
    } catch (e) {
      // surface the API message verbatim (409 on non-DRAFT must not be swallowed)
      setRevError(e instanceof ApiError ? e.message : 'Failed to freeze revision');
    } finally {
      setRevBusy(false);
    }
  };

  const restoreRevision = async () => {
    if (!viewingId || confirmRestore == null) return;
    const n = confirmRestore;
    setConfirmRestore(null);
    setRevBusy(true);
    setRevError(null);
    try {
      await api.post<BillOfLadingDetail>(`/bills/${viewingId}/revisions/${n}/restore`, {});
      await refreshDetail();
      const rows = await api.get<RevisionRow[]>(`/bills/${viewingId}/revisions`);
      setRevisions(rows);
    } catch (e) {
      setRevError(e instanceof ApiError ? e.message : 'Failed to restore revision');
    } finally {
      setRevBusy(false);
    }
  };

  // P4-U6: release (final outbound step — confirm dialog, bill:release gated)
  const releaseBill = async () => {
    if (!viewingId) return;
    setConfirmRelease(false);
    try {
      await api.post<BillOfLadingDetail>(`/bills/${viewingId}/release`, {});
      await refreshDetail();
      await load();
      const r = await api.get<{ items: Array<{ action: string; actorEmail: string; timestamp: string }> }>(
        `/bills/${viewingId}/audit`
      );
      const rel = r.items.find((x) => x.action === 'bill:release') ?? null;
      setReleaseAudit(rel ? { timestamp: rel.timestamp, actorEmail: rel.actorEmail } : null);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to release');
    }
  };

  // P4-U7: document-output hook (ADR-009) — fetch the structured payload
  const openDocument = async () => {
    if (!viewingId) return;
    setDocOpen(true);
    setDocBusy(true);
    setDocError(null);
    setDocData(null);
    try {
      setDocData(await api.get<DocumentPayload>(`/bills/${viewingId}/document`));
    } catch (e) {
      setDocError(e instanceof ApiError ? e.message : 'Failed to load document data');
    } finally {
      setDocBusy(false);
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
  const canRelease = hasPermission('bill:release'); // P4-U6: release button gate
  const isDraft = detail?.status === 'DRAFT';

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
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                        {b.billNumber}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={statusVariant(b.status)}>{t(`status.${b.status}`)}</Badge>
                      </td>
                      <td className="px-3 py-2">{t(`billType.${b.billType}`)}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {b.manifest?.manifestNumber ?? '—'}
                      </td>
                      <td className="px-3 py-2">{b.vesselName}</td>
                      <td className="px-3 py-2 text-xs">
                        {b.manifest
                          ? `${b.manifest.polPort?.code ?? '?'} → ${b.manifest.podPort?.code ?? '?'}`
                          : (b.voyage?.voyageNumber ?? '—')}
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
          {/* P4-U7: voyage + cargo create (ADR-045 decision 1). The legacy manifest
              picker is removed from the UI; the API legacy path stays untouched. */}
          <div className="grid gap-1.5">
            <Label>{t('create.voyage')}</Label>
            <select
              className={SELECT_CLASS}
              value={createForm.voyageId}
              onChange={(e) => {
                setCreateForm({ ...createForm, voyageId: e.target.value });
                void loadCreateEligible(e.target.value);
              }}
            >
              <option value="">{t('create.selectVoyage')}</option>
              {voyages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.voyageNumber} — {v.vessel.name} ({v.originPort.code} → {v.destinationPort.code})
                </option>
              ))}
            </select>
            {createForm.voyageId && createEligible.length === 0 && (
              <p className="text-xs text-muted-foreground">{t('create.noCargo')}</p>
            )}
          </div>
          {createEligible.length > 0 && (
            <div className="grid gap-1.5">
              <Label>{t('create.cargoLines')}</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {createEligible.map((el) => (
                  <label key={el.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={createCargoIds.includes(el.id)}
                      onChange={(e) =>
                        setCreateCargoIds((prev) =>
                          e.target.checked ? [...prev, el.id] : prev.filter((x) => x !== el.id)
                        )
                      }
                    />
                    <span className="font-mono text-xs">{el.cargo?.reference ?? el.cargoId}</span>
                    <span className="text-xs text-muted-foreground">
                      {el.packages != null ? `${el.packages} ${t('items.packages')}` : ''}
                      {el.weight != null ? ` · ${el.weight}` : ''}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('create.selectedCount', { count: createCargoIds.length })}
              </p>
            </div>
          )}
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
            ? detail.manifest
              ? `${t(`status.${detail.status}`)} — ${detail.manifest.manifestNumber} (${detail.manifest.polPort?.code ?? '?'} → ${detail.manifest.podPort?.code ?? '?'})`
              : `${t(`status.${detail.status}`)} — ${t('create.voyage')} ${detail.voyage?.voyageNumber ?? ''}`
            : undefined
        }
      >
        {detailLoading || !detail ? (
          <PageLoader />
        ) : (
          <div className="relative space-y-6">
            {/* P4-U7: DRAFT watermark (blueprint §5.1) — cosmetic only, no state logic.
                pointer-events-none keeps the form fully usable underneath. */}
            {detail.status === 'DRAFT' && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center overflow-hidden pt-10"
              >
                <span className="rotate-[-18deg] select-none text-6xl font-bold uppercase tracking-[0.3em] text-muted-foreground/40">
                  {t('status.DRAFT')}
                </span>
              </div>
            )}
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

            {/* Revision history (P4-U5 deferred UI, shipped P4-U7): list-only —
                no edit/delete controls exist anywhere by design (ADR-045 decision 4). */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {t('revisions.title')}
                  <span className="ms-2 text-xs font-normal text-muted-foreground">
                    {t('revisions.current', { n: detail.revision })}
                  </span>
                </h3>
                {isDraft && canUpdate && (
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8 w-56"
                      placeholder={t('revisions.notePlaceholder')}
                      value={revNote}
                      onChange={(e) => setRevNote(e.target.value)}
                      disabled={revBusy}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void freezeRevision()}
                      disabled={revBusy}
                    >
                      <History className="ms-1 h-3.5 w-3.5" />
                      {revBusy ? t('revisions.working') : t('revisions.freeze')}
                    </Button>
                  </div>
                )}
              </div>
              {revError && <p className="text-sm text-destructive">{revError}</p>}
              {revisions.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                  {t('revisions.empty')}
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {revisions.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-mono text-xs">#{r.revisionNumber}</span>
                        {r.note && (
                          <span className="ms-2 text-sm text-muted-foreground">{r.note}</span>
                        )}
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDateTime(r.createdAt, locale)}
                          {r.createdBy ? ` · ${r.createdBy.email}` : ''}
                        </p>
                      </div>
                      {isDraft && canUpdate && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={revBusy}
                          onClick={() => setConfirmRestore(r.revisionNumber)}
                        >
                          <RotateCcw className="ms-1 h-3.5 w-3.5" />
                          {t('revisions.restore')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">{t('revisions.listOnly')}</p>
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
              <Button variant="outline" onClick={() => void openDocument()}>
                <FileText className="ms-1 h-4 w-4" />
                {t('actions.document')}
              </Button>
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
              {/* P4-U6 display: Release behind bill:release + confirm (final outbound step) */}
              {detail.status === 'APPROVED' && canRelease && (
                <Button onClick={() => setConfirmRelease(true)}>
                  <Send className="ms-1 h-4 w-4" />
                  {t('actions.release')}
                </Button>
              )}
              {detail.status === 'RELEASED' && (
                <Badge variant="success">
                  <CheckCircle2 className="ms-1 h-3.5 w-3.5" />
                  {releaseAudit
                    ? t('detail.releasedOn', {
                        date: formatDateTime(releaseAudit.timestamp, locale),
                        by: releaseAudit.actorEmail,
                      })
                    : t('status.RELEASED')}
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
                  marksAndNumbers: line?.marksAndNumbers ?? '',
                  packages: line?.packages != null ? String(line.packages) : '',
                  grossWeight: line?.weight != null ? String(Number(line.weight)) : '',
                  volume: '',
                });
              }}
            >
              <option value="">{t('items.selectLinePlaceholder')}</option>
              {eligible.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.sequence != null ? `#${el.sequence} — ` : ''}
                  {el.cargo?.reference ?? el.cargoId}
                  {el.packages != null ? ` (${el.packages} ${t('items.packages')})` : ''}
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

      {/* P4-U7: document-output hook view (ADR-009) — structured data today,
          Phase 7 swaps the renderer for the PDF/A template (no engine here). */}
      <Dialog
        open={docOpen}
        onOpenChange={setDocOpen}
        title={t('document.title')}
        description={t('document.description')}
        footer={
          <Button variant="outline" onClick={() => setDocOpen(false)}>
            {t('actions.close')}
          </Button>
        }
      >
        {docBusy ? (
          <PageLoader />
        ) : docError ? (
          <p className="text-sm text-destructive">{docError}</p>
        ) : docData ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <p>
                <span className="text-muted-foreground">{t('fields.billNumber')}:</span>{' '}
                <span className="font-mono">{docData.document.billNumber}</span>
              </p>
              <p>
                <span className="text-muted-foreground">{t('fields.status')}:</span>{' '}
                {t(`status.${docData.document.status as BillStatus}`)}
                {docData.watermark ? ` (${docData.watermark})` : ''}
              </p>
              <p>
                <span className="text-muted-foreground">{t('fields.vessel')}:</span>{' '}
                {docData.document.route.vesselName}
              </p>
              <p>
                <span className="text-muted-foreground">{t('revisions.title')}:</span>{' '}
                #{docData.document.revision}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                {t('document.items', { count: docData.document.items.length })}
              </p>
              <ul className="space-y-0.5">
                {docData.document.items.map((it, i) => (
                  <li key={i} className="flex justify-between text-xs">
                    <span>
                      {it.sequence}. {it.cargoReference ?? '—'} {it.goodsDescription ?? ''}
                    </span>
                    <span className="text-muted-foreground">
                      {it.packages ?? '—'} · {it.grossWeight ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">{docData.render.note}</p>
          </div>
        ) : null}
      </Dialog>

      {/* P4-U7: restore confirm (read-back into the draft; nothing is lost — the
          pre-restore capture happens server-side first) */}
      <ConfirmDialog
        open={confirmRestore != null}
        onOpenChange={(o) => {
          if (!o) setConfirmRestore(null);
        }}
        title={t('revisions.restoreConfirmTitle', { n: confirmRestore ?? 0 })}
        description={t('revisions.restoreConfirmDescription', { n: confirmRestore ?? 0 })}
        confirmLabel={t('revisions.restore')}
        onConfirm={() => void restoreRevision()}
      />

      {/* P4-U6: release is the final outbound step — explicit confirmation */}
      <ConfirmDialog
        open={confirmRelease}
        onOpenChange={setConfirmRelease}
        title={t('confirm.release.title')}
        description={t('confirm.release.description')}
        confirmLabel={t('actions.release')}
        onConfirm={() => void releaseBill()}
      />

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
