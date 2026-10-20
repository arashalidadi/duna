import { NextRequest, NextResponse } from 'next/server';

/**
 * Sandbox diagnostics for preview tunnels. Disabled unless WEB_DIAGNOSTICS=1.
 *
 * Reports only *which* credential channels survived the journey to this server —
 * never a token value. A hosted preview can strip `Authorization` and block
 * third-party-iframe cookies, which makes every authenticated view fail with
 * 401 while login still works; this endpoint shows which fallback the proxy can
 * still use.
 */
export function GET(request: NextRequest): NextResponse {
  if (process.env.WEB_DIAGNOSTICS !== '1') {
    return NextResponse.json({ success: false, error: { message: 'Not found' } }, { status: 404 });
  }
  const headers = request.headers;
  const cookieNames = (headers.get('cookie') ?? '')
    .split(';')
    .map((pair) => pair.split('=')[0].trim())
    .filter(Boolean);
  return NextResponse.json(
    {
      success: true,
      data: {
        host: headers.get('host'),
        protocol: request.nextUrl.protocol,
        xForwardedProto: headers.get('x-forwarded-proto'),
        forwarded: headers.get('forwarded'),
        channels: {
          authorizationHeader: Boolean(headers.get('authorization')),
          xAccessTokenHeader: Boolean(headers.get('x-access-token')),
          accessCookie: Boolean(request.cookies.get('duna_at')),
          refreshCookie: Boolean(request.cookies.get('duna_rt')),
        },
        cookieNames,
        upstream: process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3101',
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
