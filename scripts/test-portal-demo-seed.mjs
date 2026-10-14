#!/usr/bin/env node
/** DB-free behaviour check of the opt-in Portal demo fixture (no Prisma engine needed). */
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { seedDemo, seedPortalDemo } from '../prisma/seed/demo.ts';

const priorDemoPassword = process.env.SEED_PORTAL_PASSWORD;
delete process.env.SEED_PORTAL_PASSWORD;

const ctx = {
  adminUser: { id: 'admin', email: 'admin@shipping.local' },
  portalRole: { id: 'portal-role' },
  ports: { jebelAli: { id: 'port-j', code: 'JEBALI' }, khalfan: { id: 'port-k', code: 'KHALFAN' } },
};

function makePrisma(extraGrant = false) {
  let id = 0;
  const rows = {
    role: [
      {
        id: ctx.portalRole.id,
        code: 'PORTAL_AGENT',
        permissions: ['portal:access', 'booking:create', ...(extraGrant ? ['user:read'] : [])].map(
          (code) => ({ permission: { code } })
        ),
      },
    ],
    port: [
      { id: 'port-j', name: 'Jebel Ali' },
      { id: 'port-k', name: 'Khalfan Port' },
    ],
  };
  const models = [
    'agent',
    'agentDestination',
    'customer',
    'user',
    'userRole',
    'vessel',
    'voyage',
    'voyageDestination',
    'manifest',
    'billOfLading',
    'releaseOrder',
    'deliveryOrder',
    'bookingRequest',
    'invoice',
    'invoiceItem',
    'cargo',
    'inspection',
    'loadList',
    'loadListItem',
  ];
  for (const model of models) rows[model] = [];

  function match(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) return match(row, value);
      return (row[key] ?? null) === value;
    });
  }
  // Compound unique keys are flattened in the fake's row objects.
  function find(model, where) {
    return rows[model].find((row) => match(row, where)) ?? null;
  }
  function selected(model, row) {
    if (!row) return null;
    if (model !== 'user') return row;
    return {
      ...row,
      roles: rows.userRole
        .filter((r) => r.userId === row.id)
        .map((r) => ({ role: { code: rows.role.find((role) => role.id === r.roleId)?.code } })),
    };
  }
  const prisma = { $transaction: async (callback) => callback(prisma) };
  for (const model of ['role', 'port', ...models]) {
    prisma[model] = {
      count: async ({ where } = {}) =>
        rows[model].filter((row) => !where || match(row, where)).length,
      findUnique: async ({ where }) => selected(model, find(model, where)),
      findFirst: async ({ where }) => selected(model, find(model, where)),
      create: async ({ data }) => {
        const row = {
          id: `fixture-${++id}`,
          isActive: true,
          deletedAt: null,
          isPrimaryAdmin: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
          portalAgentId: null,
          portalCustomerId: null,
          ...data,
        };
        rows[model].push(row);
        return selected(model, row);
      },
      upsert: async ({ where, update, create }) => {
        const found = find(model, where);
        if (found) {
          Object.assign(found, update);
          return selected(model, found);
        }
        return prisma[model].create({ data: create });
      },
      update: async ({ where, data }) => {
        const found = find(model, where);
        assert.ok(found, `${model} fixture to update exists`);
        Object.assign(found, data);
        return selected(model, found);
      },
    };
  }
  return { prisma, rows };
}

