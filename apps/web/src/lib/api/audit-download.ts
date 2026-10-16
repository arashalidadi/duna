'use client';

import { api, ApiError, getAccessToken } from './client';

/** The JSON client cannot read CSV. Never put an access token in a URL or log. */
export async function downloadAuditCsv(
  path: string,
  fileName: string
): Promise<{
  hasMore: boolean;
  nextOffset: number | null;
}> {
  const token = getAccessToken();
  if (!token) throw new ApiError(401, 'Authentication required');

  const response = await fetch(`${api.baseUrl}${path}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = body && typeof body === 'object' && 'error' in body ? body.error : null;
    const message =
      error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : `Audit export failed (${response.status})`;
    throw new ApiError(response.status, message);
  }
  if (!response.headers.get('content-type')?.includes('text/csv')) {
    throw new ApiError(response.status, 'Audit export returned a non-CSV response');
  }
  const more = response.headers.get('x-audit-export-has-more');
  const rawOffset = response.headers.get('x-audit-export-next-offset');
  const nextOffset = rawOffset === null ? null : Number(rawOffset);
  if (
    (more !== 'true' && more !== 'false') ||
    (more === 'true' &&
      (nextOffset === null ||
        !Number.isSafeInteger(nextOffset) ||
        nextOffset < 1 ||
        nextOffset > 2147483647))
  ) {
    throw new ApiError(502, 'Audit export pagination headers unavailable');
  }
  const url = URL.createObjectURL(await response.blob());
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return { hasMore: more === 'true', nextOffset: more === 'true' ? nextOffset : null };
}
