'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PaginatedResult, CustomerListItem } from '@shipping/shared';
import { Plus, Power } from 'lucide-react';
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

const CUSTOMER_TYPES = [
  { value: 'SHIPPER', label: 'Shipper' },
  { value: 'CONSIGNEE', label: 'Consignee' },
  { value: 'FORWARDER', label: 'Forwarder' },
  { value: 'TRANSPORT', label: 'Transport / Trucking' },
  { value: 'AGENT', label: 'Agent' },
];

interface FormValues {
  code: string;
  name: string;
  shortName: string;
  type: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  country: string;
  taxId: string;
  currency: string;
}

const EMPTY_FORM: FormValues = {
  code: '',
  name: '',
  shortName: '',
  type: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  country: '',
  taxId: '',
  currency: '',
};

function toForm(c: CustomerListItem): FormValues {
  return {
    code: c.code,
    name: c.name,
    shortName: c.shortName ?? '',
    type: c.type ?? '',
    contactName: c.contactName ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    address: c.address ?? '',
    country: c.country ?? '',
    taxId: c.taxId ?? '',
    currency: c.currency ?? '',
  };
}

export default function CustomersPage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<PaginatedResult<CustomerListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerListItem | null>(null);
  const [toggling, setToggling] = useState<CustomerListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);

  const load = useCallback(async (p: number, q: string, type: string, active: string) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
    if (q) params.set('search', q);
    if (type) params.set('type', type);
    if (active) params.set('isActive', active);
    try {
      setData(await api.get<PaginatedResult<CustomerListItem>>(`/customers?${params.toString()}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, search, typeFilter, activeFilter);
  }, [load, page, search, typeFilter, activeFilter]);

  const canCreate = hasPermission('customer:create');
  const canUpdate = hasPermission('customer:update');

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

  function openEdit(c: CustomerListItem) {
    setEditing(c);
    setForm(toForm(c));
    setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!form.code.trim() || !form.name.trim()) {
      setFormError('Code and name are required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch<CustomerListItem>(`/customers/${editing.id}`, formInput(form));
        setEditing(null);
      } else {
        await api.post<CustomerListItem>('/customers', formInput(form));
        setCreateOpen(false);
        setPage(1);
      }
      await load(page, search, typeFilter, activeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!toggling) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.patch<CustomerListItem>(`/customers/${toggling.id}/active`, {
        isActive: !toggling.isActive,
      });
      setToggling(null);
      await load(page, search, typeFilter, activeFilter);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to update customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: 'Customers' }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Companies that ship, receive or arrange cargo through our ports.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New customer
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Customer registry</CardTitle>
          <CardDescription>Live master data. Contains no placeholder records.</CardDescription>
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
              placeholder="Search code, name, email, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search customers"
            />
            <select
              className={SELECT_CLASS}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                applyFilters();
              }}
              aria-label="Filter by type"
            >
              <option value="">All types</option>
              {CUSTOMER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
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
          <PageLoader label="Loading customers…" />
        ) : error ? (
          <CardContent>
            <ErrorState message={error} onRetry={() => load(page, search, typeFilter, activeFilter)} />
          </CardContent>
        ) : data && data.data.length === 0 ? (
          <CardContent>
            <EmptyState title="No customers found" description="Try a different search or filter." />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">Country</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-medium text-foreground">
                            {c.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">{c.code}</span>
                        </div>
                        {c.email && (
                          <div className="truncate text-[12px] text-muted-foreground">{c.email}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      {c.type ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      <div>{c.contactName ?? '—'}</div>
                      {c.phone && <div className="tabular-nums">{c.phone}</div>}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-foreground">
                      {c.country ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {c.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="neutral">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
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
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setToggling(c)}
                            title={c.isActive ? 'Deactivate' : 'Activate'}
                            aria-label={c.isActive ? 'Deactivate customer' : 'Activate customer'}
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
        title={editing ? `Edit — ${editing.code}` : 'New customer'}
        description={
          editing
            ? 'Update the customer master record.'
            : 'Create a customer master record.'
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
              {editing ? 'Save changes' : 'Create customer'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cust-code" className="block">
              Code *
            </Label>
            <Input
              id="cust-code"
              value={form.code}
              onChange={(e) => updateField('code', e.target.value.toUpperCase())}
              placeholder="CUS-001"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-type" className="block">
              Type
            </Label>
            <select
              id="cust-type"
              className={`${SELECT_CLASS} w-full`}
              value={form.type}
              onChange={(e) => updateField('type', e.target.value)}
            >
              <option value="">Select type</option>
              {CUSTOMER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="cust-name" className="block">
              Name *
            </Label>
            <Input
              id="cust-name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Company legal name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-shortname" className="block">
              Short name
            </Label>
            <Input
              id="cust-shortname"
              value={form.shortName}
              onChange={(e) => updateField('shortName', e.target.value)}
              placeholder="e.g. ACME"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-taxid" className="block">
              Tax / TRN
            </Label>
            <Input
              id="cust-taxid"
              value={form.taxId}
              onChange={(e) => updateField('taxId', e.target.value)}
              placeholder="e.g. 100123456700003"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-contact" className="block">
              Contact name
            </Label>
            <Input
              id="cust-contact"
              value={form.contactName}
              onChange={(e) => updateField('contactName', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-phone" className="block">
              Phone
            </Label>
            <Input
              id="cust-phone"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-email" className="block">
              Email
            </Label>
            <Input
              id="cust-email"
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-currency" className="block">
              Currency
            </Label>
            <Input
              id="cust-currency"
              value={form.currency}
              onChange={(e) => updateField('currency', e.target.value.toUpperCase())}
              placeholder="AED"
              maxLength={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-country" className="block">
              Country
            </Label>
            <Input
              id="cust-country"
              value={form.country}
              onChange={(e) => updateField('country', e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="cust-address" className="block">
              Address
            </Label>
            <Input
              id="cust-address"
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
            />
          </div>
        </div>
        {formError && <p className="mt-3 text-xs text-destructive" role="alert">{formError}</p>}
      </Dialog>

      {/* Toggle confirm */}
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(open) => !open && setToggling(null)}
        title={toggling?.isActive ? 'Deactivate customer' : 'Activate customer'}
        description={
          toggling?.isActive
            ? `Deactivating "${toggling?.name}" marks it inactive in master data. Historical records are preserved.`
            : `Re-activating "${toggling?.name}" makes it available for new cargo.`
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
function formInput(f: FormValues): Record<string, string> {
  return Object.fromEntries(
    Object.entries(f).filter(([, v]) => v.trim() !== '')
  ) as Record<string, string>;
}