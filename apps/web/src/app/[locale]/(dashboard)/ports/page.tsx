'use client';
import { TableScroll } from '@/components/ui/table-scroll';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';

import { useTranslations as useUiTranslations } from 'next-intl';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PaginatedResult, PortListItem, PortDetail } from '@shipping/shared';
import { Plus, Power, Eye, MapPin } from 'lucide-react';
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
  country: string;
  city: string;
  abbreviation: string;
}

const EMPTY_FORM: FormValues = {
  code: '',
  name: '',
  country: '',
  city: '',
  abbreviation: '',
};

function toForm(p: PortListItem): FormValues {
  return {
    code: p.code,
    name: p.name,
    country: p.country,
    city: p.city ?? '',
    abbreviation: p.abbreviation ?? '',
  };
}

export default function PortsPage() {
  const ui = useUiTranslations('legacyUi');
  const { hasPermission } = useAuth();
  const t = useTranslations('ports');
  const [data, setData] = useState<PaginatedResult<PortListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [countryFilter, setCountryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PortListItem | null>(null);
  const [viewing, setViewing] = useState<PortListItem | null>(null);
  const [detail, setDetail] = useState<PortDetail | null>(null);
  const [toggling, setToggling] = useState<PortListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);

  const load = useCallback(
    async (p: number, q: string, country: string, active: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      if (country) params.set('country', country);
      if (active) params.set('isActive', active);
      try {
        setData(await api.get<PaginatedResult<PortListItem>>(`/ports?${params.toString()}`));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : ui('failedToLoadPorts'));
      } finally {
        setLoading(false);
      }
    },
    [ui]
  );

  useEffect(() => {
    load(page, debouncedSearch, countryFilter, activeFilter);
  }, [load, page, debouncedSearch, countryFilter, activeFilter]);

  const canCreate = hasPermission('port:create');
  const canUpdate = hasPermission('port:update');
  const canRead = hasPermission('port:read');

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

  function openEdit(p: PortListItem) {
    setEditing(p);
    setForm(toForm(p));
    setFormError(null);
  }

  async function openView(p: PortListItem) {
    setViewing(p);
    setDetail(null);
    try {
      setDetail(await api.get<PortDetail>(`/ports/${p.id}`));
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : ui('failedToLoadPortDetails'));
    }
  }

  async function submit() {
    setFormError(null);
    if (!form.code.trim() || !form.name.trim() || !form.country.trim()) {
      setFormError(ui('codeNameAndCountryAreRequired'));
      return;
    }
    if (form.abbreviation.trim().length > 10) {
      setFormError(t('abbreviation.validation'));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch<PortListItem>(`/ports/${editing.id}`, savePayload(form));
        setEditing(null);
      } else {
        await api.post<PortListItem>('/ports', savePayload(form));
        setCreateOpen(false);
        setPage(1);
      }
      await load(page, search, countryFilter, activeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToSavePort'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!toggling) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.patch<PortListItem>(`/ports/${toggling.id}/active`, {
        isActive: !toggling.isActive,
      });
      setToggling(null);
      await load(page, search, countryFilter, activeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToUpdatePort'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: ui('ports') }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">{ui('ports')}</h1>
          <p className="text-sm text-muted-foreground">
            {ui('portsAndTheirYardsAPortWithActiveYardsCannotBe')}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {ui('newPort')}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{ui('portRegistry')}</CardTitle>
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
              placeholder={ui('searchCodeNameCountryCity')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label={ui('searchPorts')}
            />
            <Input
              className="max-w-[160px]"
              placeholder={ui('filterCountry')}
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              aria-label={ui('filterByCountry')}
            />
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
          <PageLoader label={ui('loadingPorts')} />
        ) : error ? (
          <CardContent>
            <ErrorState
              message={error}
              onRetry={() => load(page, search, countryFilter, activeFilter)}
            />
          </CardContent>
        ) : data && data.data.length === 0 ? (
          <CardContent>
            <EmptyState
              title={ui('noPortsFound')}
              description={ui('tryADifferentSearchOrFilter')}
            />
          </CardContent>
        ) : (
          <TableScroll className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{ui('port_m1qx5adi')}</th>
                  <th className="px-3 py-2 font-medium">{t('abbreviation.column')}</th>
                  <th className="px-3 py-2 font-medium">{ui('country')}</th>
                  <th className="px-3 py-2 font-medium">{ui('city')}</th>
                  <th className="px-3 py-2 font-medium">{ui('status')}</th>
                  <th className="px-3 py-2 text-end font-medium">{ui('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-foreground">
                          {p.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{p.code}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {p.abbreviation ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-wide text-foreground">
                          {p.abbreviation}
                        </span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">
                          {t('abbreviation.empty')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">{p.country}</td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">{p.city ?? '—'}</td>
                    <td className="px-3 py-2">
                      {p.isActive ? (
                        <Badge variant="success">{ui('active')}</Badge>
                      ) : (
                        <Badge variant="neutral">{ui('inactive')}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openView(p)}
                            title={ui('viewDetailsAndYards')}
                            aria-label={ui('viewPortValue', { value0: String(p.code) })}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => openEdit(p)}
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
                              setToggling(p);
                            }}
                            title={p.isActive ? ui('deactivate') : ui('activate')}
                            aria-label={p.isActive ? ui('deactivatePort') : ui('activatePort')}
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
        title={editing ? ui('editValue', { value0: String(editing.code) }) : ui('newPort')}
        description={editing ? ui('updateThePortMasterRecord') : ui('createAPortMasterRecord')}
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
              {editing ? ui('saveChanges') : ui('createPort')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="port-code" className="block">
              {ui('codeRequired')}
            </Label>
            <Input
              id="port-code"
              value={form.code}
              onChange={(e) => updateField('code', e.target.value.toUpperCase())}
              placeholder={ui('jebali')}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="port-country" className="block">
              {ui('countryRequired')}
            </Label>
            <Input
              id="port-country"
              value={form.country}
              onChange={(e) => updateField('country', e.target.value)}
              placeholder={ui('uae')}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="port-name" className="block">
              {ui('nameRequired')}
            </Label>
            <Input
              id="port-name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder={ui('portOfJebelAli')}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="port-city" className="block">
              {ui('city')}
            </Label>
            <Input
              id="port-city"
              value={form.city}
              onChange={(e) => updateField('city', e.target.value)}
              placeholder={ui('dubai')}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="port-abbreviation" className="block">
              {t('abbreviation.label')}
            </Label>
            <Input
              id="port-abbreviation"
              value={form.abbreviation}
              onChange={(e) => updateField('abbreviation', e.target.value.toUpperCase())}
              placeholder={t('abbreviation.placeholder')}
              maxLength={10}
              aria-describedby="port-abbreviation-hint"
            />
            <p id="port-abbreviation-hint" className="text-[11px] text-muted-foreground">
              {t('abbreviation.hint')}
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
        title={viewing ? viewing.name : ui('port_m1qx5adi')}
        description={viewing ? `${viewing.code} · ${viewing.country}` : undefined}
        footer={
          <Button variant="outline" size="sm" onClick={() => setViewing(null)}>
            {ui('close')}
          </Button>
        }
      >
        {detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">{t('abbreviation.detail')}</div>
                <div>{detail.abbreviation ?? t('abbreviation.empty')}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{ui('city')}</div>
                <div>{detail.city ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{ui('status')}</div>
                <div>
                  {detail.isActive ? (
                    <Badge variant="success">{ui('active')}</Badge>
                  ) : (
                    <Badge variant="neutral">{ui('inactive')}</Badge>
                  )}
                </div>
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ui('yards')}
                {detail.yards.length})
              </div>
              {detail.yards.length === 0 ? (
                <p className="text-xs text-muted-foreground">{ui('noYardsRegisteredAtThisPort')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {detail.yards.map((y) => (
                    <li
                      key={y.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <span className="font-medium">{y.name}</span>
                        <span className="text-[11px] text-muted-foreground">{y.code}</span>
                      </span>
                      {y.isActive ? (
                        <Badge variant="success">{ui('active')}</Badge>
                      ) : (
                        <Badge variant="neutral">{ui('inactive')}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <PageLoader label={ui('loadingPortDetails')} />
        )}
      </Dialog>

      {/* Toggle confirm */}
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(open) => !open && setToggling(null)}
        title={toggling?.isActive ? ui('deactivatePort') : ui('activatePort')}
        description={
          toggling?.isActive
            ? ui('deactivatingValueFailsIfItStillHasActiveYardsHistoricalRecords', {
                value0: String(toggling?.name),
              })
            : ui('reActivatingValueMakesItAvailableForOperations', {
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

/**
 * Payload for create/edit. `abbreviation` is always present (even when empty)
 * so clearing the field on edit actually clears it server-side instead of
 * being dropped as an "empty optional" by formInput.
 */
function savePayload(f: FormValues): Record<string, string> {
  return { ...formInput(f), abbreviation: f.abbreviation.trim() };
}
