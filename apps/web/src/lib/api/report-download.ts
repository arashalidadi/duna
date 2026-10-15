'use client';

import { api, getAccessToken } from './client';

/** Browser-facing URL stays relative to the web origin; Next proxies /api/v1.
 * The JSON api client cannot parse binary Excel/PDF replies. */
export async function downloadReport(path: string, body: unknown, fileName: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${api.baseUrl}${path}`, {
    method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message = payload && typeof payload === 'object' && 'error' in payload &&
      payload.error && typeof payload.error === 'object' && 'message' in payload.error &&
      typeof payload.error.message === 'string' ? payload.error.message : `Download failed (${response.status})`;
    throw new Error(message);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
