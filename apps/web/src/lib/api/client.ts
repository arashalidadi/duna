import type { ApiResult, HealthStatus } from '@shipping/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

/**
 * In-memory + localStorage backing for the access token, kept separate from the
 * AuthProvider so the api client can attach the bearer header without causing a
 * provider re-render loop.
 */
let accessToken: string | null = null;
try {
  accessToken =
    typeof window !== 'undefined' ? window.localStorage.getItem('shipping_access_token') : null;
} catch {
  accessToken = null;
}

const tokenListeners = new Set<(token: string | null) => void>();

export function setAccessToken(token: string | null): void {
  accessToken = token;
  try {
    if (token) window.localStorage.setItem('shipping_access_token', token);
    else window.localStorage.removeItem('shipping_access_token');
  } catch {
    /* storage unavailable (SSR/privacy mode) — in-memory only */
  }
  tokenListeners.forEach((l) => l(token));
}

/** Subscribe to token changes (used by silent-refresh orchestration). */
export function onAccessTokenChange(listener: (token: string | null) => void): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function bearerHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...bearerHeaders(),
      ...(init?.headers ?? {}),
    },
    next: { revalidate: 0 },
    cache: 'no-store',
  });

  const body = (await res.json().catch(() => null)) as ApiResult<T> | null;

  if (!res.ok || !body?.success) {
    const error = body && !body.success ? body.error : undefined;
    throw new ApiError(
      error?.statusCode ?? res.status,
      typeof error?.message === 'string' ? error.message : 'Request failed',
      error?.details
    );
  }

  return body.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  getHealth: () => request<HealthStatus>('/health'),
  /** Base URL used by the client — exported for debugging / diagnostics. */
  baseUrl: API_BASE,
};