const { prisma, rows } = makePrisma();
await seedDemo(prisma, ctx);
const agentD = rows.agent.find((a) => a.code === 'AGT-001');
const agentE = rows.agent.find((a) => a.code === 'AGT-DEMO-E');
const customer = rows.customer.find((c) => c.code === 'AGT-P20DEMO');
const userD = rows.user.find((u) => u.email === 'agent@portal.local');
const userE = rows.user.find((u) => u.email === 'agent2@portal.local');
assert.ok(agentD && agentE && customer && userD && userE);
assert.equal(userD.portalAgentId, agentD.id);
assert.equal(userD.portalCustomerId, customer.id);
assert.equal(userE.portalAgentId, agentE.id);
assert.equal(userE.portalCustomerId, null);
assert.ok(await bcrypt.compare('ChangeMe123!', userD.passwordHash));
assert.ok(await bcrypt.compare('ChangeMe123!', userE.passwordHash));
assert.equal(rows.userRole.filter((r) => r.roleId === ctx.portalRole.id).length, 2);
assert.deepEqual(
  rows.agentDestination.map((d) => [d.agentId, d.portId]),
  [
    [agentD.id, ctx.ports.khalfan.id],
    [agentE.id, ctx.ports.jebelAli.id],
  ]
);
assert.equal(rows.billOfLading.length, 4);
assert.equal(rows.releaseOrder.length, 3);
assert.equal(rows.manifest.length, 2);
assert.deepEqual(
  rows.billOfLading
    .filter((b) => b.status !== 'DRAFT' && b.destinationPortId === ctx.ports.khalfan.id)
    .map((b) => b.billNumber)
    .sort(),
  ['BOL-DEMO-AGT001', 'BOL-DEMO-AGT001-HISTORY']
);
assert.deepEqual(
  rows.billOfLading
    .filter((b) => b.destinationPortId === ctx.ports.jebelAli.id)
    .map((b) => b.billNumber),
  ['BOL-DEMO-AGENT-E']
);
const issued = rows.releaseOrder.find((r) => r.docNumber === 'RO-DEMO-AGT001');
assert.equal(
  issued.billOfLadingId,
  rows.billOfLading.find((b) => b.billNumber === 'BOL-DEMO-AGT001').id
);
assert.equal(issued.paymentState, 'PAID');
assert.equal(
  rows.releaseOrder.find((r) => r.status === 'CANCELLED').cancelReason,
  'Cancelled demo release'
);
assert.deepEqual(
  rows.manifest.map((m) => m.agentId),
  [agentD.id, agentE.id]
);
assert.equal(rows.deliveryOrder[0].portName, 'Khalfan Port');
assert.deepEqual(
  rows.bookingRequest.map((b) => b.status),
  ['PENDING', 'ACCEPTED']
);
assert.equal(rows.invoice[0].totalAmount, rows.invoiceItem[0].amount);

const counts = Object.fromEntries(
  Object.entries(rows).map(([model, records]) => [model, records.length])
);
const originalHash = userD.passwordHash;
rows.billOfLading[0].status = 'CANCELLED'; // rerun must not rewrite edited demo documents
const legacyVoyage = rows.voyage.find((v) => v.voyageNumber === 'VOY-2401-00001');
legacyVoyage.status = 'COMPLETED'; // old sample upserts must not reset developer work either
await seedDemo(prisma, ctx);
assert.deepEqual(
  Object.fromEntries(Object.entries(rows).map(([model, records]) => [model, records.length])),
  counts
);
assert.equal(userD.passwordHash, originalHash);
assert.equal(rows.billOfLading[0].status, 'CANCELLED');
assert.equal(legacyVoyage.status, 'COMPLETED');

// The old API demo script created a Customer-linked account without Agent link.
userD.portalAgentId = null;
userD.passwordHash = await bcrypt.hash('old-demo-password', 12);
userD.isActive = false;
userD.lockedUntil = new Date('2030-01-01');
await seedDemo(prisma, ctx);
assert.equal(userD.portalAgentId, agentD.id);
assert.equal(userD.portalCustomerId, customer.id);
assert.equal(userD.isActive, true);
assert.equal(userD.lockedUntil, null);
assert.ok(await bcrypt.compare('ChangeMe123!', userD.passwordHash));
assert.deepEqual(
  Object.fromEntries(Object.entries(rows).map(([model, records]) => [model, records.length])),
  counts
);

const legacyManifestFixture = makePrisma();
legacyManifestFixture.rows.manifest.push({
  id: 'legacy-manifest',
  manifestNumber: 'MAN-2609-00004',
  agentId: null,
});
await seedPortalDemo(legacyManifestFixture.prisma, ctx);
assert.equal(
  legacyManifestFixture.rows.manifest[0].agentId,
  legacyManifestFixture.rows.agent.find((a) => a.code === 'AGT-001').id
);

const unsafe = makePrisma(true);
await assert.rejects(seedPortalDemo(unsafe.prisma, ctx), /PORTAL_AGENT needs only/);
assert.equal(unsafe.rows.agent.length, 0);

const protectedAccount = makePrisma();
const protectedHash = await bcrypt.hash('owner-password', 12);
protectedAccount.rows.user.push({
  id: 'existing-owner',
  email: 'agent@portal.local',
  isPrimaryAdmin: true,
  passwordHash: protectedHash,
  portalAgentId: null,
  portalCustomerId: null,
});
await assert.rejects(seedPortalDemo(protectedAccount.prisma, ctx), /conflicting identity or role/);
assert.equal(protectedAccount.rows.user[0].passwordHash, protectedHash);

process.env.SEED_PORTAL_PASSWORD = 'LocalDemoOverride123!';
const withOverride = makePrisma();
await seedPortalDemo(withOverride.prisma, ctx);
assert.ok(await bcrypt.compare('LocalDemoOverride123!', withOverride.rows.user[0].passwordHash));
if (priorDemoPassword === undefined) delete process.env.SEED_PORTAL_PASSWORD;
else process.env.SEED_PORTAL_PASSWORD = priorDemoPassword;
console.log(
  'Demo seed: fresh/repeat, legacy account+manifest repair, password override, grant rejection and admin protection passed (DB-free)'
);
