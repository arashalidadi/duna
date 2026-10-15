'use client';

import { api, getAccessToken } from './client';

export type DocumentOutputFormat = 'pdf' | 'print' | 'xlsx';

/** Binary response through the same-origin Next proxy. No token ever goes in a URL. */
export async function downloadDocument(type: string, id: string, format: DocumentOutputFormat,
  filters: { fromDate?: string; toDate?: string; currencyCode?: string; previewVersionId?: string } = {}): Promise<void> {
  // Reserve a tab synchronously for print so popup blockers do not intercept the PDF after fetch.
  const tab = format === 'print' ? window.open('', '_blank') : null;
  if (tab) tab.opener = null;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) qs.set(key, value);
  const token = getAccessToken();
  try {
    const response = await fetch(`${api.baseUrl}/documents/output/${encodeURIComponent(type)}/${encodeURIComponent(id)}/${format}${qs.size ? `?${qs}` : ''}`, {
      cache: 'no-store', headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const result: unknown = await response.json().catch(() => null);
      const error = result && typeof result === 'object' && 'error' in result && result.error &&
        typeof result.error === 'object' && 'message' in result.error && typeof result.error.message === 'string'
        ? result.error.message : `Document output failed (${response.status})`;
      throw new Error(error);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = url;
    } else {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${type}-${id}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`;
      if (format === 'print') { anchor.target = '_blank'; anchor.rel = 'noopener'; }
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
