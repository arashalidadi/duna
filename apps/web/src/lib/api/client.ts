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
  // Sent on two channels on purpose. Some hosting proxies drop `Authorization`
  // and a cross-site preview iframe may have no usable cookie storage; the
  // same-origin proxy accepts either channel and forwards one bearer header
  // upstream, so the API contract itself does not change.
  return token ? { Authorization: `Bearer ${token}`, 'X-Access-Token': token } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // FormData bodies (file uploads) must not carry a JSON Content-Type; the browser sets the boundary.
  const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...bearerHeaders(),
        ...(init?.headers ?? {}),
      },
      next: { revalidate: 0 },
      cache: 'no-store',
    });
  } catch {
    // Never display a fetch exception: it may include internal URL details.
    throw new ApiError(0, 'No HTTP response from API');
  }

  const body = (await res.json().catch(() => null)) as ApiResult<T> | null;

  if (!res.ok || !body?.success) {
    const error = body && !body.success ? body.error : undefined;
    // Nest ValidationPipe sends string[] messages. Previously these became
    // "Request failed", hiding validation details and the actual HTTP status.
    const messages = typeof error?.message === 'string' ? [error.message] :
      Array.isArray(error?.message) ? error.message.filter((item): item is string =>
        typeof item === 'string' && item.trim().length > 0).slice(0, 3) : [];
    throw new ApiError(
      res.status, // transport status, even if a malformed body claims something else
      messages.length ? messages.join('; ') : `Request failed (HTTP ${res.status})`,
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
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  getHealth: () => request<HealthStatus>('/health'),
  /** Base URL used by the client — exported for debugging / diagnostics. */
  baseUrl: API_BASE,
};