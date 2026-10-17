'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DbStop, TARGET, checkUrl, assess, digest } = require('./db-policy.cjs');
const local = [
  { name: '20261016110000_phase11_audit_append_only', sha256: '1'.repeat(64) },
  { name: TARGET, sha256: '2'.repeat(64) },
];
function fixture(phase12 = false) {
  return { who: { database: 'duna_seed_test', login: 'shipping', session: 'shipping',
    owner: 'shipping', server: '172.18.0.2', port: 5432, version: 160014,
    auditTriggers: 2, retentionExists: phase12, retentionTriggers: phase12 ? 2 : 0,
    letterGuard: phase12 ? 1 : 0 },
  runtime: { name: 'shipping_runtime_p11', login: true, superuser: false, createRole: false,
    createDb: false, ownerMember: false, createOnDb: false, connect: true },
  reservedGrants: 0,
  rights: phase12 ? { select: true, insert: true, update: true, delete: false,
    truncate: false, exporterSelect: false } : null,
  history: local.slice(0, phase12 ? 2 : 1).map((m) => ({ name: m.name, checksum: m.sha256,
    finished: true, rolledback: false })),
  permissions: phase12 ? [
    ['archive:create','archive','create'], ['archive:reopen','archive','reopen'],
    ['archive:delete','archive','delete'],
    ['retention:read','retention','read'], ['retention:manage','retention','manage'],
    ['backup:manage','backup','manage'], ['backup:restore','backup','restore'],
  ].map(([code,module,action]) => ({ code,module,action })) : [],
  };
}
test('URL guard accepts only the owner-approved target, never another spelling or DB role', () => {
  assert.equal(checkUrl('postgresql://shipping:secret@127.0.0.1:5432/duna_seed_test?schema=public'), true);
  for (const url of [undefined, 'postgresql://shipping@127.0.0.1:5432/dna_seed_test',
    'postgresql://shipping@127.0.0.1:5432/duna_seed_test1',
    'postgresql://shipping_runtime_p11@127.0.0.1:5432/duna_seed_test',
    'postgresql://shipping@localhost:5432/duna_seed_test',
    'postgresql://shipping@127.0.0.1:5433/duna_seed_test',
    'postgresql://shipping@127.0.0.1:5432/duna_seed_test?schema=other']) {
    assert.throws(() => checkUrl(url), DbStop);
  }
});
test('inspect accepts only Phase 12 as pending; verify requires exact migration, permission and grants', () => {
  assert.deepEqual(assess(fixture(), local, 'inspect').pending, [TARGET]);
  assert.deepEqual(assess(fixture(true), local, 'verify').pending, []);
  assert.throws(() => assess(fixture(), local, 'verify'), DbStop);
  const unexpected = [...local, { name: 'unreviewed_migration', sha256: 'a'.repeat(64) }];
  assert.throws(() => assess(fixture(), unexpected, 'apply'), DbStop);
  const rights = fixture(true); rights.rights.delete = true;
  assert.throws(() => assess(rights, local, 'verify'), DbStop);
  const grant = fixture(true); grant.runtime.ownerMember = true;
  assert.throws(() => assess(grant, local, 'verify'), DbStop);
  const audit = fixture(true); audit.who.auditTriggers = 1;
  assert.throws(() => assess(audit, local, 'verify'), DbStop);
  const seed = fixture(true); seed.permissions[0].module = 'wrong';
  assert.throws(() => assess(seed, local, 'verify'), DbStop);
  const reserved = fixture(true); reserved.reservedGrants = 1;
  assert.throws(() => assess(reserved, local, 'verify'), DbStop);
  const journal = fixture(true); journal.history[1].checksum = 'tampered';
  assert.throws(() => assess(journal, local, 'verify'), DbStop);
});
test('review hash binds exact source and DB inspection; never includes URL/secret', () => {
  const a = fixture();
  const head = 'a'.repeat(40);
  const first = digest(a, local, head);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, digest(a, local, 'b'.repeat(40)));
  a.who.server = 'other-server';
  assert.notEqual(first, digest(a, local, head));
});
