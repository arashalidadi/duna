// Seeds demo vouchers against the demo invoices/customers.
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

  const existing = await api('GET', '/vouchers?pageSize=1');
  if (existing.meta.totalItems > 0) {
    console.log(`vouchers already present (${existing.meta.totalItems}) — nothing to do`);
    return;
  }

  const customers = (await api('GET', '/customers?pageSize=50')).data;
  const cust = customers[0];
  if (!cust) throw new Error('no customers — run the earlier demo seeds first');
  log(`customer: ${cust.name}`);

  // ISSUED, unpaid invoices (skip the AED one — currency guard)
  const invoices = (await api('GET', '/invoices?status=ISSUED&pageSize=50&unpaid=true')).data;
  const usdInv = invoices.filter((i) => i.currencyCode === 'USD');
  if (usdInv.length === 0) throw new Error('no unpaid USD invoices — run seed-invoice-demo first');

  const inv1 = usdInv[0];
  log(`target invoice: ${inv1.invoiceNumber} — total ${inv1.totalAmount} ${inv1.currencyCode}`);

  // settle most of inv1 in two receipts
  const total = Number(inv1.totalAmount);
  const r1 = await api('POST', '/vouchers', {
    type: 'RECEIPT', customerId: cust.id, invoiceId: inv1.id,
    amount: Math.round(total * 0.6), method: 'BANK_TRANSFER',
    reference: 'TRX-DEMO-1', description: 'First installment (60%)',
  });
  log(`receipt 1: ${r1.voucherNumber} — ${r1.amount} ${r1.currencyCode} (${r1.method})`);

  const r2 = await api('POST', '/vouchers', {
    type: 'RECEIPT', customerId: cust.id, invoiceId: inv1.id,
    amount: Math.round(total * 0.2), method: 'CHEQUE',
    reference: 'CHQ-DEMO-77', description: 'Second installment (20%)',
    voucherDate: new Date(Date.now() - 3 * 86400000).toISOString(),
  });
  log(`receipt 2: ${r2.voucherNumber} — ${r2.amount} ${r2.currencyCode} (cheque, backdated 3d)`);

  // partial refund against inv1
  const pmt = await api('POST', '/vouchers', {
    type: 'PAYMENT', customerId: cust.id, invoiceId: inv1.id,
    amount: 100, method: 'BANK_TRANSFER',
    description: 'Goodwill credit — demurrage dispute',
  });
  log(`payment (refund): ${pmt.voucherNumber} — ${pmt.amount} ${pmt.currencyCode}`);

  // standalone deposit, no invoice
  const dep = await api('POST', '/vouchers', {
    type: 'RECEIPT', customerId: cust.id,
    amount: 250, method: 'CASH',
    description: 'Cash advance — next shipment',
  });
  log(`standalone deposit: ${dep.voucherNumber} — ${dep.amount} ${dep.currencyCode} (no invoice)`);

  const after = await api('GET', `/invoices/${inv1.id}`);
  log(`invoice now: paid ${after.paidAmount} / total ${after.totalAmount} ${after.currencyCode}`);

  const ledger = await api('GET', `/ledger/customers?customerId=${cust.id}&currencyCode=USD`);
  const s = ledger.summary;
  console.log(`\n=== USD statement — ${s.customerName} ===`);
  console.log(`  opening ${s.openingBalance} | debit ${s.totalDebit} | credit ${s.totalCredit} | closing ${s.closingBalance}`);
  for (const e of ledger.entries.slice(-6)) {
    console.log(`  ${e.date.slice(0, 10)} | ${(e.documentNumber + '                    ').slice(0, 16)} | D ${(e.debit + '      ').slice(0, 8)} | C ${(e.credit + '      ').slice(0, 8)} | bal ${e.balance}`);
  }
  console.log(`  (${ledger.entries.length} entries total)`);

  const final = await api('GET', '/vouchers?pageSize=25');
  console.log(`\ntotal vouchers seeded: ${final.meta.totalItems}`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
