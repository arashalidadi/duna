// Seeds demo proforma invoices (Phase 14).
// 1) PRF ISSUED + converted into a real DRAFT invoice (the conversion story)
// 2) PRF ISSUED, unconverted (pending client decision)
// 3) PRF DRAFT with editable lines
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

  const existing = await api('GET', '/proformas?pageSize=1');
  if (existing.meta.totalItems > 0) {
    log(`already seeded (${existing.meta.totalItems} proformas) — skipping`);
    console.log('DONE');
    return;
  }

  const customers = await api('GET', '/customers?pageSize=100');
  const customer = customers.data.find((c) => c.name === 'AL Co 46tyen') ?? customers.data[0];
  log(`customer: ${customer.name}`);

  // ── 1) quote → issued → converted to invoice ──
  const p1 = await api('POST', '/proformas', {
    customerId: customer.id,
    title: 'Freight & handling quote — MV Hormoz / Voyage 12',
    currencyCode: 'USD',
    taxRate: 5,
    discountAmount: 50,
    validUntil: '2026-10-15',
    notes: 'Quote covers THC + drayage for 2x40ft.',
    items: [
      { description: 'Terminal handling 40ft', quantity: 2, unitPrice: 250 },
      { description: 'Drayage to dry port', quantity: 1, unitPrice: 380 },
    ],
  });
  log(`PRF created: ${p1.proformaNumber} [${p1.status}] total ${p1.totalAmount} ${p1.currencyCode}`);

  const p1Issued = await api('POST', `/proformas/${p1.id}/issue`, {});
  log(`issued: ${p1Issued.status}`);

  const conv = await api('POST', `/proformas/${p1.id}/convert`, {});
  log(`converted -> invoice ${conv.invoice.invoiceNumber} [${conv.invoice.status}] total ${conv.invoice.totalAmount}`);

  // ── 2) issued, unconverted (awaiting client) ──
  const p2 = await api('POST', '/proformas', {
    customerId: customer.id,
    title: 'Customs clearance quote — pending approval',
    currencyCode: 'USD',
    taxRate: 0,
    items: [
      { description: 'Customs clearance 20ft', quantity: 1, unitPrice: 420 },
      { description: 'Documentation fee', quantity: 1, unitPrice: 95 },
    ],
  });
  await api('POST', `/proformas/${p2.id}/issue`, {});
  log(`PRF created + issued (unconverted): ${p2.proformaNumber} total ${p2.totalAmount}`);

  // ── 3) draft with editable lines ──
  const p3 = await api('POST', '/proformas', {
    customerId: customer.id,
    title: 'Warehouse storage quote (draft)',
    currencyCode: 'AED',
    items: [{ description: 'Storage per pallet / week', quantity: 30, unitPrice: 18 }],
  });
  log(`PRF draft: ${p3.proformaNumber} total ${p3.totalAmount} AED`);

  const summary = await api('GET', '/proformas?pageSize=10');
  log(`final: ${summary.meta.totalItems} proformas in system`);
  console.log('DONE');
}

main().catch((e) => {
  console.error('SEED FAILED:', e.message);
  process.exit(1);
});
