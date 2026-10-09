'use client';
import { TableScroll } from '@/components/ui/table-scroll';

import { useTranslations as useUiTranslations } from 'next-intl';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import type {
  BillOfLading,
  CustomerListItem,
  Invoice,
  InvoiceDetail,
  InvoiceItem,
  InvoiceStatus,
  Manifest,
  PaginatedResult,
} from '@shipping/shared';
import { Plus, Eye, CheckCircle2, XCircle, Stamp, Save, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateShort, formatDateTime } from '@/lib/date';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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

const STATUSES: InvoiceStatus[] = ['DRAFT', 'ISSUED', 'CANCELLED'];

function statusVariant(s: InvoiceStatus): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  switch (s) {
    case 'DRAFT':
      return 'neutral';
    case 'ISSUED':
      return 'success';
    default:
      return 'danger';
  }
}

const fmtMoney = (v: string | null | undefined, locale: string) =>
  v == null
    ? '—'
    : Number(v).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface CreateForm {
  customerId: string;
  title: string;
  description: string;
  currencyCode: string;
  taxRate: string;
  discountAmount: string;
  issueDate: string;
  dueDate: string;
  billOfLadingId: string;
  manifestId: string;
  notes: string;
}

const EMPTY_CREATE: CreateForm = {
  customerId: '',
  title: '',
  description: '',
  currencyCode: 'USD',
  taxRate: '',
  discountAmount: '',
  issueDate: '',
  dueDate: '',
  billOfLadingId: '',
  manifestId: '',
  notes: '',
};

interface HeaderDraft {
  customerId: string;
  title: string;
  description: string;
  currencyCode: string;
  taxRate: string;
  discountAmount: string;
  issueDate: string;
  dueDate: string;
  notes: string;
}

interface ItemDraft {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  notes: string;
}

