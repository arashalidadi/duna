'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PaginatedResult, VesselListItem, VesselDetail, VesselType } from '@shipping/shared';
import { Plus, Power, Eye } from 'lucide-react';
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

const VESSEL_TYPES: VesselType[] = [
  'CONTAINER',
  'BULK',
  'TANKER',
  'RORO',
  'GENERAL',
  'PROJECT',
  'OTHER',
];

const TYPE_LABELS: Record<VesselType, string> = {
  CONTAINER: 'Container',
  BULK: 'Bulk carrier',
  TANKER: 'Tanker',
  RORO: 'Ro-Ro',
  GENERAL: 'General cargo',
  PROJECT: 'Project',
  OTHER: 'Other',
};

interface FormValues {
  code: string;
  name: string;
  imo: string;
  flag: string;
  vesselType: VesselType;
  capacityTeu: string;
  notes: string;
}

const EMPTY_FORM: FormValues = {
  code: '',
  name: '',
  imo: '',
  flag: '',
  vesselType: 'CONTAINER',
  capacityTeu: '',
  notes: '',
};

function toForm(v: VesselListItem): FormValues {
  return {
    code: v.code,
    name: v.name,
    imo: v.imo ?? '',
    flag: v.flag,
    vesselType: v.vesselType,
    capacityTeu: v.capacityTeu ? String(v.capacityTeu) : '',
    notes: '',
  };
}

