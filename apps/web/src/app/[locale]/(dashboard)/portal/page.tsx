'use client';
import { TableScroll } from '@/components/ui/table-scroll';

import { useLocale as useUiLocale } from 'next-intl';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  BookingRequest,
  BookingStatus,
  PaginatedResult,
  PortalCustomer,
  PortalMe,
  PortalShipment,
  PortalSummary,
  LedgerEntry,
  LedgerSummary,
} from '@shipping/shared';
import {
  Globe,
  Plus,
  Ship,
  FileText,
  ReceiptText,
  Ban,
  CalendarDays,
  Anchor,
  Scale,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateTime, formatDateShort } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog } from '@/components/ui/dialog';
import { PageLoader } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';

const PAGE_SIZE = 20;

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-card px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring';

const BOOKING_STATUSES: BookingStatus[] = ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'];

const BOOKING_STATUS_META: Record<
  BookingStatus,
  { variant: 'neutral' | 'info' | 'success' | 'danger' | 'warning' }
> = {
  PENDING: { variant: 'info' },
  ACCEPTED: { variant: 'success' },
  DECLINED: { variant: 'danger' },
  CANCELLED: { variant: 'neutral' },
};

const MANIFEST_STATUS_META: Record<string, { variant: 'neutral' | 'info' | 'success' | 'danger' }> =
  {
    DRAFT: { variant: 'neutral' },
    SUBMITTED: { variant: 'info' },
    APPROVED: { variant: 'success' },
    CANCELLED: { variant: 'danger' },
  };

