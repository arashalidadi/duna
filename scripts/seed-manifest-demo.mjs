// Creates realistic Manifest demo data through the live API (full business chain).
// 3 manifests: APPROVED (2 items), SUBMITTED (1 item), DRAFT (1 item).
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
  // --- auth ---
  const login = await api('POST', '/auth/login', {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local',
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  });
  token = login.accessToken;
  log('logged in as admin');

  // --- master data lookups ---
  const ports = await api('GET', '/ports?pageSize=50');
  const pol = ports.data.find((p) => p.code === 'JEBALI') ?? ports.data[0];
  const pod = ports.data.find((p) => p.code === 'KHALIFA') ?? ports.data[1] ?? ports.data[0];
  const vessels = await api('GET', '/vessels?pageSize=50');
  const vessel = vessels.data[0];
  const customers = await api('GET', '/customers?pageSize=50');
  const shipper = customers.data[0];
  const consignee = customers.data[1] ?? customers.data[0];
  const yards = await api('GET', '/yards?pageSize=50');
  const yard = yards.data[0];
  if (!vessel || !shipper || !pol || !pod || !yard) throw new Error('missing master data (run prisma seed)');
  log(`vessel=${vessel.name} shipper=${shipper.name} route=${pol.code}->${pod.code}`);

  // --- helper: full chain for one voyage ---
  let cargoSeq = 0;
  async function buildLoadedVoyage(label, cargos) {
    const voyage = await api('POST', '/voyages', {
      vesselId: vessel.id,
      originPortId: pol.id,
      destinationPortId: pod.id,
      notes: `Manifest demo voyage ${label}`,
    });
    log(`[${label}] voyage ${voyage.voyageNumber}`);

    const cargoIds = [];
    for (const c of cargos) {
      cargoSeq += 1;
      const cargo = await api('POST', '/cargo', {
        customerId: shipper.id,
        portId: pol.id,
        yardId: yard.id,
        cargoType: 'CONTAINER',
        quantity: c.quantity,
        weight: c.weight,
        weightUnit: 'KG',
        packages: c.packages,
        packageType: c.packageType ?? 'CARTONS',
        serialNumber: `DEMO-SN-${String(cargoSeq).padStart(3, '0')}`,
      });
      const insp = await api('POST', '/inspections', { cargoId: cargo.id, findings: 'demo ok' });
      await api('POST', `/inspections/${insp.id}/approve`);
      cargoIds.push({ cargoId: cargo.id, planned: c.quantity, ref: cargo.reference });
      log(`[${label}] cargo ${cargo.reference} approved`);
    }

    const ll = await api('POST', '/load-lists', { voyageId: voyage.id, notes: `demo ${label}` });
    const llItemIds = [];
    for (let i = 0; i < cargoIds.length; i++) {
      const item = await api('POST', `/load-lists/${ll.id}/items`, {
        cargoId: cargoIds[i].cargoId,
        plannedQuantity: cargoIds[i].planned,
        sequence: i + 1,
      });
      llItemIds.push({ id: item.id, planned: cargoIds[i].planned });
    }
    await api('POST', `/load-lists/${ll.id}/finalize`);
    log(`[${label}] load list ${ll.loadListNumber} finalized`);

    const al = await api('POST', '/actual-loading', { loadListId: ll.id, notes: 'demo loading' });
    for (const li of llItemIds) {
      await api('PATCH', `/actual-loading/${al.id}/items/${li.id}`, { actualQuantity: li.planned });
    }
    await api('POST', `/actual-loading/${al.id}/start`);
    await api('POST', `/actual-loading/${al.id}/complete`, { notes: 'all loaded' });
    log(`[${label}] actual loading ${al.actualLoadingNumber} completed`);

    return { voyage, cargoIds };
  }

  // --- manifest 1: APPROVED with 2 items ---
  const v1 = await buildLoadedVoyage('M1', [
    { quantity: 20, weight: '1250.5', packages: 20, packageType: 'CARTONS' },
    { quantity: 14, weight: '860', packages: 14, packageType: 'PALLETS' },
  ]);
  const m1 = await api('POST', '/manifests', {
    voyageId: v1.voyage.id,
    shipperId: shipper.id,
    consigneeId: consignee.id,
    notifyParty: 'Bushehr Cargo Agency',
    description: 'General cargo — demo manifest 1',
    notes: 'دمو — تأییدشده',
  });
  for (let i = 0; i < v1.cargoIds.length; i++) {
    await api('POST', `/manifests/${m1.id}/items`, {
      cargoId: v1.cargoIds[i].cargoId,
      blNumber: `BL-DEMO-${String(i + 1).padStart(3, '0')}`,
    });
  }
  await api('PATCH', `/manifests/${m1.id}`, {
    gasCost: 120.5,
    lashingCost: 80,
    shipperCost: 45,
    podCost: 210,
    polCost: 180,
    currencyCode: 'USD',
  });
  await api('POST', `/manifests/${m1.id}/submit`);
  await api('POST', `/manifests/${m1.id}/approve`);
  log(`manifest 1: ${m1.manifestNumber} APPROVED (2 items)`);

  // --- manifest 2: SUBMITTED with 1 item ---
  const v2 = await buildLoadedVoyage('M2', [{ quantity: 30, weight: '2100', packages: 30 }]);
  const m2 = await api('POST', '/manifests', {
    voyageId: v2.voyage.id,
    shipperId: shipper.id,
    consigneeId: consignee.id,
    notifyParty: 'Khalifa Shipping Co',
    description: 'Demo manifest 2 — awaiting approval',
  });
  await api('POST', `/manifests/${m2.id}/items`, { cargoId: v2.cargoIds[0].cargoId, blNumber: 'BL-DEMO-003' });
  await api('POST', `/manifests/${m2.id}/submit`);
  log(`manifest 2: ${m2.manifestNumber} SUBMITTED (1 item)`);

  // --- manifest 3: DRAFT with 1 item ---
  const v3 = await buildLoadedVoyage('M3', [{ quantity: 8, weight: '450.25', packages: 8, packageType: 'CRATES' }]);
  const m3 = await api('POST', '/manifests', {
    voyageId: v3.voyage.id,
    shipperId: shipper.id,
    description: 'Demo manifest 3 — draft',
  });
  await api('POST', `/manifests/${m3.id}/items`, { cargoId: v3.cargoIds[0].cargoId });
  log(`manifest 3: ${m3.manifestNumber} DRAFT (1 item)`);

  // --- verify ---
  const list = await api('GET', '/manifests?pageSize=25');
  console.log('\n=== manifests in DB ===');
  for (const m of list.data) {
    console.log(
      `  ${m.manifestNumber} | ${m.status.padEnd(9)} | voyage ${m.voyage?.voyageNumber} | ${m._count?.items ?? 0} items | ${m.totalWeight} kg / ${m.totalQuantity} qty / ${m.totalPackages} pkg`
    );
  }
  console.log(`\ntotal: ${list.meta.totalItems}`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
