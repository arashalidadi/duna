// Seeds demo B/Ls against the APPROVED demo manifests from seed-manifest-demo.mjs.
// 2 bills: one ISSUED (1 item, stamped on the manifest line), one DRAFT (1 item).
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

  // All APPROVED manifests (demo + any previous runs)
  const list = await api('GET', '/manifests?status=APPROVED&pageSize=50&sort=approvedAt&order=desc');
  const approved = list.data;
  log(`approved manifests: ${approved.length}`);

  let made = 0;
  const existing = await api('GET', '/bills?pageSize=100');
  log(`existing bills: ${existing.meta.totalItems}`);
  if (existing.meta.totalItems > 0) {
    console.log('demo bills already present — nothing to do');
    return;
  }

  for (const m of approved.slice(0, 2)) {
    const lines = await api('GET', `/bills/eligible-items?manifestId=${m.id}`);
    if (lines.length === 0) continue;
    const line = lines[0];

    const bill = await api('POST', '/bills', {
      manifestId: m.id,
      billType: 'HOUSE',
      freightTerms: 'PREPAID',
      carrierName: 'Gulf Marine Carriers',
      placeOfIssue: 'Jebel Ali, UAE',
      originals: 3,
      freightAmount: '1850.00',
      currencyCode: 'USD',
      goodsDescription: 'General cargo — said to contain',
      shipmentMarks: 'GMC-2609 / KEEP DRY',
      notes: 'دمو — بارنامه آزمایشی',
    });
    log(`created ${bill.billNumber} for ${m.manifestNumber}`);

    await api('POST', `/bills/${bill.id}/items`, {
      manifestItemId: line.id,
      volume: '4.250',
    });
    log(`  added line #${line.sequence} (cargo ${line.cargo?.reference ?? line.cargoId})`);

    if (made === 0) {
      // issue the first one — stamps ManifestItem.blNumber
      const issued = await api('POST', `/bills/${bill.id}/issue`, {});
      log(`  issued -> ${issued.status}, dateOfIssue=${issued.dateOfIssue}`);
    } else {
      log('  left in DRAFT');
    }
    made++;
  }

  const final = await api('GET', '/bills?pageSize=25');
  console.log('\n=== bills in DB ===');
  for (const b of final.data) {
    console.log(`  ${b.billNumber} | ${b.status.padEnd(9)} | manifest ${b.manifest?.manifestNumber} | ${b._count?.items ?? 0} items | ${b.totalPackages} pkg / ${Number(b.totalGrossWeight).toLocaleString()} kg / ${Number(b.totalVolume).toFixed(3)} m³`);
  }
  console.log(`\ntotal: ${final.meta.totalItems}`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