const fmtAmount = (n: number, displayLocale: string) =>
  n.toLocaleString(displayLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Tab = 'bookings' | 'shipments' | 'statement';

interface PortOption {
  id: string;
  name: string;
  country: string;
}

export default function PortalPage() {
  const uiLocale = useUiLocale();
  const { hasPermission } = useAuth();
  const tc = useTranslations('common');
  const t = useTranslations('portal');

  const [tab, setTab] = useState<Tab>('bookings');
  const [me, setMe] = useState<PortalMe | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Bookings tab
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [bPage, setBPage] = useState(1);
  const [bTotal, setBTotal] = useState(0);
  const [bLoading, setBLoading] = useState(false);
  const [bStatus, setBStatus] = useState<'ALL' | BookingStatus>('ALL');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Shipments tab
  const [shipments, setShipments] = useState<PortalShipment[]>([]);
  const [sPage, setSPage] = useState(1);
  const [sTotal, setSTotal] = useState(0);
  const [sLoading, setSLoading] = useState(false);

  // Statement tab
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [stLoading, setStLoading] = useState(false);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [fDesc, setFDesc] = useState('');
  const [fOrigin, setFOrigin] = useState('');
  const [fDest, setFDest] = useState('');
  const [fDate, setFDate] = useState('');
  const [fContainers, setFContainers] = useState('');
  const [fWeight, setFWeight] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [ports, setPorts] = useState<PortOption[]>([]);

  const canCreate = hasPermission('booking:create');

  const loadMe = useCallback(async () => {
    try {
      const res = await api.get<PortalMe>('/portal/me');
      setMe(res);
      setLoadError(null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : tc('errors.generic');
      setLoadError(msg);
    } finally {
      setPageLoading(false);
    }
  }, [tc]);

  const loadBookings = useCallback(
    async (page: number, status: 'ALL' | BookingStatus) => {
      setBLoading(true);
      try {
        const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
        if (status !== 'ALL') qs.set('status', status);
        const res = await api.get<PaginatedResult<BookingRequest>>(
          `/portal/bookings?${qs.toString()}`
        );
        setBookings(res.data);
        setBTotal(res.meta.totalItems);
      } catch (e) {
        setLoadError(e instanceof ApiError ? e.message : tc('errors.generic'));
      } finally {
        setBLoading(false);
      }
    },
    [tc]
  );

  const loadShipments = useCallback(
    async (page: number) => {
      setSLoading(true);
      try {
        const res = await api.get<PaginatedResult<PortalShipment>>(
          `/portal/shipments?page=${page}&pageSize=${PAGE_SIZE}`
        );
        setShipments(res.data);
        setSTotal(res.meta.totalItems);
      } catch (e) {
        setLoadError(e instanceof ApiError ? e.message : tc('errors.generic'));
      } finally {
        setSLoading(false);
      }
    },
    [tc]
  );

  const loadStatement = useCallback(async () => {
    setStLoading(true);
    try {
      const res = await api.get<{ entries: LedgerEntry[]; summary: LedgerSummary }>(
        '/portal/statement'
      );
      setEntries(res.entries);
      setSummary(res.summary);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : tc('errors.generic'));
    } finally {
      setStLoading(false);
    }
  }, [tc]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (!me) return;
    if (tab === 'bookings') void loadBookings(bPage, bStatus);
    if (tab === 'shipments') void loadShipments(sPage);
    if (tab === 'statement' && entries.length === 0 && !summary) void loadStatement();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, tab, bPage, bStatus, sPage]);

  async function openCreate() {
    setFDesc('');
    setFOrigin('');
    setFDest('');
    setFDate('');
    setFContainers('');
    setFWeight('');
    setFNotes('');
    setCreateError(null);
    setShowCreate(true);
    if (ports.length === 0) {
      try {
        const res = await api.get<PortOption[]>('/portal/ports');
        setPorts(res ?? []);
      } catch {
        /* port list is optional decoration */
      }
    }
  }

  async function createBooking(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await api.post('/portal/bookings', {
        cargoDescription: fDesc.trim(),
        originPortId: fOrigin || undefined,
        destinationPortId: fDest || undefined,
        requestedShipDate: fDate ? new Date(fDate).toISOString() : undefined,
        containers: fContainers ? Number(fContainers) : undefined,
        weightKg: fWeight ? Number(fWeight) : undefined,
        notes: fNotes.trim() || undefined,
      });
      setShowCreate(false);
      setBPage(1);
      await Promise.all([loadBookings(1, bStatus), loadMe()]);
    } catch (e2) {
      setCreateError(e2 instanceof ApiError ? e2.message : tc('errors.generic'));
    } finally {
      setCreating(false);
    }
  }

  async function cancelBooking(b: BookingRequest) {
    setCancellingId(b.id);
    try {
      await api.post(`/portal/bookings/${b.id}/cancel`);
      await Promise.all([loadBookings(bPage, bStatus), loadMe()]);
    } catch (e2) {
      setLoadError(e2 instanceof ApiError ? e2.message : tc('errors.generic'));
    } finally {
      setCancellingId(null);
    }
  }

  if (pageLoading) return <PageLoader label={tc('loading')} />;

  const customer = me?.customer ?? null;

  const TABS: { key: Tab; label: string; icon: typeof Ship }[] = [
    { key: 'bookings', label: t('tabs.bookings'), icon: FileText },
    { key: 'shipments', label: t('tabs.shipments'), icon: Ship },
    { key: 'statement', label: t('tabs.statement'), icon: ReceiptText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Globe className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          {customer ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {customer.name}
              {customer.code ? ` · ${customer.code}` : ''}
            </p>
          ) : (
            <p className="mt-1 text-sm text-destructive">{t('notLinked')}</p>
          )}
        </div>
        {canCreate && customer && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('newBooking')}
          </Button>
        )}
      </div>

      {loadError && (
        <ErrorState
          message={loadError}
          onRetry={() => {
            setLoadError(null);
            void loadMe();
          }}
        />
      )}

      {me && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<FileText className="h-4 w-4" />}
            label={t('summary.bookingsTotal')}
            value={String(me.summary.bookingsTotal)}
          />
          <SummaryCard
            icon={<CalendarDays className="h-4 w-4" />}
            label={t('summary.pending')}
            value={String(me.summary.bookingsPending)}
            accent={me.summary.bookingsPending > 0}
          />
          <SummaryCard
            icon={<Anchor className="h-4 w-4" />}
            label={t('summary.approvedManifests')}
            value={String(me.summary.approvedManifests)}
          />
          <SummaryCard
            icon={<Scale className="h-4 w-4" />}
            label={t('summary.balanceDue')}
            value={fmtAmount(me.summary.balanceDue, uiLocale)}
            sub={me.summary.currencyCode}
          />
        </div>
      )}

      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'bookings' && (
        <BookingsTab
          bookings={bookings}
          loading={bLoading}
          status={bStatus}
          onStatus={(s) => {
            setBStatus(s);
            setBPage(1);
          }}
          page={bPage}
          totalItems={bTotal}
          pageSize={PAGE_SIZE}
          onPage={setBPage}
          cancellingId={cancellingId}
          onCancel={cancelBooking}
          customer={customer}
        />
      )}

      {tab === 'shipments' && (
        <ShipmentsTab
          shipments={shipments}
          loading={sLoading}
          page={sPage}
          totalItems={sTotal}
          pageSize={PAGE_SIZE}
          onPage={setSPage}
        />
      )}

      {tab === 'statement' && (
        <StatementTab entries={entries} summary={summary} loading={stLoading} />
      )}

      <Dialog
        open={showCreate}
        onOpenChange={setShowCreate}
        title={t('create.title')}
        description={t('create.hint')}
      >
        <form onSubmit={createBooking} className="space-y-4">
          {createError && <p className="text-sm text-destructive">{createError}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="bk-desc">{t('form.cargoDescription')} *</Label>
            <Input
              id="bk-desc"
              value={fDesc}
              onChange={(e) => setFDesc(e.target.value)}
              required
              maxLength={255}
              placeholder={t('form.cargoDescriptionPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bk-origin">{t('form.originPort')}</Label>
              <select
                id="bk-origin"
                className={`w-full ${SELECT_CLASS}`}
                value={fOrigin}
                onChange={(e) => setFOrigin(e.target.value)}
              >
                <option value="">{tc('select')}</option>
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.country})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-dest">{t('form.destinationPort')}</Label>
              <select
                id="bk-dest"
                className={`w-full ${SELECT_CLASS}`}
                value={fDest}
                onChange={(e) => setFDest(e.target.value)}
              >
                <option value="">{tc('select')}</option>
                {ports.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.country})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bk-date">{t('form.requestedShipDate')}</Label>
              <Input
                id="bk-date"
                type="date"
                value={fDate}
                onChange={(e) => setFDate(e.target.value)}
                className={SELECT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-containers">{t('form.containers')}</Label>
              <Input
                id="bk-containers"
                type="number"
                min={0}
                value={fContainers}
                onChange={(e) => setFContainers(e.target.value)}
                placeholder={t('form.containersHint')}
                className={SELECT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bk-weight">{t('form.weightKg')}</Label>
              <Input
                id="bk-weight"
                type="number"
                min={0}
                step="0.001"
                value={fWeight}
                onChange={(e) => setFWeight(e.target.value)}
                className={SELECT_CLASS}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-notes">{t('form.notes')}</Label>
            <textarea
              id="bk-notes"
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t('form.notesPlaceholder')}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={creating || !fDesc.trim()}>
              {creating ? tc('saving') : t('create.submit')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div
          className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wide ${accent ? 'text-warning' : 'text-muted-foreground'}`}
        >
          {icon}
          {label}
        </div>
        <div className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
          {value}
          {sub ? (
            <span className="ms-1.5 text-xs font-normal text-muted-foreground">{sub}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function BookingsTab({
  bookings,
  loading,
  status,
  onStatus,
  page,
  totalItems,
  pageSize,
  onPage,
  cancellingId,
  onCancel,
  customer,
}: {
  bookings: BookingRequest[];
  loading: boolean;
  status: 'ALL' | BookingStatus;
  onStatus: (s: 'ALL' | BookingStatus) => void;
  page: number;
  totalItems: number;
  pageSize: number;
  onPage: (p: number) => void;
  cancellingId: string | null;
  onCancel: (b: BookingRequest) => void;
  customer: PortalCustomer | null;
}) {
  const tc = useTranslations('common');
  const t = useTranslations('portal');
  const locale = useLocale();

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <select
            className={SELECT_CLASS}
            value={status}
            onChange={(e) => onStatus(e.target.value as 'ALL' | BookingStatus)}
          >
            <option value="ALL">{t('list.allStatuses')}</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
          {loading && <span className="text-xs text-muted-foreground">{tc('loading')}</span>}
        </div>

        {bookings.length === 0 && !loading ? (
          <EmptyState
            title={t('list.empty')}
            description={customer ? t('list.emptyHint') : t('notLinked')}
          />
        ) : (
          <TableScroll className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-start text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2.5 text-start font-medium">{t('fields.number')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('fields.status')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('fields.cargo')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('fields.route')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('fields.shipDate')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('fields.containers')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('fields.response')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('fields.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const meta = BOOKING_STATUS_META[b.status];
                  return (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2.5 font-mono text-xs">{b.bookingNumber}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={meta.variant}>{t(`status.${b.status}`)}</Badge>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-2.5" title={b.cargoDescription}>
                        {b.cargoDescription}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {b.originPort?.name ?? '—'}
                        <span className="mx-1">→</span>
                        {b.destinationPort?.name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                        {b.requestedShipDate ? formatDateShort(b.requestedShipDate, locale) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{b.containers ?? '—'}</td>
                      <td className="max-w-[200px] px-4 py-2.5 text-xs">
                        {b.status === 'ACCEPTED' || b.status === 'DECLINED' ? (
                          <div>
                            <span
                              className={
                                b.status === 'ACCEPTED' ? 'text-success' : 'text-destructive'
                              }
                            >
                              {b.responseNote || t(`status.${b.status}`)}
                            </span>
                            {b.handledAt && (
                              <div className="text-[11px] text-muted-foreground">
                                {formatDateTime(b.handledAt, locale)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-end">
                        {b.status === 'PENDING' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={cancellingId === b.id}
                            onClick={() => onCancel(b)}
                            title={t('cancelBooking')}
                          >
                            <Ban className="h-4 w-4 text-destructive" />
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
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={Math.max(1, Math.ceil(totalItems / pageSize))}
          onPageChange={onPage}
        />
      </CardContent>
    </Card>
  );
}

function ShipmentsTab({
  shipments,
  loading,
  page,
  totalItems,
  pageSize,
  onPage,
}: {
  shipments: PortalShipment[];
  loading: boolean;
  page: number;
  totalItems: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const uiLocale = useUiLocale();
  const tc = useTranslations('common');
  const t = useTranslations('portal');

  return (
    <Card>
      <CardContent className="p-0">
        {loading && (
          <div className="border-b px-4 py-3 text-xs text-muted-foreground">{tc('loading')}</div>
        )}
        {shipments.length === 0 && !loading ? (
          <EmptyState title={t('shipments.empty')} />
        ) : (
          <TableScroll className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2.5 text-start font-medium">{t('shipments.manifest')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('shipments.status')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('shipments.vessel')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('shipments.route')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('shipments.etd')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('shipments.eta')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('shipments.weight')}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{t('shipments.units')}</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => {
                  const meta = MANIFEST_STATUS_META[s.status] ?? { variant: 'neutral' as const };
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-xs">{s.manifestNumber}</div>
                        {s.voyageNumber && (
                          <div className="text-[11px] text-muted-foreground">{s.voyageNumber}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={meta.variant}>{t(`manifest.${s.status}`)}</Badge>
                      </td>
                      <td className="px-4 py-2.5">{s.vesselName}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {s.pol?.name ?? '—'}
                        <span className="mx-1">→</span>
                        {s.pod?.name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                        {s.departureDate ? formatDateShort(s.departureDate, uiLocale) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                        {s.arrivalDate ? formatDateShort(s.arrivalDate, uiLocale) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-end tabular-nums">
                        {fmtAmount(s.totalWeight, uiLocale)}
                      </td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{s.totalQuantity}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          totalPages={Math.max(1, Math.ceil(totalItems / pageSize))}
          onPageChange={onPage}
        />
      </CardContent>
    </Card>
  );
}

function StatementTab({
  entries,
  summary,
  loading,
}: {
  entries: LedgerEntry[];
  summary: LedgerSummary | null;
  loading: boolean;
}) {
  const uiLocale = useUiLocale();
  const tc = useTranslations('common');
  const t = useTranslations('portal');

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            label={t('statement.opening')}
            value={fmtAmount(Number(summary.openingBalance), uiLocale)}
            sub={summary.currencyCode}
            icon={<ReceiptText className="h-4 w-4" />}
          />
          <SummaryCard
            label={t('statement.debits')}
            value={fmtAmount(Number(summary.totalDebit), uiLocale)}
            sub={summary.currencyCode}
            icon={<ReceiptText className="h-4 w-4" />}
          />
          <SummaryCard
            label={t('statement.credits')}
            value={fmtAmount(Number(summary.totalCredit), uiLocale)}
            sub={summary.currencyCode}
            icon={<ReceiptText className="h-4 w-4" />}
          />
          <SummaryCard
            label={t('statement.closing')}
            value={fmtAmount(Number(summary.closingBalance), uiLocale)}
            sub={summary.currencyCode}
            accent={Number(summary.closingBalance) > 0}
            icon={<Scale className="h-4 w-4" />}
          />
        </div>
      )}
      <Card>
        <CardContent className="p-0">
          {loading && (
            <div className="border-b px-4 py-3 text-xs text-muted-foreground">{tc('loading')}</div>
          )}
          {entries.length === 0 && !loading ? (
            <EmptyState title={t('statement.empty')} />
          ) : (
            <TableScroll className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-2.5 text-start font-medium">{t('statement.date')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('statement.doc')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">
                      {t('statement.description')}
                    </th>
                    <th className="px-4 py-2.5 text-end font-medium">{t('statement.debit')}</th>
                    <th className="px-4 py-2.5 text-end font-medium">{t('statement.credit')}</th>
                    <th className="px-4 py-2.5 text-end font-medium">{t('statement.balance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, idx) => (
                    <tr
                      key={`${e.date}-${e.description}-${idx}`}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                        {formatDateShort(e.date, uiLocale)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{e.documentNumber ?? '—'}</td>
                      <td className="max-w-[280px] truncate px-4 py-2.5" title={e.description}>
                        {e.description}
                      </td>
                      <td className="px-4 py-2.5 text-end tabular-nums">
                        {e.debit !== '0.00' && e.debit ? e.debit : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-end tabular-nums">
                        {e.credit !== '0.00' && e.credit ? e.credit : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-end font-medium tabular-nums">{e.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
