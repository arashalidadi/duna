'use client';
import { TableScroll } from '@/components/ui/table-scroll';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';

import { useLocale as useUiLocale } from 'next-intl';
import { DomainLabel } from '@/components/ui/domain-label';

import { useTranslations as useUiTranslations } from 'next-intl';

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

const CARGO_TYPES: CargoType[] = [
  'GENERAL',
  'VEHICLE',
  'HEAVY_LIFT',
  'CONTAINER',
  'BULK',
  'PROJECT',
];
const STATUSES: CargoStatus[] = [
  'REGISTERED',
  'AT_YARD',
  'READY_FOR_LOADING',
  'LOADED',
  'DELIVERED',
  'CANCELLED',
];
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

const STATUS_META: Record<
  CargoStatus,
  { label: string; variant: 'success' | 'neutral' | 'warning' | 'info' }
> = {
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
  const uiLocale = useUiLocale();
  const ui = useUiTranslations('legacyUi');
  const { hasPermission } = useAuth();
  const [data, setData] = useState<PaginatedResult<CargoListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
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
        setError(e instanceof ApiError ? e.message : ui('failedToLoadCargo'));
      } finally {
        setLoading(false);
      }
    },
    [ui]
  );

  useEffect(() => {
    load(page, debouncedSearch, statusFilter, typeFilter, inYardFilter);
  }, [load, page, debouncedSearch, statusFilter, typeFilter, inYardFilter]);

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
      setFormError(e instanceof ApiError ? e.message : ui('failedToLoadCargo'));
    }
  }

  async function openView(c: CargoListItem) {
    setViewing(c);
    setDetail(null);
    try {
      setDetail(await api.get<CargoDetail>(`/cargo/${c.id}`));
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : ui('failedToLoadCargoDetails'));
    }
  }

  async function submit() {
    setFormError(null);
    if (!form.customerId || !form.portId || !form.cargoType) {
      setFormError(ui('customerPortAndCargoTypeAreRequired'));
      return;
    }
    // ADR-044 decision 2: Comment is required AT CREATION only (01-final-requirements
    // "Comment is required, editable, and deletable" — deletable implies it cannot stay
    // mandatory afterwards). Edit keeps the field optional; CreateCargoDto stays optional
    // (DTO enforcement is the deferred follow-up, not this unit).
    if (!editing && !form.comments.trim()) {
      setFormError(ui('commentIsRequiredAddTheOperationalNotesForThisCargo'));
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
      setFormError(err instanceof ApiError ? err.message : ui('failedToSaveCargo'));
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
      setFormError(err instanceof ApiError ? err.message : ui('failedToCancelCargo'));
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
      setFormError(err instanceof ApiError ? err.message : ui('failedToDeleteCargo'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: ui('cargo') }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">{ui('cargo')}</h1>
          <p className="text-sm text-muted-foreground">
            {ui('liveCargoRecordsYardPlacementAndLifecycleCargoCancelledWithAn')}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {ui('newCargo')}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{ui('cargoRegistry')}</CardTitle>
          <CardDescription>{ui('liveOperationalRecordsNoPlaceholderData')}</CardDescription>
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
              placeholder={ui('searchRefSerialVINCustomer')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label={ui('searchCargo')}
            />
            <select
              className={SELECT_CLASS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                applyFilters();
              }}
              aria-label={ui('filterByStatus')}
            >
              <option value="">{ui('allStatuses')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  <DomainLabel value={statusMeta(s).label} />
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
              aria-label={ui('filterByCargoType')}
            >
              <option value="">{ui('allTypes')}</option>
              {CARGO_TYPES.map((t) => (
                <option key={t} value={t}>
                  <DomainLabel value={t.replace(/_/g, ' ')} />
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
              aria-label={ui('filterByYardStatus')}
            >
              <option value="">{ui('anyYardStatus')}</option>
              <option value="true">{ui('inYard')}</option>
              <option value="false">{ui('notInYard')}</option>
            </select>
            <Button type="submit" variant="secondary">
              <ArrowUpDown className="h-3.5 w-3.5" />
              {ui('apply')}
            </Button>
          </form>
        </CardContent>
        {loading ? (
          <PageLoader label={ui('loadingCargo')} />
        ) : error ? (
          <CardContent>
            <ErrorState
              message={error}
              onRetry={() => load(page, search, statusFilter, typeFilter, inYardFilter)}
            />
          </CardContent>
        ) : data && data.data.length === 0 ? (
          <CardContent>
            <EmptyState
              title={ui('noCargoFound')}
              description={ui('tryADifferentSearchOrFilter')}
            />
          </CardContent>
        ) : (
          <TableScroll className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{ui('reference')}</th>
                  <th className="px-3 py-2 font-medium">{ui('customer')}</th>
                  <th className="px-3 py-2 font-medium">{ui('type')}</th>
                  <th className="px-3 py-2 font-medium">{ui('weight')}</th>
                  <th className="px-3 py-2 font-medium">{ui('location')}</th>
                  <th className="px-3 py-2 font-medium">{ui('status')}</th>
                  <th className="px-3 py-2 text-end font-medium">{ui('actions')}</th>
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
                      <DomainLabel value={c.cargoType.replace(/_/g, ' ')} />
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
                      <Badge variant={statusMeta(c.status).variant}>
                        <DomainLabel value={statusMeta(c.status).label} />
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openView(c)}
                            title={ui('viewDetails')}
                            aria-label={ui('viewCargoValue', { value0: String(c.reference) })}
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
                            {ui('edit')}
                          </Button>
                        )}
                        {canTransition && c.status !== 'CANCELLED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setCancelling(c)}
                            title={ui('cancelCargo')}
                            aria-label={ui('cancelCargoValue', { value0: String(c.reference) })}
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
                            title={ui('deleteCargo')}
                            aria-label={ui('deleteCargoValue', { value0: String(c.reference) })}
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

      {/* Create / edit dialog */}
      <Dialog
        open={createOpen || !!editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditing(null);
          }
        }}
        title={editing ? ui('editValue', { value0: String(editing.reference) }) : ui('newCargo')}
        description={ui('createOrUpdateACargoRecordReferenceIsAssignedAutomatically')}
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
              {ui('cancel')}
            </Button>
            <Button size="sm" loading={saving} onClick={submit}>
              {editing ? ui('saveChanges') : ui('createCargo')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="cargo-customer" className="block">
              {ui('customerRequired')}
            </Label>
            <select
              id="cargo-customer"
              className={SELECT_CLASS + ' w-full'}
              value={form.customerId}
              onChange={(e) => updateField('customerId', e.target.value)}
              autoFocus
            >
              <option value="">{ui('selectCustomer')}</option>
              {customers.map((cu) => (
                <option key={cu.id} value={cu.id}>
                  {cu.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargo-port" className="block">
              {ui('portOfArrivalRequired')}
            </Label>
            <select
              id="cargo-port"
              className={SELECT_CLASS + ' w-full'}
              value={form.portId}
              onChange={(e) => updateField('portId', e.target.value)}
            >
              <option value="">{ui('selectPort')}</option>
              {ports.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargo-yard" className="block">
              {ui('yard')}
            </Label>
            <select
              id="cargo-yard"
              className={SELECT_CLASS + ' w-full'}
              value={form.yardId}
              onChange={(e) => updateField('yardId', e.target.value)}
            >
              <option value="">{ui('noYard')}</option>
              {availableYards.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargo-destination" className="block">
              {ui('destinationPort')}
            </Label>
            <select
              id="cargo-destination"
              className={SELECT_CLASS + ' w-full'}
              value={form.destinationPortId}
              onChange={(e) => updateField('destinationPortId', e.target.value)}
            >
              <option value="">{ui('noDestination')}</option>
              {ports.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargo-type" className="block">
              {ui('cargoTypeRequired')}
            </Label>
            <select
              id="cargo-type"
              className={SELECT_CLASS + ' w-full'}
              value={form.cargoType}
              onChange={(e) => updateField('cargoType', e.target.value as CargoType)}
            >
              {CARGO_TYPES.map((t) => (
                <option key={t} value={t}>
                  <DomainLabel value={t.replace(/_/g, ' ')} />
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cargo-spec" className="block">
              {ui('specification')}
            </Label>
            <Input
              id="cargo-spec"
              value={form.specification}
              onChange={(e) => updateField('specification', e.target.value)}
              placeholder={ui('eG40ftReefer')}
            />
          </div>
          <div className="col-span-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cargo-serial" className="block">
                  {ui('serialNumber')}
                </Label>
                <Input
                  id="cargo-serial"
                  value={form.serialNumber}
                  onChange={(e) => updateField('serialNumber', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo-chassis" className="block">
                  {ui('chassisNumber')}
                </Label>
                <Input
                  id="cargo-chassis"
                  value={form.chassisNumber}
                  onChange={(e) => updateField('chassisNumber', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo-vin" className="block">
                  {ui('vin')}
                </Label>
                <Input
                  id="cargo-vin"
                  value={form.vin}
                  onChange={(e) => updateField('vin', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo-arrival" className="block">
                  {ui('arrivalDate')}
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
                  {ui('weight')}
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
                  {ui('weightUnit')}
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
                  {ui('quantity')}
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
                  {ui('packages')}
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
                  {ui('packageType')}
                </Label>
                <Input
                  id="cargo-package-type"
                  value={form.packageType}
                  onChange={(e) => updateField('packageType', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cargo-arrival-ref" className="block">
                  {ui('arrivalReference')}
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
              {editing ? ui('comments') : ui('commentsRequired')}
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
              {ui('operationalNotesForThisCargoVisibleToAccountantsAndOthersWith')}
              {editing
                ? ui('editableAndClearableAtAnyTime')
                : ui('requiredAtCreationEditableAndClearableLater')}
            </p>
          </div>
        </div>
        {formError && (
          <p className="mt-3 text-xs text-destructive" role="alert">
            {formError}
          </p>
        )}
      </Dialog>

      {/* Detail dialog */}
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing?.reference ?? ui('cargo')}
        description={viewing ? `${viewing.customer.name}` : undefined}
        footer={
          <Button variant="outline" size="sm" onClick={() => setViewing(null)}>
            {ui('close')}
          </Button>
        }
      >
        {detail ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">{ui('status')}</div>
                <Badge variant={statusMeta(detail.status).variant}>
                  <DomainLabel value={statusMeta(detail.status).label} />
                </Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{ui('type')}</div>
                <div>
                  <DomainLabel value={detail.cargoType.replace(/_/g, ' ')} />
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{ui('inspection')}</div>
                <div>
                  <DomainLabel value={inspectionLabel(detail.inspectionStatus)} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">{ui('weight')}</div>
                <div>
                  {detail.weight != null
                    ? `${detail.weight} ${detail.weightUnit ?? ''}`.trim()
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{ui('loading_mn7wu3b')}</div>
                <div>
                  <DomainLabel value={LOADING_META[detail.loadingStatus]} />
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{ui('quantity')}</div>
                <div>{detail.quantity ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{ui('packages')}</div>
                <div>
                  {detail.packages != null
                    ? `${detail.packages}${detail.packageType ? ` ${detail.packageType}` : ''}`
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{ui('arrivalDate')}</div>
                <div>
                  {detail.arrivalDate
                    ? new Date(detail.arrivalDate).toLocaleDateString(uiLocale)
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{ui('created')}</div>
                <div>{new Date(detail.createdAt).toLocaleDateString(uiLocale)}</div>
              </div>
            </div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {ui('identifiers')}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{ui('serial')}</dt>
                <dd className="text-end">{detail.serialNumber ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{ui('chassis')}</dt>
                <dd className="text-end">{detail.chassisNumber ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{ui('vin')}</dt>
                <dd className="text-end">{detail.vin ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{ui('arrivalRef')}</dt>
                <dd className="text-end">{detail.arrivalReference ?? '—'}</dd>
              </div>
            </dl>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {ui('location')}
            </div>
            <dl className="space-y-1.5">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{ui('port_m1qx5adi')}</dt>
                <dd className="text-end">{detail.port.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{ui('yard')}</dt>
                <dd className="text-end">{detail.yard?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{ui('destination')}</dt>
                <dd className="text-end">{detail.destinationPort?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{ui('inYard')}</dt>
                <dd className="text-end">
                  {detail.inventory
                    ? ui('yesValue', { value0: String(detail.inventory.status) })
                    : ui('no_mr5wqai')}
                </dd>
              </div>
            </dl>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">{ui('comments')}</div>
              <p className="whitespace-pre-wrap rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                {detail.comments || '—'}
              </p>
            </div>
          </div>
        ) : (
          <PageLoader label={ui('loadingCargoDetails')} />
        )}
      </Dialog>

      {/* Cancel confirm */}
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={ui('cancelCargo')}
        description={
          cancelling?.inventory
            ? ui('valueHasAnActiveYardRecordCancellingRequiresRemovingItFrom', {
                value0: String(cancelling?.reference),
              })
            : ui('cancelValueThisIsATerminalStateAndCannotBeReversed', {
                value0: String(cancelling?.reference),
              })
        }
        confirmLabel={ui('cancelCargo')}
        destructive
        loading={saving}
        onConfirm={cancelCargo}
        error={formError}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={ui('deleteCargo')}
        description={ui('deleteValueThisSoftDeletesTheRecordKeptForAuditRetention', {
          value0: String(deleting?.reference),
        })}
        confirmLabel={ui('delete')}
        destructive
        loading={saving}
        onConfirm={deleteCargo}
        error={formError}
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
