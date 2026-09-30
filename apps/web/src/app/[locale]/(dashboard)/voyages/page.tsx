'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
  PaginatedResult,
  VoyageListItem,
  VoyageDetail,
  VoyageStatus,
  VesselListItem,
  PortListItem,
} from '@shipping/shared';
import {
  Plus,
  Eye,
  CalendarClock,
  Play,
  CheckCircle2,
  Ban,
} from 'lucide-react';
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

const STATUSES: VoyageStatus[] = [
  'DRAFT',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

const STATUS_META: Record<
  VoyageStatus,
  { label: string; variant: 'neutral' | 'warning' | 'success' }
> = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  SCHEDULED: { label: 'Scheduled', variant: 'neutral' },
  IN_PROGRESS: { label: 'In progress', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

interface VoyageForm {
  vesselId: string;
  tugVesselId: string;
  bargeVesselId: string;
  originPortId: string;
  destinationPortId: string;
  /** Additional destinations beyond the primary one (each gets its own leg). */
  destinations: string[];
  notes: string;
}

const EMPTY_FORM: VoyageForm = {
  vesselId: '',
  tugVesselId: '',
  bargeVesselId: '',
  originPortId: '',
  destinationPortId: '',
  destinations: [],
  notes: '',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'short', timeStyle: 'short' });
}

