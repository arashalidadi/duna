// Smoke-check the same path the browser uses: web :3000 proxy -> api :3101.
const BASE = 'http://127.0.0.1:3000/api/v1';
const r = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json();
  if (!res.ok || !j?.success) throw new Error(`${method} ${path} -> ${res.status}`);
  return j.data;
};
const login = await r('POST', '/auth/login', { email: 'admin@shipping.local', password: 'ChangeMe123!' });
const list = await r('GET', '/manifests?pageSize=10', undefined, login.accessToken);
console.log('via web proxy:', list.data.length, 'manifests');
for (const m of list.data) console.log(' ', m.manifestNumber, '|', m.status, '| items:', m._count?.items ?? '?');

