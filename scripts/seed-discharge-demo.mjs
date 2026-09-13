#!/usr/bin/env node
/**
 * Phase 19 demo seed — Discharge (unloading at destination).
 * Idempotent: skips when discharges already exist.
 *
 * Usage: node scripts/seed-discharge-demo.mjs
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
  console.log('Phase 19 demo seed — discharge');

  const login = await json('/auth/login', { method: 'POST', body: ADMIN });
  const token = login.data.accessToken;
  const auth = { token };

  // ---- idempotency guard (raw list envelope is double-wrapped) -----------
  const existing = await json('/discharge?pageSize=1', auth);
  if (existing.data.meta.totalItems > 0) {
    console.log('  = discharges already present (' + existing.data.meta.totalItems + ') — skipping');
    return;
  }

  // completed actual loadings available for discharge
  const completed = await json('/actual-loading?status=COMPLETED&pageSize=50', auth);
  const candidates = completed.data.data;
  if (candidates.length === 0) {
    console.log('  ! no COMPLETED actual loadings found — run earlier phase demo seeds first');
    process.exitCode = 1;
    return;
  }

  const create = (actualLoadingId, notes) =>
    json('/discharge', { method: 'POST', body: { actualLoadingId, notes }, token }).then((r) => r.data);
  const setQty = (dischargeId, itemId, dischargeQuantity, notes) =>
    json(`/discharge/${dischargeId}/items/${itemId}`, { method: 'PATCH', body: { dischargeQuantity, notes }, token }).then((r) => r.data);
  const start = (id) => json(`/discharge/${id}/start`, { method: 'POST', token }).then((r) => r.data);
  const complete = (id, notes) => json(`/discharge/${id}/complete`, { method: 'POST', body: { notes }, token }).then((r) => r.data);
  const cancel = (id, cancelReason) =>
    json(`/discharge/${id}/cancel`, { method: 'POST', body: { cancelReason }, token }).then((r) => r.data);

  // 1) FULL discharge on the most recent completed loading → COMPLETED (cargo DELIVERED)
  const first = candidates[candidates.length - 1];
  await ok(`full discharge on ${first.actualLoadingNumber} (COMPLETED)`, async () => {
    const d = await create(first.id, 'Vessel arrived at destination port — all units accounted.');
    for (const it of d.items ?? []) {
      await setQty(d.id, it.id, it.expectedQuantity, 'discharged in full');
    }
    await start(d.id);
    return complete(d.id, 'discharge complete');
  });

  // 2) PARTIAL discharge on an older loading → COMPLETED with a shortfall
  if (candidates.length >= 2) {
    const second = candidates[0];
    await ok(`partial discharge on ${second.actualLoadingNumber} (shortfall)`, async () => {
      const d = await create(second.id, 'Discharge with shortage under deck.');
      for (const it of d.items ?? []) {
        const expected = it.expectedQuantity ?? 0;
        const short = Math.max(0, expected - 1);
        await setQty(d.id, it.id, short, short < expected ? '1 unit short — damage claim opened with carrier' : undefined);
      }
      await start(d.id);
      return complete(d.id, 'completed with recorded shortfall');
    });
  }

  // 3) a NOT_STARTED discharge awaiting berth
  if (candidates.length >= 3) {
    const third = candidates[1];
    await ok(`pending discharge on ${third.actualLoadingNumber} (NOT_STARTED)`, async () => {
      return create(third.id, 'Awaiting berth window at destination port.');
    });
  }

  // 4) a CANCELLED discharge for the audit trail
  if (candidates.length >= 4) {
    const fourth = candidates[2];
    await ok(`cancelled discharge on ${fourth.actualLoadingNumber} (reason)`, async () => {
      const d = await create(fourth.id);
      return cancel(d.id, 'Discharge re-planned under a new port call — record voided.');
    });
  }

  const list = await json('/discharge?pageSize=50', auth);
  console.log(`\n  discharges: ${list.data.meta.totalItems}`);
  for (const d of list.data.data) {
    console.log(
      `   ${d.dischargeNumber}  [${d.status}]  ${d.actualLoading?.actualLoadingNumber ?? ''}  items=${d.itemsCount}  expected=${d.expectedTotal} discharged=${d.dischargedTotal}`,
    );
  }
};

main().catch((e) => {
  console.error('seed failed:', e.message);
  process.exit(1);
});
