#!/usr/bin/env node
/**
 * Phase 17 demo seed — Letters & correspondence.
 * Idempotent: skips when letters already exist.
 *
 * Usage: node scripts/seed-letters-demo.mjs
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
  console.log('Phase 17 demo seed — letters');

  const login = await json('/auth/login', { method: 'POST', body: ADMIN });
  const token = login.data.accessToken;
  const auth = { token };

  // ---- idempotency guard (raw list envelope is double-wrapped) -----------
  const existing = await json('/letters?pageSize=1', auth);
  if (existing.data.meta.totalItems > 0) {
    console.log('  = letters already present (' + existing.data.meta.totalItems + ') — skipping');
    return;
  }

  // optional customer link — reuse first seeded customer if any
  let customerId;
  try {
    const custs = await json('/customers?pageSize=1', auth);
    customerId = custs.data.data[0]?.id;
  } catch { /* customers module may be empty — fine, link is optional */ }

  const create = (body) => json('/letters', { method: 'POST', body, token }).then((r) => r.data);
  const send = (id) => json(`/letters/${id}/send`, { method: 'POST', token }).then((r) => r.data);
  const archive = (id) => json(`/letters/${id}/archive`, { method: 'POST', token }).then((r) => r.data);
  const reply = (id, body = {}) => json(`/letters/${id}/reply`, { method: 'POST', body, token }).then((r) => r.data);

  // 1) INCOMING — lands as RECEIVED automatically
  const arrivalNotice = await ok('INCOMING arrival notice (RECEIVED)', () =>
    create({
      direction: 'INCOMING',
      letterDate: '2026-08-24',
      subject: 'Arrival notice — MV Caspian Glory ETA 2026-08-28',
      body: 'Dear partner, we hereby advise that MV Caspian Glory is expected to arrive at Bandar Abbas port on 2026-08-28. Please arrange customs clearance and delivery documents prior to berthing.',
      refNumber: 'CG/AN/26-0812',
      fromContact: 'Caspian Shipping Line — Bandar Abbas agency',
      toContact: 'Operations Dept.',
      customerId,
    }));

  // 2) OUTGOING draft kept in DRAFT (editable demo)
  await ok('OUTGOING draft (DRAFT)', () =>
    create({
      direction: 'OUTGOING',
      letterDate: '2026-09-02',
      subject: 'Request for detention waiver — container CSSU4471203',
      body: 'We kindly request a waiver of detention charges for container CSSU4471203, which was held at the yard due to customs inspection beyond our control. Supporting inspection report is attached.',
      refNumber: 'REQ/DW/26-0043',
      fromContact: 'This Company — Operations Dept.',
      toContact: 'Caspian Shipping Line — Commercial Dept.',
      customerId,
      notes: 'Awaiting final review by operations manager before dispatch.',
    }));

  // 3) OUTGOING → SENT
  const docrx = await ok('OUTGOING doc release request (SENT)', async () => {
    const l = await create({
      direction: 'OUTGOING',
      letterDate: '2026-08-26',
      subject: 'Original B/L surrender & doc release request',
      body: 'Please find enclosed the original bills of lading duly endorsed for surrender. We request release of documentation for the attached manifest at your earliest convenience.',
      refNumber: 'SUR/26-0771',
      fromContact: 'This Company — Documentation Desk',
      toContact: 'Caspian Shipping Line — Documentation Desk',
      customerId,
    });
    return send(l.id);
  });

  // 4) reply thread on the arrival notice → SENT
  await ok('reply on arrival notice (Re:, SENT)', async () => {
    const r = await reply(arrivalNotice.id, {
      body: 'Thank you for the advice. Clearance documents are being prepared; we expect to present D/O by 2026-08-27. Please confirm berthing slot for discharging operations.',
      toContact: 'Caspian Shipping Line — Bandar Abbas agency',
    });
    return send(r.id);
  });

  // 5) OUTGOING → SENT → ARCHIVED
  await ok('OUTGOING closed thread (ARCHIVED)', async () => {
    const l = await create({
      direction: 'OUTGOING',
      letterDate: '2026-07-14',
      subject: 'Rate amendment notice effective 2026-08-01',
      body: 'Further to our agreement, the port handling component of your contracted rates will be amended effective 2026-08-01 as per the annexed tariff.',
      refNumber: 'FIN/RA/26-0009',
      fromContact: 'This Company — Commercial Dept.',
      toContact: 'Caspian Shipping Line — Commercial Dept.',
      customerId,
    });
    const sent = await send(l.id);
    return archive(sent.id);
  });

  const list = await json('/letters?pageSize=50', auth);
  console.log(`\n  letters: ${list.data.meta.totalItems}`);
  for (const l of list.data.data) {
    console.log(`   ${l.letterNumber}  [${l.direction}/${l.status}]  ${l.subject.slice(0, 52)}  replies=${l.repliesCount}`);
  }
};

main().catch((e) => {
  console.error('seed failed:', e.message);
  process.exit(1);
});
