import type { PaginatedResult } from '@shipping/shared';
import { api } from './client';

/**
 * The largest `pageSize` the API accepts.
 *
 * This mirrors the server-side limit. `parsePagination()` in
 * `apps/api/src/common/utils/pagination.util.ts` clamps to `MAX_PAGE_SIZE = 100`,
 * and every list DTO additionally *rejects* anything larger with `@Max(100)`.
 * Because the API runs a global `ValidationPipe` with `forbidNonWhitelisted`,
 * a request with `pageSize=101` or more is answered with **HTTP 400** before it
 * ever reaches a controller — it is not clamped.
 *
 * So a client that wants more than one page must ask for pages explicitly; it
 * must never raise `pageSize`. `check-page-size.mjs` enforces this.
 */
export const MAX_PAGE_SIZE = 100;

/**
 * Safety valve for `fetchAllPages`: stop after this many pages even if the
 * server reports more, so a bad `totalPages` cannot spin forever.
 * 50 × 100 = 5,000 rows, far beyond any dropdown this app builds.
 */
export const MAX_FETCH_PAGES = 50;

/**
 * Read every page of a paginated list endpoint and return the combined rows.
 *
 * Needed because the API caps `pageSize` at {@link MAX_PAGE_SIZE}: asking for
 * `?pageSize=200` (or 500) is a **400**, not a bigger page. Screens that need a
 * complete option list — a `<select>` of customers, a port picker — must walk
 * the pages instead, and that is also what makes them correct for datasets
 * larger than one page: a single capped request would silently truncate.
 *
 * Every request stays within the documented limit.
 *
 * @param path     endpoint path, with or without its own query string,
 *                 e.g. `/customers` or `/customers?personKind=LEGAL`
 * @param options  `pageSize` (defaults to, and is capped at, the API maximum)
 *                 and `maxPages` (defaults to {@link MAX_FETCH_PAGES})
 */
export async function fetchAllPages<T>(
  path: string,
  options: { pageSize?: number; maxPages?: number } = {}
): Promise<T[]> {
  const pageSize = Math.min(options.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
  const maxPages = options.maxPages ?? MAX_FETCH_PAGES;
  const separator = path.includes('?') ? '&' : '?';

  const rows: T[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await api.get<PaginatedResult<T>>(
      `${path}${separator}page=${page}&pageSize=${pageSize}`
    );
    rows.push(...(result.data ?? []));
    // The API omits nothing, but stay defensive: a malformed meta must not loop.
    totalPages = Math.max(1, result.meta?.totalPages ?? 1);
    page += 1;
  } while (page <= totalPages && page <= maxPages);

  return rows;
}
