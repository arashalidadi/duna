'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PaginatedShippersResult, ShipperListItem } from '@shipping/shared';
import { Plus, Power, Trash2 } from 'lucide-react';
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

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-card px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring';

interface FormValues {
  code: string;
  name: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  notes: string;
}

const EMPTY_FORM: FormValues = {
  code: '',
  name: '',
  taxId: '',
  address: '',
  phone: '',
  email: '',
  notes: '',
};

function toForm(c: ShipperListItem): FormValues {
  return {
    code: c.code,
    name: c.name,
    taxId: c.taxId ?? '',
    address: c.address ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    notes: c.notes ?? '',
  };
}

function formInputObject(f: FormValues): Record<string, string> {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim() !== '')) as Record<string, string>;
}

export default function ShippersPage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<PaginatedShippersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ShipperListItem | null>(null);
  const [toggling, setToggling] = useState<ShipperListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [deleting, setDeleting] = useState<ShipperListItem | null>(null);

  const load = useCallback(
    async (p: number, q: string, active: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      if (active) params.set('isActive', active);
      try {
        setData(await api.get<PaginatedShippersResult>(`/shippers?${params.toString()}`));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load shippers');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(page, search, activeFilter);
  }, [load, page, search, activeFilter]);

  const canCreate = hasPermission('shipper:create');
  const canUpdate = hasPermission('shipper:update');

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

  function openEdit(c: ShipperListItem) {
    setEditing(c);
    setForm(toForm(c));
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
        await api.put<ShipperListItem>(`/shippers/${editing.id}`, formInputObject(form));
        setEditing(null);
      } else {
        await api.post<ShipperListItem>('/shippers', formInputObject(form));
        setCreateOpen(false);
        setPage(1);
      }
      await load(page, search, activeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save shipper');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!toggling) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.put(`/shippers/${toggling.id}/active`, { isActive: !toggling.isActive });
      setToggling(null);
      await load(page, search, activeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to update shipper');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.del(`/shippers/${deleting.id}`);
      setDeleting(null);
      await load(page, search, activeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to delete shipper');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: 'Shippers' }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">Shippers</h1>
          <p className="text-sm text-muted-foreground">
            Companies that ship cargo through our ports.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New shipper
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Search and filter</CardTitle>
          <CardDescription>Find shippers by name or code.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters();
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <Input
              className="max-w-xs"
              placeholder="Search code, name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search shippers"
            />
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
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shippers</CardTitle>
          <CardDescription>Registered shipping companies.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <PageLoader />}
          {error && <ErrorState title="Failed to load" message={error} />}
          {!loading && !error && data && (
            <>
              {data.data.length === 0 ? (
                <EmptyState
                  title="No shippers yet"
                  description="Create the first shipper to get started."
                />
              ) : (
                <div className="border rounded-lg divide-y">
                  {data.data.map((row) => (
                    <div key={row.id} className="flex items-center gap-4 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {row.code}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {row.taxId ? `Tax ID: ${row.taxId}` : 'No tax ID'}
                          {row.address ? ` · ${row.address}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
                        {canUpdate && (
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="New shipper">
        <div className="space-y-3">
          <FormField label="Code" required>
            <Input
              value={form.code}
              onChange={(e) => updateField('code', e.target.value)}
              placeholder="SHP-001"
            />
          </FormField>
          <FormField label="Name" required>
            <Input
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="ACME Shipping Co."
            />
          </FormField>
          <FormField label="Tax ID">
            <Input
              value={form.taxId}
              onChange={(e) => updateField('taxId', e.target.value)}
              placeholder="123456789"
            />
          </FormField>
          <FormField label="Address">
            <Input
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="123 Port Road"
            />
          </FormField>
          <FormField label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+1 555-0100"
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="contact@acme.example"
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
            {saving ? 'Saving…' : 'Create shipper'}
          </Button>
        </CardFooter>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)} title="Edit shipper">
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
        title="Delete shipper"
        description={deleting ? `Delete "${deleting.name}"? This cannot be undone.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        loading={saving}
      />
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
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

function Search({ className }: { className?: string }) {
  return (
    <Search className={className} />
  );
}
