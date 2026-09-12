// Seeds demo invoices against demo customers (+ optional B/L anchor).
const BASE = 'http://127.0.0.1:3101/api/v1';
let token = '';

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const msg = json?.error?.message ?? `${res.status} ${res.statusText}`;
    throw new Error(`${method} ${path} -> ${Array.isArray(msg) ? msg.join('; ') : msg}`);
  }
  return json.data;
}

const log = (m) => console.log(`  ${m}`);

async function main() {
  const login = await api('POST', '/auth/login', {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  });
  token = login.accessToken;
  log('logged in as admin');

  const existing = await api('GET', '/invoices?pageSize=100');
  if (existing.meta.totalItems > 0) {
    console.log(`invoices already present (${existing.meta.totalItems}) — nothing to do`);
    return;
  }

  const customers = (await api('GET', '/customers?pageSize=50')).data;
  const bills = (await api('GET', '/bills?pageSize=50&sort=billNumber&order=desc')).data;
  const cust = customers[0];
  if (!cust) throw new Error('no customers — run the earlier demo seeds first');
  log(`customer: ${cust.name}`);

  // --- invoice 1: ISSUED, anchored to the demo B/L, tax 5% ---
  const inv1 = await api('POST', '/invoices', {
    customerId: cust.id,
    title: 'Ocean freight & handling',
    description: `To: ${cust.name}`,
    currencyCode: 'USD',
    taxRate: 5,
    discountAmount: 50,
    dueDate: '2026-10-15',
    ...(bills[0] ? { billOfLadingId: bills[0].id } : {}),
  });
  log(`created ${inv1.invoiceNumber}`);
  await api('POST', `/invoices/${inv1.id}/items`, { description: 'Ocean freight', unitPrice: 1850, quantity: 1 });
  await api('POST', `/invoices/${inv1.id}/items`, { description: 'Terminal handling (THC)', unitPrice: 120, quantity: 2 });
  await api('POST', `/invoices/${inv1.id}/items`, { description: 'Documentation fee', unitPrice: 45, quantity: 1 });
  const issued = await api('POST', `/invoices/${inv1.id}/issue`, {});
  log(`  3 lines, issued: total ${issued.totalAmount} ${issued.currencyCode} (tax ${issued.taxAmount}, discount ${issued.discountAmount})`);

  // --- invoice 2: ISSUED, overdue (past due) ---
  const inv2 = await api('POST', '/invoices', {
    customerId: cust.id,
    title: 'Storage & demurrage',
    currencyCode: 'USD',
    taxRate: 0,
    dueDate: '2026-08-01',
  });
  log(`created ${inv2.invoiceNumber}`);
  await api('POST', `/invoices/${inv2.id}/items`, { description: 'Yard storage — 14 days', unitPrice: 21, quantity: 14 });
  const issued2 = await api('POST', `/invoices/${inv2.id}/issue`, {});
  log(`  1 line, issued: total ${issued2.totalAmount} ${issued2.currencyCode} — overdue demo`);

  // --- invoice 3: DRAFT ---
  const inv3 = await api('POST', '/invoices', {
    customerId: cust.id,
    title: 'Customs clearance — pending review',
    currencyCode: 'AED',
    taxRate: 5,
  });
  log(`created ${inv3.invoiceNumber}`);
  await api('POST', `/invoices/${inv3.id}/items`, { description: 'Clearance service', unitPrice: 900, quantity: 1 });
  log('  left in DRAFT');

  const final = await api('GET', '/invoices?pageSize=25');
  console.log('\n=== invoices in DB ===');
  for (const i of final.data) {
    console.log(
      `  ${i.invoiceNumber} | ${i.status.padEnd(9)} | ${i.customer?.name} | ${i._count?.items ?? 0} lines | total ${i.totalAmount} ${i.currencyCode} | due ${i.dueDate ? i.dueDate.slice(0, 10) : '—'}`
    );
  }
  console.log(`\ntotal: ${final.meta.totalItems}`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
