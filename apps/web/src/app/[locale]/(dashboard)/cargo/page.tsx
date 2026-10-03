'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  CargoDetail,
  CargoListItem,
  CargoStatus,
  CargoType,
  InspectionStatus,
  LoadingStatus,
  WeightUnit,
  PaginatedResult,
  CustomerListItem,
  PortListItem,
  YardListItem,
} from '@shipping/shared';
import { Plus, Eye, Ban, Trash2, ArrowUpDown, MapPin } from 'lucide-react';
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

const CARGO_TYPES: CargoType[] = ['GENERAL', 'VEHICLE', 'HEAVY_LIFT', 'CONTAINER', 'BULK', 'PROJECT'];
const STATUSES: CargoStatus[] = ['REGISTERED', 'AT_YARD', 'READY_FOR_LOADING', 'LOADED', 'DELIVERED', 'CANCELLED'];
const WEIGHT_UNITS: WeightUnit[] = ['KG', 'MT'];

interface FormValues {
  customerId: string;
  portId: string;
  yardId: string;
  destinationPortId: string;
  cargoType: CargoType;
  specification: string;
  serialNumber: string;
  chassisNumber: string;
  vin: string;
  weight: string;
  weightUnit: WeightUnit;
  quantity: string;
  packages: string;
  packageType: string;
  arrivalDate: string;
  arrivalReference: string;
  comments: string;
}

const EMPTY_FORM: FormValues = {
  customerId: '',
  portId: '',
  yardId: '',
  destinationPortId: '',
  cargoType: 'GENERAL',
  specification: '',
  serialNumber: '',
  chassisNumber: '',
  vin: '',
  weight: '',
  weightUnit: 'KG',
  quantity: '',
  packages: '',
  packageType: '',
  arrivalDate: '',
  arrivalReference: '',
  comments: '',
};

function toForm(c: CargoDetail): FormValues {
  return {
    customerId: c.customer.id,
    portId: c.port.id,
    yardId: c.yard?.id ?? '',
    destinationPortId: c.destinationPort?.id ?? '',
    cargoType: c.cargoType,
    specification: c.specification ?? '',
    serialNumber: c.serialNumber ?? '',
    chassisNumber: c.chassisNumber ?? '',
    vin: c.vin ?? '',
    weight: c.weight ?? '',
    weightUnit: c.weightUnit ?? 'KG',
    quantity: c.quantity != null ? String(c.quantity) : '',
    packages: c.packages != null ? String(c.packages) : '',
    packageType: c.packageType ?? '',
    arrivalDate: c.arrivalDate ? c.arrivalDate.slice(0, 10) : '',
    arrivalReference: c.arrivalReference ?? '',
    comments: c.comments ?? '',
  };
}

const STATUS_META: Record<CargoStatus, { label: string; variant: 'success' | 'neutral' | 'warning' | 'info' }> = {
  REGISTERED: { label: 'Registered', variant: 'neutral' },
  AT_YARD: { label: 'At yard', variant: 'info' },
  READY_FOR_LOADING: { label: 'Ready for loading', variant: 'success' },
  LOADED: { label: 'Loaded', variant: 'success' },
  DELIVERED: { label: 'Delivered', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'warning' },
};

const INSPECTION_META: Record<InspectionStatus, string> = {
  PENDING: 'Pending',
  BOOKED: 'Booked',
  DONE: 'Done',
  FAILED: 'Failed',
  NEEDS_REINSPECTION: 'Needs re-inspection',
};

// ?? fallbacks (bookings/portal pattern): an unknown/future enum value must render a
// readable label instead of crashing the page (STATUS_META[x].variant was a live TypeError).
const statusMeta = (s: CargoStatus) =>
  STATUS_META[s] ?? { label: s.replace(/_/g, ' '), variant: 'neutral' as const };
const inspectionLabel = (s: InspectionStatus) => INSPECTION_META[s] ?? s.replace(/_/g, ' ');

