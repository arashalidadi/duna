'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  InspectionListItem,
  InspectionDetail,
  InspectionStatus,
  InspectionUserRef,
  PaginatedResult,
  CargoListItem,
  CustomerListItem,
  YardListItem,
} from '@shipping/shared';
import { Plus, Eye, CheckCircle2, XCircle, ArrowUpDown, MapPin, CalendarCheck, RotateCcw } from 'lucide-react';
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

const STATUSES: InspectionStatus[] = ['PENDING', 'BOOKED', 'DONE', 'FAILED', 'NEEDS_REINSPECTION'];

// Badge variants chosen deliberately: neutral = awaiting, info = scheduled/booked,
// success = done, danger = failed, warning = needs re-inspection (design-system §2.2:
// label always present, colour never the only signal).
const STATUS_META: Record<
  InspectionStatus,
  { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }
> = {
  PENDING: { label: 'Pending', variant: 'neutral' },
  BOOKED: { label: 'Booked', variant: 'info' },
  DONE: { label: 'Done', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'danger' },
  NEEDS_REINSPECTION: { label: 'Needs re-inspection', variant: 'warning' },
};

// ?? fallback (bookings/portal pattern): a future/unknown enum value renders a readable
// label instead of a render-time TypeError — STATUS_META[x].variant with no fallback was
// the live white-screen (22 of 25 rows are DONE).
const statusMeta = (s: InspectionStatus) =>
  STATUS_META[s] ?? { label: s.replace(/_/g, ' '), variant: 'neutral' as const };

// Shipped transitions (inspection.service.ts TRANSITIONS). A button only renders when
// the endpoint accepts that transition FROM the row's current status — e.g. `done`
// requires BOOKED (POST /done on PENDING is a live 409), and PENDING/NEEDS_REINSPECTION
// offer book+fail, BOOKED offers done+fail, FAILED offers needs-re-inspection, DONE is terminal.
const bookable = (s: InspectionStatus) => s === 'PENDING' || s === 'NEEDS_REINSPECTION';
const donable = (s: InspectionStatus) => s === 'BOOKED';
const failable = (s: InspectionStatus) => s === 'PENDING' || s === 'BOOKED';
const reinspectable = (s: InspectionStatus) => s === 'FAILED';

interface FormValues {
  cargoId: string;
  inspectorName: string;
  inspectionDate: string;
  findings: string;
  condition: string;
  verificationNotes: string;
  remarks: string;
}

const EMPTY_FORM: FormValues = {
  cargoId: '',
  inspectorName: '',
  inspectionDate: '',
  findings: '',
  condition: '',
  verificationNotes: '',
  remarks: '',
};

function fmtInspectionDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { timeZone: 'Asia/Dubai' });
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InspectionsPage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<PaginatedResult<InspectionListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [yardFilter, setYardFilter] = useState('');

  const [cargos, setCargos] = useState<CargoListItem[]>([]);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [yards, setYards] = useState<YardListItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<InspectionListItem | null>(null);
  const [detail, setDetail] = useState<InspectionDetail | null>(null);
  const [history, setHistory] = useState<InspectionListItem[]>([]);
  const [confirmingApprove, setConfirmingApprove] = useState<InspectionListItem | null>(null);
  const [confirmingReject, setConfirmingReject] = useState<InspectionListItem | null>(null);
  const [confirmingBook, setConfirmingBook] = useState<InspectionListItem | null>(null);
  const [confirmingReInspect, setConfirmingReInspect] = useState<InspectionListItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);

  const canCreate = hasPermission('inspection:create');
  const canUpdate = hasPermission('inspection:update');
  const canApprove = hasPermission('inspection:approve');
  const canReject = hasPermission('inspection:reject');
  const canRead = hasPermission('inspection:read');

  const selectedCargo = cargos.find((c) => c.id === form.cargoId) ?? null;

  const load = useCallback(
    async (p: number, q: string, status: string, customerId: string, yardId: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      if (status) params.set('status', status);
      if (customerId) params.set('customerId', customerId);
      if (yardId) params.set('yardId', yardId);
      try {
        setData(await api.get<PaginatedResult<InspectionListItem>>(`/inspections?${params.toString()}`));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load inspections');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(page, search, statusFilter, customerFilter, yardFilter);
  }, [load, page, search, statusFilter, customerFilter, yardFilter]);

  useEffect(() => {
    (async () => {
      try {
        const [cargoRes, custRes, yardRes] = await Promise.all([
          api.get<PaginatedResult<CargoListItem>>('/cargo?pageSize=100'),
          api.get<PaginatedResult<CustomerListItem>>('/customers?pageSize=100'),
          api.get<PaginatedResult<YardListItem>>('/yards?pageSize=100'),
        ]);
        setCargos(cargoRes.data);
        setCustomers(custRes.data);
        setYards(yardRes.data);
      } catch {
        /* form selects degrade gracefully */
      }
    })();
  }, []);

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setCreateOpen(true);
  }

  async function openDetail(row: InspectionListItem) {
    setViewing(row);
    setDetail(null);
    setHistory([]);
    try {
      const [d, h] = await Promise.all([
        api.get<InspectionDetail>(`/inspections/${row.id}`),
        api.get<InspectionListItem[]>(`/inspections/cargo/${row.cargo.id}/history`),
      ]);
      setDetail(d);
      setHistory(h);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to load inspection');
      setViewing(null);
    }
  }

  async function submitCreate() {
    setFormError(null);
    if (!form.cargoId) {
      setFormError('Select a cargo to inspect.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { cargoId: form.cargoId };
      if (form.inspectionDate) payload.inspectionDate = form.inspectionDate;
      if (form.inspectorName.trim()) payload.inspectorName = form.inspectorName.trim();
      if (form.findings.trim()) payload.findings = form.findings.trim();
      if (form.condition.trim()) payload.condition = form.condition.trim();
      if (form.verificationNotes.trim()) payload.verificationNotes = form.verificationNotes.trim();
      if (form.remarks.trim()) payload.remarks = form.remarks.trim();
      await api.post<InspectionDetail>('/inspections', payload);
      setCreateOpen(false);
      setPage(1);
      await load(page, search, statusFilter, customerFilter, yardFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create inspection');
    } finally {
      setSaving(false);
    }
  }

  async function submitApprove() {
    if (!confirmingApprove) return;
    setFormError(null);
    setSaving(true);
    try {
      // shipped route: POST /inspections/:id/done (permission inspection:approve);
      // /approve was renamed away in 4a39653 and 404'd.
      const updated = await api.post<InspectionDetail>(`/inspections/${confirmingApprove.id}/done`);
      setConfirmingApprove(null);
      if (viewing) setDetail(updated);
      await load(page, search, statusFilter, customerFilter, yardFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to complete inspection');
    } finally {
      setSaving(false);
    }
  }

  async function submitBook() {
    if (!confirmingBook) return;
    setFormError(null);
    setSaving(true);
    try {
      // shipped route: POST /inspections/:id/book (permission inspection:update)
      const updated = await api.post<InspectionDetail>(`/inspections/${confirmingBook.id}/book`);
      setConfirmingBook(null);
      if (viewing) setDetail(updated);
      await load(page, search, statusFilter, customerFilter, yardFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to book inspection');
    } finally {
      setSaving(false);
    }
  }

  async function submitReInspect() {
    if (!confirmingReInspect) return;
    setFormError(null);
    setSaving(true);
    try {
      // shipped route: POST /inspections/:id/needs-re-inspection (permission inspection:update)
      const updated = await api.post<InspectionDetail>(
        `/inspections/${confirmingReInspect.id}/needs-re-inspection`
      );
      setConfirmingReInspect(null);
      if (viewing) setDetail(updated);
      await load(page, search, statusFilter, customerFilter, yardFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to re-open inspection');
    } finally {
      setSaving(false);
    }
  }

  async function submitReject() {
    if (!confirmingReject) return;
    setFormError(null);
    if (!rejectReason.trim()) {
      setFormError('A rejection reason is required.');
      return;
    }
    setSaving(true);
    try {
      // shipped route: POST /inspections/:id/fail (permission inspection:reject), same
      // { rejectionReason } body — /reject was renamed away in 4a39653 and 404'd.
      const updated = await api.post<InspectionDetail>(`/inspections/${confirmingReject.id}/fail`, {
        rejectionReason: rejectReason.trim(),
      });
      setConfirmingReject(null);
      setRejectReason('');
      if (viewing) setDetail(updated);
      await load(page, search, statusFilter, customerFilter, yardFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to reject inspection');
    } finally {
      setSaving(false);
    }
  }

  function inspectorName(row: InspectionListItem): string {
    return row.inspectorName || row.createdBy?.fullName || 'Unnamed';
  }

  function rejectOpen(row: InspectionListItem) {
    setRejectReason('');
    setFormError(null);
    setConfirmingReject(row);
  }

  function approveOpen(row: InspectionListItem) {
    setFormError(null);
    setConfirmingApprove(row);
  }

  function bookOpen(row: InspectionListItem) {
    setFormError(null);
    setConfirmingBook(row);
  }

  function reInspectOpen(row: InspectionListItem) {
    setFormError(null);
    setConfirmingReInspect(row);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: 'Inspection' }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">Inspections</h1>
          <p className="text-sm text-muted-foreground">
            Cargo inspections, findings and approval status. Approved cargo is eligible for future load
            planning; rejected cargo records the reason. Live records only.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New inspection
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Inspection register</CardTitle>
          <CardDescription>Live inspection history. No placeholder data.</CardDescription>
        </CardHeader>
        <CardContent className="border-b border-border pb-3 pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Input
                placeholder="Search inspection no., cargo no., serial/VIN, customer, inspector"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label="Search inspections"
              />
            </div>
            <select
              className={SELECT_CLASS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusMeta(s).label}
                </option>
              ))}
            </select>
            <select
              className={SELECT_CLASS}
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by customer"
            >
              <option value="">All customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <select
              className={SELECT_CLASS}
              value={yardFilter}
              onChange={(e) => {
                setYardFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by yard"
            >
              <option value="">All yards</option>
              {yards.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.code} — {y.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>

        {loading ? (
          <PageLoader label="Loading inspections..." />
        ) : error ? (
          <CardContent>
            <ErrorState
              message={error}
              onRetry={() => load(page, search, statusFilter, customerFilter, yardFilter)}
            />
          </CardContent>
        ) : data && data.data.length === 0 ? (
          <CardContent>
            <EmptyState
              title="No inspections found"
              description="Try a different search or filter, or create a new inspection."
            />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Inspection No.</th>
                  <th className="px-3 py-2 font-medium">Cargo No.</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Destination</th>
                  <th className="px-3 py-2 font-medium">Yard</th>
                  <th className="px-3 py-2 font-medium">Inspector</th>
                  <th className="px-3 py-2 font-medium">Inspection date</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 text-[13px] font-medium text-foreground">
                      {row.inspectionNumber}
                    </td>
                    <td className="px-3 py-2">{row.cargo.reference}</td>
                    <td className="px-3 py-2">{row.cargo.customer.name}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {row.cargo.destinationPort ? (
                          <>
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                            <span>{row.cargo.destinationPort.code}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">{row.cargo.yard?.code ?? '—'}</td>
                    <td className="px-3 py-2">{inspectorName(row)}</td>
                    <td className="px-3 py-2">{fmtShortDate(row.inspectionDate)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={statusMeta(row.status).variant} dot>
                        {statusMeta(row.status).label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openDetail(row)}
                            aria-label={`View ${row.inspectionNumber}`}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canUpdate && bookable(row.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => bookOpen(row)}
                            aria-label={`Book ${row.inspectionNumber}`}
                          >
                            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canApprove && donable(row.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                            onClick={() => approveOpen(row)}
                            aria-label={`Approve ${row.inspectionNumber}`}
                          >
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canReject && failable(row.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => rejectOpen(row)}
                            aria-label={`Reject ${row.inspectionNumber}`}
                          >
                            <XCircle className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canUpdate && reinspectable(row.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => reInspectOpen(row)}
                            aria-label={`Re-inspect ${row.inspectionNumber}`}
                          >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
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

      {/* Create inspection */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => !open && setCreateOpen(false)}
        title="New inspection"
        description="Select the cargo to inspect. Cargo identity, customer, destination and location are read from the cargo record."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={submitCreate}>
              Create inspection
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="ins-cargo" className="block">
              Cargo *
            </Label>
            <select
              id="ins-cargo"
              className={SELECT_CLASS + ' w-full'}
              value={form.cargoId}
              onChange={(e) => updateField('cargoId', e.target.value)}
              autoFocus
            >
              <option value="">Select cargo…</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.reference} — {c.customer.name}
                </option>
              ))}
            </select>
          </div>
          {selectedCargo && (
            <div className="col-span-2 rounded-md border border-border bg-muted/40 p-3 text-[13px]">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Cargo type</dt>
                  <dd className="text-right">{selectedCargo.cargoType.replace(/_/g, ' ')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Customer</dt>
                  <dd className="text-right">{selectedCargo.customer.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Destination</dt>
                  <dd className="text-right">{selectedCargo.destinationPort?.code ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Yard</dt>
                  <dd className="text-right">{selectedCargo.yard?.code ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Serial / VIN</dt>
                  <dd className="text-right">
                    {selectedCargo.serialNumber || selectedCargo.vin || '—'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Current inspection</dt>
                  <dd className="text-right">
                    <Badge variant={statusMeta(selectedCargo.inspectionStatus).variant}>
                      {statusMeta(selectedCargo.inspectionStatus).label}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ins-date" className="block">
              Inspection date
            </Label>
            <Input
              id="ins-date"
              type="datetime-local"
              value={form.inspectionDate}
              onChange={(e) => updateField('inspectionDate', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ins-inspector" className="block">
              Inspector
            </Label>
            <Input
              id="ins-inspector"
              placeholder="Inspector name"
              value={form.inspectorName}
              onChange={(e) => updateField('inspectorName', e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="ins-findings" className="block">
              Findings
            </Label>
            <textarea
              id="ins-findings"
              className="min-h-[64px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.findings}
              onChange={(e) => updateField('findings', e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="ins-condition" className="block">
              Physical condition
            </Label>
            <textarea
              id="ins-condition"
              className="min-h-[56px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.condition}
              onChange={(e) => updateField('condition', e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="ins-verification" className="block">
              Verification notes
            </Label>
            <textarea
              id="ins-verification"
              className="min-h-[56px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Serial/chassis, quantity, weight, documentation verification"
              value={form.verificationNotes}
              onChange={(e) => updateField('verificationNotes', e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="ins-remarks" className="block">
              Remarks
            </Label>
            <textarea
              id="ins-remarks"
              className="min-h-[56px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.remarks}
              onChange={(e) => updateField('remarks', e.target.value)}
            />
          </div>
        </div>
        {formError && (
          <p className="mt-3 text-xs text-destructive" role="alert">
            {formError}
          </p>
        )}
      </Dialog>

      {/* Detail */}
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing?.inspectionNumber ?? 'Inspection'}
        description={viewing ? `${viewing.cargo.reference} — ${viewing.cargo.customer.name}` : undefined}
        footer={
          <>
            {canUpdate && detail && bookable(detail.status) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => bookOpen(detail)}
              >
                <CalendarCheck className="h-4 w-4" />
                Book
              </Button>
            )}
            {canApprove && detail && donable(detail.status) && (
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-700"
                onClick={() => approveOpen(detail)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
            )}
            {canReject && detail && failable(detail.status) && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => rejectOpen(detail)}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            )}
            {canUpdate && detail && reinspectable(detail.status) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => reInspectOpen(detail)}
              >
                <RotateCcw className="h-4 w-4" />
                Re-inspection
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setViewing(null)}>
              Close
            </Button>
          </>
        }
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Badge variant={statusMeta(detail.status).variant} dot>
                  {statusMeta(detail.status).label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Inspection {fmtInspectionDate(detail.inspectionDate)}
                </span>
              </div>
            </div>

            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cargo
              </h3>
              <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/40 p-3">
                <div>
                  <div className="text-xs text-muted-foreground">Reference</div>
                  <div className="font-medium">{detail.cargo.reference}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Cargo type</div>
                  <div>{detail.cargo.cargoType.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Customer</div>
                  <div>{detail.cargo.customer.name}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Destination</div>
                  <div>{detail.cargo.destinationPort?.code ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Serial / VIN</div>
                  <div>
                    {detail.cargo.serialNumber || detail.cargo.chassisNumber || detail.cargo.vin || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Cargo status</div>
                  <div>{detail.cargo.status.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Yard / location</div>
                  <div>
                    {detail.cargo.yard?.code ?? '—'}
                    {detail.cargo.inventory ? ` (${detail.cargo.inventory.status.replace(/_/g, ' ')})` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Readiness</div>
                  <div>
                    {detail.cargo.inspectionStatus === 'DONE'
                      ? 'Eligible for load planning'
                      : detail.cargo.inspectionStatus === 'FAILED'
                        ? 'Ineligible — failed inspection'
                        : 'Pending review'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Inspector</div>
                <div>{inspectorName(detail)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Approved</div>
                <div>{detail.approvedAt ? fmtInspectionDate(detail.approvedAt) : '—'}</div>
              </div>
            </div>

            {(detail.findings || detail.condition || detail.verificationNotes || detail.remarks) && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Findings
                </h3>
                <div className="space-y-2">
                  {detail.findings && (
                    <div>
                      <div className="text-xs text-muted-foreground">Findings</div>
                      <div className="whitespace-pre-wrap">{detail.findings}</div>
                    </div>
                  )}
                  {detail.condition && (
                    <div>
                      <div className="text-xs text-muted-foreground">Physical condition</div>
                      <div className="whitespace-pre-wrap">{detail.condition}</div>
                    </div>
                  )}
                  {detail.verificationNotes && (
                    <div>
                      <div className="text-xs text-muted-foreground">Verification</div>
                      <div className="whitespace-pre-wrap">{detail.verificationNotes}</div>
                    </div>
                  )}
                  {detail.remarks && (
                    <div>
                      <div className="text-xs text-muted-foreground">Remarks</div>
                      <div className="whitespace-pre-wrap">{detail.remarks}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {detail.status === 'FAILED' && detail.rejectionReason && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-destructive">
                  Rejection reason
                </div>
                <div className="whitespace-pre-wrap">{detail.rejectionReason}</div>
              </div>
            )}

            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Inspection history
              </h3>
              {history.length === 0 ? (
                <p className="text-muted-foreground">No previous inspections for this cargo.</p>
              ) : (
                <ul className="space-y-1.5">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className={
                        'flex items-center justify-between rounded-md border p-2 text-[13px] ' +
                        (h.id === detail.id
                          ? 'border-ring bg-muted/60'
                          : 'border-border bg-card')
                      }
                    >
                      <span className="flex items-center gap-2">
                        {h.id === detail.id && (
                          <span className="text-[10px] uppercase text-muted-foreground">Current</span>
                        )}
                        <span className="font-medium">{h.inspectionNumber}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">{inspectorName(h)}</span>
                        <span>{fmtShortDate(h.inspectionDate)}</span>
                        <Badge variant={statusMeta(h.status).variant}>{statusMeta(h.status).label}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {formError && (
              <p className="text-xs text-destructive" role="alert">
                {formError}
              </p>
            )}
          </div>
        ) : (
          <PageLoader label="Loading inspection..." />
        )}
      </Dialog>

      {/* Approve confirm (shipped route: /done — cargo inspection becomes DONE) */}
      <ConfirmDialog
        open={!!confirmingApprove}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingApprove(null);
            setFormError(null);
          }
        }}
        title="Approve inspection"
        description={`Approve ${confirmingApprove?.inspectionNumber}? This marks the inspection DONE — the cargo becomes eligible for future load planning.`}
        confirmLabel="Approve"
        loading={saving}
        error={formError}
        onConfirm={submitApprove}
      />

      {/* Book confirm (shipped route: /book — PENDING|NEEDS_REINSPECTION -> BOOKED) */}
      <ConfirmDialog
        open={!!confirmingBook}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingBook(null);
            setFormError(null);
          }
        }}
        title="Book inspection"
        description={`Book ${confirmingBook?.inspectionNumber}? Books the inspection for execution (status becomes BOOKED).`}
        confirmLabel="Book"
        loading={saving}
        error={formError}
        onConfirm={submitBook}
      />

      {/* Re-inspection confirm (shipped route: /needs-re-inspection — FAILED -> NEEDS_REINSPECTION) */}
      <ConfirmDialog
        open={!!confirmingReInspect}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingReInspect(null);
            setFormError(null);
          }
        }}
        title="Request re-inspection"
        description={`Re-open ${confirmingReInspect?.inspectionNumber}? The cargo returns to pending review and can be booked for a new inspection cycle.`}
        confirmLabel="Re-open"
        loading={saving}
        error={formError}
        onConfirm={submitReInspect}
      />

      {/* Reject dialog */}
      <Dialog
        open={!!confirmingReject}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmingReject(null);
            setRejectReason('');
            setFormError(null);
          }
        }}
        title="Reject inspection"
        description={`Reject ${confirmingReject?.inspectionNumber}? You must provide a reason. Rejected cargo is not eligible for load planning.`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setConfirmingReject(null);
                setRejectReason('');
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" size="sm" loading={saving} onClick={submitReject}>
              Reject inspection
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="reject-reason" className="block">
            Rejection reason *
          </Label>
          <textarea
            id="reject-reason"
            autoFocus
            className="min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
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