'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type {
  SalaryRecord,
  SalaryRecordListResult,
  SalaryStatus,
  Employee,
  EmployeeListResult,
} from '@shipping/shared';
import {
  Plus, Eye, CheckCircle2, Banknote, XCircle, Trash2, Wallet,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateTime } from '@/lib/date';
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

const SALARY_STATUSES: SalaryStatus[] = ['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'];
const PAY_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const;

function statusVariant(s: SalaryStatus): 'info' | 'success' | 'danger' | 'outline' {
  if (s === 'PAID') return 'success';
  if (s === 'APPROVED') return 'info';
  if (s === 'CANCELLED') return 'danger';
  return 'outline';
}

function money(v: string): string {
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function periodLabel(year: number, month: number): string {
  return `${year}/${String(month).padStart(2, '0')}`;
}

type FormState = {
  employeeId: string;
  year: string;
  month: string;
  base: string;
  additions: string;
  deductions: string;
  currencyCode: string;
  notes: string;
};

export default function SalaryRecordsPage() {
  const t = useTranslations('salary');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { hasPermission } = useAuth();

  // list
  const [rows, setRows] = useState<SalaryRecord[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SalaryStatus>('ALL');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [employeeFilter, setEmployeeFilter] = useState('ALL');
  const [employees, setEmployees] = useState<Employee[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (yearFilter !== 'ALL') params.set('year', yearFilter);
      if (monthFilter !== 'ALL') params.set('month', monthFilter);
      if (employeeFilter !== 'ALL') params.set('employeeId', employeeFilter);
      const res = await api.get<SalaryRecordListResult>(`/salary-records?${params.toString()}`);
      setRows(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, yearFilter, monthFilter, employeeFilter, tc]);

  useEffect(() => { void load(); }, [load]);

  // employee picker data (create + filter)
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<EmployeeListResult>('/employees?pageSize=100&status=ACTIVE');
        setEmployees(res.data);
      } catch { /* best-effort */ }
    })();
  }, []);

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  // create
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    employeeId: '', year: String(new Date().getFullYear()), month: String(new Date().getMonth() + 1),
    base: '0', additions: '0', deductions: '0', currencyCode: 'IRR', notes: '',
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const openCreate = () => {
    setForm({
      employeeId: '', year: String(new Date().getFullYear()), month: String(new Date().getMonth() + 1),
      base: '0', additions: '0', deductions: '0', currencyCode: 'IRR', notes: '',
    });
    setFormError('');
    setCreateOpen(true);
  };

  const onPickEmployee = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    setForm((f) => ({
      ...f,
      employeeId: id,
      base: emp ? String(Number(emp.baseSalary)) : f.base,
      currencyCode: emp ? emp.currencyCode : f.currencyCode,
    }));
  };

  const netPreview = (() => {
    const base = Number(form.base) || 0;
    const add = Number(form.additions) || 0;
    const ded = Number(form.deductions) || 0;
    return base + add - ded;
  })();

  const submitCreate = async () => {
    if (!form.employeeId) { setFormError(t('create.errors.employeeRequired')); return; }
    setCreating(true);
    setFormError('');
    try {
      await api.post('/salary-records', {
        employeeId: form.employeeId,
        year: Number(form.year),
        month: Number(form.month),
        base: Number(form.base) || 0,
        additions: Number(form.additions) || 0,
        deductions: Number(form.deductions) || 0,
        currencyCode: form.currencyCode,
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      setCreateOpen(false);
      setPage(1);
      await load();
    } catch (e: any) {
      setFormError(e instanceof ApiError ? e.message : tc('errors.generic'));
    } finally {
      setCreating(false);
    }
  };

  // detail
  const [detail, setDetail] = useState<SalaryRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const d = await api.get<SalaryRecord>(`/salary-records/${id}`);
      setDetail(d);
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // lifecycle
  const [approveTarget, setApproveTarget] = useState<SalaryRecord | null>(null);
  const [approving, setApproving] = useState(false);
  const [payTarget, setPayTarget] = useState<SalaryRecord | null>(null);
  const [payMethod, setPayMethod] = useState<string>('BANK_TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [paying, setPaying] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<SalaryRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SalaryRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const doApprove = async () => {
    if (!approveTarget) return;
    setApproving(true);
    try {
      await api.post(`/salary-records/${approveTarget.id}/approve`, {});
      setApproveTarget(null);
      setDetailOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
    } finally { setApproving(false); }
  };

  const doPay = async () => {
    if (!payTarget) return;
    setPaying(true);
    try {
      await api.post(`/salary-records/${payTarget.id}/pay`, {
        paymentMethod: payMethod,
        ...(payRef.trim() ? { paymentRef: payRef.trim() } : {}),
      });
      setPayTarget(null);
      setPayRef('');
      setDetailOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
    } finally { setPaying(false); }
  };

  const doCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await api.post(`/salary-records/${cancelTarget.id}/cancel`, { cancelReason: cancelReason.trim() });
      setCancelTarget(null);
      setCancelReason('');
      setDetailOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
    } finally { setCancelling(false); }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/salary-records/${deleteTarget.id}`);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? tc('errors.generic'));
      setDeleteTarget(null);
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: tc('nav.home'), href: '/dashboard' }, { label: t('page.title') }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Wallet className="size-6 text-primary" />
            {t('page.title')}
          </h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </div>
        {hasPermission('salary:create') && (
          <Button onClick={openCreate}><Plus className="size-4" />{t('actions.create')}</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('list.title')}</CardTitle>
          <CardDescription>{t('list.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}>
              <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('list.search')} className="w-56" />
              <Button type="submit" variant="outline" size="sm">{tc('actions.search')}</Button>
            </form>
            <select className={SELECT_CLASS} value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}>
              <option value="ALL">{t('list.allStatuses')}</option>
              {SALARY_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
            </select>
            <select className={SELECT_CLASS} value={yearFilter}
              onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}>
              <option value="ALL">{t('list.allYears')}</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className={SELECT_CLASS} value={monthFilter}
              onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}>
              <option value="ALL">{t('list.allMonths')}</option>
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
            <select className={SELECT_CLASS} value={employeeFilter}
              onChange={(e) => { setEmployeeFilter(e.target.value); setPage(1); }}>
              <option value="ALL">{t('list.allEmployees')}</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <span className="ms-auto text-sm text-muted-foreground">{tc('list.total')}: {meta.totalItems}</span>
          </div>

          {loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : rows.length === 0 ? (
            <EmptyState title={t('list.empty.title')} description={t('list.empty.description')} />
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground">
                      <th className="p-3 text-start font-medium">{t('fields.number')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.employee')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.period')}</th>
                      <th className="p-3 text-end font-medium">{t('fields.base')}</th>
                      <th className="p-3 text-end font-medium">{t('fields.additions')}</th>
                      <th className="p-3 text-end font-medium">{t('fields.deductions')}</th>
                      <th className="p-3 text-end font-medium">{t('fields.net')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.status')}</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="p-3">
                          <button className="font-mono text-primary underline-offset-4 hover:underline"
                            onClick={() => void openDetail(r.id)}>{r.recordNumber}</button>
                        </td>
                        <td className="p-3">{r.employee?.name ?? '—'}</td>
                        <td className="p-3 font-mono text-xs">{periodLabel(r.year, r.month)}</td>
                        <td className="p-3 text-end">{money(r.base)}</td>
                        <td className="p-3 text-end text-success-foreground">{money(r.additions)}</td>
                        <td className="p-3 text-end text-destructive">{money(r.deductions)}</td>
                        <td className="p-3 text-end font-medium">
                          {money(r.net)} <span className="text-xs font-normal text-muted-foreground">{r.currencyCode}</span>
                        </td>
                        <td className="p-3"><Badge variant={statusVariant(r.status)}>{t(`status.${r.status}`)}</Badge></td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => void openDetail(r.id)} title={t('actions.view')}><Eye className="size-4" /></Button>
                            {r.status === 'DRAFT' && hasPermission('salary:approve') && (
                              <Button size="sm" variant="ghost" className="text-success-foreground" title={t('actions.approve')}
                                onClick={() => setApproveTarget(r)}><CheckCircle2 className="size-4" /></Button>
                            )}
                            {r.status === 'APPROVED' && hasPermission('salary:pay') && (
                              <Button size="sm" variant="ghost" className="text-info-foreground" title={t('actions.pay')}
                                onClick={() => { setPayTarget(r); setPayMethod('BANK_TRANSFER'); setPayRef(''); }}><Banknote className="size-4" /></Button>
                            )}
                            {(r.status === 'DRAFT' || r.status === 'APPROVED') && hasPermission('salary:cancel') && (
                              <Button size="sm" variant="ghost" className="text-warning-foreground" title={t('actions.cancel')}
                                onClick={() => { setCancelTarget(r); setCancelReason(''); }}><XCircle className="size-4" /></Button>
                            )}
                            {r.status === 'DRAFT' && hasPermission('salary:delete') && (
                              <Button size="sm" variant="ghost" className="text-destructive" title={t('actions.delete')}
                                onClick={() => setDeleteTarget(r)}><Trash2 className="size-4" /></Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={meta.page} pageSize={meta.pageSize} totalItems={meta.totalItems} totalPages={meta.totalPages} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}
        title={t('create.title')} description={t('create.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{tc('actions.cancel')}</Button>
            <Button onClick={() => void submitCreate()} disabled={creating}>
              {creating ? t('create.creating') : tc('actions.save')}
            </Button>
          </>
        }>
        <div className="grid gap-4">
          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.employee')} *</Label>
              <select className={SELECT_CLASS + ' w-full'} value={form.employeeId}
                onChange={(e) => onPickEmployee(e.target.value)}>
                <option value="">{t('create.selectEmployee')}</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.currency')}</Label>
              <select className={SELECT_CLASS + ' w-full'} value={form.currencyCode}
                onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}>
                {['IRR', 'USD', 'AED', 'EUR', 'TRY', 'CNY'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.year')}</Label>
              <Input type="number" min={2000} max={2100} value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.month')}</Label>
              <select className={SELECT_CLASS + ' w-full'} value={form.month}
                onChange={(e) => setForm({ ...form, month: e.target.value })}>
                {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.base')}</Label>
              <Input type="number" min="0" value={form.base}
                onChange={(e) => setForm({ ...form, base: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.additions')}</Label>
              <Input type="number" min="0" value={form.additions}
                onChange={(e) => setForm({ ...form, additions: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.deductions')}</Label>
              <Input type="number" min="0" value={form.deductions}
                onChange={(e) => setForm({ ...form, deductions: e.target.value })} />
            </div>
          </div>

          {/* live net */}
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between"><span>{t('fields.base')}</span><span>{money(form.base)}</span></div>
            <div className="flex justify-between text-success-foreground"><span>{t('fields.additions')}</span><span>+ {money(form.additions)}</span></div>
            <div className="flex justify-between text-destructive"><span>{t('fields.deductions')}</span><span>− {money(form.deductions)}</span></div>
            <div className="mt-1 flex justify-between border-t pt-1 font-medium"><span>{t('fields.net')}</span><span>{money(String(netPreview))} {form.currencyCode}</span></div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('fields.notes')}</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Dialog>

      {/* detail */}
      <Dialog open={detailOpen} onOpenChange={(o) => { setDetailOpen(o); if (!o) setDetail(null); }}
        title={detail ? detail.recordNumber : t('detail.title')}>
        {detailLoading || !detail ? (
          <PageLoader />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(detail.status)}>{t(`status.${detail.status}`)}</Badge>
              <span className="text-sm text-muted-foreground">{detail.employee?.name} — {periodLabel(detail.year, detail.month)}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-muted-foreground">{t('fields.base')}</dt><dd>{money(detail.base)}</dd></div>
              <div><dt className="text-muted-foreground">{t('fields.additions')}</dt><dd className="text-success-foreground">{money(detail.additions)}</dd></div>
              <div><dt className="text-muted-foreground">{t('fields.deductions')}</dt><dd className="text-destructive">{money(detail.deductions)}</dd></div>
              <div><dt className="text-muted-foreground">{t('fields.currency')}</dt><dd>{detail.currencyCode}</dd></div>
              <div className="col-span-2 border-t pt-2"><dt className="text-muted-foreground">{t('fields.net')}</dt>
                <dd className="text-lg font-bold">{money(detail.net)} {detail.currencyCode}</dd></div>
              {detail.paymentMethod && (
                <div><dt className="text-muted-foreground">{t('fields.paymentMethod')}</dt><dd>{t(`method.${detail.paymentMethod}`)}</dd></div>
              )}
              {detail.paymentRef && (
                <div><dt className="text-muted-foreground">{t('fields.paymentRef')}</dt><dd className="font-mono text-xs">{detail.paymentRef}</dd></div>
              )}
              {detail.approvedAt && (
                <div><dt className="text-muted-foreground">{t('detail.approvedOn')}</dt>
                  <dd>{formatDateTime(detail.approvedAt, locale)}</dd></div>
              )}
              {detail.paidAt && (
                <div><dt className="text-muted-foreground">{t('detail.paidOn')}</dt>
                  <dd>{formatDateTime(detail.paidAt, locale)}</dd></div>
              )}
              {detail.cancelledAt && (
                <div><dt className="text-muted-foreground">{t('detail.cancelledOn')}</dt>
                  <dd>{formatDateTime(detail.cancelledAt, locale)}</dd></div>
              )}
              {detail.cancelReason && (
                <div className="col-span-2"><dt className="text-muted-foreground">{t('fields.cancelReason')}</dt>
                  <dd className="text-destructive">{detail.cancelReason}</dd></div>
              )}
              {detail.notes && (
                <div className="col-span-2"><dt className="text-muted-foreground">{t('fields.notes')}</dt><dd>{detail.notes}</dd></div>
              )}
              <div className="col-span-2"><dt className="text-muted-foreground">{t('detail.createdAt')}</dt>
                <dd>{formatDateTime(detail.createdAt, locale)}</dd></div>
            </dl>
          </div>
        )}
      </Dialog>

      {/* approve confirm */}
      <ConfirmDialog
        open={!!approveTarget} onOpenChange={(o) => { if (!o) setApproveTarget(null); }}
        title={t('confirm.approve.title')}
        description={approveTarget
          ? t('confirm.approve.description', { number: approveTarget.recordNumber, net: money(approveTarget.net) })
          : ''}
        confirmLabel={t('actions.approve')} loading={approving}
        onConfirm={() => void doApprove()}
      />

      {/* pay dialog */}
      <Dialog open={!!payTarget} onOpenChange={(o) => { if (!o) setPayTarget(null); }}
        title={t('pay.title')} description={t('pay.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setPayTarget(null)}>{tc('actions.cancel')}</Button>
            <Button onClick={() => void doPay()} disabled={paying}>
              {paying ? t('pay.paying') : t('actions.pay')}
            </Button>
          </>
        }>
        <div className="space-y-4">
          {payTarget && (
            <p className="text-sm text-muted-foreground">
              {payTarget.recordNumber} — {payTarget.employee?.name} — {money(payTarget.net)} {payTarget.currencyCode}
            </p>
          )}
          <div className="space-y-1.5">
            <Label>{t('fields.paymentMethod')}</Label>
            <select className={SELECT_CLASS + ' w-full'} value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}>
              {PAY_METHODS.map((m) => <option key={m} value={m}>{t(`method.${m}`)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.paymentRef')}</Label>
            <Input value={payRef} onChange={(e) => setPayRef(e.target.value)}
              placeholder={t('pay.referencePlaceholder')} />
          </div>
        </div>
      </Dialog>

      {/* cancel with reason */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null); }}
        title={t('cancel.title')} description={t('cancel.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>{tc('actions.cancel')}</Button>
            <Button variant="destructive" disabled={cancelling || !cancelReason.trim()} onClick={() => void doCancel()}>
              {cancelling ? t('actions.cancelling') : t('actions.cancel')}
            </Button>
          </>
        }>
        <div className="space-y-1.5">
          <Label>{t('cancel.reason')}</Label>
          <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t('cancel.reasonPlaceholder')} />
        </div>
      </Dialog>

      {/* delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title={t('confirm.delete.title')}
        description={deleteTarget ? t('confirm.delete.description', { number: deleteTarget.recordNumber }) : ''}
        confirmLabel={tc('actions.delete')} loading={deleting}
        onConfirm={() => void doDelete()}
      />
    </div>
  );
}
