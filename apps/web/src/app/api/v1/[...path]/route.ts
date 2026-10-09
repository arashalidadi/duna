import { NextRequest, NextResponse } from 'next/server';

// Server-only upstream. The browser uses /api/v1, never the sandbox's loopback address.
const API_ORIGIN = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3101';
async function forward(
  request: NextRequest,
  ctx: { params: { path: string[] } }
): Promise<NextResponse> {
  const target = new URL(
    `${API_ORIGIN.replace(/\/$/, '')}/api/v1/${ctx.params.path.map(encodeURIComponent).join('/')}`
  );
  target.search = request.nextUrl.search;
  const headers = new Headers();
  for (const name of ['content-type', 'authorization', 'x-refresh-token', 'accept']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const body =
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.arrayBuffer();
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: body?.byteLength ? body : undefined,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    // Do not forward transport headers after fetch decompression, or expose upstream cookies.
    // Authentication uses the existing bearer/refresh-token response contract, not cookies.
    const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
    for (const name of ['content-type', 'content-disposition', 'retry-after']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new NextResponse(
      upstream.status === 204 || upstream.status === 304 ? null : await upstream.arrayBuffer(),
      { status: upstream.status, headers: responseHeaders }
    );
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
