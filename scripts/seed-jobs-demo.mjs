#!/usr/bin/env node
/**
 * Phase 18 demo seed — Jobs & job costing.
 * Idempotent: skips when jobs already exist.
 *
 * Usage: node scripts/seed-jobs-demo.mjs
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
  console.log('Phase 18 demo seed — jobs & costing');

  const login = await json('/auth/login', { method: 'POST', body: ADMIN });
  const token = login.data.accessToken;
  const auth = { token };

  // ---- idempotency guard (raw list envelope is double-wrapped) -----------
  const existing = await json('/jobs?pageSize=1', auth);
  if (existing.data.meta.totalItems > 0) {
    console.log('  = jobs already present (' + existing.data.meta.totalItems + ') — skipping');
    return;
  }

  // optional links — reuse first seeded customer / voyage if any
  let customerId;
  try {
    const custs = await json('/customers?pageSize=1', auth);
    customerId = custs.data.data[0]?.id;
  } catch { /* optional */ }
  let voyageId;
  try {
    const voy = await json('/voyages?pageSize=1', auth);
    voyageId = voy.data.data[0]?.id;
  } catch { /* optional */ }

  const create = (body) => json('/jobs', { method: 'POST', body, token }).then((r) => r.data);
  const start = (id) => json(`/jobs/${id}/start`, { method: 'POST', token }).then((r) => r.data);
  const complete = (id) => json(`/jobs/${id}/complete`, { method: 'POST', token }).then((r) => r.data);
  const cancel = (id, cancelReason) => json(`/jobs/${id}/cancel`, { method: 'POST', body: { cancelReason }, token }).then((r) => r.data);
  const addItem = (id, body) => json(`/jobs/${id}/items`, { method: 'POST', body, token }).then((r) => r.data);

  // 1) DRAFT job with mixed lines — editable demo
  await ok('IMPORT_CLEARANCE (DRAFT)', () =>
    create({
      title: 'Import clearance — 3 x 40HC, machine parts',
      jobType: 'IMPORT_CLEARANCE',
      customerId,
      currencyCode: 'USD',
      description: 'Customs clearance and delivery of three 40ft high-cube containers of industrial machine parts.',
      items: [
        { kind: 'INCOME', category: 'clearance fee', description: 'Clearance service fee (customer)', amount: '980.00', itemDate: '2026-09-01' },
        { kind: 'COST', category: 'customs duty', description: 'Duty payment on behalf of customer', amount: '4120.00', itemDate: '2026-09-02' },
        { kind: 'COST', category: 'THC', description: 'Terminal handling — 3 x 40HC', amount: '735.00', itemDate: '2026-09-02' },
      ],
      notes: 'Awaiting original B/L surrender before final delivery order.',
    }));

  // 2) OPEN job — started, extra cost line appended post-open
  await ok('EXPORT (OPEN)', async () => {
    const j = await create({
      title: 'Export booking — dried fruits, 2 x 20GP to Bandar',
      jobType: 'EXPORT',
      customerId,
      voyageId,
      currencyCode: 'USD',
      items: [
        { kind: 'INCOME', category: 'service fee', description: 'Export documentation & booking fee', amount: '540.00', itemDate: '2026-08-27' },
        { kind: 'COST', category: 'trucking', description: 'Inland haulage origin → port', amount: '310.00', itemDate: '2026-08-28' },
      ],
    });
    await start(j.id);
    return addItem(j.id, { kind: 'COST', category: 'THC', description: 'Export THC at origin terminal', amount: '190.00', itemDate: '2026-08-29' });
  });

  // 3) COMPLETED profitable job — full lifecycle
  await ok('TRANSIT (COMPLETED)', async () => {
    const j = await create({
      title: 'Transit shipment — auto parts to Iraq border',
      jobType: 'TRANSIT',
      customerId,
      currencyCode: 'USD',
      items: [
        { kind: 'INCOME', category: 'transit fee', description: 'Transit service — door to border', amount: '2600.00', itemDate: '2026-08-10' },
        { kind: 'COST', category: 'trucking', description: 'TIR trucking leg 1', amount: '1150.00', itemDate: '2026-08-11' },
        { kind: 'COST', category: 'insurance', description: 'Transit cargo insurance', amount: '180.00', itemDate: '2026-08-10' },
      ],
    });
    const opened = await start(j.id);
    return complete(opened.id);
  });

  // 4) CANCELLED job — reason demo
  await ok('CUSTOMS (CANCELLED)', async () => {
    const j = await create({
      title: 'Customs valuation assistance — reefer unit',
      jobType: 'CUSTOMS',
      customerId,
      currencyCode: 'IRR',
      items: [
        { kind: 'INCOME', category: 'consulting', description: 'Valuation advisory', amount: '45000000', itemDate: '2026-09-05' },
      ],
    });
    return cancel(j.id, 'Customer performed clearance directly through their own agent.');
  });

  const list = await json('/jobs?pageSize=50', auth);
  console.log(`\n  jobs: ${list.data.meta.totalItems}`);
  for (const j of list.data.data) {
    console.log(`   ${j.jobNumber}  [${j.status}]  ${j.title.slice(0, 46)}  in=${j.totalIncome} cost=${j.totalCost} profit=${j.profit} ${j.currencyCode}`);
  }
};

main().catch((e) => {
  console.error('seed failed:', e.message);
  process.exit(1);
});
