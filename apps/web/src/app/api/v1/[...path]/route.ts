import { NextRequest, NextResponse } from 'next/server';

// Server-only upstream. The browser uses /api/v1, never the sandbox's loopback address.
const API_ORIGIN = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3101';

/**
 * Cookie bridge for hosted previews.
 *
 * The application contract is bearer-token based: the browser keeps the access
 * token in memory/localStorage and sends `Authorization: Bearer …`. Some hosting
 * proxies (sandbox preview tunnels, for example) reserve or strip that header,
 * and third-party-iframe storage can be unavailable, so the API would answer
 * every authenticated call with 401 "Authentication required" while login
 * itself — which needs no bearer header — still works.
 *
 * To stay correct in both worlds the proxy mirrors the tokens it already sees in
 * the login/refresh response bodies into httpOnly cookies, and re-attaches them
 * as the bearer header when the browser could not send one. The bearer header
 * always wins, so API clients, tests and normal deployments are unaffected.
 */
const ACCESS_COOKIE = 'duna_at';
const REFRESH_COOKIE = 'duna_rt';
const ACCESS_TTL_SECONDS = Number(process.env.WEB_ACCESS_COOKIE_TTL_SECONDS ?? 900);
const REFRESH_TTL_SECONDS = Number(process.env.WEB_REFRESH_COOKIE_TTL_SECONDS ?? 604800);