const LOADING_META: Record<LoadingStatus, string> = {
  NOT_LOADED: 'Not loaded',
  LOADED: 'Loaded',
};

export default function CargoPage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<PaginatedResult<CargoListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [inYardFilter, setInYardFilter] = useState('');

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [ports, setPorts] = useState<PortListItem[]>([]);
  const [yards, setYards] = useState<YardListItem[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CargoDetail | null>(null);
  const [viewing, setViewing] = useState<CargoListItem | null>(null);
  const [detail, setDetail] = useState<CargoDetail | null>(null);
  const [deleting, setDeleting] = useState<CargoListItem | null>(null);
  const [cancelling, setCancelling] = useState<CargoListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);

  const canCreate = hasPermission('cargo:create');
  const canUpdate = hasPermission('cargo:update');
  const canTransition = hasPermission('cargo:transition');
  const canDelete = hasPermission('cargo:delete');
  const canRead = hasPermission('cargo:read');

  const load = useCallback(
    async (p: number, q: string, status: string, type: string, inYard: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      if (status) params.set('status', status);
      if (type) params.set('cargoType', type);
      if (inYard) params.set('inYard', inYard);
      try {
        setData(await api.get<PaginatedResult<CargoListItem>>(`/cargo?${params.toString()}`));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load cargo');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(page, search, statusFilter, typeFilter, inYardFilter);
  }, [load, page, search, statusFilter, typeFilter, inYardFilter]);

  useEffect(() => {
    (async () => {
      try {
        const [c, p, y] = await Promise.all([
          api.get<PaginatedResult<CustomerListItem>>('/customers?pageSize=100'),
          api.get<PaginatedResult<PortListItem>>('/ports?pageSize=100'),
          api.get<PaginatedResult<YardListItem>>('/yards?pageSize=100'),
        ]);
        setCustomers(c.data);
        setPorts(p.data);
        setYards(y.data);
      } catch {
        /* form selects degrade gracefully */
      }
    })();
  }, []);

  const availableYards = form.portId ? yards.filter((y) => y.portId === form.portId) : [];

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'portId') next.yardId = '';
      return next;
    });
  }

  function applyFilters() {
    setPage(1);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setCreateOpen(true);
  }

  async function openEdit(c: CargoListItem) {
    try {
      const d = await api.get<CargoDetail>(`/cargo/${c.id}`);
      setEditing(d);
      setForm(toForm(d));
      setFormError(null);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to load cargo');
    }
  }

  async function openView(c: CargoListItem) {
    setViewing(c);
    setDetail(null);
    try {
      setDetail(await api.get<CargoDetail>(`/cargo/${c.id}`));
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to load cargo details');
    }
  }

  async function submit() {
    setFormError(null);
    if (!form.customerId || !form.portId || !form.cargoType) {
      setFormError('Customer, port and cargo type are required.');
      return;
    }
    // ADR-044 decision 2: Comment is required AT CREATION only (01-final-requirements
    // "Comment is required, editable, and deletable" — deletable implies it cannot stay
    // mandatory afterwards). Edit keeps the field optional; CreateCargoDto stays optional
    // (DTO enforcement is the deferred follow-up, not this unit).
    if (!editing && !form.comments.trim()) {
      setFormError('Comment is required — add the operational notes for this cargo.');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (editing) {
        await api.patch<CargoListItem>(`/cargo/${editing.id}`, payload);
        setEditing(null);
      } else {
        await api.post<CargoListItem>('/cargo', payload);
        setCreateOpen(false);
        setPage(1);
      }
      await load(page, search, statusFilter, typeFilter, inYardFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save cargo');
    } finally {
      setSaving(false);
    }
  }

  async function cancelCargo() {
    if (!cancelling) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.patch<CargoDetail>(`/cargo/${cancelling.id}/status`, { status: 'CANCELLED' });
      setCancelling(null);
      await load(page, search, statusFilter, typeFilter, inYardFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to cancel cargo');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCargo() {
    if (!deleting) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.del<CargoDetail>(`/cargo/${deleting.id}`);
      setDeleting(null);
      await load(page, search, statusFilter, typeFilter, inYardFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to delete cargo');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: 'Cargo' }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">Cargo</h1>
          <p className="text-sm text-muted-foreground">
            Live cargo records, yard placement and lifecycle. Cargo cancelled with an active yard
            record must be removed from the yard first.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New cargo
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Cargo registry</CardTitle>
          <CardDescription>Live operational records. No placeholder data.</CardDescription>
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
              placeholder="Search ref, serial, VIN, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search cargo"
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
                  {statusMeta(s).label}
                </option>
              ))}
            </select>
            <select
              className={SELECT_CLASS}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                applyFilters();
              }}
              aria-label="Filter by cargo type"
            >
              <option value="">All types</option>
              {CARGO_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <select
              className={SELECT_CLASS}
              value={inYardFilter}
              onChange={(e) => {
                setInYardFilter(e.target.value);
                applyFilters();
              }}
              aria-label="Filter by yard status"
            >
              <option value="">Any yard status</option>
              <option value="true">In yard</option>
              <option value="false">Not in yard</option>
            </select>
            <Button type="submit" variant="secondary">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Apply
            </Button>
          </form>
        </CardContent>
        {loading ? (
          <PageLoader label="Loading cargo…" />
        ) : error ? (
          <CardContent>
            <ErrorState message={error} onRetry={() => load(page, search, statusFilter, typeFilter, inYardFilter)} />
          </CardContent>
        ) : data && data.data.length === 0 ? (
          <CardContent>
            <EmptyState title="No cargo found" description="Try a different search or filter." />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Reference</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Weight</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-foreground">
                          {c.reference}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      {c.customer.shortName ?? c.customer.code}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      {c.cargoType.replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      {c.weight != null ? `${c.weight} ${c.weightUnit ?? ''}`.trim() : '—'}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      {c.inventory ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {c.yard?.code}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={statusMeta(c.status).variant}>{statusMeta(c.status).label}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openView(c)}
                            title="View details"
                            aria-label={`View cargo ${c.reference}`}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => openEdit(c)}
                          >
                            Edit
                          </Button>
                        )}
                        {canTransition && c.status !== 'CANCELLED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setCancelling(c)}
                            title="Cancel cargo"
                            aria-label={`Cancel cargo ${c.reference}`}
                          >
                            <Ban className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleting(c)}
                            title="Delete cargo"
                            aria-label={`Delete cargo ${c.reference}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
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

      {/* Create / edit dialog */}
      <Dialog
        open={createOpen || !!editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditing(null);
          }
        }}
        title={editing ? `Edit — ${editing.reference}` : 'New cargo'}
        description="Create or update a cargo record. Reference is assigned automatically."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCreateOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={submit}>
              {editing ? 'Save changes' : 'Create cargo'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="cargo-customer" className="block">
              Customer *
            </Label>
            <select
              id="cargo-customer"
              className={SELECT_CLASS + ' w-full'}
              value={form.customerId}
              onChange={(e) => updateField('customerId', e.target.value)}
              autoFocus
            >
              <option value="">Select customer…</option>
              {customers.map((cu) => (
                <option key={cu.id} value={cu.id}>
                  {cu.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargo-port" className="block">
              Port of arrival *
            </Label>
            <select
              id="cargo-port"
              className={SELECT_CLASS + ' w-full'}
              value={form.portId}
              onChange={(e) => updateField('portId', e.target.value)}
            >
              <option value="">Select port…</option>
              {ports.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargo-yard" className="block">
              Yard
            </Label>
            <select
              id="cargo-yard"
              className={SELECT_CLASS + ' w-full'}
              value={form.yardId}
              onChange={(e) => updateField('yardId', e.target.value)}
            >
              <option value="">No yard</option>
              {availableYards.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargo-destination" className="block">
              Destination port
            </Label>
            <select
              id="cargo-destination"
              className={SELECT_CLASS + ' w-full'}
              value={form.destinationPortId}
              onChange={(e) => updateField('destinationPortId', e.target.value)}
            >
              <option value="">No destination</option>
              {ports.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargo-type" className="block">
              Cargo type *
            </Label>
            <select
              id="cargo-type"
              className={SELECT_CLASS + ' w-full'}
              value={form.cargoType}
              onChange={(e) => updateField('cargoType', e.target.value as CargoType)}
            >
              {CARGO_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargo-spec" className="block">
              Specification
            </Label>
            <Input
              id="cargo-spec"
              value={form.specification}
              onChange={(e) => updateField('specification', e.target.value)}
              placeholder="e.g. 40ft reefer"
            />
          </div>
          <div className="col-span-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cargo-serial" className="block">
                  Serial number
                </Label>
                <Input
                  id="cargo-serial"
                  value={form.serialNumber}
                  onChange={(e) => updateField('serialNumber', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo-chassis" className="block">
                  Chassis number
                </Label>
                <Input
                  id="cargo-chassis"
                  value={form.chassisNumber}
                  onChange={(e) => updateField('chassisNumber', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo-vin" className="block">
                  VIN
                </Label>
                <Input id="cargo-vin" value={form.vin} onChange={(e) => updateField('vin', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo-arrival" className="block">
                  Arrival date
                </Label>
                <Input
                  id="cargo-arrival"
                  type="date"
                  value={form.arrivalDate}
                  onChange={(e) => updateField('arrivalDate', e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="col-span-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cargo-weight" className="block">
                  Weight
                </Label>
                <Input
                  id="cargo-weight"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={form.weight}
                  onChange={(e) => updateField('weight', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo-weight-unit" className="block">
                  Weight unit
                </Label>
                <select
                  id="cargo-weight-unit"
                  className={SELECT_CLASS + ' w-full'}
                  value={form.weightUnit}
                  onChange={(e) => updateField('weightUnit', e.target.value as WeightUnit)}
                >
                  {WEIGHT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo-quantity" className="block">
                  Quantity
                </Label>
                <Input
                  id="cargo-quantity"
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => updateField('quantity', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo-packages" className="block">
                  Packages
                </Label>
                <Input
                  id="cargo-packages"
                  type="number"
                  min={0}
                  value={form.packages}
                  onChange={(e) => updateField('packages', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo-package-type" className="block">
                  Package type
                </Label>
                <Input
                  id="cargo-package-type"
                  value={form.packageType}
                  onChange={(e) => updateField('packageType', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo-arrival-ref" className="block">
                  Arrival reference
                </Label>
                <Input
                  id="cargo-arrival-ref"
                  value={form.arrivalReference}
                  onChange={(e) => updateField('arrivalReference', e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="cargo-comments" className="block">
              {editing ? 'Comments' : 'Comments *'}
            </Label>
            <textarea
              id="cargo-comments"
              className="min-h-[64px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.comments}
              onChange={(e) => updateField('comments', e.target.value)}
              required={!editing}
              aria-required={!editing}
            />
            <p className="text-xs text-muted-foreground">
              Operational notes for this cargo — visible to accountants and others with
              cargo access.
              {editing
                ? ' Editable and clearable at any time.'
                : ' Required at creation; editable and clearable later.'}
            </p>
          </div>
        </div>
        {formError && <p className="mt-3 text-xs text-destructive" role="alert">{formError}</p>}
      </Dialog>

      {/* Detail dialog */}
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing?.reference ?? 'Cargo'}
        description={viewing ? `${viewing.customer.name}` : undefined}
        footer={
          <Button variant="outline" size="sm" onClick={() => setViewing(null)}>
            Close
          </Button>
        }
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <Badge variant={statusMeta(detail.status).variant}>
                  {statusMeta(detail.status).label}
                </Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Type</div>
                <div>{detail.cargoType.replace(/_/g, ' ')}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Inspection</div>
                <div>{inspectionLabel(detail.inspectionStatus)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Weight</div>
                <div>
                  {detail.weight != null ? `${detail.weight} ${detail.weightUnit ?? ''}`.trim() : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Loading</div>
                <div>{LOADING_META[detail.loadingStatus]}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Quantity</div>
                <div>{detail.quantity ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Packages</div>
                <div>{detail.packages != null ? `${detail.packages}${detail.packageType ? ` ${detail.packageType}` : ''}` : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Arrival date</div>
                <div>{detail.arrivalDate ? new Date(detail.arrivalDate).toLocaleDateString() : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Created</div>
                <div>{new Date(detail.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Identifiers
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <div className="flex justify-between"><dt className="text-muted-foreground">Serial</dt><dd className="text-right">{detail.serialNumber ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Chassis</dt><dd className="text-right">{detail.chassisNumber ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">VIN</dt><dd className="text-right">{detail.vin ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Arrival ref</dt><dd className="text-right">{detail.arrivalReference ?? '—'}</dd></div>
            </dl>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Location
            </div>
            <dl className="space-y-1.5">
              <div className="flex justify-between"><dt className="text-muted-foreground">Port</dt><dd className="text-right">{detail.port.name}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Yard</dt><dd className="text-right">{detail.yard?.name ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Destination</dt><dd className="text-right">{detail.destinationPort?.name ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">In yard</dt><dd className="text-right">{detail.inventory ? `Yes · ${detail.inventory.status}` : 'No'}</dd></div>
            </dl>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Comments</div>
              <p className="whitespace-pre-wrap rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                {detail.comments || '—'}
              </p>
            </div>
          </div>
        ) : (
          <PageLoader label="Loading cargo details…" />
        )}
      </Dialog>

      {/* Cancel confirm */}
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Cancel cargo"
        description={
          cancelling?.inventory
            ? `"${cancelling?.reference}" has an active yard record. Cancelling requires removing it from the yard first.`
            : `Cancel "${cancelling?.reference}"? This is a terminal state and cannot be reversed.`
        }
        confirmLabel="Cancel cargo"
        destructive
        loading={saving}
        onConfirm={cancelCargo}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete cargo"
        description={`Delete "${deleting?.reference}"? This soft-deletes the record (kept for audit/retention).`}
        confirmLabel="Delete"
        destructive
        loading={saving}
        onConfirm={deleteCargo}
      />
    </div>
  );
}

/** Build a JSON payload omitting empty optional strings so optional fields are not sent.
 *  Exception (ADR-044 decision 3): `comments` is ALWAYS sent — an emptied textarea must
 *  reach the API as '' so clearing the comment persists (PATCH treats undefined as
 *  "leave unchanged", so conditionally omitting it made the field impossible to clear). */
function buildPayload(f: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    customerId: f.customerId,
    portId: f.portId,
    cargoType: f.cargoType,
  };
  if (f.yardId) payload.yardId = f.yardId;
  if (f.destinationPortId) payload.destinationPortId = f.destinationPortId;
  if (f.specification.trim()) payload.specification = f.specification.trim();
  if (f.serialNumber.trim()) payload.serialNumber = f.serialNumber.trim();
  if (f.chassisNumber.trim()) payload.chassisNumber = f.chassisNumber.trim();
  if (f.vin.trim()) payload.vin = f.vin.trim();
  if (f.weight.trim()) payload.weight = f.weight.trim();
  if (f.weightUnit) payload.weightUnit = f.weightUnit;
  if (f.quantity.trim()) payload.quantity = Number(f.quantity);
  if (f.packages.trim()) payload.packages = Number(f.packages);
  if (f.packageType.trim()) payload.packageType = f.packageType.trim();
  if (f.arrivalDate) payload.arrivalDate = f.arrivalDate;
  if (f.arrivalReference.trim()) payload.arrivalReference = f.arrivalReference.trim();
  payload.comments = f.comments.trim();
  return payload;
}