export default function VoyagesPage() {
  const { hasPermission } = useAuth();
  const t = useTranslations('voyages');
  const [data, setData] = useState<PaginatedResult<VoyageListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vesselFilter, setVesselFilter] = useState('');

  const [vessels, setVessels] = useState<VesselListItem[]>([]);
  const [tugs, setTugs] = useState<VesselListItem[]>([]);
  const [barges, setBarges] = useState<VesselListItem[]>([]);
  const [ports, setPorts] = useState<PortListItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<VoyageListItem | null>(null);
  const [detail, setDetail] = useState<VoyageDetail | null>(null);
  const [scheduling, setScheduling] = useState<VoyageListItem | null>(null);
  const [confirmingStart, setConfirmingStart] = useState<VoyageListItem | null>(null);
  const [confirmingComplete, setConfirmingComplete] = useState<VoyageListItem | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<VoyageListItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<VoyageForm>(EMPTY_FORM);
  // destinationPortId -> next per-destination number ({seq}/{YY}), advisory only.
  const [numberPreview, setNumberPreview] = useState<Record<string, string>>({});

  const canCreate = hasPermission('voyage:create');
  const canRead = hasPermission('voyage:read');
  const canSchedule = hasPermission('voyage:schedule');
  const canStart = hasPermission('voyage:start');
  const canComplete = hasPermission('voyage:complete');
  const canCancel = hasPermission('voyage:cancel');

  const load = useCallback(
    async (p: number, q: string, status: string, vesselId: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      if (status) params.set('status', status);
      if (vesselId) params.set('vesselId', vesselId);
      try {
        setData(await api.get<PaginatedResult<VoyageListItem>>(`/voyages?${params.toString()}`));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load voyages');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(page, search, statusFilter, vesselFilter);
  }, [load, page, search, statusFilter, vesselFilter]);

  // Reference data for the create form + vessel filter (degrades gracefully when
  // the actor lacks vessel/port read permissions).
  useEffect(() => {
    (async () => {
      try {
        const [ves, tug, barge, port] = await Promise.all([
          api.get<PaginatedResult<VesselListItem>>('/vessels?pageSize=100'),
          api.get<PaginatedResult<VesselListItem>>('/vessels?vesselType=TUG&pageSize=100'),
          api.get<PaginatedResult<VesselListItem>>('/vessels?vesselType=BARGE&pageSize=100'),
          api.get<PaginatedResult<PortListItem>>('/ports?pageSize=100'),
        ]);
        setVessels(ves.data);
        setTugs(tug.data);
        setBarges(barge.data);
        setPorts(port.data);
      } catch {
        /* form selects degrade gracefully */
      }
    })();
  }, []);

  // Per-destination number preview: shows what allocation WILL produce.
  useEffect(() => {
    const ids = [form.destinationPortId, ...form.destinations].filter(Boolean);
    if (ids.length === 0) {
      setNumberPreview({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.get<Array<{ destinationPortId: string; nextVoyageNumber: string }>>(
          `/voyages/number-preview?destinationPortIds=${ids.join(',')}`
        );
        if (!cancelled) {
          setNumberPreview(
            Object.fromEntries(rows.map((row) => [row.destinationPortId, row.nextVoyageNumber]))
          );
        }
      } catch {
        /* preview is advisory — never block the form */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.destinationPortId, form.destinations]);

  function applyFilters() {
    setPage(1);
  }

  function updateField<K extends keyof VoyageForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addDestination() {
    setForm((prev) => ({ ...prev, destinations: [...prev.destinations, ''] }));
  }

  function updateDestination(index: number, value: string) {
    setForm((prev) => ({
      ...prev,
      destinations: prev.destinations.map((existing, i) => (i === index ? value : existing)),
    }));
  }

  function removeDestination(index: number) {
    setForm((prev) => ({
      ...prev,
      destinations: prev.destinations.filter((_, i) => i !== index),
    }));
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setCreateOpen(true);
  }

  async function openView(row: VoyageListItem) {
    setViewing(row);
    setDetail(null);
    try {
      setDetail(await api.get<VoyageDetail>(`/voyages/${row.id}`));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to load voyage');
      setViewing(null);
    }
  }

  async function submitCreate() {
    setFormError(null);
    if (!form.vesselId || !form.originPortId || !form.destinationPortId) {
      setFormError('Vessel, origin and destination are required.');
      return;
    }
    if (form.originPortId === form.destinationPortId) {
      setFormError('Origin and destination must be different ports.');
      return;
    }
    // Additional destination rows: every row must be filled and unique —
    // mirrors the API's per-voyage duplicate-destination rejection.
    const extraDestinations = form.destinations;
    if (extraDestinations.some((dest) => !dest)) {
      setFormError(t('legs.emptyRow'));
      return;
    }
    const allDestinations = [form.destinationPortId, ...extraDestinations];
    if (new Set(allDestinations).size !== allDestinations.length) {
      setFormError(t('legs.duplicate'));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        vesselId: form.vesselId,
        originPortId: form.originPortId,
        destinationPortId: form.destinationPortId,
      };
      if (extraDestinations.length > 0) payload.destinations = extraDestinations;
      // Optional tug/barge pairing (Phase 2): only sent when selected, so a
      // plain self-propelled voyage payload is unchanged from before.
      if (form.tugVesselId) payload.tugVesselId = form.tugVesselId;
      if (form.bargeVesselId) payload.bargeVesselId = form.bargeVesselId;
      if (form.notes.trim()) payload.notes = form.notes.trim();
      await api.post<VoyageDetail>('/voyages', payload);
      setCreateOpen(false);
      setPage(1);
      await load(page, search, statusFilter, vesselFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create voyage');
    } finally {
      setSaving(false);
    }
  }

  async function submitSchedule() {
    if (!scheduling) return;
    setFormError(null);
    if (!departure || !arrival) {
      setFormError('Set both departure and arrival (ETA) times.');
      return;
    }
    setSaving(true);
    try {
      await api.post<VoyageDetail>(`/voyages/${scheduling.id}/schedule`, {
        plannedDepartureAt: new Date(departure).toISOString(),
        plannedArrivalAt: new Date(arrival).toISOString(),
      });
      setScheduling(null);
      setDeparture('');
      setArrival('');
      if (viewing) setDetail(await api.get<VoyageDetail>(`/voyages/${scheduling.id}`));
      await load(page, search, statusFilter, vesselFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to schedule voyage');
    } finally {
      setSaving(false);
    }
  }

  async function submitTransition(action: 'start' | 'complete' | 'cancel', row: VoyageListItem) {
    setFormError(null);
    setSaving(true);
    try {
      if (action === 'cancel') {
        if (!cancelReason.trim()) {
          setFormError('A cancellation reason is required.');
          setSaving(false);
          return;
        }
        await api.post<VoyageDetail>(`/voyages/${row.id}/cancel`, { cancelReason: cancelReason.trim() });
      } else {
        await api.post<VoyageDetail>(`/voyages/${row.id}/${action}`);
      }
      setConfirmingStart(null);
      setConfirmingComplete(null);
      setConfirmingCancel(null);
      setCancelReason('');
      if (viewing) setDetail(await api.get<VoyageDetail>(`/voyages/${row.id}`));
      await load(page, search, statusFilter, vesselFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to update voyage');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: 'Voyages' }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">Voyages</h1>
          <p className="text-sm text-muted-foreground">
            Operational sailings. A vessel cannot run two overlapping voyages.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New voyage
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Voyage schedule</CardTitle>
          <CardDescription>Live operational data. No placeholder records.</CardDescription>
        </CardHeader>
        <CardContent className="border-b border-border pb-3 pt-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters();
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <Input
              className="max-w-xs"
              placeholder="Search number, vessel, ports…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search voyages"
            />
            <select
              className={SELECT_CLASS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                applyFilters();
              }}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
            <select
              className={SELECT_CLASS}
              value={vesselFilter}
              onChange={(e) => {
                setVesselFilter(e.target.value);
                applyFilters();
              }}
              aria-label="Filter by vessel"
            >
              <option value="">All vessels</option>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </CardContent>
        {loading ? (
          <PageLoader label="Loading voyages…" />
        ) : error ? (
          <CardContent>
            <ErrorState message={error} onRetry={() => load(page, search, statusFilter, vesselFilter)} />
          </CardContent>
        ) : data && data.data.length === 0 ? (
          <CardContent>
            <EmptyState title="No voyages found" description="Try a different search or filter." />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Voyage</th>
                  <th className="px-3 py-2 font-medium">Vessel</th>
                  <th className="px-3 py-2 font-medium">Route</th>
                  <th className="px-3 py-2 font-medium">Departure</th>
                  <th className="px-3 py-2 font-medium">Arrival (ETA)</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((v) => (
                  <tr key={v.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 text-[13px] font-medium text-foreground">
                      {v.voyageNumber}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{v.vessel.name}</span>
                        <span className="text-[11px]">{v.vessel.code}</span>
                      </div>
                      {(v.tugVessel || v.bargeVessel) && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {[v.tugVessel, v.bargeVessel]
                            .filter(Boolean)
                            .map((tv) => `${tv!.name} (${tv!.code})`)
                            .join(' + ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      {v.originPort.code} →{' '}
                      {v.legs.length > 0
                        ? v.legs.map((leg) => leg.destinationPort.code).join(' → ')
                        : v.destinationPort.code}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">{fmtDate(v.plannedDepartureAt)}</td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">{fmtDate(v.plannedArrivalAt)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_META[v.status].variant} dot>
                        {STATUS_META[v.status].label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openView(v)}
                            title="View details"
                            aria-label={`View voyage ${v.voyageNumber}`}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canSchedule && v.status === 'DRAFT' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setScheduling(v);
                              setDeparture('');
                              setArrival('');
                              setFormError(null);
                            }}
                          >
                            <CalendarClock className="h-3.5 w-3.5" />
                            Schedule
                          </Button>
                        )}
                        {canStart && v.status === 'SCHEDULED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setConfirmingStart(v)}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Start
                          </Button>
                        )}
                        {canComplete && v.status === 'IN_PROGRESS' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setConfirmingComplete(v)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Complete
                          </Button>
                        )}
                        {canCancel && (v.status === 'DRAFT' || v.status === 'SCHEDULED') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setConfirmingCancel(v);
                              setCancelReason('');
                              setFormError(null);
                            }}
                            title="Cancel voyage"
                            aria-label={`Cancel voyage ${v.voyageNumber}`}
                          >
                            <Ban className="h-4 w-4" aria-hidden="true" />
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
        title="New voyage"
        description="Voyages start in DRAFT with no cargo assignment."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={submitCreate}>
              Create voyage
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="voy-vessel" className="block">
              Vessel *
            </Label>
            <select
              id="voy-vessel"
              className={SELECT_CLASS + ' w-full'}
              value={form.vesselId}
              onChange={(e) => updateField('vesselId', e.target.value)}
              autoFocus
            >
              <option value="">Select vessel…</option>
              {vessels.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.code})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="voy-tug" className="block">
                {t('pairing.tug')}
              </Label>
              <select
                id="voy-tug"
                className={SELECT_CLASS + ' w-full'}
                value={form.tugVesselId}
                onChange={(e) => updateField('tugVesselId', e.target.value)}
              >
                <option value="">{t('pairing.noneTug')}</option>
                {tugs.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voy-barge" className="block">
                {t('pairing.barge')}
              </Label>
              <select
                id="voy-barge"
                className={SELECT_CLASS + ' w-full'}
                value={form.bargeVesselId}
                onChange={(e) => updateField('bargeVesselId', e.target.value)}
              >
                <option value="">{t('pairing.noneBarge')}</option>
                {barges.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">{t('pairing.hint')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="voy-origin" className="block">
                Origin *
              </Label>
              <select
                id="voy-origin"
                className={SELECT_CLASS + ' w-full'}
                value={form.originPortId}
                onChange={(e) => updateField('originPortId', e.target.value)}
              >
                <option value="">Select…</option>
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voy-dest" className="block">
                Destination *
              </Label>
              <select
                id="voy-dest"
                className={SELECT_CLASS + ' w-full'}
                value={form.destinationPortId}
                onChange={(e) => updateField('destinationPortId', e.target.value)}
              >
                <option value="">Select…</option>
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Optional extra destinations: one leg each, own {seq}/{YY} number */}
          <div className="space-y-1.5">
            <Label className="block">{t('legs.title')}</Label>
            <p className="text-[11px] text-muted-foreground">{t('legs.hint')}</p>
            {form.destinations.map((destinationPortId, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  className={SELECT_CLASS + ' flex-1'}
                  value={destinationPortId}
                  onChange={(e) => updateDestination(index, e.target.value)}
                  aria-label={t('legs.rowLabel', { n: index + 2 })}
                >
                  <option value="">{t('legs.selectPlaceholder')}</option>
                  {ports
                    .filter(
                      (port) =>
                        port.id === destinationPortId ||
                        (port.id !== form.destinationPortId &&
                          !form.destinations.includes(port.id))
                    )
                    .map((port) => (
                      <option key={port.id} value={port.id}>
                        {port.code} — {port.name}
                      </option>
                    ))}
                </select>
                <span
                  className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground"
                  title={t('legs.previewTitle')}
                >
                  {destinationPortId ? (numberPreview[destinationPortId] ?? '…') : ''}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 px-2 text-xs"
                  onClick={() => removeDestination(index)}
                  aria-label={t('legs.removeLabel', { n: index + 2 })}
                >
                  {t('legs.remove')}
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addDestination}>
              <Plus className="h-3.5 w-3.5" />
              {t('legs.add')}
            </Button>
            {form.destinationPortId && (
              <p className="font-mono text-[11px] text-muted-foreground">
                {t('legs.previewPrefix')} {numberPreview[form.destinationPortId] ?? '…'}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="voy-notes" className="block">
              Notes
            </Label>
            <Input
              id="voy-notes"
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        {formError && <p className="mt-3 text-xs text-destructive" role="alert">{formError}</p>}
      </Dialog>

      {/* Detail dialog */}
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing ? viewing.voyageNumber : 'Voyage'}
        description={viewing ? `${viewing.originPort.code} → ${viewing.destinationPort.code}` : undefined}
        footer={
          <Button variant="outline" size="sm" onClick={() => setViewing(null)}>
            Close
          </Button>
        }
      >
        {detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Vessel</div>
                <div>{detail.vessel.name} ({detail.vessel.code})</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t('pairing.tug')}</div>
                <div>
                  {detail.tugVessel
                    ? `${detail.tugVessel.name} (${detail.tugVessel.code})`
                    : t('pairing.noneTug')}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t('pairing.barge')}</div>
                <div>
                  {detail.bargeVessel
                    ? `${detail.bargeVessel.name} (${detail.bargeVessel.code})`
                    : t('pairing.noneBarge')}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div>
                  <Badge variant={STATUS_META[detail.status].variant} dot>
                    {STATUS_META[detail.status].label}
                  </Badge>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Departure</div>
                <div>{fmtDate(detail.plannedDepartureAt)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Arrival (ETA)</div>
                <div>{fmtDate(detail.plannedArrivalAt)}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Notes</div>
                <div>{detail.notes ?? '—'}</div>
              </div>
              {detail.cancelReason && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Cancellation reason</div>
                  <div>{detail.cancelReason}</div>
                </div>
              )}
            </div>
            {/* Destination legs: one row per destination with its own number */}
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">{t('legs.title')}</div>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-1 pr-2 font-medium">{t('legs.legColumn')}</th>
                    <th className="py-1 pr-2 font-medium">{t('legs.destinationColumn')}</th>
                    <th className="py-1 font-medium">{t('legs.numberColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.legs.map((leg) => (
                    <tr key={leg.id} className="border-b border-border/60 last:border-0">
                      <td className="py-1.5 pr-2 text-[13px] text-muted-foreground">{leg.legNumber}</td>
                      <td className="py-1.5 pr-2 text-[13px]">
                        {leg.destinationPort.name}{' '}
                        <span className="text-muted-foreground">({leg.destinationPort.code})</span>
                      </td>
                      <td className="py-1.5 font-mono text-[13px]">{leg.voyageNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <PageLoader label="Loading voyage details…" />
        )}
      </Dialog>

      {/* Schedule dialog */}
      <Dialog
        open={!!scheduling}
        onOpenChange={(open) => {
          if (!open) {
            setScheduling(null);
            setDeparture('');
            setArrival('');
          }
        }}
        title={scheduling ? `Schedule — ${scheduling.voyageNumber}` : 'Schedule voyage'}
        description="Set the planned departure and arrival (ETA) times. Required to leave DRAFT."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setScheduling(null);
                setDeparture('');
                setArrival('');
              }}
            >
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={submitSchedule}>
              Schedule
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sch-dep" className="block">
              Departure *
            </Label>
            <Input
              id="sch-dep"
              type="datetime-local"
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sch-arr" className="block">
              Arrival (ETA) *
            </Label>
            <Input
              id="sch-arr"
              type="datetime-local"
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
            />
          </div>
        </div>
        {(formError && scheduling) && (
          <p className="mt-3 text-xs text-destructive" role="alert">{formError}</p>
        )}
      </Dialog>

      {/* Start confirm */}
      <ConfirmDialog
        open={!!confirmingStart}
        onOpenChange={(open) => !open && setConfirmingStart(null)}
        title="Start voyage"
        description={confirmingStart ? `Mark ${confirmingStart.voyageNumber} as in progress.` : undefined}
        confirmLabel="Start"
        loading={saving}
        onConfirm={() => confirmingStart && submitTransition('start', confirmingStart)}
      />

      {/* Complete confirm */}
      <ConfirmDialog
        open={!!confirmingComplete}
        onOpenChange={(open) => !open && setConfirmingComplete(null)}
        title="Complete voyage"
        description={confirmingComplete ? `Mark ${confirmingComplete.voyageNumber} as completed.` : undefined}
        confirmLabel="Complete"
        loading={saving}
        onConfirm={() => confirmingComplete && submitTransition('complete', confirmingComplete)}
      />

      {/* Cancel dialog */}
      <Dialog
        open={!!confirmingCancel}
        onOpenChange={(open) => !open && setConfirmingCancel(null)}
        title={confirmingCancel ? `Cancel ${confirmingCancel.voyageNumber}` : 'Cancel voyage'}
        description="A cancellation reason is required."
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
              Close
            </Button>
            <Button
              size="sm"
              variant="destructive"
              loading={saving}
              onClick={() => confirmingCancel && submitTransition('cancel', confirmingCancel)}
            >
              Cancel voyage
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason" className="block">
            Reason *
          </Label>
          <Input
            id="cancel-reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Rerouted via Jebel Ali"
          />
        </div>
        {formError && <p className="mt-3 text-xs text-destructive" role="alert">{formError}</p>}
      </Dialog>
    </div>
  );
}