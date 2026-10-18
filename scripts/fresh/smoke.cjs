'use strict';

const BASE = 'http://127.0.0.1:3000';

async function request(path, options = {}) {
  const response = await fetch(BASE + path, {
    ...options,
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  });
  return response;
}
async function checkReadOnly(fetcher = request) {
  for (const page of ['/', '/fa/login']) {
    const response = await fetcher(page);
    if (
      !response.ok ||
      !(response.headers.get('content-type') || '').includes('text/html') ||
      !(await response.text()).includes('<html')
    ) {
      throw new Error('Web public page is not rendered');
    }
  }
  const response = await fetcher('/api/v1/health');
  const body = response.ok ? await response.json() : null;
  if (
    body?.data?.status !== 'ok' ||
    body?.data?.database?.status !== 'up' ||
    body?.data?.app?.environment !== 'production'
  ) {
    throw new Error('Web-proxied API/database health check failed');
  }
}
async function checkAdmin(email, password, fetcher = request) {
  if (!email || !password) throw new Error('Initial admin not configured for fresh login check');
  const login = await fetcher('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = login.ok ? await login.json() : null;
  const data = body?.data;
  if (
    !login.ok ||
    data?.user?.email !== email ||
    data?.user?.isPrimaryAdmin !== true ||
    !data?.accessToken ||
    !Array.isArray(data?.permissions) ||
    !data.permissions.includes('permission:read')
  ) {
    throw new Error('Fresh primary-admin login via Web proxy failed');
  }
  const headers = { authorization: `Bearer ${data.accessToken}` };
  const me = await fetcher('/api/v1/auth/me', { headers });
  const current = me.ok ? await me.json() : null;
  if (current?.data?.user?.id !== data.user.id || current?.data?.user?.isPrimaryAdmin !== true) {
    throw new Error('Authenticated Web-proxied account read failed');
  }
  const permissions = await fetcher('/api/v1/permissions/all', { headers });
  const list = permissions.ok ? await permissions.json() : null;
  if (!Array.isArray(list?.data) || !list.data.some((row) => row.code === 'audit:read')) {
    throw new Error('Authenticated database-backed permission list failed');
  }
}
module.exports = { BASE, checkReadOnly, checkAdmin };
