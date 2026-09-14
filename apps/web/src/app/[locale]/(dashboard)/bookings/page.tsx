'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { BookingRequest, BookingStatus, PaginatedResult } from '@shipping/shared';
import { CalendarCheck, CheckCircle2, XCircle, Eye, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateTime } from '@/lib/date';
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

const PAGE_SIZE = 25;

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-card px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring';

const BOOKING_STATUSES: BookingStatus[] = ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'];

const STATUS_META: Record<BookingStatus, { variant: 'neutral' | 'info' | 'success' | 'danger' }> = {
  PENDING: { variant: 'info' },
  ACCEPTED: { variant: 'success' },
  DECLINED: { variant: 'danger' },
  CANCELLED: { variant: 'neutral' },
};

interface CustomerOption {
  id: string;
  name: string;
  code: string;
}

export default function BookingsPage() {
  const tc = useTranslations('common');
  const t = useTranslations('bookings');
  const tb = useTranslations('booking');
  const { hasPermission } = useAuth();
  const locale = useLocale();

  const [data, setData] = useState<PaginatedResult<BookingRequest> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState<'ALL' | BookingStatus>('ALL');
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const [detail, setDetail] = useState<BookingRequest | null>(null);
  const [decision, setDecision] = useState<'ACCEPTED' | 'DECLINED'>('ACCEPTED');
  const [note, setNote] = useState('');
  const [responding, setResponding] = useState(false);
  const [respError, setRespError] = useState<string | null>(null);

  const canRespond = hasPermission('booking:respond');

  const load = useCallback(
    async (p: number, q: string, s: 'ALL' | BookingStatus, custId: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      if (s !== 'ALL') params.set('status', s);
      if (custId) params.set('customerId', custId);
      try {
        const res = await api.get<PaginatedResult<BookingRequest>>(`/bookings?${params.toString()}`);
        setData(res);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : tc('errors.generic'));
      } finally {
        setLoading(false);
      }
    },
    [tc]
  );

  useEffect(() => {
    load(page, search, status, customerId);
  }, [load, page, search, status, customerId]);

  useEffect(() => {
    if (customers.length === 0) {
      api
        .get<PaginatedResult<CustomerOption>>('/customers?pageSize=200')
        .then((res) => setCustomers(res.data ?? []))
        .catch(() => undefined);
    }
  }, [customers.length]);

  function openDetail(row: BookingRequest) {
    setDetail(row);
    setDecision('ACCEPTED');
    setNote('');
    setRespError(null);
  }

  async function respond(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setResponding(true);
    setRespError(null);
    try {
      const res = await api.post<BookingRequest>(`/bookings/${detail.id}/respond`, {
        decision,
        ...(note.trim() ? { responseNote: note.trim() } : {}),
      });
      setDetail(null);
      setPage(1);
      await load(1, search, status, customerId);
      void res;
    } catch (err) {
      setRespError(err instanceof ApiError ? err.message : tc('errors.generic'));
    } finally {
      setResponding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <CalendarCheck className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {error && (
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            load(page, search, status, customerId);
          }}
        />
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    setSearch(searchInput);
                  }
                }}
                placeholder={t('searchPlaceholder')}
                className="h-8 w-52"
              />
            </div>
            <select
              className={SELECT_CLASS}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as 'ALL' | BookingStatus);
                setPage(1);
              }}
            >
              <option value="ALL">{t('allStatuses')}</option>
              {BOOKING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {tb(`status.${s}`)}
                </option>
              ))}
            </select>
            <select
              className={SELECT_CLASS}
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('allCompanies')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {(search || status !== 'ALL' || customerId) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSearchInput('');
                  setStatus('ALL');
                  setCustomerId('');
                  setPage(1);
                }}
              >
                {tc('reset')}
              </Button>
            )}
            {loading && <span className="text-xs text-muted-foreground">{tc('loading')}</span>}
          </div>

          {data && data.data.length === 0 && !loading ? (
            <EmptyState title={t('empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-2.5 text-start font-medium">{t('fields.number')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('fields.company')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('fields.cargo')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('fields.route')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('fields.shipDate')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('fields.status')}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t('fields.response')}</th>
                    <th className="px-4 py-2.5 text-end font-medium">{tc('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.data ?? []).map((b) => {
                    const meta = STATUS_META[b.status] ?? { variant: 'neutral' as const };
                    return (
                      <tr key={b.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-4 py-2.5 font-mono text-xs">{b.bookingNumber}</td>
                        <td className="px-4 py-2.5">{b.customer?.name ?? '—'}</td>
                        <td className="max-w-[220px] truncate px-4 py-2.5" title={b.cargoDescription}>
                          {b.cargoDescription}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {b.originPort?.name ?? '—'}
                          <span className="mx-1">→</span>
                          {b.destinationPort?.name ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                          {b.requestedShipDate ? b.requestedShipDate.slice(0, 10) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={meta.variant}>{tb(`status.${b.status}`)}</Badge>
                        </td>
                        <td className="max-w-[200px] px-4 py-2.5 text-xs">
                          {b.responseNote ? (
                            <div>
                              <div className="truncate" title={b.responseNote}>
                                {b.responseNote}
                              </div>
                              {b.handledAt && (
                                <div className="text-[11px] text-muted-foreground">
                                  {b.handledBy ? `${b.handledBy} · ` : ''}
                                  {formatDateTime(b.handledAt, locale)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-end">
                          <Button size="sm" variant="ghost" onClick={() => openDetail(b)} title={t('detail')}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {data && (
            <Pagination
              page={data.meta.page}
              pageSize={data.meta.pageSize}
              totalItems={data.meta.totalItems}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!detail}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail ? `${t('detailTitle')} ${detail.bookingNumber}` : ''}
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailRow label={t('fields.company')} value={detail.customer?.name ?? '—'} />
              <DetailRow label={t('fields.status')} value={tb(`status.${detail.status}`)} />
              <DetailRow
                label={t('fields.cargo')}
                value={detail.cargoDescription}
                className="col-span-2"
              />
              <DetailRow
                label={t('fields.route')}
                value={`${detail.originPort?.name ?? '—'} → ${detail.destinationPort?.name ?? '—'}`}
                className="col-span-2"
              />
              <DetailRow
                label={t('fields.shipDate')}
                value={detail.requestedShipDate ? detail.requestedShipDate.slice(0, 10) : '—'}
              />
              <DetailRow label={t('fields.created')} value={formatDateTime(detail.createdAt, locale)} />
              <DetailRow
                label={t('fields.containers')}
                value={detail.containers != null ? String(detail.containers) : '—'}
              />
              <DetailRow
                label={t('fields.weightKg')}
                value={detail.weightKg != null ? String(detail.weightKg) : '—'}
              />
              {detail.notes && <DetailRow label={t('fields.notes')} value={detail.notes} className="col-span-2" />}
              {detail.responseNote && (
                <DetailRow
                  label={t('fields.responseNote')}
                  value={`${detail.responseNote}${detail.handledBy ? ` — ${detail.handledBy}` : ''}`}
                  className="col-span-2"
                />
              )}
            </div>

            {detail.status === 'PENDING' && canRespond && (
              <form onSubmit={respond} className="space-y-3 border-t pt-4">
                <Label className="text-sm font-medium">{t('respond.title')}</Label>
                {respError && <p className="text-sm text-destructive">{respError}</p>}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={decision === 'ACCEPTED' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDecision('ACCEPTED')}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t('respond.accept')}
                  </Button>
                  <Button
                    type="button"
                    variant={decision === 'DECLINED' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => setDecision('DECLINED')}
                  >
                    <XCircle className="h-4 w-4" />
                    {t('respond.decline')}
                  </Button>
                </div>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('respond.notePlaceholder')}
                  maxLength={500}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={responding}>
                    {responding ? tc('saving') : t('respond.submit')}
                  </Button>
                </div>
              </form>
            )}
            {detail.status === 'PENDING' && !canRespond && (
              <p className="text-xs text-muted-foreground">{t('respond.noPermission')}</p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

function DetailRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
