'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import type {
  BillStatus,
  PortalBillOfLading,
  PortalBlLabelListResult,
  PortalReadEmptyReason,
  PortalReadListResult,
  PortalReleaseOrder,
} from '@shipping/shared';
import { api, ApiError } from '@/lib/api/client';
import { formatDateShort } from '@/lib/date';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Pagination } from '@/components/ui/pagination';
import { TableScroll } from '@/components/ui/table-scroll';

const PAGE_SIZE = 20;
type DocumentKind = 'bills' | 'releases';

function useDocumentList<T>(path: string) {
  const t = useTranslations('portal.documents');
  const forbidden = t('errors.forbidden');
  const unavailable = t('errors.unavailable');
  const [page, setPage] = useState(1);
  const [retryIndex, setRetryIndex] = useState(0);
  const [result, setResult] = useState<PortalReadListResult<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const version = ++requestVersion.current;
    // Never show an earlier page's rows while a new scoped response is pending.
    setResult(null);
    setError(null);
    setLoading(true);
    void api.get<PortalReadListResult<T>>(`${path}?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((response) => {
        if (active && version === requestVersion.current) setResult(response);
      })
      .catch((cause: unknown) => {
        if (active && version === requestVersion.current) {
          setError(cause instanceof ApiError && cause.status === 403 ? forbidden : unavailable);
        }
      })
      .finally(() => {
        if (active && version === requestVersion.current) setLoading(false);
      });
    return () => { active = false; };
  }, [path, page, retryIndex, forbidden, unavailable]);

  return {
    result, loading, error, page, retryIndex,
    setPage: (nextPage: number) => {
      requestVersion.current += 1;
      setResult(null);
      setError(null);
      setLoading(true);
      setPage(nextPage);
    },
    retry: () => {
      requestVersion.current += 1;
      setResult(null);
      setError(null);
      setLoading(true);
      setRetryIndex((n) => n + 1);
    },
  };
}

type DocumentList<T> = ReturnType<typeof useDocumentList<T>>;

function DocumentEmpty({ reason, kind }: { reason: PortalReadEmptyReason | undefined; kind: DocumentKind }) {
  const t = useTranslations('portal.documents');
  if (reason === 'CUSTOMER_ONLY') {
    return <EmptyState title={t('empty.customerOnly')} description={t('empty.customerOnlyHint')} />;
  }
  if (reason === 'NO_ACTIVE_DESTINATIONS') {
    return <EmptyState title={t('empty.noActiveDestinations')} description={t('empty.noActiveDestinationsHint')} />;
  }
  if (reason === 'PAGE_OUT_OF_RANGE') {
    return <EmptyState title={t('empty.pageOutOfRange')} description={t('empty.pageOutOfRangeHint')} />;
  }
  return <EmptyState title={kind === 'bills' ? t('empty.noBills') : t('empty.noReleases')} />;
}

function DocumentListCard<T>({
  title,
  kind,
  list,
  notice,
  children,
}: {
  title: string;
  kind: DocumentKind;
  list: DocumentList<T>;
  notice?: React.ReactNode;
  children: (rows: T[]) => React.ReactNode;
}) {
  const tc = useTranslations('common');
  const t = useTranslations('portal.documents');
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{title}</h2>
            <Button variant="outline" size="sm" onClick={list.retry} disabled={list.loading}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t('refresh')}
            </Button>
          </div>
          {notice}
        </div>
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.retry} />
        ) : list.loading ? (
          <div className="px-4 py-8 text-sm text-muted-foreground" role="status">{tc('loading')}</div>
        ) : list.result?.data.length ? (
          children(list.result.data)
        ) : (
          <DocumentEmpty reason={list.result?.emptyState?.reason} kind={kind} />
        )}
        {!list.loading && !list.error && list.result && list.result.meta.totalItems > 0 && (
          <Pagination
            page={list.result.meta.page}
            pageSize={list.result.meta.pageSize}
            totalItems={list.result.meta.totalItems}
            totalPages={list.result.meta.totalPages}
            onPageChange={list.setPage}
          />
        )}
      </CardContent>
    </Card>
  );
}

function billStatusVariant(status: BillStatus): BadgeVariant {
  switch (status) {
    case 'DRAFT': return 'neutral';
    case 'FINAL': return 'warning';
    case 'APPROVED':
    case 'RELEASED':
    case 'ISSUED': return 'success';
    case 'CANCELLED': return 'danger';
  }
}

/** Read-only B/Ls; access scope and DRAFT exclusion are enforced by the portal API. */
export function PortalBillsTab() {
  const t = useTranslations('portal.documents');
  const locale = useLocale();
  const list = useDocumentList<PortalBillOfLading>('/portal/bills-of-lading');
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [labelsUnavailable, setLabelsUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    setLabels({});
    setLabelsUnavailable(false);
    void api.get<PortalBlLabelListResult>('/portal/bl-labels')
      .then(({ data }) => {
        if (!active) return;
        const next: Record<string, string> = {};
        for (const { code, label } of data) next[code] = label;
        setLabels(next);
      })
      .catch(() => {
        if (active) setLabelsUnavailable(true);
      });
    return () => { active = false; };
  }, [list.retryIndex]);

  return (
    <DocumentListCard
      title={t('bills.title')}
      kind="bills"
      list={list}
      notice={labelsUnavailable ? (
        <p className="mt-1 text-xs text-muted-foreground">{t('errors.labelsUnavailable')}</p>
      ) : undefined}
    >
      {(bills) => (
        <TableScroll>
          <table className="w-full min-w-[670px] text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2.5 text-start font-medium">{t('bills.number')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('bills.status')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('bills.vessel')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('bills.issueDate')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('bills.activeRelease')}</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2.5 font-mono text-xs"><span dir="ltr">{bill.billNumber}</span></td>
                  <td className="px-4 py-2.5"><Badge variant={billStatusVariant(bill.status)}>{labels[bill.status]?.trim() || bill.status}</Badge></td>
                  <td className="px-4 py-2.5">{bill.vesselName}</td>
                  <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                    {bill.dateOfIssue ? formatDateShort(bill.dateOfIssue, locale) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {bill.activeRelease ? (
                      <div className="space-y-0.5">
                        <span dir="ltr" className="inline-block font-mono text-xs">{bill.activeRelease.docNumber}</span>
                        <div className="text-xs text-muted-foreground">
                          {formatDateShort(bill.activeRelease.releaseDate, locale)}
                        </div>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">{t('bills.noActiveRelease')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </DocumentListCard>
  );
}

/** Shows issued and retained cancelled R/Os; payment state is recorded, not derived. */
export function PortalReleasesTab() {
  const t = useTranslations('portal.documents');
  const ro = useTranslations('releaseOrder');
  const locale = useLocale();
  const list = useDocumentList<PortalReleaseOrder>('/portal/release-orders');

  return (
    <DocumentListCard
      title={t('releases.title')}
      kind="releases"
      list={list}
      notice={<p className="mt-1 text-xs text-muted-foreground">{t('releases.paymentNote')}</p>}
    >
      {(releases) => (
        <TableScroll>
          <table className="w-full min-w-[670px] text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2.5 text-start font-medium">{t('releases.number')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('releases.bill')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('releases.status')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('releases.payment')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('releases.releaseDate')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('releases.cancelledAt')}</th>
              </tr>
            </thead>
            <tbody>
              {releases.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2.5 font-mono text-xs"><span dir="ltr">{order.docNumber}</span></td>
                  <td className="px-4 py-2.5 font-mono text-xs"><span dir="ltr">{order.billOfLading.billNumber}</span></td>
                  <td className="px-4 py-2.5">
                    <Badge variant={order.status === 'ISSUED' ? 'success' : 'neutral'}>
                      {ro(`status.${order.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {order.paymentState ? ro(`paymentState.${order.paymentState}`) : t('releases.notRecorded')}
                  </td>
                  <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground">{formatDateShort(order.releaseDate, locale)}</td>
                  <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                    {order.cancelledAt ? formatDateShort(order.cancelledAt, locale) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </DocumentListCard>
  );
}
