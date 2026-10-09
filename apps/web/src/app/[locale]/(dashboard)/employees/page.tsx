'use client';
import { TableScroll } from '@/components/ui/table-scroll';

import { useLocale as useUiLocale } from 'next-intl';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { Employee, EmployeeListResult, EmployeeStatus } from '@shipping/shared';
import { Plus, Eye, Pencil, Trash2, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateShort } from '@/lib/date';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { PageLoader } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';

const PAGE_SIZE = 20;

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-card px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring';

function statusVariant(s: EmployeeStatus): 'success' | 'outline' {
  return s === 'ACTIVE' ? 'success' : 'outline';
}

function money(v: string, displayLocale: string): string {
  return Number(v).toLocaleString(displayLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

type FormState = {
  id: string;
  code: string;
  name: string;
  nationalId: string;
  position: string;
  phone: string;
  email: string;
  hireDate: string;
  baseSalary: string;
  currencyCode: string;
  status: EmployeeStatus;
  notes: string;
};

const EMPTY_FORM: FormState = {
  id: '',
  code: '',
  name: '',
  nationalId: '',
  position: '',
  phone: '',
  email: '',
  hireDate: '',
  baseSalary: '0',
  currencyCode: 'IRR',
  status: 'ACTIVE',
  notes: '',
};

export default function EmployeesPage() {
  const uiLocale = useUiLocale();
  const t = useTranslations('employee');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { hasPermission } = useAuth();

  // list
  const [rows, setRows] = useState<Employee[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EmployeeStatus>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await api.get<EmployeeListResult>(`/employees?${params.toString()}`);
      setRows(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  // create / edit
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = async (row: Employee) => {
    setForm({
      id: row.id,
      code: row.code,
      name: row.name,
      nationalId: row.nationalId ?? '',
      position: row.position ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      hireDate: row.hireDate ? row.hireDate.slice(0, 10) : '',
      baseSalary: String(Number(row.baseSalary)),
      currencyCode: row.currencyCode,
      status: row.status,
      notes: row.notes ?? '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setFormError(t('form.errors.nameRequired'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        ...(form.nationalId.trim() ? { nationalId: form.nationalId.trim() } : {}),
        ...(form.position.trim() ? { position: form.position.trim() } : {}),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.hireDate ? { hireDate: form.hireDate } : {}),
        baseSalary: Number(form.baseSalary) || 0,
        currencyCode: form.currencyCode,
        status: form.status,
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      };
      if (form.code.trim()) payload.code = form.code.trim();
      if (form.id) {
        await api.patch(`/employees/${form.id}`, payload);
      } else {
        await api.post('/employees', payload);
      }
      setFormOpen(false);
      await load();
    } catch (e: any) {
      setFormError(e instanceof ApiError ? e.message : tc('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  // delete
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/employees/${deleteTarget.id}`);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: tc('nav.home'), href: '/dashboard' }, { label: t('page.title') }]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="size-6 text-primary" />
            {t('page.title')}
          </h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </div>
        {hasPermission('employee:create') && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t('actions.create')}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('list.title')}</CardTitle>
          <CardDescription>{t('list.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(searchInput);
                setPage(1);
              }}
            >
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('list.search')}
                className="w-64"
              />
              <Button type="submit" variant="outline" size="sm">
                {tc('actions.search')}
              </Button>
            </form>
            <select
              className={SELECT_CLASS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
            >
              <option value="ALL">{t('list.allStatuses')}</option>
              <option value="ACTIVE">{t('status.ACTIVE')}</option>
              <option value="INACTIVE">{t('status.INACTIVE')}</option>
            </select>
            <span className="ms-auto text-sm text-muted-foreground">
              {tc('list.total')}: {meta.totalItems}
            </span>
          </div>

          {loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : rows.length === 0 ? (
            <EmptyState title={t('list.empty.title')} description={t('list.empty.description')} />
          ) : (
            <>
              <TableScroll className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground">
                      <th className="p-3 text-start font-medium">{t('fields.code')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.name')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.position')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.hireDate')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.baseSalary')}</th>
                      <th className="p-3 text-start font-medium">
                        {t('fields.salaryRecordsCount')}
                      </th>
                      <th className="p-3 text-start font-medium">{t('fields.status')}</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => (
                      <tr key={e.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="p-3 font-mono text-xs">{e.code}</td>
                        <td className="p-3">
                          <div className="font-medium">{e.name}</div>
                          {e.phone && (
                            <div className="text-xs text-muted-foreground">{e.phone}</div>
                          )}
                        </td>
                        <td className="p-3">{e.position ?? '—'}</td>
                        <td className="p-3">
                          {e.hireDate ? formatDateShort(e.hireDate, locale) : '—'}
                        </td>
                        <td className="p-3 font-medium">
                          {money(e.baseSalary, uiLocale)}{' '}
                          <span className="text-xs text-muted-foreground">{e.currencyCode}</span>
                        </td>
                        <td className="p-3">{e.salaryRecordsCount ?? 0}</td>
                        <td className="p-3">
                          <Badge variant={statusVariant(e.status)}>{t(`status.${e.status}`)}</Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            {hasPermission('employee:update') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                title={t('actions.edit')}
                                onClick={() => void openEdit(e)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            )}
                            {hasPermission('employee:delete') &&
                              (e.salaryRecordsCount ?? 0) === 0 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  title={t('actions.delete')}
                                  onClick={() => setDeleteTarget(e)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
              <Pagination
                page={meta.page}
                pageSize={meta.pageSize}
                totalItems={meta.totalItems}
                totalPages={meta.totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* create / edit dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={form.id ? t('form.editTitle') : t('form.title')}
        description={t('form.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              {tc('actions.cancel')}
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? t('form.saving') : tc('actions.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.code')}</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder={t('form.codePlaceholder')}
                disabled={!!form.id}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.name')} *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.nationalId')}</Label>
              <Input
                value={form.nationalId}
                onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.position')}</Label>
              <Input
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.phone')}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.email')}</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.hireDate')}</Label>
              <Input
                type="date"
                value={form.hireDate}
                onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.baseSalary')}</Label>
              <Input
                type="number"
                min="0"
                value={form.baseSalary}
                onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.currency')}</Label>
              <select
                className={SELECT_CLASS + ' w-full'}
                value={form.currencyCode}
                onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
              >
                {['IRR', 'USD', 'AED', 'EUR', 'TRY', 'CNY'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('fields.status')}</Label>
            <select
              className={SELECT_CLASS + ' w-full'}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as EmployeeStatus })}
            >
              <option value="ACTIVE">{t('status.ACTIVE')}</option>
              <option value="INACTIVE">{t('status.INACTIVE')}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>{t('fields.notes')}</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
      </Dialog>

      {/* delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={t('confirm.delete.title')}
        description={
          deleteTarget ? t('confirm.delete.description', { name: deleteTarget.name }) : ''
        }
        confirmLabel={tc('actions.delete')}
        loading={deleting}
        onConfirm={() => void doDelete()}
        error={formError}
      />
    </div>
  );
}
