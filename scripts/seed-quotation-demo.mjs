// Seeds demo quotations (Phase 15).
// 1) QUOTATION SENT -> ACCEPTED -> converted into a DRAFT proforma (the chain story)
// 2) QUOTATION SENT, validUntil in the past (expired-but-open, convertible if accepted)
// 3) QUOTATION REJECTED with reason
// 4) QUOTATION DRAFT with editable lines
const BASE = 'http://127.0.0.1:3101/api/v1';
let token = '';

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !(json && json.success)) {
    const err = json && json.error ? json.error.message : res.status + ' ' + res.statusText;
    throw new Error(method + ' ' + path + ' -> ' + (Array.isArray(err) ? err.join('; ') : err));
  }
  return json.data;
}

const log = (m) => console.log('  ' + m);

async function main() {
  const login = await api('POST', '/auth/login', {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  });
  token = login.accessToken;
  log('logged in as admin');

  const existing = await api('GET', '/quotations?pageSize=1');
  if (existing.meta.totalItems > 0) {
    log('already seeded (' + existing.meta.totalItems + ' quotations) — skipping');
    console.log('DONE');
    return;
  }

  const customers = await api('GET', '/customers?pageSize=100');
  const customer = customers.data.find((c) => c.name === 'AL Co 46tyen') ?? customers.data[0];
  log('customer: ' + customer.name);

  // ── 1) quote -> sent -> accepted -> converted to proforma ──
  const q1 = await api('POST', '/quotations', {
    customerId: customer.id,
    title: 'Sea freight quote — MV Hormoz / Voyage 12',
    currencyCode: 'USD',
    taxRate: 5,
    discountAmount: 50,
    validUntil: '2026-10-20',
    notes: 'Door-to-port rate for 2x40ft HQ, incl. THC.',
    items: [
      { description: 'Ocean freight 40ft HQ', quantity: 2, unitPrice: 1200 },
      { description: 'Terminal handling 40ft', quantity: 2, unitPrice: 250 },
    ],
  });
  log('QT created: ' + q1.quotationNumber + ' [' + q1.status + '] total ' + q1.totalAmount + ' ' + q1.currencyCode);

  const q1s = await api('POST', '/quotations/' + q1.id + '/send', {});
  log('sent: ' + q1s.status + ' issued ' + q1s.issueDate.slice(0, 10));

  const q1a = await api('POST', '/quotations/' + q1.id + '/accept', {});
  log('accepted: ' + q1a.status);

  const conv = await api('POST', '/quotations/' + q1.id + '/convert', {});
  log('converted -> proforma ' + conv.proforma.proformaNumber + ' [' + conv.proforma.status + '] total ' + conv.proforma.totalAmount);

  // ── 2) sent but expired validity (open for acceptance by override-free flow) ──
  const q2 = await api('POST', '/quotations', {
    customerId: customer.id,
    title: 'Air freight quote — expired validity',
    currencyCode: 'EUR',
    validUntil: '2026-08-15',
    items: [{ description: 'Air freight 45kg', quantity: 1, unitPrice: 690 }],
  });
  await api('POST', '/quotations/' + q2.id + '/send', {});
  log('QT sent + expired: ' + q2.quotationNumber + ' validUntil ' + q2.validUntil + ' total ' + q2.totalAmount + ' EUR');

  // ── 3) rejected with reason ──
  const q3 = await api('POST', '/quotations', {
    customerId: customer.id,
    title: 'Warehousing quote — rejected',
    currencyCode: 'AED',
    items: [{ description: 'Cold storage per pallet / week', quantity: 12, unitPrice: 24 }],
  });
  await api('POST', '/quotations/' + q3.id + '/send', {});
  const q3r = await api('POST', '/quotations/' + q3.id + '/reject', {
    rejectReason: 'Customer chose a cheaper 3PL (budget gap ~15%).',
  });
  log('QT rejected: ' + q3r.quotationNumber + ' — ' + q3r.rejectReason);

  // ── 4) editable draft ──
  const q4 = await api('POST', '/quotations', {
    customerId: customer.id,
    title: 'Inland trucking quote (draft)',
    currencyCode: 'IRR',
    taxRate: 10,
    items: [{ description: 'Trucking Bandar Abbas -> Tehran', quantity: 3, unitPrice: 45000000 }],
  });
  log('QT draft: ' + q4.quotationNumber + ' total ' + q4.totalAmount + ' IRR');

  const summary = await api('GET', '/quotations?pageSize=10');
  log('final: ' + summary.meta.totalItems + ' quotations in system');
  console.log('DONE');
}

main().catch((e) => {
  console.error('SEED FAILED:', e.message);
  process.exit(1);
});
