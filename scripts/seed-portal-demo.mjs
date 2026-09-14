#!/usr/bin/env node
/**
 * Phase 20 demo seed — Agent Portal.
 * Creates: demo agent company (AGENT type) + portal role + linked portal user,
 * 4 booking requests in every lifecycle state (via the real API so numbering,
 * stamps and guards are exercised), one DRAFT manifest re-agented to the demo
 * company (shipments tab), and one ISSUED invoice (statement tab).
 *
 * Idempotent: skips when bookings already exist.
 *
 * Usage: node scripts/seed-portal-demo.mjs
 */
const BASE = 'http://127.0.0.1:3101/api/v1';
const ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local',
  password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
};
const AGENT_EMAIL = 'agent@portal.local';
const AGENT_PASSWORD = 'ChangeMe123!';

let token = '';

async function api(method, path, body, tok = token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
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
  console.log('Phase 20 demo seed — agent portal');

  const login = await api('POST', '/auth/login', ADMIN);
  token = login.accessToken;
  log('logged in as admin');

  // --- idempotency guard ---
  const existing = await api('GET', '/bookings?pageSize=1');
  if (existing.meta.totalItems > 0) {
    console.log(`bookings already present (${existing.meta.totalItems}) — nothing to do`);
    return;
  }

  // --- demo agent company ---
  const customers = (await api('GET', '/customers?pageSize=100')).data;
  let company = customers.find((c) => c.code === 'AGT-P20DEMO');
  if (!company) {
    company = await api('POST', '/customers', {
      code: 'AGT-P20DEMO',
      name: 'Meridian Freight Co. (Portal Demo)',
      shortName: 'Meridian',
      type: 'AGENT',
      contactName: 'Sara Amiri',
      phone: '+971 4 555 0182',
      email: 'ops@meridian-freight.example',
    });
    log(`created agent company ${company.code} — ${company.name}`);
  } else {
    log(`agent company ${company.code} already exists`);
  }

  // --- portal role (portal:access + booking:create) ---
  const perms = await api('GET', '/permissions/all');
  const permList = Array.isArray(perms) ? perms : (perms.data ?? []);
  // portal:access + booking:create ONLY — booking:read would expose the office desk (ADR-040)
  const wanted = ['portal:access', 'booking:create'];
  const permIds = permList.filter((p) => wanted.includes(p.code)).map((p) => p.id);
  if (permIds.length !== wanted.length) throw new Error(`permissions missing: got ${permIds.length} of ${wanted.length}`);

  const roles = await api('GET', '/roles?pageSize=100');
  const roleList = Array.isArray(roles) ? roles : (roles.data ?? []);
  let portalRole = roleList.find((r) => r.code === 'PORTAL_AGENT');
  if (!portalRole) {
    portalRole = await api('POST', '/roles', {
      code: 'PORTAL_AGENT',
      name: 'Portal Agent (external)',
      description: 'Agent-portal login: company-scoped reads + booking submission (ADR-040)',
    });
    log(`created role ${portalRole.code}`);
  }
  await api('PATCH', `/roles/${portalRole.id}/permissions`, { permissionIds: permIds });
  log(`role ${portalRole.code} -> ${permIds.length} permissions`);

  // --- portal user linked to the company ---
  const users = (await api('GET', '/users?pageSize=100')).data;
  let agentUser = users.find((u) => u.email === AGENT_EMAIL);
  if (!agentUser) {
    agentUser = await api('POST', '/users', {
      email: AGENT_EMAIL,
      fullName: 'Sara Amiri (Meridian)',
      password: AGENT_PASSWORD,
      roleIds: [portalRole.id],
      portalCustomerId: company.id,
    });
    log(`created portal user ${AGENT_EMAIL} — linked to ${company.code}`);
  } else if (!agentUser.portalCustomerId) {
    await api('PATCH', `/users/${agentUser.id}`, { portalCustomerId: company.id });
    log(`linked existing user ${AGENT_EMAIL} to ${company.code}`);
  } else {
    log(`portal user ${AGENT_EMAIL} already linked`);
  }

  // --- agent logs in (portal flow, real numbering BRK-YYMM-#####) ---
  const agentLogin = await api('POST', '/auth/login', { email: AGENT_EMAIL, password: AGENT_PASSWORD });
  const agentToken = agentLogin.accessToken;
  log(`${AGENT_EMAIL} logged in`);

  const ports = (await api('GET', '/portal/ports', undefined, agentToken));
  const pol = ports[0];
  const pod = ports[1] ?? ports[0];

  // --- 4 bookings across the lifecycle ---
  const mk = (body) => api('POST', '/portal/bookings', body, agentToken);

  const b1 = await mk({
    cargoDescription: 'Industrial machine parts — 3 x 40HC reefer',
    originPortId: pol?.id,
    destinationPortId: pod?.id,
    requestedShipDate: '2026-09-28',
    containers: 3,
    weightKg: 21400,
    notes: 'Power plugs required at origin yard.',
  });

  const b2 = await mk({
    cargoDescription: 'Dried fruits & nuts — 2 x 20GP, food-grade lining',
    originPortId: pod?.id,
    destinationPortId: pol?.id,
    requestedShipDate: '2026-10-05',
    containers: 2,
    weightKg: 17600,
    notes: 'Phytosanitary certificate to follow by email.',
  });

  const b3 = await mk({
    cargoDescription: 'Palletized ceramics — fragile, 1 x 40GP',
    originPortId: pol?.id,
    destinationPortId: pod?.id,
    requestedShipDate: '2026-10-12',
    containers: 1,
    weightKg: 9800,
  });

  const b4 = await mk({
    cargoDescription: 'Sample consignment — 2 pallets (to be cancelled)',
    originPortId: pol?.id,
    weightKg: 640,
  });

  log(`4 bookings submitted: ${b1.bookingNumber}, ${b2.bookingNumber}, ${b3.bookingNumber}, ${b4.bookingNumber}`);

  // --- office desk: respond ---
  await api('POST', `/bookings/${b1.id}/respond`, {
    decision: 'ACCEPTED',
    responseNote: 'Confirmed — space reserved on MV Azari, ETD Sep 28. Rate as quoted.',
  });
  log(`${b1.bookingNumber} ACCEPTED`);

  await api('POST', `/bookings/${b2.id}/respond`, {
    decision: 'DECLINED',
    responseNote: 'No reefer plugs available that week — please propose ETD Oct 12 or later.',
  });
  log(`${b2.bookingNumber} DECLINED`);

  // --- agent cancels the sample ---
  await api('POST', `/portal/bookings/${b4.id}/cancel`, undefined, agentToken);
  log(`${b4.bookingNumber} CANCELLED by agent`);

  // --- shipments tab: re-agent a DRAFT manifest to the demo company ---
  try {
    const manifests = await api('GET', '/manifests?pageSize=50&status=DRAFT');
    const draft = (manifests.data ?? [])[0];
    if (draft) {
      await api('PATCH', `/manifests/${draft.id}`, { agentId: company.id });
      log(`DRAFT manifest ${draft.manifestNumber} re-agented to ${company.code} (shipments tab)`);
    } else {
      log('no DRAFT manifest available — shipments tab will be empty');
    }
  } catch (e) {
    log(`manifest re-agent skipped: ${e.message}`);
  }

  // --- statement tab: one ISSUED invoice for the demo company ---
  try {
    const inv = await api('POST', '/invoices', {
      customerId: company.id,
      title: 'Agency handling — September consignments',
      currencyCode: 'USD',
      taxRate: 5,
      dueDate: '2026-10-20',
    });
    await api('POST', `/invoices/${inv.id}/items`, { description: 'Agency coordination fee', unitPrice: 650, quantity: 1 });
    await api('POST', `/invoices/${inv.id}/items`, { description: 'Port documentation set', unitPrice: 85, quantity: 2 });
    const issued = await api('POST', `/invoices/${inv.id}/issue`, {});
    log(`invoice ${issued.invoiceNumber} ISSUED — ${issued.totalAmount} ${issued.currencyCode} (statement tab)`);
  } catch (e) {
    log(`invoice skipped: ${e.message}`);
  }

  // --- summary ---
  const mine = await api('GET', '/portal/bookings?pageSize=25', undefined, agentToken);
  console.log('\n=== portal bookings (as agent) ===');
  for (const b of mine.data) {
    console.log(`  ${b.bookingNumber} | ${b.status.padEnd(9)} | ${(b.cargoDescription ?? '').slice(0, 48)}`);
  }
  console.log(`\nagent login: ${AGENT_EMAIL} / ${AGENT_PASSWORD}`);
}

main().catch((e) => {
  console.error('seed failed:', e.message);
  process.exit(1);
});