export default function InvoicesPage() {
  const ui = useUiTranslations('legacyUi');
  const t = useTranslations('invoice');
  const tNav = useTranslations('nav');
  const { hasPermission } = useAuth();
  const locale = useLocale();

  const [data, setData] = useState<PaginatedResult<Invoice> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [unpaidFilter, setUnpaidFilter] = useState('');
  const [overdueFilter, setOverdueFilter] = useState('');

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [bills, setBills] = useState<BillOfLading[]>([]);
  const [manifests, setManifests] = useState<Manifest[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [headerDraft, setHeaderDraft] = useState<HeaderDraft | null>(null);
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);

  const [itemDrafts, setItemDrafts] = useState<Record<string, ItemDraft>>({});
  const [savingItems, setSavingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    description: '',
    quantity: '1',
    unitPrice: '',
    notes: '',
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [confirmIssue, setConfirmIssue] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (unpaidFilter) params.set('unpaid', unpaidFilter);
      if (overdueFilter) params.set('overdue', overdueFilter);
      const res = await api.get<PaginatedResult<Invoice>>(`/invoices?${params.toString()}`);
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : ui('failedToLoadInvoices'));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, unpaidFilter, overdueFilter, ui]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadCreateOptions = useCallback(async () => {
    try {
      const [custs, bls, mfs] = await Promise.all([
        api.get<PaginatedResult<CustomerListItem>>('/customers?pageSize=100'),
        api.get<PaginatedResult<BillOfLading>>('/bills?pageSize=100'),
        api.get<PaginatedResult<Manifest>>('/manifests?pageSize=100'),
      ]);
      setCustomers(custs.data);
      setBills(bls.data);
      setManifests(mfs.data);
    } catch {
      /* options best-effort */
    }
  }, []);

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE);
    setCreateError(null);
    setCreateOpen(true);
    void loadCreateOptions();
  };

  const createInvoice = async () => {
    if (!createForm.customerId) {
      setCreateError(t('create.errors.customerRequired'));
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const payload: Record<string, unknown> = { customerId: createForm.customerId };
      if (createForm.title) payload.title = createForm.title;
      if (createForm.description) payload.description = createForm.description;
      if (createForm.currencyCode) payload.currencyCode = createForm.currencyCode;
      if (createForm.taxRate) payload.taxRate = createForm.taxRate;
      if (createForm.discountAmount) payload.discountAmount = createForm.discountAmount;
      if (createForm.issueDate) payload.issueDate = createForm.issueDate;
      if (createForm.dueDate) payload.dueDate = createForm.dueDate;
      if (createForm.billOfLadingId) payload.billOfLadingId = createForm.billOfLadingId;
      if (createForm.manifestId) payload.manifestId = createForm.manifestId;
      if (createForm.notes) payload.notes = createForm.notes;
      const created = await api.post<Invoice>('/invoices', payload);
      setCreateOpen(false);
      setViewingId(created.id);
      await openDetail(created.id);
    } catch (e) {
      setCreateError(e instanceof ApiError ? e.message : ui('failedToCreate'));
    } finally {
      setCreating(false);
    }
  };

  const openDetail = useCallback(
    async (id: string) => {
      setViewingId(id);
      setDetailLoading(true);
      setDetail(null);
      setHeaderError(null);
      setActionError(null);
      setItemsError(null);
      try {
        const d = await api.get<InvoiceDetail>(`/invoices/${id}`);
        setDetail(d);
        setHeaderDraft({
          customerId: d.customerId,
          title: d.title ?? '',
          description: d.description ?? '',
          currencyCode: d.currencyCode,
          taxRate: d.taxRate != null ? String(Number(d.taxRate)) : '',
          discountAmount: d.discountAmount != null ? String(Number(d.discountAmount)) : '',
          issueDate: d.issueDate ? d.issueDate.slice(0, 10) : '',
          dueDate: d.dueDate ? d.dueDate.slice(0, 10) : '',
          notes: d.notes ?? '',
        });
        const drafts: Record<string, ItemDraft> = {};
        for (const it of d.items) {
          drafts[it.id] = {
            id: it.id,
            description: it.description ?? '',
            quantity: String(it.quantity),
            unitPrice: String(Number(it.unitPrice)),
            notes: it.notes ?? '',
          };
        }
        setItemDrafts(drafts);
      } catch (e) {
        setActionError(e instanceof ApiError ? e.message : ui('failedToLoadInvoice'));
      } finally {
        setDetailLoading(false);
      }
    },
    [ui]
  );

  const refreshDetail = useCallback(async () => {
    if (viewingId) await openDetail(viewingId);
  }, [viewingId, openDetail]);

  const saveHeader = async () => {
    if (!viewingId || !headerDraft) return;
    setSavingHeader(true);
    setHeaderError(null);
    try {
      await api.patch<InvoiceDetail>(`/invoices/${viewingId}`, {
        title: headerDraft.title || null,
        description: headerDraft.description || null,
        currencyCode: headerDraft.currencyCode,
        taxRate: headerDraft.taxRate || 0,
        discountAmount: headerDraft.discountAmount || 0,
        issueDate: headerDraft.issueDate || null,
        dueDate: headerDraft.dueDate || null,
        notes: headerDraft.notes || null,
      });
      await refreshDetail();
    } catch (e) {
      setHeaderError(e instanceof ApiError ? e.message : ui('failedToSave'));
    } finally {
      setSavingHeader(false);
    }
  };

  const saveItem = async (itemId: string) => {
    if (!viewingId) return;
    const draft = itemDrafts[itemId];
    if (!draft) return;
    try {
      const d = await api.patch<InvoiceDetail>(`/invoices/${viewingId}/items/${itemId}`, {
        description: draft.description,
        quantity: Number(draft.quantity),
        unitPrice: draft.unitPrice,
        notes: draft.notes || null,
      });
      setDetail(d);
    } catch (e) {
      setItemsError(e instanceof ApiError ? e.message : ui('failedToSaveItem'));
    }
  };

  const addItem = async () => {
    if (!viewingId) return;
    if (!addForm.description.trim() || !addForm.unitPrice) {
      setAddError(t('items.errors.lineRequired'));
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const d = await api.post<InvoiceDetail>(`/invoices/${viewingId}/items`, {
        description: addForm.description.trim(),
        quantity: addForm.quantity ? Number(addForm.quantity) : 1,
        unitPrice: addForm.unitPrice,
        notes: addForm.notes || undefined,
      });
      setDetail(d);
      const drafts = { ...itemDrafts };
      for (const it of d.items) {
        if (!drafts[it.id]) {
          drafts[it.id] = {
            id: it.id,
            description: it.description ?? '',
            quantity: String(it.quantity),
            unitPrice: String(Number(it.unitPrice)),
            notes: it.notes ?? '',
          };
        }
      }
      setItemDrafts(drafts);
      setAddOpen(false);
      setAddForm({ description: '', quantity: '1', unitPrice: '', notes: '' });
    } catch (e) {
      setAddError(e instanceof ApiError ? e.message : ui('failedToAdd'));
    } finally {
      setAdding(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!viewingId) return;
    try {
      const d = await api.del<InvoiceDetail>(`/invoices/${viewingId}/items/${itemId}`);
      setDetail(d);
    } catch (e) {
      setItemsError(e instanceof ApiError ? e.message : ui('failedToRemove'));
    } finally {
      setConfirmRemoveItem(null);
    }
  };

  const issueInvoice = async () => {
    if (!viewingId) return;
    setConfirmIssue(false);
    try {
      const d = await api.post<InvoiceDetail>(`/invoices/${viewingId}/issue`, {});
      setDetail(d);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : ui('failedToIssue'));
    }
  };

  const cancelInvoice = async () => {
    if (!viewingId || !cancelReason.trim()) return;
    setConfirmCancel(false);
    try {
      const d = await api.post<InvoiceDetail>(`/invoices/${viewingId}/cancel`, {
        cancelReason: cancelReason.trim(),
      });
      setDetail(d);
      setCancelReason('');
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : ui('failedToCancel'));
    }
  };

  const deleteInvoice = async () => {
    if (!viewingId) return;
    setConfirmDelete(false);
    try {
      await api.del<InvoiceDetail>(`/invoices/${viewingId}`);
      setViewingId(null);
      setDetail(null);
      await load();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : ui('failedToDelete'));
    }
  };

  const totalPages = data?.meta.totalPages ?? 1;
  const canCreate = hasPermission('invoice:create');
  const canUpdate = hasPermission('invoice:update');
  const canDelete = hasPermission('invoice:delete');
  const canIssue = hasPermission('invoice:issue');
  const canCancel = hasPermission('invoice:cancel');
  const isDraft = detail?.status === 'DRAFT';
  const isIssued = detail?.status === 'ISSUED';
  const paid = detail
    ? Number(detail.paidAmount) >= Number(detail.totalAmount) && Number(detail.totalAmount) > 0
    : false;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: tNav('commercial'), href: '/dashboard' }, { label: tNav('invoices') }]}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('page.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('page.description')}</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="ms-2 h-4 w-4" />
            {t('actions.create')}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <CardTitle>{t('list.title')}</CardTitle>
              <CardDescription>
                {t('list.description', { count: data?.meta.totalItems ?? 0 })}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder={t('list.search')}
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                className="md:w-56"
              />
              <select
                className={SELECT_CLASS}
                value={statusFilter}
                onChange={(e) => {
                  setPage(1);
                  setStatusFilter(e.target.value);
                }}
              >
                <option value="">{t('list.allStatuses')}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
              <select
                className={SELECT_CLASS}
                value={unpaidFilter}
                onChange={(e) => {
                  setPage(1);
                  setUnpaidFilter(e.target.value);
                }}
              >
                <option value="">{t('list.allPayments')}</option>
                <option value="true">{t('list.unpaid')}</option>
              </select>
              <select
                className={SELECT_CLASS}
                value={overdueFilter}
                onChange={(e) => {
                  setPage(1);
                  setOverdueFilter(e.target.value);
                }}
              >
                <option value="">{t('list.allDue')}</option>
                <option value="true">{t('list.overdue')}</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : !data || data.data.length === 0 ? (
            <EmptyState title={t('list.empty.title')} description={t('list.empty.description')} />
          ) : (
            <TableScroll className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-start">{t('fields.invoiceNumber')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.status')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.customer')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.title')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.bill')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.manifest')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.totalAmount')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.paidAmount')}</th>
                    <th className="px-3 py-2 text-start">{t('fields.dueDate')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((inv) => {
                    const invUnpaid =
                      inv.status === 'ISSUED' && Number(inv.paidAmount) < Number(inv.totalAmount);
                    return (
                      <tr
                        key={inv.id}
                        className="border-b transition-colors hover:bg-muted/40 cursor-pointer"
                        onClick={() => void openDetail(inv.id)}
                      >
                        <td className="px-3 py-2 font-mono text-xs">{inv.invoiceNumber}</td>
                        <td className="px-3 py-2">
                          <Badge variant={statusVariant(inv.status)}>
                            {t(`status.${inv.status}`)}
                          </Badge>
                          {invUnpaid && <span className="ms-1 text-xs text-warning">●</span>}
                        </td>
                        <td className="px-3 py-2">{inv.customer?.name ?? '—'}</td>
                        <td className="px-3 py-2">{inv.title ?? '—'}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {inv.billOfLading?.billNumber ?? '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {inv.manifest?.manifestNumber ?? '—'}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {fmtMoney(inv.totalAmount, locale)} {inv.currencyCode}
                        </td>
                        <td className="px-3 py-2">{fmtMoney(inv.paidAmount, locale)}</td>
                        <td className="px-3 py-2 text-xs">
                          {inv.dueDate ? formatDateShort(inv.dueDate, locale) : '—'}
                        </td>
                        <td className="px-3 py-2 text-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              void openDetail(inv.id);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          )}
          {data && totalPages > 1 && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={data.meta.totalItems}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t('create.title')}
        description={t('create.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('actions.close')}
            </Button>
            <Button onClick={() => void createInvoice()} disabled={creating}>
              {creating ? t('create.creating') : t('actions.create')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>{t('fields.customer')}</Label>
            <select
              className={SELECT_CLASS}
              value={createForm.customerId}
              onChange={(e) => setCreateForm({ ...createForm, customerId: e.target.value })}
            >
              <option value="">{t('create.selectCustomer')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('fields.title')}</Label>
              <Input
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('fields.currencyCode')}</Label>
              <Input
                maxLength={3}
                placeholder="USD"
                value={createForm.currencyCode}
                onChange={(e) =>
                  setCreateForm({ ...createForm, currencyCode: e.target.value.toUpperCase() })
                }
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('fields.description')}</Label>
            <Input
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('fields.taxRate')}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={createForm.taxRate}
                onChange={(e) => setCreateForm({ ...createForm, taxRate: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('fields.discountAmount')}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={createForm.discountAmount}
                onChange={(e) => setCreateForm({ ...createForm, discountAmount: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('fields.issueDate')}</Label>
              <Input
                type="date"
                value={createForm.issueDate}
                onChange={(e) => setCreateForm({ ...createForm, issueDate: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('fields.dueDate')}</Label>
              <Input
                type="date"
                value={createForm.dueDate}
                onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('fields.bill')}</Label>
              <select
                className={SELECT_CLASS}
                value={createForm.billOfLadingId}
                onChange={(e) => setCreateForm({ ...createForm, billOfLadingId: e.target.value })}
              >
                <option value="">{t('create.noAnchor')}</option>
                {bills.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.billNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('fields.manifest')}</Label>
              <select
                className={SELECT_CLASS}
                value={createForm.manifestId}
                onChange={(e) => setCreateForm({ ...createForm, manifestId: e.target.value })}
              >
                <option value="">{t('create.noAnchor')}</option>
                {manifests.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.manifestNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('fields.notes')}</Label>
            <Input
              value={createForm.notes}
              onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            />
          </div>
          {createError && <p className="text-sm text-destructive">{createError}</p>}
        </div>
      </Dialog>

      {/* Detail dialog */}
      <Dialog
        open={!!viewingId}
        onOpenChange={(o) => {
          if (!o) {
            setViewingId(null);
            setDetail(null);
            void load();
          }
        }}
        title={detail ? `${detail.invoiceNumber}` : t('detail.loading')}
        description={
          detail
            ? `${t(`status.${detail.status}`)} — ${detail.customer?.name ?? ''} (${fmtMoney(detail.totalAmount, locale)} ${detail.currencyCode})`
            : undefined
        }
      >
        {detailLoading || !detail ? (
          <PageLoader />
        ) : (
          <div className="space-y-6">
            {actionError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionError}
              </p>
            )}

            {/* Header */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('detail.headerTitle')}</h3>
                {isDraft && canUpdate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void saveHeader()}
                    disabled={savingHeader}
                  >
                    <Save className="ms-1 h-3.5 w-3.5" />
                    {savingHeader ? t('detail.saving') : t('actions.save')}
                  </Button>
                )}
              </div>
              {headerDraft && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.title')}</Label>
                    <Input
                      disabled={!isDraft}
                      value={headerDraft.title}
                      onChange={(e) => setHeaderDraft({ ...headerDraft, title: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.currencyCode')}</Label>
                    <Input
                      maxLength={3}
                      disabled={!isDraft}
                      value={headerDraft.currencyCode}
                      onChange={(e) =>
                        setHeaderDraft({
                          ...headerDraft,
                          currencyCode: e.target.value.toUpperCase(),
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.taxRate')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      disabled={!isDraft}
                      value={headerDraft.taxRate}
                      onChange={(e) => setHeaderDraft({ ...headerDraft, taxRate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.discountAmount')}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={!isDraft}
                      value={headerDraft.discountAmount}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, discountAmount: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.issueDate')}</Label>
                    <Input
                      type="date"
                      disabled={!isDraft}
                      value={headerDraft.issueDate}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, issueDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">{t('fields.dueDate')}</Label>
                    <Input
                      type="date"
                      disabled={!isDraft}
                      value={headerDraft.dueDate}
                      onChange={(e) => setHeaderDraft({ ...headerDraft, dueDate: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    <Label className="text-xs">{t('fields.description')}</Label>
                    <Input
                      disabled={!isDraft}
                      value={headerDraft.description}
                      onChange={(e) =>
                        setHeaderDraft({ ...headerDraft, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-3 grid gap-1.5">
                    <Label className="text-xs">{t('fields.notes')}</Label>
                    <Input
                      disabled={!isDraft}
                      value={headerDraft.notes}
                      onChange={(e) => setHeaderDraft({ ...headerDraft, notes: e.target.value })}
                    />
                  </div>
                </div>
              )}
              {headerError && <p className="text-sm text-destructive">{headerError}</p>}

              {/* Money summary */}
              <div className="grid grid-cols-3 gap-3 rounded-md border p-3 text-center md:grid-cols-5">
                <div>
                  <p className="text-xs text-muted-foreground">{t('fields.subtotal')}</p>
                  <p className="text-base font-semibold">{fmtMoney(detail.subtotal, locale)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('fields.discountAmount')}</p>
                  <p className="text-base font-semibold">
                    {fmtMoney(detail.discountAmount, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('fields.taxAmount')}</p>
                  <p className="text-base font-semibold">{fmtMoney(detail.taxAmount, locale)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('fields.totalAmount')}</p>
                  <p className="text-lg font-semibold">{fmtMoney(detail.totalAmount, locale)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('fields.paidAmount')}</p>
                  <p className="text-base font-semibold">{fmtMoney(detail.paidAmount, locale)}</p>
                </div>
              </div>
              {isIssued && (
                <div className="flex items-center justify-end">
                  {paid ? (
                    <Badge variant="success">
                      <CheckCircle2 className="ms-1 h-3.5 w-3.5" />
                      {t('detail.paid')}
                    </Badge>
                  ) : (
                    <Badge variant="warning">{t('detail.unpaid')}</Badge>
                  )}
                </div>
              )}
            </section>

            {/* Items */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('items.title')}</h3>
                {isDraft && canUpdate && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void saveItemsAll()}
                      disabled={savingItems}
                    >
                      <Save className="ms-1 h-3.5 w-3.5" />
                      {t('items.saveAll')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setAddForm({ description: '', quantity: '1', unitPrice: '', notes: '' });
                        setAddError(null);
                        setAddOpen(true);
                      }}
                    >
                      <Plus className="ms-1 h-3.5 w-3.5" />
                      {t('items.add')}
                    </Button>
                  </div>
                )}
              </div>
              {itemsError && <p className="text-sm text-destructive">{itemsError}</p>}
              {detail.items.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  {t('items.empty')}
                </p>
              ) : (
                <TableScroll className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-2 text-start">#</th>
                        <th className="px-2 py-2 text-start">{t('items.description')}</th>
                        <th className="px-2 py-2 text-start">{t('items.quantity')}</th>
                        <th className="px-2 py-2 text-start">{t('items.unitPrice')}</th>
                        <th className="px-2 py-2 text-start">{t('items.amount')}</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((it: InvoiceItem) => {
                        const draft = itemDrafts[it.id];
                        return (
                          <tr key={it.id} className="border-b last:border-0">
                            <td className="px-2 py-1.5 text-xs text-muted-foreground">
                              {it.sequence}
                            </td>
                            <td className="px-2 py-1.5">
                              {isDraft && draft ? (
                                <Input
                                  className="h-8"
                                  value={draft.description}
                                  onChange={(e) =>
                                    setItemDrafts({
                                      ...itemDrafts,
                                      [it.id]: { ...draft, description: e.target.value },
                                    })
                                  }
                                />
                              ) : (
                                (it.description ?? '—')
                              )}
                            </td>
                            <td className="px-2 py-1.5 w-20">
                              {isDraft && draft ? (
                                <Input
                                  className="h-8"
                                  type="number"
                                  min={1}
                                  value={draft.quantity}
                                  onChange={(e) =>
                                    setItemDrafts({
                                      ...itemDrafts,
                                      [it.id]: { ...draft, quantity: e.target.value },
                                    })
                                  }
                                />
                              ) : (
                                it.quantity
                              )}
                            </td>
                            <td className="px-2 py-1.5 w-28">
                              {isDraft && draft ? (
                                <Input
                                  className="h-8"
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={draft.unitPrice}
                                  onChange={(e) =>
                                    setItemDrafts({
                                      ...itemDrafts,
                                      [it.id]: { ...draft, unitPrice: e.target.value },
                                    })
                                  }
                                />
                              ) : (
                                fmtMoney(it.unitPrice, locale)
                              )}
                            </td>
                            <td className="px-2 py-1.5 font-medium">
                              {fmtMoney(it.amount, locale)}
                            </td>
                            <td className="px-2 py-1.5 text-end">
                              {isDraft && canUpdate && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setConfirmRemoveItem(it.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableScroll>
              )}
            </section>

            {/* Lifecycle */}
            <section className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
              {isDraft && canDelete && (
                <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="ms-1 h-4 w-4" />
                  {t('actions.delete')}
                </Button>
              )}
              {isDraft && canIssue && (
                <Button onClick={() => setConfirmIssue(true)}>
                  <Stamp className="ms-1 h-4 w-4" />
                  {t('actions.issue')}
                </Button>
              )}
              {(isDraft || isIssued) && canCancel && (
                <Button variant="destructive" onClick={() => setConfirmCancel(true)}>
                  <XCircle className="ms-1 h-4 w-4" />
                  {t('actions.cancel')}
                </Button>
              )}
              {isIssued && (
                <p className="text-xs text-muted-foreground">
                  {t('detail.issuedOn', {
                    date: detail.issueDate
                      ? formatDateShort(detail.issueDate, locale)
                      : formatDateTime(detail.issuedAt ?? detail.createdAt, locale),
                  })}
                </p>
              )}
            </section>
          </div>
        )}
      </Dialog>

      {/* Add item dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title={t('items.addTitle')}
        description={t('items.addDescription')}
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {t('actions.close')}
            </Button>
            <Button onClick={() => void addItem()} disabled={adding}>
              {adding ? t('items.adding') : t('items.add')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>{t('items.description')}</Label>
            <Input
              value={addForm.description}
              onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('items.quantity')}</Label>
              <Input
                type="number"
                min={1}
                value={addForm.quantity}
                onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('items.unitPrice')}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={addForm.unitPrice}
                onChange={(e) => setAddForm({ ...addForm, unitPrice: e.target.value })}
              />
            </div>
          </div>
          {addError && <p className="text-sm text-destructive">{addError}</p>}
        </div>
      </Dialog>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmIssue}
        onOpenChange={setConfirmIssue}
        title={t('confirm.issue.title')}
        description={t('confirm.issue.description')}
        confirmLabel={t('actions.issue')}
        onConfirm={() => void issueInvoice()}
      />
      <Dialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t('confirm.cancel.title')}
        description={t('confirm.cancel.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              {t('actions.close')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void cancelInvoice()}
              disabled={!cancelReason.trim()}
            >
              {t('actions.cancel')}
            </Button>
          </>
        }
      >
        <div className="grid gap-1.5">
          <Label>{t('confirm.cancel.reason')}</Label>
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t('confirm.cancel.reasonPlaceholder')}
          />
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('confirm.delete.title')}
        description={t('confirm.delete.description')}
        confirmLabel={t('actions.delete')}
        destructive
        onConfirm={() => void deleteInvoice()}
      />
      <ConfirmDialog
        open={!!confirmRemoveItem}
        onOpenChange={(o) => !o && setConfirmRemoveItem(null)}
        title={t('confirm.removeItem.title')}
        description={t('confirm.removeItem.description')}
        confirmLabel={t('items.remove')}
        destructive
        onConfirm={() => confirmRemoveItem && void removeItem(confirmRemoveItem)}
      />
    </div>
  );

  async function saveItemsAll() {
    if (!viewingId) return;
    setSavingItems(true);
    setItemsError(null);
    try {
      await Promise.all(
        Object.values(itemDrafts).map((draft) =>
          api.patch(`/invoices/${viewingId}/items/${draft.id}`, {
            description: draft.description,
            quantity: Number(draft.quantity),
            unitPrice: draft.unitPrice,
            notes: draft.notes || null,
          })
        )
      );
      await refreshDetail();
    } catch (e) {
      setItemsError(e instanceof ApiError ? e.message : ui('failedToSaveItems'));
    } finally {
      setSavingItems(false);
    }
  }
}
