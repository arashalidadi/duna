'use client';
import { TableScroll } from '@/components/ui/table-scroll';

import { useLocale as useUiLocale } from 'next-intl';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import type {
  PaginatedResult,
  ReleaseEligibility,
  ReleaseOrder,
  BillOfLading,
} from '@shipping/shared';
import { Plus, Eye, XCircle, Trash2, ShieldAlert, BadgeCheck, FileCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateShort, formatDateTime } from '@/lib/date';
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

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
}

function fmt(v: string, displayLocale: string): string {
  return Number(v).toLocaleString(displayLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ReleaseOrdersPage() {
  const uiLocale = useUiLocale();
  const t = useTranslations('releaseOrder');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { hasPermission } = useAuth();

  // list
  const [rows, setRows] = useState<ReleaseOrder[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ISSUED' | 'CANCELLED'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await api.get<PaginatedResult<ReleaseOrder>>(
        `/release-orders?${params.toString()}`
      );
      setRows(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // detail
  const [detail, setDetail] = useState<ReleaseOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const d = await api.get<ReleaseOrder>(`/release-orders/${id}`);
      setDetail(d);
    } catch (e: any) {
      setError(errMsg(e));
    } finally {
      setDetailLoading(false);
    }
  };

  // create
  const [createOpen, setCreateOpen] = useState(false);
  const [bills, setBills] = useState<BillOfLading[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [fBill, setFBill] = useState('');
  const [elig, setElig] = useState<ReleaseEligibility | null>(null);
  const [eligLoading, setEligLoading] = useState(false);
  const [fNotes, setFNotes] = useState('');
  const [force, setForce] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const openCreate = async () => {
    setCreateOpen(true);
    setCreateError('');
    setFBill('');
    setElig(null);
    setFNotes('');
    setForce(false);
    setOverrideReason('');
    setBillsLoading(true);
    try {
      const res = await api.get<PaginatedResult<BillOfLading>>(
        '/bills?status=APPROVED&pageSize=100'
      );
      setBills(res.data);
    } catch (e: any) {
      setCreateError(errMsg(e));
    } finally {
      setBillsLoading(false);
    }
  };

  useEffect(() => {
    if (!createOpen || !fBill) {
      setElig(null);
      return;
    }
    let cancelled = false;
    setEligLoading(true);
    api
      .get<ReleaseEligibility>(`/release-orders/eligibility?billOfLadingId=${fBill}`)
      .then((res) => {
        if (!cancelled) setElig(res);
      })
      .catch(() => {
        if (!cancelled) setElig(null);
      })
      .finally(() => {
        if (!cancelled) setEligLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [createOpen, fBill]);

  const submitCreate = async () => {
    if (!fBill) {
      setCreateError(t('create.errors.billRequired'));
      return;
    }
    if (elig && elig.needsOverride && !force) {
      setCreateError(t('create.blockedNeedsForce'));
      return;
    }
    if (force && !overrideReason.trim()) {
      setCreateError(t('create.errors.overrideReasonRequired'));
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await api.post('/release-orders', {
        billOfLadingId: fBill,
        ...(fNotes.trim() ? { notes: fNotes.trim() } : {}),
        ...(force ? { force: true, overrideReason: overrideReason.trim() } : {}),
      });
      setCreateOpen(false);
      setPage(1);
      await load();
    } catch (e: any) {
      setCreateError(errMsg(e));
    } finally {
      setCreating(false);
    }
  };

  // cancel / delete
  const [cancelTarget, setCancelTarget] = useState<ReleaseOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReleaseOrder | null>(null);
  const [deleting, setDeleting] = useState(false);

  const submitCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await api.post(`/release-orders/${cancelTarget.id}/cancel`, { reason: cancelReason.trim() });
      setCancelTarget(null);
      setCancelReason('');
      setDetailOpen(false);
      await load();
    } catch (e: any) {
      setError(errMsg(e));
    } finally {
      setCancelling(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/release-orders/${deleteTarget.id}`);
      setDeleteTarget(null);
      setDetailOpen(false);
      await load();
    } catch (e: any) {
      setError(errMsg(e));
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
            <FileCheck className="size-6 text-primary" />
            {t('page.title')}
          </h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </div>
        {hasPermission('release:create') && (
          <Button onClick={() => void openCreate()}>
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
              <option value="ISSUED">{t('status.ISSUED')}</option>
              <option value="CANCELLED">{t('status.CANCELLED')}</option>
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
                      <th className="p-3 text-start font-medium">{t('fields.docNumber')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.bill')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.releaseDate')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.financial')}</th>
                      <th className="p-3 text-start font-medium">{t('fields.status')}</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="p-3">
                          <button
                            className="font-mono text-primary underline-offset-4 hover:underline"
                            onClick={() => void openDetail(r.id)}
                          >
                            {r.docNumber}
                          </button>
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {r.billOfLading?.billNumber ?? '—'}
                        </td>
                        <td className="p-3">{formatDateShort(r.releaseDate, locale)}</td>
                        <td className="p-3">
                          {r.financialOverride ? (
                            <Badge variant="warning">{t('fields.override')}</Badge>
                          ) : (
                            <Badge variant="outline">{t('fields.settled')}</Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant={r.status === 'ISSUED' ? 'success' : 'danger'}>
                            {t(`status.${r.status}`)}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => void openDetail(r.id)}>
                              <Eye className="size-4" />
                            </Button>
                            {r.status === 'ISSUED' && hasPermission('release:cancel') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-warning"
                                onClick={() => {
                                  setCancelTarget(r);
                                  setCancelReason('');
                                }}
                              >
                                <XCircle className="size-4" />
                              </Button>
                            )}
                            {r.status === 'CANCELLED' && hasPermission('release:delete') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => setDeleteTarget(r)}
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

      {/* create */}
      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t('create.title')}
        description={t('create.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {tc('actions.cancel')}
            </Button>
            <Button onClick={() => void submitCreate()} disabled={creating || billsLoading}>
              {creating ? t('create.creating') : tc('actions.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {createError && <p className="text-sm text-destructive">{createError}</p>}

          <div className="space-y-1.5">
            <Label>{t('fields.bill')}</Label>
            <select
              className={SELECT_CLASS + ' w-full'}
              value={fBill}
              onChange={(e) => setFBill(e.target.value)}
              disabled={billsLoading}
            >
              <option value="">{billsLoading ? tc('list.loading') : t('create.selectBill')}</option>
              {bills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.billNumber}
                </option>
              ))}
            </select>
          </div>

          {eligLoading && (
            <p className="text-xs text-muted-foreground">{t('create.checkingEligibility')}</p>
          )}

          {elig && !eligLoading && (
            <div
              className={`rounded-md border p-3 text-sm ${elig.needsOverride ? 'border-warning/40 bg-warning/10' : 'border-success/40 bg-success/10'}`}
            >
              <div className="mb-1 flex items-center gap-2 font-medium">
                {elig.needsOverride ? (
                  <ShieldAlert className="size-4 text-warning" />
                ) : (
                  <BadgeCheck className="size-4 text-success" />
                )}
                {elig.needsOverride ? t('create.blockedTitle') : t('create.readyTitle')}
              </div>
              <p className="text-muted-foreground">
                {t('create.eligibilityLine', {
                  total: fmt(elig.invoicesTotal, uiLocale),
                  paid: fmt(elig.invoicesPaid, uiLocale),
                  outstanding: fmt(elig.outstanding, uiLocale),
                })}
              </p>
            </div>
          )}

          {elig && elig.needsOverride && (
            <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  className="size-4 rounded border-input"
                />
                {t('create.forceOverride')}
              </label>
              {force && (
                <div className="space-y-1.5">
                  <Label>{t('fields.overrideReason')}</Label>
                  <Input
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder={t('create.overrideReasonPlaceholder')}
                    maxLength={500}
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t('fields.notes')}</Label>
            <Input value={fNotes} onChange={(e) => setFNotes(e.target.value)} />
          </div>
        </div>
      </Dialog>

      {/* detail */}
      <Dialog
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setDetail(null);
        }}
        title={detail ? detail.docNumber : t('detail.headerTitle')}
      >
        {detailLoading || !detail ? (
          <PageLoader />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={detail.status === 'ISSUED' ? 'success' : 'danger'}>
                {t(`status.${detail.status}`)}
              </Badge>
              {detail.financialOverride && <Badge variant="warning">{t('fields.override')}</Badge>}
              <span className="font-mono text-xs text-muted-foreground">
                {detail.billOfLading?.billNumber}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('fields.releaseDate')}</dt>
                <dd>{formatDateTime(detail.releaseDate, locale)}</dd>
              </div>
              {detail.financials && (
                <>
                  <div>
                    <dt className="text-muted-foreground">{t('fields.invoicesTotal')}</dt>
                    <dd>{fmt(detail.financials.invoicesTotal, uiLocale)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t('fields.invoicesPaid')}</dt>
                    <dd>{fmt(detail.financials.invoicesPaid, uiLocale)}</dd>
                  </div>
                </>
              )}
              {detail.overrideReason && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">{t('fields.overrideReason')}</dt>
                  <dd className="text-warning">{detail.overrideReason}</dd>
                </div>
              )}
              {detail.notes && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">{t('fields.notes')}</dt>
                  <dd>{detail.notes}</dd>
                </div>
              )}
              {detail.cancelReason && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">{t('fields.cancelReason')}</dt>
                  <dd className="text-destructive">{detail.cancelReason}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </Dialog>

      {/* cancel */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(o) => {
          if (!o) setCancelTarget(null);
        }}
        title={t('confirm.cancel.title')}
        description={t('confirm.cancel.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              {tc('actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={cancelling || !cancelReason.trim()}
              onClick={() => void submitCancel()}
            >
              {cancelling ? tc('list.loading') : t('actions.cancelOrder')}
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label>{t('confirm.cancel.reason')}</Label>
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t('confirm.cancel.reasonPlaceholder')}
          />
        </div>
      </Dialog>

      {/* delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={t('confirm.delete.title')}
        description={t('confirm.delete.description')}
        confirmLabel={tc('actions.delete')}
        destructive
        loading={deleting}
        onConfirm={() => void submitDelete()}
      />
    </div>
  );
}
