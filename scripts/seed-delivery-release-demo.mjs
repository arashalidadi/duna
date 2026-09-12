// Seeds demo Delivery Orders (D/O) + Release Orders (R/O) against the demo B/Ls.
// Part 1: happy path — D/O + R/O on an ISSUED B/L with no open invoices.
// Part 2: override path — issue the draft B/L (has an unpaid invoice), get
//         blocked by the money rule (409), then release with force+reason.
// Idempotent-ish: skips each part if its rows already exist.
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

  const today = new Date().toISOString().slice(0, 10);

  const bills = await api('GET', '/bills?pageSize=50');

  // ---- Part 1: happy path on an ISSUED B/L with no open invoices ----
  const dos = await api('GET', '/delivery-orders?pageSize=50');
  const ros = await api('GET', '/release-orders?pageSize=50');
  let primary = bills.data.find((b) => b.status === 'ISSUED');

  if (!primary) throw new Error('no ISSUED B/L found - run the B/L demo seed first');

  if (dos.data.some((d) => d.billOfLadingId === primary.id)) {
    log(`part 1 already seeded for ${primary.billNumber} - skipping`);
  } else {
    const do1 = await api('POST', '/delivery-orders', {
      billOfLadingId: primary.id,
      recipient: primary.consignee?.name || 'Consignee Co.',
      vehiclePlate: '12ب34567',
      notes: 'Deliver at Terminal 2, Berth 5 - contact +98 76 3333 4455. ID verification required.',
      issueDate: today,
    });
    log(`D/O created: ${do1.docNumber} [${do1.status}] for ${do1.bill?.billNumber ?? primary.billNumber}`);

    const elig = await api('GET', `/release-orders/eligibility?billOfLadingId=${primary.id}`);
    log(
      `eligibility for ${primary.billNumber}: canRelease=${elig.canRelease} needsOverride=${elig.needsOverride} ` +
        `billed=${elig.invoicesTotal} paid=${elig.invoicesPaid}`,
    );

    const ro1 = await api('POST', '/release-orders', {
      billOfLadingId: primary.id,
      releaseDate: today,
      notes: `All charges settled at Customs Office, Bandar Abbas. Delivery order ${do1.docNumber} presented.`,
    });
    log(`R/O created: ${ro1.docNumber} [${ro1.status}] for ${ro1.bill?.billNumber ?? primary.billNumber}`);
  }

  // ---- Part 2: override demo - B/L with an unpaid ISSUED invoice ----
  // Issue the draft B/L first (its invoice INV-2609-00001 stays unpaid 0/2189.25).
  let target = bills.data.find((b) => b.status === 'DRAFT' && b.id !== primary.id);
  if (target) {
    target = await api('POST', `/bills/${target.id}/issue`, {});
    log(`second B/L issued for override demo: ${target.billNumber} [${target.status}]`);
  } else {
    // Already issued by a previous run - find an ISSUED B/L (not primary) with open invoices.
    target = bills.data.find((b) => b.status === 'ISSUED' && b.id !== primary.id);
    if (!target) {
      log('no second B/L available for the override demo - skipping part 2');
      console.log('DONE');
      return;
    }
    log(`reusing already-issued B/L for override demo: ${target.billNumber}`);
  }

  const rosNow = await api('GET', '/release-orders?pageSize=50');
  if (rosNow.data.some((r) => r.billOfLadingId === target.id)) {
    log(`part 2 already seeded for ${target.billNumber} - skipping`);
    console.log('DONE');
    return;
  }

  const elig2 = await api('GET', `/release-orders/eligibility?billOfLadingId=${target.id}`);
  log(
    `eligibility for ${target.billNumber}: canRelease=${elig2.canRelease} needsOverride=${elig2.needsOverride} ` +
      `billed=${elig2.invoicesTotal} paid=${elig2.invoicesPaid} outstanding=${elig2.outstanding}`,
  );

  // Expected rejection without override (money rule):
  const blocked = await fetch(`${BASE}/release-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ billOfLadingId: target.id, releaseDate: today }),
  });
  const blockedJson = await blocked.json().catch(() => null);
  if (blocked.status === 409) {
    log(`money rule enforced: ${blockedJson?.error?.message ?? 'blocked (409)'}`);
  } else {
    throw new Error(`expected 409 without override, got ${blocked.status}`);
  }

  const ro2 = await api('POST', '/release-orders', {
    billOfLadingId: target.id,
    releaseDate: today,
    force: true,
    overrideReason: 'Credit released for top consignee - approved by GM (demo).',
    notes: 'Override demo: invoice still open at release time.',
  });
  log(`R/O created with override: ${ro2.docNumber} [${ro2.status}] financialOverride=${ro2.financialOverride}`);
  log(`override reason: ${ro2.overrideReason}`);

  const do2 = await api('POST', '/delivery-orders', {
    billOfLadingId: target.id,
    recipient: 'AL Co 46tyen - Warehouse Dept.',
    vehiclePlate: '45د89123',
    notes: 'Second D/O demo row.',
    issueDate: today,
  });
  log(`D/O created: ${do2.docNumber} [${do2.status}]`);

  const finalDo = await api('GET', '/delivery-orders?pageSize=10');
  const finalRo = await api('GET', '/release-orders?pageSize=10');
  log(`final: ${finalDo.meta.totalItems} D/O, ${finalRo.meta.totalItems} R/O in system`);
  console.log('DONE');
}

main().catch((e) => {
  console.error('SEED FAILED:', e.message);
  process.exit(1);
});