function cookieAttributes(request: NextRequest, maxAge: number): string {
  // SameSite=None (required for a cross-site preview iframe) is only valid over
  // HTTPS. Preview tunnels terminate TLS before the request reaches Next, so the
  // request itself looks like plain http; a non-loopback Host is therefore also
  // treated as an HTTPS deployment. Plain localhost development keeps Lax.
  const host = (request.headers.get('host') ?? request.nextUrl.host).split(':')[0];
  const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);
  const secure =
    request.nextUrl.protocol === 'https:' ||
    (request.headers.get('x-forwarded-proto') ?? '').split(',')[0].trim() === 'https' ||
    !loopback;
  return [
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAge}`,
    secure ? 'Secure' : '',
    secure ? 'SameSite=None' : 'SameSite=Lax',
    secure ? 'Partitioned' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function cookieValue(name: string, attributes: string, value = ''): string {
  return `${name}=${value}; ${attributes}`;
}

/**
 * Adds `refreshToken` from the mirrored cookie when the request body does not
 * carry one (silent refresh and logout in a storage-less preview iframe).
 * Returns the original buffer untouched when it is not a JSON object body.
 */
function withRefreshTokenFromBodyOrCookie(
  body: ArrayBuffer,
  cookieRefresh: string
): ArrayBuffer | undefined {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(body)) as { refreshToken?: unknown };
    if (typeof parsed?.refreshToken === 'string' && parsed.refreshToken.length > 0) return undefined;
    parsed.refreshToken = cookieRefresh;
    return new TextEncoder().encode(JSON.stringify(parsed)).buffer as ArrayBuffer;
  } catch {
    return undefined;
  }
}

async function forward(
  request: NextRequest,
  ctx: { params: { path: string[] } }
): Promise<NextResponse> {
  const route = ctx.params.path.join('/');
  const target = new URL(
    `${API_ORIGIN.replace(/\/$/, '')}/api/v1/${ctx.params.path.map(encodeURIComponent).join('/')}`
  );
  target.search = request.nextUrl.search;
  const headers = new Headers();
  for (const name of ['content-type', 'authorization', 'x-refresh-token', 'accept']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Fallbacks only: an explicit bearer header from the client is never replaced.
  // Order matters — Authorization wins, then the dedicated header (for tunnels
  // that strip Authorization), then the mirrored httpOnly cookie.
  if (!headers.has('authorization')) {
    const alternateHeader = request.headers.get('x-access-token');
    const fromCookie = request.cookies.get(ACCESS_COOKIE)?.value;
    const token = alternateHeader || fromCookie;
    if (token) headers.set('authorization', `Bearer ${token}`);
  }

  try {
    let body =
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.arrayBuffer();

    // Silent refresh and logout send the rotating refresh token in the request
    // body. When browser storage is unavailable the mirrored cookie copy is used.
    const cookieRefresh = request.cookies.get(REFRESH_COOKIE)?.value;
    if (request.method === 'POST' && route === 'auth/refresh' && body?.byteLength && cookieRefresh) {
      const patched = withRefreshTokenFromBodyOrCookie(body, cookieRefresh);
      if (patched) {
        body = patched;
        headers.set('content-type', 'application/json');
      }
    }
    if (request.method === 'POST' && route === 'auth/logout') {
      const patched =
        body?.byteLength && cookieRefresh ? withRefreshTokenFromBodyOrCookie(body, cookieRefresh) : undefined;
      if (patched) {
        body = patched;
        headers.set('content-type', 'application/json');
      }
      // Nothing to revoke upstream (no refresh token in the body or the cookie):
      // answer locally so a storage-less client does not get a validation error,
      // and still drop the mirrored cookies.
      if (!cookieRefresh) {
        const cleared = new Headers({ 'Cache-Control': 'no-store' });
        cleared.append('set-cookie', cookieValue(ACCESS_COOKIE, cookieAttributes(request, 0)));
        cleared.append('set-cookie', cookieValue(REFRESH_COOKIE, cookieAttributes(request, 0)));
        return new NextResponse(null, { status: 204, headers: cleared });
      }
    }

    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: body?.byteLength ? body : undefined,
      cache: 'no-store',
      redirect: 'manual',
      // Report reads run in bounded repeatable-read snapshots; PDF/Excel
      // rendering can also exceed the normal JSON timeout. Remain binary-safe.
      signal: AbortSignal.timeout(
        ['reports', 'documents'].includes(ctx.params.path[0]) ? 60_000 : 15_000
      ),
    });
    // Do not forward transport headers after fetch decompression, or expose upstream cookies.
    // Authentication uses the existing bearer/refresh-token response contract, not cookies.
    const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
    for (const name of ['content-type', 'content-disposition', 'retry-after']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    // Audit CSV is deliberately paged. Preserve its bounded next-page contract
    // so the UI never mistakes a 500-row page for the full history.
    if (request.method === 'GET' && route === 'audit/export') {
      for (const name of ['x-audit-export-has-more', 'x-audit-export-next-offset']) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders.set(name, value);
      }
    }

    const payload = await upstream.arrayBuffer();

    // Mirror the issued tokens into httpOnly cookies (see the note above). The
    // response body itself is forwarded unchanged, so the existing client
    // contract — including localStorage-backed sessions — is untouched.
    if (request.method === 'POST' && (route === 'auth/login' || route === 'auth/refresh')) {
      if (upstream.status >= 200 && upstream.status < 300) {
        try {
          const issued = JSON.parse(new TextDecoder().decode(payload)) as {
            data?: { accessToken?: unknown; refreshToken?: unknown };
          };
          const accessToken = issued?.data?.accessToken;
          const refreshToken = issued?.data?.refreshToken;
          if (typeof accessToken === 'string' && accessToken) {
            responseHeaders.append(
              'set-cookie',
              cookieValue(ACCESS_COOKIE, cookieAttributes(request, ACCESS_TTL_SECONDS), accessToken)
            );
          }
          if (typeof refreshToken === 'string' && refreshToken) {
            responseHeaders.append(
              'set-cookie',
              cookieValue(REFRESH_COOKIE, cookieAttributes(request, REFRESH_TTL_SECONDS), refreshToken)
            );
          }
        } catch {
          /* a non-JSON auth response carries no tokens to mirror */
        }
      }
    }
    // Clearing happens whatever the API decided, so a local logout can never
    // leave a usable token cookie behind.
    if (request.method === 'POST' && route === 'auth/logout') {
      responseHeaders.append('set-cookie', cookieValue(ACCESS_COOKIE, cookieAttributes(request, 0)));
      responseHeaders.append('set-cookie', cookieValue(REFRESH_COOKIE, cookieAttributes(request, 0)));
    }

    return new NextResponse(upstream.status === 204 || upstream.status === 304 ? null : payload, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    // A missing preview API must be distinguishable from invalid credentials.
    // No hostnames, credentials, stack traces or environment values are returned.
    return NextResponse.json(
      {
        success: false,
        error: {
          statusCode: 502,
          message: 'API service unavailable',
          code: 'UPSTREAM_UNAVAILABLE',
        },
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
