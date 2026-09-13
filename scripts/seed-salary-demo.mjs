#!/usr/bin/env node
/**
 * Phase 16 demo seed — Employees & Salary records.
 * Idempotent: skips when demo employees already exist.
 *
 * Usage: node scripts/seed-salary-demo.mjs
 */
const API = 'http://127.0.0.1:3101/api/v1';
const ADMIN = { email: 'admin@shipping.local', password: 'ChangeMe123!' };

const json = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
};

const ok = (label, fn) => fn().then((r) => (console.log('  ✓', label), r)).catch((e) => {
  console.error('  ✗', label, '—', e.message);
  process.exitCode = 1;
});

const main = async () => {
  console.log('Phase 16 demo seed');

  const login = await json('/auth/login', { method: 'POST', body: ADMIN });
  const token = login.data.accessToken;
  const auth = { token };

  // ---- idempotency guard --------------------------------------------------
  // raw fetch sees the double-wrapped envelope: {success, data: {data, meta}, meta}
  const existing = await json('/employees?pageSize=1', auth);
  if (existing.data.meta.totalItems > 0) {
    console.log('  = employees already present (' + existing.data.meta.totalItems + ') — skipping');
    return;
  }

  // ---- employees ----------------------------------------------------------
  console.log('  employees:');
  const emp = async (label, body) =>
    ok(label, async () => {
      const r = await json('/employees', { method: 'POST', body, token });
      return r.data;
    });
  const opsManager = await emp('Operations Manager (USD)', {
    name: 'Reza Alavi',
    nationalId: '0012345678',
    position: 'Operations Manager',
    phone: '+98 912 111 0001',
    email: 'reza.alavi@shipping.local',
    hireDate: '2023-04-01',
    baseSalary: '2400',
    currencyCode: 'USD',
  });
  const accountant = await emp('Senior Accountant (IRR)', {
    name: 'Sara Mohammadi',
    nationalId: '0023456789',
    position: 'Senior Accountant',
    phone: '+98 912 111 0002',
    email: 'sara.mohammadi@shipping.local',
    hireDate: '2022-09-15',
    baseSalary: '148000000',
    currencyCode: 'IRR',
  });
  const yardSup = await emp('Yard Supervisor (IRR)', {
    name: 'Amir Hosseini',
    nationalId: '0034567890',
    position: 'Yard Supervisor',
    phone: '+98 912 111 0003',
    hireDate: '2024-01-08',
    baseSalary: '92000000',
    currencyCode: 'IRR',
  });
  await emp('Documentation Clerk (INACTIVE)', {
    name: 'Maryam Karimi',
    nationalId: '0045678901',
    position: 'Documentation Clerk',
    phone: '+98 912 111 0004',
    hireDate: '2023-11-20',
    baseSalary: '78000000',
    currencyCode: 'IRR',
    status: 'INACTIVE',
    notes: 'On extended leave.',
  });

  // ---- payslips -------------------------------------------------------------
  console.log('  payslips:');
  const mk = (employeeId, year, month, extra = {}) =>
    json('/salary-records', { method: 'POST', body: { employeeId, year, month, ...extra }, token }).then((r) => r.data);
  const approve = (id) => json(`/salary-records/${id}/approve`, { method: 'POST', token }).then((r) => r.data);
  const pay = (id, paymentMethod, paymentRef) =>
    json(`/salary-records/${id}/pay`, { method: 'POST', body: { paymentMethod, paymentRef }, token }).then((r) => r.data);
  const cancel = (id, cancelReason) =>
    json(`/salary-records/${id}/cancel`, { method: 'POST', body: { cancelReason }, token }).then((r) => r.data);

  // Aug: ops manager — full cycle to PAID
  await ok(`${opsManager.code} 2026-08 PAID`, async () => {
    const r = await mk(opsManager.id, 2026, 8, { additions: '300', deductions: '120' });
    await approve(r.id);
    await pay(r.id, 'BANK_TRANSFER', 'TRF-OPS-2608');
  });
  // Sep: ops manager — APPROVED
  await ok(`${opsManager.code} 2026-09 APPROVED`, async () => {
    const r = await mk(opsManager.id, 2026, 9, { additions: '150' });
    await approve(r.id);
  });
  // Aug: accountant — PAID with additions/deductions
  await ok(`${accountant.code} 2026-08 PAID`, async () => {
    const r = await mk(accountant.id, 2026, 8, { additions: '12000000', deductions: '9450000' });
    await approve(r.id);
    await pay(r.id, 'CASH', 'RCT-1187');
  });
  // Sep: accountant — DRAFT (in progress)
  await ok(`${accountant.code} 2026-09 DRAFT`, async () => {
    await mk(accountant.id, 2026, 9, { additions: '8000000', deductions: '11250000', notes: 'Pending overtime sheet.' });
  });
  // Aug: yard supervisor — CANCELLED with reason
  await ok(`${yardSup.code} 2026-08 CANCELLED`, async () => {
    const r = await mk(yardSup.id, 2026, 8, { deductions: '5000000', notes: 'Salary advance taken.' });
    await approve(r.id);
    await cancel(r.id, 'Advance re-logged as a separate payable.');
  });
  // Sep: yard supervisor — APPROVED, awaiting pay
  await ok(`${yardSup.code} 2026-09 APPROVED`, async () => {
    const r = await mk(yardSup.id, 2026, 9, { additions: '3500000' });
    await approve(r.id);
  });

  const list = await json('/salary-records?pageSize=50', auth);
  console.log(`\n  payslips: ${list.data.meta.totalItems}`);
  for (const s of list.data.data) {
    console.log(`   ${s.recordNumber}  ${s.employee?.name ?? ''}  ${s.year}-${String(s.month).padStart(2, '0')}  net=${s.net} ${s.currencyCode}  [${s.status}]`);
  }
};

main().catch((e) => {
  console.error('seed failed:', e.message);
  process.exit(1);
});
