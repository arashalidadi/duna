'use client';
import { TableScroll } from '@/components/ui/table-scroll';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';

import { useTranslations as useUiTranslations } from 'next-intl';

import { useCallback, useEffect, useState } from 'react';
import type { PaginatedResult, YardListItem, PortListItem } from '@shipping/shared';
import { Plus, Power, Warehouse } from 'lucide-react';
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

interface FormValues {
  code: string;
  name: string;
  portId: string;
  address: string;
}

const EMPTY_FORM: FormValues = { code: '', name: '', portId: '', address: '' };

function toForm(y: YardListItem): FormValues {
  return { code: y.code, name: y.name, portId: y.portId, address: y.address ?? '' };
}

export default function YardsPage() {
  const ui = useUiTranslations('legacyUi');
  const { hasPermission } = useAuth();
  const [data, setData] = useState<PaginatedResult<YardListItem> | null>(null);
  const [ports, setPorts] = useState<PortListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [portFilter, setPortFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<YardListItem | null>(null);
  const [toggling, setToggling] = useState<YardListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);

  const load = useCallback(
    async (p: number, q: string, portId: string, active: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      if (portId) params.set('portId', portId);
      if (active) params.set('isActive', active);
      try {
        setData(await api.get<PaginatedResult<YardListItem>>(`/yards?${params.toString()}`));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : ui('failedToLoadYards'));
      } finally {
        setLoading(false);
      }
    },
    [ui]
  );

  const loadPorts = useCallback(async () => {
    try {
      const res = await api.get<PaginatedResult<PortListItem>>(
        `/ports?page=1&pageSize=100&isActive=true`
      );
      setPorts(res.data);
    } catch {
      setPorts([]);
    }
  }, []);

  useEffect(() => {
    load(page, debouncedSearch, portFilter, activeFilter);
  }, [load, page, debouncedSearch, portFilter, activeFilter]);

  useEffect(() => {
    loadPorts();
  }, [loadPorts]);

  const canCreate = hasPermission('yard:create');
  const canUpdate = hasPermission('yard:update');

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

  function openEdit(y: YardListItem) {
    setEditing(y);
    setForm(toForm(y));
    setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!form.code.trim() || !form.name.trim() || !form.portId) {
      setFormError(ui('codeNameAndPortAreRequired'));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch<YardListItem>(`/yards/${editing.id}`, formInput(form));
        setEditing(null);
      } else {
        await api.post<YardListItem>('/yards', formInput(form));
        setCreateOpen(false);
        setPage(1);
      }
      await load(page, search, portFilter, activeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToSaveYard'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!toggling) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.patch<YardListItem>(`/yards/${toggling.id}/active`, {
        isActive: !toggling.isActive,
      });
      setToggling(null);
      await load(page, search, portFilter, activeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToUpdateYard'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: ui('yards_m1ahdfge') }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">{ui('yards_m1ahdfge')}</h1>
          <p className="text-sm text-muted-foreground">
            {ui('storageYardsWithinPortsEachYardBelongsToExactlyOnePort')}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {ui('newYard')}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{ui('yardRegistry')}</CardTitle>
          <CardDescription>{ui('liveMasterDataNoPlaceholderRecords')}</CardDescription>
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
              placeholder={ui('searchCodeNameAddress')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label={ui('searchYards')}
            />
            <select
              className={SELECT_CLASS}
              value={portFilter}
              onChange={(e) => {
                setPortFilter(e.target.value);
                applyFilters();
              }}
              aria-label={ui('filterByPort')}
            >
              <option value="">{ui('allPorts')}</option>
              {ports.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
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
              aria-label={ui('filterByStatus')}
            >
              <option value="">{ui('allStatus')}</option>
              <option value="true">{ui('active')}</option>
              <option value="false">{ui('inactive')}</option>
            </select>
            <Button type="submit" variant="secondary">
              {ui('search')}
            </Button>
          </form>
        </CardContent>
        {loading ? (
          <PageLoader label={ui('loadingYards')} />
        ) : error ? (
          <CardContent>
            <ErrorState
              message={error}
              onRetry={() => load(page, search, portFilter, activeFilter)}
            />
          </CardContent>
        ) : data && data.data.length === 0 ? (
          <CardContent>
            <EmptyState
              title={ui('noYardsFound')}
              description={ui('tryADifferentSearchOrFilter')}
            />
          </CardContent>
        ) : (
          <TableScroll className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{ui('yard')}</th>
                  <th className="px-3 py-2 font-medium">{ui('port_m1qx5adi')}</th>
                  <th className="px-3 py-2 font-medium">{ui('location')}</th>
                  <th className="px-3 py-2 font-medium">{ui('status')}</th>
                  <th className="px-3 py-2 text-end font-medium">{ui('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((y) => (
                  <tr key={y.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Warehouse className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-medium text-foreground">
                              {y.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground">{y.code}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      {y.port.name} ({y.port.code})
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      {y.address ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {y.isActive ? (
                        <Badge variant="success">{ui('active')}</Badge>
                      ) : (
                        <Badge variant="neutral">{ui('inactive')}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => openEdit(y)}
                          >
                            {ui('edit')}
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setFormError(null);
                              setToggling(y);
                            }}
                            title={y.isActive ? ui('deactivate') : ui('activate')}
                            aria-label={y.isActive ? ui('deactivateYard') : ui('activateYard')}
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
        title={editing ? ui('editValue', { value0: String(editing.code) }) : ui('newYard')}
        description={editing ? ui('updateTheYardMasterRecord') : ui('createAYardWithinAPort')}
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
              {editing ? ui('saveChanges') : ui('createYard')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="yard-port" className="block">
              {ui('portRequired')}
            </Label>
            <select
              id="yard-port"
              className={`${SELECT_CLASS} w-full`}
              value={form.portId}
              onChange={(e) => updateField('portId', e.target.value)}
              autoFocus
            >
              <option value="">{ui('selectAPort')}</option>
              {ports.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="yard-code" className="block">
                {ui('codeRequired')}
              </Label>
              <Input
                id="yard-code"
                value={form.code}
                onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                placeholder={ui('jebaliY1')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="yard-name" className="block">
                {ui('nameRequired')}
              </Label>
              <Input
                id="yard-name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder={ui('yard1')}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="yard-address" className="block">
              {ui('address')}
            </Label>
            <Input
              id="yard-address"
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder={ui('sectorAreaZone')}
            />
          </div>
        </div>
        {formError && (
          <p className="mt-3 text-xs text-destructive" role="alert">
            {formError}
          </p>
        )}
      </Dialog>

      {/* Toggle confirm */}
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(open) => !open && setToggling(null)}
        title={toggling?.isActive ? ui('deactivateYard') : ui('activateYard')}
        description={
          toggling?.isActive
            ? ui('deactivatingYardValueKeepsItInMasterDataButMarksIt', {
                value0: String(toggling?.name),
              })
            : ui('reActivatingYardValueMakesItAvailableForOperations', {
                value0: String(toggling?.name),
              })
        }
        confirmLabel={toggling?.isActive ? ui('deactivate') : ui('activate')}
        destructive={toggling?.isActive}
        loading={saving}
        onConfirm={toggleActive}
        error={formError}
      />
    </div>
  );
}

/** Strip empty strings so optional fields are omitted from the request. */
function formInput(f: FormValues): Record<string, string> {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim() !== '')) as Record<
    string,
    string
  >;
}
