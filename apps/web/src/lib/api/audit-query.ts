/** Audit review uses GET /audit; CSV export is a distinct, separately gated GET. */
export interface AuditFilters {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  from: string; // datetime-local in the browser's timezone
  to: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  action: '',
  entityType: '',
  entityId: '',
  actorId: '',
  from: '',
  to: '',
};

const FILTER_KEYS = ['action', 'entityType', 'entityId', 'actorId'] as const;
const MAX_EXPORT_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

function asUtc(value: string): string {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw new RangeError('Invalid audit date/time');
  return new Date(time).toISOString();
}

function addFilters(params: URLSearchParams, filters: AuditFilters): void {
  for (const key of FILTER_KEYS) {
    const value = filters[key].trim();
    if (value) params.set(key, value);
  }
}

export function buildAuditBrowsePath(filters: AuditFilters, page: number, pageSize = 25): string {
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 500
  )
    throw new RangeError('Invalid audit page');
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset) || offset > 2147483647) {
    throw new RangeError('Invalid audit page offset');
  }
  const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
  addFilters(params, filters);
  if (filters.from) params.set('from', asUtc(filters.from));
  if (filters.to) params.set('to', asUtc(filters.to));
  if (filters.from && filters.to && new Date(filters.from) > new Date(filters.to)) {
    throw new RangeError('Audit start must not be after end');
  }
  return `/audit?${params.toString()}`;
}

/** A user-triggered, single CSV page. Never silently iterate through an entire audit history. */
export function buildAuditExportPath(
  filters: AuditFilters,
  from: string,
  to: string,
  offset = 0,
  now = Date.now()
): string {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2147483647) {
    throw new RangeError('Invalid audit export offset');
  }
  if (!from || !to) throw new RangeError('Choose an export start and end');
  const start = new Date(asUtc(from)).getTime();
  const end = new Date(asUtc(to)).getTime();
  if (start > end || end - start > MAX_EXPORT_RANGE_MS || end > now) {
    throw new RangeError('Audit export requires a past range of at most 31 days');
  }
  const params = new URLSearchParams({
    from: new Date(start).toISOString(),
    to: new Date(end).toISOString(),
    limit: '500',
    offset: String(offset),
  });
  addFilters(params, filters);
  return `/audit/export?${params.toString()}`;
}
