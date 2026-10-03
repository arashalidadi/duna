'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  InventoryListItem,
  InventoryDetail,
  InventoryStatus,
  CargoStatus,
  CargoListItem,
  PaginatedResult,
  YardListItem,
} from '@shipping/shared';
import { Plus, Eye, ArrowUpDown, Trash2, MapPin, ArrowRight } from 'lucide-react';
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

const INV_STATUSES: InventoryStatus[] = ['IN_YARD', 'RESERVED'];
const CARGO_STATUSES: CargoStatus[] = ['REGISTERED', 'AT_YARD', 'READY_FOR_LOADING', 'LOADED', 'DELIVERED', 'CANCELLED'];

const INV_META: Record<InventoryStatus, { label: string; variant: 'info' | 'success' }> = {
  IN_YARD: { label: 'In yard', variant: 'info' },
  RESERVED: { label: 'Reserved', variant: 'success' },
};

interface PlaceForm {
  cargoId: string;
  yardId: string;
  locationLabel: string;
  notes: string;
}

interface MoveForm {
  yardId: string;
  status: InventoryStatus;
  locationLabel: string;
  notes: string;
}

const EMPTY_PLACE: PlaceForm = { cargoId: '', yardId: '', locationLabel: '', notes: '' };

export default function YardInventoryPage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<PaginatedResult<InventoryListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [yardFilter, setYardFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cargoStatusFilter, setCargoStatusFilter] = useState('');

  const [cargos, setCargos] = useState<{ id: string; reference: string }[]>([]);
  const [yards, setYards] = useState<YardListItem[]>([]);

  const [placing, setPlacing] = useState(false);
  const [moving, setMoving] = useState<InventoryListItem | null>(null);
  const [viewing, setViewing] = useState<InventoryListItem | null>(null);
  const [viewDetail, setViewDetail] = useState<InventoryDetail | null>(null);
  const [removing, setRemoving] = useState<InventoryListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [placeForm, setPlaceForm] = useState<PlaceForm>(EMPTY_PLACE);
  const [moveForm, setMoveForm] = useState<MoveForm>({
    yardId: '',
    status: 'IN_YARD',
    locationLabel: '',
    notes: '',
  });

  const canCreate = hasPermission('yard-inventory:create');
  const canUpdate = hasPermission('yard-inventory:update');
  const canRemove = hasPermission('yard-inventory:remove');
  const canRead = hasPermission('yard-inventory:read');

  const load = useCallback(
    async (p: number, q: string, yard: string, status: string, cargoStatus: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      if (yard) params.set('yardId', yard);
      if (status) params.set('status', status);
      if (cargoStatus) params.set('cargoStatus', cargoStatus);
      try {
        setData(await api.get<PaginatedResult<InventoryListItem>>(`/yard-inventory?${params.toString()}`));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load yard inventory');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(page, search, yardFilter, statusFilter, cargoStatusFilter);
  }, [load, page, search, yardFilter, statusFilter, cargoStatusFilter]);

  useEffect(() => {
    (async () => {
      try {
        const [y, c] = await Promise.all([
          api.get<PaginatedResult<YardListItem>>('/yards?pageSize=100'),
          api.get<PaginatedResult<CargoListItem>>('/cargo?pageSize=100&inYard=false'),
        ]);
        setYards(y.data);
        setCargos(c.data.map((row) => ({ id: row.id, reference: row.reference })));
      } catch {
        /* selects degrade gracefully */
      }
    })();
  }, []);

  function updateField<K extends keyof PlaceForm>(key: K, value: string) {
    setPlaceForm((prev) => ({ ...prev, [key]: value }));
  }

  function openPlace() {
    setPlaceForm(EMPTY_PLACE);
    setFormError(null);
    setPlacing(true);
  }

  async function submitPlace() {
    setFormError(null);
    if (!placeForm.cargoId || !placeForm.yardId) {
      setFormError('Cargo and yard are required.');
      return;
    }
    setSaving(true);
    try {
      await api.post<InventoryDetail>('/yard-inventory', {
        cargoId: placeForm.cargoId,
        yardId: placeForm.yardId,
        ...(placeForm.locationLabel.trim() ? { locationLabel: placeForm.locationLabel.trim() } : {}),
        ...(placeForm.notes.trim() ? { notes: placeForm.notes.trim() } : {}),
      });
      setPlacing(false);
      setPage(1);
      await load(page, search, yardFilter, statusFilter, cargoStatusFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to place cargo');
    } finally {
      setSaving(false);
    }
  }

  function openMove(row: InventoryListItem) {
    setMoving(row);
    setMoveForm({ yardId: row.yard.id, status: row.status, locationLabel: row.locationLabel ?? '', notes: row.notes ?? '' });
    setFormError(null);
  }

  async function submitMove() {
    if (!moving) return;
    setFormError(null);
    if (!moveForm.yardId) {
      setFormError('Yard is required.');
      return;
    }
    setSaving(true);
    try {
      await api.patch<InventoryDetail>(`/yard-inventory/${moving.id}`, {
        yardId: moveForm.yardId,
        status: moveForm.status,
        ...(moveForm.locationLabel.trim() !== (moving.locationLabel ?? '') ? { locationLabel: moveForm.locationLabel.trim() } : {}),
        ...(moveForm.notes.trim() !== (moving.notes ?? '') ? { notes: moveForm.notes.trim() } : {}),
      });
      setMoving(null);
      await load(page, search, yardFilter, statusFilter, cargoStatusFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to update inventory');
    } finally {
      setSaving(false);
    }
  }

  async function openView(row: InventoryListItem) {
    setViewing(row);
    setViewDetail(null);
    try {
      setViewDetail(await api.get<InventoryDetail>(`/yard-inventory/${row.id}`));
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to load inventory details');
    }
  }

  async function submitRemove() {
    if (!removing) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.del<{ removed: boolean }>(`/yard-inventory/${removing.id}`);
      setRemoving(null);
      await load(page, search, yardFilter, statusFilter, cargoStatusFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to remove from yard');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: 'Yard Inventory' }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">Yard Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Current yard stock. Placing a cargo moves it to At yard; removing returns it to Registered.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openPlace}>
            <Plus className="h-4 w-4" />
            Place cargo
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Inventory registry</CardTitle>
          <CardDescription>One current record per cargo. Move or remove to change it.</CardDescription>
        </CardHeader>
        <CardContent className="border-b border-border pb-3 pt-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <Input
              className="max-w-xs"
              placeholder="Search reference, serial, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search inventory"
            />
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
                  {y.name}
                </option>
              ))}
            </select>
            <select
              className={SELECT_CLASS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by inventory status"
            >
              <option value="">Any status</option>
              {INV_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {INV_META[s].label}
                </option>
              ))}
            </select>
            <select
              className={SELECT_CLASS}
              value={cargoStatusFilter}
              onChange={(e) => {
                setCargoStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by cargo status"
            >
              <option value="">Any cargo status</option>
              {CARGO_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Apply
            </Button>
          </form>
        </CardContent>
        {loading ? (
          <PageLoader label="Loading inventory…" />
        ) : error ? (
          <CardContent>
            <ErrorState message={error} onRetry={() => load(page, search, yardFilter, statusFilter, cargoStatusFilter)} />
          </CardContent>
        ) : data && data.data.length === 0 ? (
          <CardContent>
            <EmptyState title="No inventory records" description="Place cargo into a yard to begin." />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Cargo</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Yard</th>
                  <th className="px-3 py-2 font-medium">Port</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-foreground">
                          {row.cargo.reference}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {row.cargo.cargoType.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      {row.cargo.customer.shortName ?? row.cargo.customer.code}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {row.yard.code}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">{row.port.code}</td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">{row.locationLabel ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Badge variant={INV_META[row.status].variant}>{INV_META[row.status].label}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openView(row)}
                            title="View details"
                            aria-label={`View ${row.cargo.reference}`}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openMove(row)}
                            title="Move or reserve"
                            aria-label={`Move ${row.cargo.reference}`}
                          >
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canRemove && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setRemoving(row)}
                            title="Remove from yard"
                            aria-label={`Remove ${row.cargo.reference}`}
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

      {/* Place dialog */}
      <Dialog
        open={placing}
        onOpenChange={(open) => !open && setPlacing(false)}
        title="Place cargo in yard"
        description="Moving a cargo into a yard sets its status to At yard."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setPlacing(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={submitPlace}>
              Place cargo
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv-cargo" className="block">
              Cargo *
            </Label>
            <select
              id="inv-cargo"
              className={SELECT_CLASS + ' w-full'}
              value={placeForm.cargoId}
              onChange={(e) => updateField('cargoId', e.target.value)}
              autoFocus
            >
              <option value="">Select not-in-yard cargo…</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.reference}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-yard" className="block">
              Yard *
            </Label>
            <select
              id="inv-yard"
              className={SELECT_CLASS + ' w-full'}
              value={placeForm.yardId}
              onChange={(e) => updateField('yardId', e.target.value)}
            >
              <option value="">Select yard…</option>
              {yards.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-location" className="block">
              Location label
            </Label>
            <Input
              id="inv-location"
              value={placeForm.locationLabel}
              onChange={(e) => updateField('locationLabel', e.target.value)}
              placeholder="Bay A1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-notes" className="block">
              Notes
            </Label>
            <textarea
              id="inv-notes"
              className="min-h-[56px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={placeForm.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </div>
        </div>
        {formError && <p className="mt-3 text-xs text-destructive" role="alert">{formError}</p>}
      </Dialog>

      {/* Move / update dialog */}
      <Dialog
        open={!!moving}
        onOpenChange={(open) => !open && setMoving(null)}
        title={moving ? `Move — ${moving.cargo.reference}` : 'Update inventory'}
        description="Change the yard, status or location of this inventory record."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setMoving(null)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={submitMove}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="move-yard" className="block">
              Yard *
            </Label>
            <select
              id="move-yard"
              className={SELECT_CLASS + ' w-full'}
              value={moveForm.yardId}
              onChange={(e) => setMoveForm((prev) => ({ ...prev, yardId: e.target.value }))}
            >
              {yards.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="move-status" className="block">
              Status
            </Label>
            <select
              id="move-status"
              className={SELECT_CLASS + ' w-full'}
              value={moveForm.status}
              onChange={(e) => setMoveForm((prev) => ({ ...prev, status: e.target.value as InventoryStatus }))}
            >
              {INV_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {INV_META[s].label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="move-location" className="block">
              Location label
            </Label>
            <Input
              id="move-location"
              value={moveForm.locationLabel}
              onChange={(e) => setMoveForm((prev) => ({ ...prev, locationLabel: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="move-notes" className="block">
              Notes
            </Label>
            <textarea
              id="move-notes"
              className="min-h-[56px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={moveForm.notes}
              onChange={(e) => setMoveForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </div>
        {formError && <p className="mt-3 text-xs text-destructive" role="alert">{formError}</p>}
      </Dialog>

      {/* Detail dialog */}
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing?.cargo.reference ?? 'Inventory'}
        description={viewing ? `${viewing.cargo.customer.name}` : undefined}
        footer={
          <Button variant="outline" size="sm" onClick={() => setViewing(null)}>
            Close
          </Button>
        }
      >
        {viewDetail ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <Badge variant={INV_META[viewDetail.status].variant}>{INV_META[viewDetail.status].label}</Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Entered</div>
                <div>{new Date(viewDetail.enteredAt).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Yard</div>
                <div>{viewDetail.yard.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Port</div>
                <div>{viewDetail.port.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Location</div>
                <div>{viewDetail.locationLabel ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Cargo status</div>
                <div>{viewDetail.cargo.status.replace(/_/g, ' ')}</div>
              </div>
            </div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cargo
            </div>
            <dl className="space-y-1.5">
              <div className="flex justify-between"><dt className="text-muted-foreground">Reference</dt><dd className="text-right">{viewDetail.cargo.reference}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd className="text-right">{viewDetail.cargo.cargoType.replace(/_/g, ' ')}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Customer</dt><dd className="text-right">{viewDetail.cargo.customer.name}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Inspection</dt><dd className="text-right">{viewDetail.cargo.inspectionStatus}</dd></div>
            </dl>
            {viewDetail.notes && (
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Notes</div>
                <p className="whitespace-pre-wrap rounded-md border border-border px-3 py-2 text-xs">
                  {viewDetail.notes}
                </p>
              </div>
            )}
          </div>
        ) : (
          <PageLoader label="Loading inventory details…" />
        )}
      </Dialog>

      {/* Remove confirm */}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove from yard"
        description={`Remove "${removing?.cargo.reference}" from ${removing?.yard.code}? Its cargo status returns to Registered (if it is At yard).`}
        confirmLabel="Remove"
        destructive
        loading={saving}
        onConfirm={submitRemove}
      />
    </div>
  );
}