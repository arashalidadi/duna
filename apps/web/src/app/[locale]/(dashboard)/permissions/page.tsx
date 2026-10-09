'use client';
import { TableScroll } from '@/components/ui/table-scroll';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';

import { useTranslations as useUiTranslations } from 'next-intl';

import { useCallback, useEffect, useState } from 'react';
import type { PermissionListItem, PaginatedResult } from '@shipping/shared';
import { KeyRound } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';

const PAGE_SIZE = 25;

export default function PermissionsPage() {
  const ui = useUiTranslations('legacyUi');
  const [data, setData] = useState<PaginatedResult<PermissionListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [module, setModule] = useState('');
  const [modules, setModules] = useState<string[]>([]);

  const load = useCallback(
    async (p: number, q: string, m: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      if (m) params.set('module', m);
      try {
        const [permData, modData] = await Promise.all([
          api.get<PaginatedResult<PermissionListItem>>(`/permissions?${params.toString()}`),
          api.get<string[]>('/permissions/modules'),
        ]);
        setData(permData);
        setModules(modData);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : ui('failedToLoadPermissions'));
      } finally {
        setLoading(false);
      }
    },
    [ui]
  );

  useEffect(() => {
    load(page, debouncedSearch, module);
  }, [load, page, debouncedSearch, module]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1, search, module);
  }

  return (
    <div className="space-y-4">
      <div>
        <Breadcrumbs items={[{ label: ui('permissions') }]} />
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{ui('permissions')}</h1>
            <p className="text-sm text-muted-foreground">
              {ui('readOnlyCatalogueOfEveryPermissionEnforcedByTheAPI')}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b-0 px-4 pb-2">
          <CardTitle className="text-sm font-semibold">{ui('permissionCatalogue')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSearch} className="mb-4 flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder={ui('searchCode')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label={ui('searchPermissions')}
            />
            <select
              value={module}
              onChange={(e) => {
                setModule(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={ui('filterByModule')}
            >
              <option value="">{ui('allModules')}</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              {ui('search')}
            </Button>
          </form>

          {loading ? (
            <PageLoader label={ui('loadingPermissions')} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => load(page, search, module)} />
          ) : data && data.data.length === 0 ? (
            <EmptyState
              title={ui('noPermissionsFound')}
              description={ui('tryADifferentSearchOrClearTheModuleFilter')}
            />
          ) : (
            <TableScroll className="overflow-x-auto">
              <table className="w-full text-start">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{ui('code')}</th>
                    <th className="px-3 py-2 font-medium">{ui('module')}</th>
                    <th className="px-3 py-2 font-medium">{ui('action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                          <span className="font-mono text-xs text-foreground">{p.code}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[11px]">
                          {p.module}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-[13px] text-muted-foreground">{p.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}

          {data && data.meta.totalPages > 1 && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={data.meta.totalItems}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
