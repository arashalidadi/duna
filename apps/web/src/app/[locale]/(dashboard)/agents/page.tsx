'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PaginatedAgentsResult, AgentListItem, AgentDetail, AgentDestinationListItem, PaginatedAgentDestinationsResult } from '@shipping/shared';
import { Plus, Power, Trash2, Search, MapPin, Building2, Truck } from 'lucide-react';
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
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';

const PAGE_SIZE = 25;

interface AgentFormValues {
  code: string;
  name: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
}

const EMPTY_AGENT_FORM: AgentFormValues = {
  code: '',
  name: '',
  taxId: '',
  address: '',
  phone: '',
  email: '',
  notes: '',
};

function toAgentForm(a: AgentListItem): AgentFormValues {
  return {
    code: a.code,
    name: a.name,
    taxId: a.taxId ?? '',
    address: a.address ?? '',
    phone: a.phone ?? '',
    email: a.email ?? '',
    notes: a.notes ?? '',
  };
}

interface DestinationFormValues {
  portId: string;
  isActive: boolean;
}

// Simple in-component port cache to avoid the null-check error
let portCache: { id: string; code: string; name: string }[] | null = null;

async function loadPorts(): Promise<{ id: string; code: string; name: string }[]> {
  if (portCache) return portCache;
  try {
    const res = await api.get<{ data: { id: string; code: string; name: string }[] }>('/ports?pageSize=500');
    portCache = res.data;
    return res.data;
  } catch {
    portCache = [];
    return [];
  }
}

