import { NextRequest, NextResponse } from 'next/server';

/**
 * Same-origin reverse proxy for the NestJS API.
 *
 * The public deployment is served behind a reverse proxy that fronts only the
 * Next.js app (see /etc/nginx/sites-available/dashboard.3ree.eu.cc), so there is
 * no public route to the API process. This route handler forwards `/api/v1/*`
 * to the API service so the browser never needs a hard-coded origin:
 *
 *   browser (dashboard.3ree.eu.cc) ──▶ nginx ──▶ Next route handler ──▶ API (127.0.0.1:3101)
 *   browser (http://127.0.0.1:3000) ──────────▶ Next route handler ──▶ API (127.0.0.1:3101)
 *
 * Keeping the request same-origin avoids all browser CORS/preflight issues for
 * public (and local) authentication without weakening CORS on the API.
 */
const API_ORIGIN =
  process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3101';
const API_BASE = `${API_ORIGIN}/api/v1`;

async function forward(
  request: NextRequest,
  ctx: { params: { path: string[] } }
): Promise<NextResponse> {
  const path = ctx.params.path;

  const target = new URL(`${API_BASE}/${path.join('/')}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType && !contentType.includes('multipart/form-data')) {
    headers.set('content-type', contentType);
  }
  const authorization = request.headers.get('authorization');
  if (authorization) headers.set('authorization', authorization);
  const refreshToken = request.headers.get('x-refresh-token');
  if (refreshToken) headers.set('x-refresh-token', refreshToken);

  const { method } = request;
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : await request.arrayBuffer().catch(() => new ArrayBuffer(0));

  const upstream = await fetch(target.toString(), {
    method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
    cache: 'no-store',
  });

  const upstreamBody = await upstream.arrayBuffer();

  const response = new NextResponse(Buffer.from(upstreamBody), {
    status: upstream.status,
    headers: upstream.headers,
  });

  return response;
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;