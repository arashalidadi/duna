'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Download, RefreshCw, ScrollText } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import {
  buildAuditBrowsePath,
  buildAuditExportPath,
  EMPTY_AUDIT_FILTERS,
  type AuditFilters,
} from '@/lib/api/audit-query';
import { downloadAuditCsv } from '@/lib/api/audit-download';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateTime } from '@/lib/date';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TableScroll } from '@/components/ui/table-scroll';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoader } from '@/components/ui/loading';

interface AuditEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
}
interface AuditResult {
  items: AuditEntry[];
  total: number;
}
const PAGE_SIZE = 25;

function FilterInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={type === 'datetime-local' ? 'ltr' : undefined}
      />
    </div>
  );
}

export default function AuditPage() {
  const { status, hasPermission } = useAuth();
  const t = useTranslations('auditTrail');
  const nav = useTranslations('nav');
  const locale = useLocale();
  const canRead = status === 'authenticated' && hasPermission('audit:read');
  const canExport = canRead && hasPermission('audit:export');
  const [draft, setDraft] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportOffset, setExportOffset] = useState(0);
  const [exportMore, setExportMore] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const exportGeneration = useRef(0);

  useEffect(() => {
    if (!canRead) return;
    let current = true;
    setLoading(true);
    setLoadError(null);
    let path: string;
    try {
      path = buildAuditBrowsePath(applied, page, PAGE_SIZE);
    } catch {
      setLoadError(t('invalidBrowseRange'));
      setLoading(false);
      return;
    }
    void api
      .get<AuditResult>(path)
      .then((data) => {
        if (current) setResult(data);
      })
      .catch((error: unknown) => {
        if (current)
          setLoadError(
            error instanceof ApiError && error.status === 404
              ? t('browseUnavailable')
              : error instanceof ApiError && error.status === 403
                ? t('noAccess')
                : t('loadFailed')
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [canRead, applied, page, reload, t]);

  function resetExportPage() {
    exportGeneration.current += 1;
    setExportOffset(0);
    setExportMore(false);
    setExportComplete(false);
    setExportError(null);
  }

  function edit(key: keyof AuditFilters, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      buildAuditBrowsePath(draft, 1, PAGE_SIZE);
      setApplied({ ...draft });
      setPage(1);
      resetExportPage();
      setReload((n) => n + 1);
    } catch {
      setLoadError(t('invalidBrowseRange'));
      setLoading(false);
    }
  }

  function clearFilters() {
    setDraft(EMPTY_AUDIT_FILTERS);
    setApplied(EMPTY_AUDIT_FILTERS);
    setPage(1);
    resetExportPage();
    setReload((n) => n + 1);
  }

  async function exportOnePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canExport || exporting) return;
    setExportError(null);
    let path: string;
    try {
      path = buildAuditExportPath(applied, exportFrom, exportTo, exportOffset);
    } catch {
      setExportError(t('invalidExportRange'));
      return;
    }
    setExporting(true);
    const generation = exportGeneration.current;
    try {
      const next = await downloadAuditCsv(
        path,
        `audit-${exportFrom.slice(0, 10)}-${exportTo.slice(0, 10)}-${exportOffset}.csv`
      );
      if (generation === exportGeneration.current) {
        setExportMore(next.hasMore);
        setExportOffset(next.nextOffset ?? 0);
        setExportComplete(!next.hasMore);
      }
    } catch (error) {
      if (generation === exportGeneration.current)
        setExportError(
          error instanceof ApiError && error.status === 404
            ? t('exportUnavailable')
            : error instanceof ApiError && error.status === 403
              ? t('exportDenied')
              : t('exportFailed')
        );
    } finally {
      setExporting(false);
    }
  }

  // A direct URL must not fetch or reveal audit rows to a user without browse authority.
  // The API independently enforces the same policy, including the owner's implicit authority.
  if (status !== 'authenticated') return <PageLoader label={t('loading')} />;
  if (!canRead) return <ErrorState title={nav('auditTrail')} message={t('noAccess')} />;

  return (
    <div className="space-y-5">
      <div>
        <Breadcrumbs items={[{ label: nav('auditTrail') }]} />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <ScrollText className="h-5 w-5" aria-hidden="true" />
              {nav('auditTrail')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
          </div>
          <Badge variant="outline">{t('readOnly')}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={applyFilters} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FilterInput
                id="audit-action"
                label={t('action')}
                value={draft.action}
                onChange={(value) => edit('action', value)}
                placeholder="role:create"
              />
              <FilterInput
                id="audit-type"
                label={t('entityType')}
                value={draft.entityType}
                onChange={(value) => edit('entityType', value)}
                placeholder="Role"
              />
              <FilterInput
                id="audit-id"
                label={t('entityId')}
                value={draft.entityId}
                onChange={(value) => edit('entityId', value)}
              />
              <FilterInput
                id="audit-actor"
                label={t('actorId')}
                value={draft.actorId}
                onChange={(value) => edit('actorId', value)}
              />
              <FilterInput
                id="audit-from"
                label={t('from')}
                type="datetime-local"
                value={draft.from}
                onChange={(value) => edit('from', value)}
              />
              <FilterInput
                id="audit-to"
                label={t('to')}
                type="datetime-local"
                value={draft.to}
                onChange={(value) => edit('to', value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t('timeZoneHint')}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">{t('applyFilters')}</Button>
              <Button type="button" variant="outline" onClick={clearFilters}>
                {t('clearFilters')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setReload((n) => n + 1)}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t('refresh')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('events')}</CardTitle>
            <CardDescription>{t('newestFirst')}</CardDescription>
          </div>
          {result && !loading && !loadError && <Badge variant="neutral">{result.total}</Badge>}
        </CardHeader>
        {loading ? (
          <CardContent>
            <PageLoader label={t('loading')} />
          </CardContent>
        ) : loadError ? (
          <CardContent>
            <ErrorState message={loadError} onRetry={() => setReload((n) => n + 1)} />
          </CardContent>
        ) : !result?.items.length ? (
          <CardContent>
            <EmptyState title={t('empty')} description={t('emptyHint')} />
          </CardContent>
        ) : (
          <>
            <TableScroll>
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-4 py-3 text-start font-medium">{t('when')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('actor')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('action')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('entity')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('details')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-border/60 align-top last:border-0"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-xs" dir="auto">
                        {formatDateTime(entry.timestamp, locale)}
                      </td>
                      <td className="max-w-52 break-all px-4 py-3" dir="auto">
                        {entry.actorEmail}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{entry.action}</Badge>
                      </td>
                      <td className="max-w-52 px-4 py-3" dir="auto">
                        <span className="block font-medium">{entry.entityType}</span>
                        <span className="block break-all text-xs text-muted-foreground">
                          {entry.entityId}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <details className="max-w-xs">
                          <summary className="cursor-pointer text-xs text-primary">
                            {t('showDetails')}
                          </summary>
                          <pre
                            className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-xs"
                            dir="ltr"
                          >
                            {JSON.stringify(
                              {
                                before: entry.beforeData,
                                after: entry.afterData,
                                metadata: entry.metadata,
                              },
                              null,
                              2
                            )}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            {result.total > PAGE_SIZE && (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                totalItems={result.total}
                totalPages={Math.ceil(result.total / PAGE_SIZE)}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>

      {canExport && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('exportTitle')}</CardTitle>
              <CardDescription>{t('exportDescription')}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void exportOnePage(event)} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <FilterInput
                  id="audit-export-from"
                  label={t('exportFrom')}
                  type="datetime-local"
                  value={exportFrom}
                  onChange={(value) => {
                    setExportFrom(value);
                    resetExportPage();
                  }}
                />
                <FilterInput
                  id="audit-export-to"
                  label={t('exportTo')}
                  type="datetime-local"
                  value={exportTo}
                  onChange={(value) => {
                    setExportTo(value);
                    resetExportPage();
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('exportHint')}</p>
              {exportError && (
                <p role="alert" className="text-sm text-destructive">
                  {exportError}
                </p>
              )}
              {exportMore && (
                <p role="status" className="text-sm">
                  {t('moreAvailable')}
                </p>
              )}
              {exportComplete && (
                <p role="status" className="text-sm">
                  {t('exportComplete')}
                </p>
              )}
              <Button type="submit" loading={exporting} disabled={!exportFrom || !exportTo}>
                <Download className="h-4 w-4" aria-hidden="true" />
                {t(exportMore ? 'downloadNextCsv' : 'downloadCsv')}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