export default function AgentsPage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<PaginatedAgentsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AgentListItem | null>(null);
  const [toggling, setToggling] = useState<AgentListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<AgentFormValues>(EMPTY_AGENT_FORM);
  const [deleting, setDeleting] = useState<AgentListItem | null>(null);

  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<AgentDestinationListItem[]>([]);
  const [destPage, setDestPage] = useState(1);

  const [destCreateOpen, setDestCreateOpen] = useState(false);
  const [destForm, setDestForm] = useState<DestinationFormValues>({ portId: '', isActive: true });
  const [destCreating, setDestCreating] = useState(false);
  const [destError, setDestError] = useState<string | null>(null);

  const [destDeleting, setDestDeleting] = useState<string | null>(null);
  const [destRemoving, setDestRemoving] = useState(false);

  const [ports, setPorts] = useState<{ id: string; code: string; name: string }[] | null>(null);

  const load = useCallback(
    async (p: number, q: string, active: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      if (active) params.set('isActive', active);
      try {
        setData(await api.get<PaginatedAgentsResult>(`/agents?${params.toString()}`));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load agents');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(page, search, activeFilter);
  }, [load, page, search, activeFilter]);

  const canCreate = hasPermission('agent:create');
  const canUpdate = hasPermission('agent:update');
  const canDelete = hasPermission('agent:delete');

  function applyFilters() {
    setPage(1);
  }

  function updateField<K extends keyof AgentFormValues>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreate() {
    setForm(EMPTY_AGENT_FORM);
    setFormError(null);
    setCreateOpen(true);
  }

  function openEdit(a: AgentListItem) {
    setEditing(a);
    setForm(toAgentForm(a));
    setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!form.code.trim()) {
      setFormError('Code is required.');
      return;
    }
    if (!form.name.trim()) {
      setFormError('Name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put<AgentListItem>(`/agents/${editing.id}`, formInputObject(form));
        setEditing(null);
      } else {
        await api.post<AgentListItem>('/agents', formInputObject(form));
        setCreateOpen(false);
        setPage(1);
      }
      await load(page, search, activeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!toggling) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.put(`/agents/${toggling.id}/active`, { isActive: !toggling.isActive });
      setToggling(null);
      await load(page, search, activeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to update agent');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.del(`/agents/${deleting.id}`);
      setDeleting(null);
      await load(page, search, activeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to delete agent');
    } finally {
      setSaving(false);
    }
  }

  async function loadDetail(a: AgentListItem) {
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    setDestCreateOpen(false);
    setDestDeleting(null);
    setDestCreating(false);
    setDestError(null);
    setDestForm({ portId: '', isActive: true });
    try {
      const d = await api.get<AgentDetail>(`/agents/${a.id}`);
      setDetail(d);
      setDestinations(d.destinations);
    } catch (e) {
      setDetailError(e instanceof ApiError ? e.message : 'Failed to load agent');
    } finally {
      setDetailLoading(false);
    }
  }

  async function openDetail(a: AgentListItem) {
    await loadPorts().then((ps) => setPorts(ps));
    await loadDetail(a);
  }

  async function addDestination() {
    if (!destForm.portId.trim() || !detail) {
      setDestError('Port is required.');
      return;
    }
    setDestCreating(true);
    setDestError(null);
    try {
      await api.post<AgentDestinationListItem>(`/agents/${detail.id}/destinations`, {
        portId: destForm.portId,
        isActive: destForm.isActive,
      });
      setDestCreateOpen(false);
      setDestForm({ portId: '', isActive: true });
      const updated = await api.get<AgentDetail>(`/agents/${detail.id}`);
      setDetail(updated);
      setDestinations(updated.destinations);
    } catch (err) {
      setDestError(err instanceof ApiError ? err.message : 'Failed to add destination');
    } finally {
      setDestCreating(false);
    }
  }

  async function removeDestination(portId: string) {
    if (!detail) return;
    setDestDeleting(portId);
    try {
      await api.del(`/agents/${detail.id}/destinations/${portId}`);
      const updated = await api.get<AgentDetail>(`/agents/${detail.id}`);
      setDetail(updated);
      setDestinations(updated.destinations);
    } catch (err) {
      setDestError(err instanceof ApiError ? err.message : 'Failed to remove destination');
    } finally {
      setDestDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: 'Agents' }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Freight forwarding and shipping agents.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New agent
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Search and filter</CardTitle>
          <CardDescription>Find agents by name or code.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Search name or code…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  applyFilters();
                }}
                className="pl-8"
              />
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <select
              className="h-9 rounded-md border border-input bg-card px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                applyFilters();
              }}
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agents</CardTitle>
          <CardDescription>Registered agents.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <PageLoader />}
          {error && <ErrorState title="Failed to load" message={error} />}
          {!loading && !error && data && (
            <>
              {data.data.length === 0 ? (
                <EmptyState
                  title="No agents yet"
                  description="Create the first agent to get started."
                />
              ) : (
                <div className="border rounded-lg divide-y">
                  {data.data.map((row) => (
                    <div key={row.id} className="flex items-center gap-4 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.name}</span>
                          <Badge variant="neutral" className="text-xs">
                            {row.code}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {row.taxId ? `Tax ID: ${row.taxId}` : 'No tax ID'}
                          {row.address ? ` · ${row.address}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openDetail(row)}>
                          <MapPin className="h-4 w-4" />
                          Destinations
                        </Button>
                        {canUpdate && (
                          <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                            Edit
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setToggling(row)}
                          disabled={!canUpdate}
                        >
                          <Power className="h-4 w-4" />
                          {row.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        {canDelete && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleting(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end pt-4 border-t">
                <Pagination
                  page={data.meta.page}
                  pageSize={data.meta.pageSize}
                  totalItems={data.meta.totalItems}
                  totalPages={data.meta.totalPages}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="New agent">
        <div className="space-y-3">
          <FormField label="Code" required>
            <Input
              value={form.code}
              onChange={(e) => updateField('code', e.target.value)}
              placeholder="AGT-001"
            />
          </FormField>
          <FormField label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Global Freight Ltd."
            />
          </FormField>
          <FormField label="Tax ID">
            <Input
              value={form.taxId}
              onChange={(e) => updateField('taxId', e.target.value)}
              placeholder="1122334455"
            />
          </FormField>
          <FormField label="Address">
            <Input
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="789 Agent St"
            />
          </FormField>
          <FormField label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+1 555-0300"
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="office@globalfreight.example"
            />
          </FormField>
          <FormField label="Notes">
            <Input
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Additional notes"
            />
          </FormField>
        </div>
        <CardFooter className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Create agent'}
          </Button>
        </CardFooter>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)} title="Edit agent">
        <div className="space-y-3">
          <FormField label="Code" required>
            <Input
              value={form.code}
              onChange={(e) => updateField('code', e.target.value)}
            />
          </FormField>
          <FormField label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </FormField>
          <FormField label="Tax ID">
            <Input
              value={form.taxId}
              onChange={(e) => updateField('taxId', e.target.value)}
            />
          </FormField>
          <FormField label="Address">
            <Input
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
            />
          </FormField>
          <FormField label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </FormField>
          <FormField label="Notes">
            <Input
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </FormField>
        </div>
        <CardFooter className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </CardFooter>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete agent"
        description={deleting ? `Delete "${deleting.name}"? This cannot be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        loading={saving}
      />

      {/* Agent detail / destinations */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)} title="Agent destinations">
        {detailLoading && <PageLoader />}
        {detailError && <ErrorState title="Failed to load" message={detailError} />}
        {!detailLoading && !detailError && detail && (
          <div className="space-y-4">
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{detail.name}</span>
                <Badge variant="neutral">{detail.code}</Badge>
                <Badge variant={detail.isActive ? 'success' : 'danger'} dot>
                  {detail.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {detail.taxId && <div>Tax ID: {detail.taxId}</div>}
              {detail.address && <div>{detail.address}</div>}
              {detail.phone && <div>Phone: {detail.phone}</div>}
              {detail.email && <div>Email: {detail.email}</div>}
              {detail.notes && <div className="text-muted-foreground">{detail.notes}</div>}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Destination ports</h3>
                <span className="text-xs text-muted-foreground">
                  {destinations.length} port{destinations.length === 1 ? '' : 's'}
                </span>
              </div>

              {canCreate && (
                <Dialog
                  open={destCreateOpen}
                  onOpenChange={setDestCreateOpen}
                  title="Add destination"
                  description="Associate a port with this agent."
                >
                  <div className="space-y-3">
                    <FormField label="Port" required>
                      <select
                        className="h-9 rounded-md border border-input bg-card px-3 text-sm w-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                        value={destForm.portId}
                        onChange={(e) => setDestForm((p) => ({ ...p, portId: e.target.value }))}
                      >
                        <option value="">Select a port…</option>
                        {ports?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} — {p.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Active">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={destForm.isActive}
                          onChange={(e) => setDestForm((p) => ({ ...p, isActive: e.target.checked }))}
                          className="h-4 w-4 rounded border-border text-primary"
                        />
                        <span className="text-sm">Active destination</span>
                      </label>
                    </FormField>
                  </div>
                  <CardFooter className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setDestCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={addDestination} disabled={destCreating}>
                      {destCreating ? 'Adding…' : 'Add destination'}
                    </Button>
                  </CardFooter>
                </Dialog>
              )}

              {destError && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {destError}
                </div>
              )}

              <div className="mt-3 space-y-1">
                {destinations.map((dest) => (
                  <div
                    key={dest.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{dest.port.name}</div>
                        <div className="text-xs text-muted-foreground">{dest.port.code}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={dest.isActive ? 'success' : 'danger'} dot className="text-[11px]">
                        {dest.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {canDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeDestination(dest.portId)}
                          disabled={destRemoving}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {destinations.length === 0 && (
                  <EmptyState
                    title="No destinations"
                    description="Add a port to associate with this agent."
                  />
                )}
              </div>
            </div>
          </div>
        )}
        {!detailLoading && !detailError && detail && (
          <CardFooter className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDetail(null)}>
              Close
            </Button>
            {canCreate && (
              <Button onClick={() => setDestCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Add destination
              </Button>
            )}
          </CardFooter>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!destDeleting}
        onOpenChange={(open) => !open && setDestDeleting(null)}
        title="Remove destination"
        description={destDeleting ? 'Remove this port from the agent?' : undefined}
        confirmLabel="Remove"
        destructive
        onConfirm={() => destDeleting && removeDestination(destDeleting)}
        loading={destRemoving}
      />
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive text-[11px]">*</span>}
      </Label>
      {children}
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex gap-1">
        <span className="h-2 w-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span className="h-2 w-2 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ animationDelay: '150ms' }} />
        <span className="h-2 w-2 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

function formInputObject(f: AgentFormValues): Record<string, string> {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim() !== '')) as Record<string, string>;
}
