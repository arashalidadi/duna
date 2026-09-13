#!/usr/bin/env node
/**
 * Phase 17 demo seed — correspondence register.
 * Idempotent: skips when demo letters already exist.
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
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
};

const main = async () => {
  console.log('Phase 17 demo seed (letters)');

  const login = await json('/auth/login', { method: 'POST', body: ADMIN });
  const token = login.data.accessToken;

  // idempotency guard — raw envelope: { data: { data, meta } }
  const existing = await json('/letters?pageSize=1', { token });
  if (existing.data.meta.totalItems > 0) {
    console.log('  = letters already present (' + existing.data.meta.totalItems + ') — skipping');
    return;
  }

  // 1) incoming customs notice -> RECEIVED -> archived
  const incoming = await json('/letters', {
    method: 'POST', token,
    body: {
      direction: 'INCOMING',
      letterDate: '2026-09-08',
      subject: 'Customs clearance notice — Container MSCU-772104',
      body: 'This is to inform that the above container is cleared and awaiting release instructions.',
      refNumber: 'AGT-CUS-77',
      fromContact: 'Bandar Abbas Customs',
      notes: 'File under import docs.',
    },
  });
  await json(`/letters/${incoming.data.id}/archive`, { method: 'POST', token });
  console.log('  ✓ incoming customs notice (archived)');

  // 2) outgoing demurrage claim -> DRAFT -> SENT
  const claim = await json('/letters', {
    method: 'POST', token,
    body: {
      direction: 'OUTGOING',
      letterDate: '2026-09-09',
      subject: 'Demurrage claim — Container MSCU-772104',
      body: 'We hereby submit our demurrage claim for the delayed return of the referenced container.',
      refNumber: 'CLM-2609-01',
      toContact: 'Kharg Shipping Lines',
    },
  });
  await json(`/letters/${claim.data.id}/send`, { method: 'POST', token });
  console.log('  ✓ outgoing demurrage claim (sent)');

  // 3) reply thread on the incoming notice
  const reply = await json(`/letters/${incoming.data.id}/reply`, {
    method: 'POST', token,
    body: { body: 'Acknowledged. Release instructions will follow via the yard portal.' },
  });
  await json(`/letters/${reply.data.id}/send`, { method: 'POST', token });
  console.log('  ✓ threaded reply (sent)');

  // 4) a fresh DRAFT for the UI
  await json('/letters', {
    method: 'POST', token,
    body: {
      direction: 'OUTGOING',
      letterDate: '2026-09-12',
      subject: 'Request for berth window extension',
      body: 'Please extend the berth window for MV Sinar Bandung by 48 hours.',
      toContact: 'Port Control',
    },
  });
  console.log('  ✓ fresh DRAFT berth extension request');

  const list = await json('/letters?pageSize=10', { token });
  console.log(`\n  letters: ${list.data.meta.totalItems}`);
  for (const l of list.data.data) {
    console.log(`   ${l.letterNumber}  [${l.direction}]  ${l.status}  — ${l.subject}`);
  }
};

main().catch((e) => {
  console.error('seed failed:', e.message);
  process.exit(1);
});