export default function VesselsPage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<PaginatedResult<VesselListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<VesselListItem | null>(null);
  const [viewing, setViewing] = useState<VesselListItem | null>(null);
  const [detail, setDetail] = useState<VesselDetail | null>(null);
  const [toggling, setToggling] = useState<VesselListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);

  const canCreate = hasPermission('vessel:create');
  const canUpdate = hasPermission('vessel:update');
  const canActivate = hasPermission('vessel:activate');
  const canRead = hasPermission('vessel:read');

  const load = useCallback(
    async (p: number, q: string, type: string, active: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      if (type) params.set('vesselType', type);
      if (active) params.set('isActive', active);
      try {
        setData(await api.get<PaginatedResult<VesselListItem>>(`/vessels?${params.toString()}`));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load vessels');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(page, search, typeFilter, activeFilter);
  }, [load, page, search, typeFilter, activeFilter]);

  function applyFilters() {
    setPage(1);
  }

  function updateField<K extends keyof FormValues>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setCreateOpen(true);
  }

  function openEdit(v: VesselListItem) {
    setEditing(v);
    setForm(toForm(v));
    setFormError(null);
  }

  async function openView(v: VesselListItem) {
    setViewing(v);
    setDetail(null);
    try {
      setDetail(await api.get<VesselDetail>(`/vessels/${v.id}`));
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to load vessel details');
    }
  }

  async function submit() {
    setFormError(null);
    if (!form.code.trim() || !form.name.trim() || !form.flag.trim()) {
      setFormError('Code, name and flag are required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch<VesselListItem>(`/vessels/${editing.id}`, editInput(form));
        setEditing(null);
      } else {
        await api.post<VesselListItem>('/vessels', formInput(form));
        setCreateOpen(false);
        setPage(1);
      }
      await load(page, search, typeFilter, activeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save vessel');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!toggling) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.patch<VesselListItem>(`/vessels/${toggling.id}/active`, {
        isActive: !toggling.isActive,
      });
      setToggling(null);
      await load(page, search, typeFilter, activeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to update vessel');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: 'Vessels' }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">Vessels</h1>
          <p className="text-sm text-muted-foreground">
            Vessel registry. A vessel with unfinished voyages cannot be deactivated.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New vessel
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Vessel registry</CardTitle>
          <CardDescription>Live master data. No placeholder records.</CardDescription>
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
              placeholder="Search code, name, flag, IMO…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search vessels"
            />
            <select
              className={SELECT_CLASS}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                applyFilters();
              }}
              aria-label="Filter by vessel type"
            >
              <option value="">All types</option>
              {VESSEL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <select
              className={SELECT_CLASS}
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                applyFilters();
              }}
              aria-label="Filter by status"
            >
              <option value="">All status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </CardContent>
        {loading ? (
          <PageLoader label="Loading vessels…" />
        ) : error ? (
          <CardContent>
            <ErrorState message={error} onRetry={() => load(page, search, typeFilter, activeFilter)} />
          </CardContent>
        ) : data && data.data.length === 0 ? (
          <CardContent>
            <EmptyState title="No vessels found" description="Try a different search or filter." />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Vessel</th>
                  <th className="px-3 py-2 font-medium">IMO</th>
                  <th className="px-3 py-2 font-medium">Flag</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Capacity (TEU)</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((v) => (
                  <tr key={v.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-foreground">
                          {v.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{v.code}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">{v.imo ?? '—'}</td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">{v.flag}</td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      {TYPE_LABELS[v.vesselType]}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      {v.capacityTeu ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {v.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="neutral">Inactive</Badge>
                      )}
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
                            aria-label={`View vessel ${v.code}`}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => openEdit(v)}
                          >
                            Edit
                          </Button>
                        )}
                        {canActivate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setToggling(v)}
                            title={v.isActive ? 'Deactivate' : 'Activate'}
                            aria-label={v.isActive ? 'Deactivate vessel' : 'Activate vessel'}
                          >
                            <Power className="h-4 w-4" aria-hidden="true" />
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
        title={editing ? `Edit — ${editing.code}` : 'New vessel'}
        description={
          editing ? 'Update the vessel master record. Code is immutable.' : 'Create a vessel master record.'
        }
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
              {editing ? 'Save changes' : 'Create vessel'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="vessel-code" className="block">
              Code *
            </Label>
            <Input
              id="vessel-code"
              value={form.code}
              onChange={(e) => updateField('code', e.target.value.toUpperCase())}
              placeholder="MV-HORIZON"
              disabled={!!editing}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vessel-type" className="block">
              Type *
            </Label>
            <select
              id="vessel-type"
              className={SELECT_CLASS + ' w-full'}
              value={form.vesselType}
              onChange={(e) => updateField('vesselType', e.target.value as VesselType)}
            >
              {VESSEL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="vessel-name" className="block">
              Name *
            </Label>
            <Input
              id="vessel-name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="MV Horizon"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vessel-imo" className="block">
              IMO number
            </Label>
            <Input
              id="vessel-imo"
              value={form.imo}
              onChange={(e) => updateField('imo', e.target.value.replace(/\D/g, '').slice(0, 7))}
              placeholder="1234567"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vessel-flag" className="block">
              Flag *
            </Label>
            <Input
              id="vessel-flag"
              value={form.flag}
              onChange={(e) => updateField('flag', e.target.value.toUpperCase())}
              placeholder="UAE"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vessel-capacity" className="block">
              Capacity (TEU)
            </Label>
            <Input
              id="vessel-capacity"
              type="number"
              min={1}
              value={form.capacityTeu}
              onChange={(e) => updateField('capacityTeu', e.target.value)}
              placeholder="2400"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vessel-notes" className="block">
              Notes
            </Label>
            <Input
              id="vessel-notes"
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
        title={viewing ? viewing.name : 'Vessel'}
        description={viewing ? `${viewing.code} · ${viewing.flag}` : undefined}
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
                <div className="text-xs text-muted-foreground">IMO</div>
                <div>{detail.imo ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Type</div>
                <div>{TYPE_LABELS[detail.vesselType]}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Capacity (TEU)</div>
                <div>{detail.capacityTeu ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div>
                  {detail.isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="neutral">Inactive</Badge>
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Notes</div>
                <div>{detail.notes ?? '—'}</div>
              </div>
            </div>
          </div>
        ) : (
          <PageLoader label="Loading vessel details…" />
        )}
      </Dialog>

      {/* Toggle confirm */}
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(open) => !open && setToggling(null)}
        title={toggling?.isActive ? 'Deactivate vessel' : 'Activate vessel'}
        description={
          toggling?.isActive
            ? `Deactivating "${toggling?.name}" fails if it still has unfinished voyages. Historical records are preserved.`
            : `Re-activating "${toggling?.name}" makes it available for new voyages.`
        }
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Activate'}
        destructive={toggling?.isActive}
        loading={saving}
        onConfirm={toggleActive}
      />
    </div>
  );
}

/** Strip empty strings so optional fields are omitted from the request. */
function formInput(f: FormValues): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (f.code.trim()) out.code = f.code.trim();
  if (f.name.trim()) out.name = f.name.trim();
  if (f.imo.trim()) out.imo = f.imo.trim();
  if (f.flag.trim()) out.flag = f.flag.trim();
  out.vesselType = f.vesselType;
  if (f.capacityTeu.trim()) out.capacityTeu = Number(f.capacityTeu);
  if (f.notes.trim()) out.notes = f.notes.trim();
  return out;
}

/** Edit input: code is immutable, and imo needs explicit null when cleared. */
function editInput(f: FormValues): Record<string, string | number | null> {
  const input = formInput(f);
  return {
    ...input,
    imo: f.imo.trim() ? f.imo.trim() : null,
    notes: f.notes.trim() ? f.notes.trim() : null,
  };
}