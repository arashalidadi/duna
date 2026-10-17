'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DbStop, TARGET, CODES, POLICY_COLUMNS, POLICY_CONSTRAINTS,
  checkUrl, assess, digest } = require('./db-policy.cjs');
const local = [
  { name: '20261016110000_phase11_audit_append_only', sha256: '1'.repeat(64) },
  { name: TARGET, sha256: '2'.repeat(64) },
];
const triggers = [
  { name:'phase12_retention_no_reduction',table:'RetentionPolicy',enabled:'A',internal:false,
    definition:'BEFORE UPDATE OR DELETE ON public."RetentionPolicy"' },
  { name:'phase12_retention_no_truncate',table:'RetentionPolicy',enabled:'A',internal:false,
    definition:'BEFORE TRUNCATE ON public."RetentionPolicy"' },
  { name:'phase12_letter_no_archive_delete_bypass',table:'letters',enabled:'A',internal:false,
    definition:'BEFORE UPDATE OF "deletedAt" ON public."letters"' },
];
const functions = [
  {name:'phase12_protect_retention_policy',owner:'shipping',securityDefiner:false,
    config:['search_path=pg_catalog'], definition:'RAISE EXCEPTION NEW."minimumDays" < OLD."minimumDays"'},
  {name:'phase12_protect_archived_letter',owner:'shipping',securityDefiner:false,
    config:['search_path=pg_catalog'], definition:'RAISE EXCEPTION OLD."archivedFromStatus" IS NOT NULL'},
];
function fixture(phase12 = false) {
  return { who: { database: 'duna_seed_test', login: 'shipping', session: 'shipping',
    owner: 'shipping', lettersOwner:'shipping', permissionsOwner:'shipping',grantsOwner:'shipping',
    journalOwner:'shipping',journalRights:{ ownerSelect:true,ownerInsert:true,ownerUpdate:true,
      runtimeSelect:false,runtimeInsert:false,runtimeUpdate:false,runtimeDelete:false },
    server: '172.18.0.2', port: 5432, version: 160014,
    auditTriggers: 2, retentionExists: phase12, retentionTriggers: phase12 ? 2 : 0,
    letterGuard: phase12 ? 1 : 0, letterColumn:phase12, letterColumnPresent:phase12,
    policyColumns:phase12 ? POLICY_COLUMNS.map(([name,type,modifier,required])=>
      ({ name,type,modifier,required })) : [],
    policyConstraints:phase12 ? POLICY_CONSTRAINTS.map((name)=>({name,validated:true})) : [],
    phase12Functions:phase12 ? structuredClone(functions):[],
    phase12Triggers:phase12 ? structuredClone(triggers):[],
    policyRows:0,archiveCriteria:0,deleteThresholds:0 },
  runtime: { name: 'shipping_runtime_p11', login: true, superuser: false, createRole: false,
    createDb: false, ownerMember: false, createOnDb: false, connect: true },
  reservedGrants: 0,
  rights: phase12 ? { select: true, insert: true, update: true, delete: false,
    truncate: false, exporterSelect: false } : null,
  history: local.slice(0, phase12 ? 2 : 1).map((m) => ({ name: m.name, checksum: m.sha256,
    finished: true, rolledback: false })),
  permissions: phase12 ? CODES.map(([code,module,action]) => ({code,module,action})) : [],
  };
}
test('owner guard accepts only approved shipping credential and public schema; runtime is NOT migrator', () => {
  assert.equal(checkUrl('postgresql://shipping:secret@127.0.0.1:5432/duna_seed_test?schema=public'), true);
  for (const url of [undefined, 'postgresql://shipping@127.0.0.1:5432/duna_seed_test',
    'postgresql://shipping@127.0.0.1:5432/dna_seed_test',
    'postgresql://shipping@127.0.0.1:5432/duna_seed_test1',
    'postgresql://shipping_runtime_p11:secret@127.0.0.1:5432/duna_seed_test',
    'postgresql://shipping:secret@localhost:5432/duna_seed_test',
    'postgresql://shipping:secret@127.0.0.1:5433/duna_seed_test',
    'postgresql://shipping:secret@127.0.0.1:5432/duna_seed_test?schema=other']) {
    assert.throws(() => checkUrl(url), DbStop);
  }
});
test('preflight permits only Phase 12 pending or exactly applied; rejects drift and runtime journal grants', () => {
  assert.deepEqual(assess(fixture(), local, 'inspect').pending, [TARGET]);
  assert.deepEqual(assess(fixture(true), local, 'verify').pending, []);
  assert.throws(() => assess(fixture(), local, 'verify'), DbStop);
  const unexpected = [...local, { name: 'unreviewed_migration', sha256: 'a'.repeat(64) }];
  assert.throws(() => assess(fixture(), unexpected, 'apply'), DbStop);
  const journal = fixture(true); journal.history[1].checksum = 'tampered';
  assert.throws(() => assess(journal, local, 'verify'), DbStop);
  const absent = fixture(); absent.history=[];
  assert.throws(() => assess(absent, local, 'apply'), DbStop);
  for (const property of ['runtimeSelect','runtimeInsert','runtimeUpdate','runtimeDelete']) {
    const unsafe = fixture(); unsafe.who.journalRights[property] = true;
    assert.throws(() => assess(unsafe, local, 'apply'), DbStop);
  }
});
test('shipping owner alone may obtain minimum journal grant if postgres owns it', () => {
  const short = fixture();short.who.journalOwner='postgres';
  short.who.journalRights.ownerSelect=false;
  short.who.journalRights.ownerInsert=false;
  short.who.journalRights.ownerUpdate=false;
  assert.equal(assess(short,local,'apply').journalNeedsGrant,true);
  assert.throws(()=>assess(short,local,'verify'),DbStop);
  short.who.journalOwner='someone-else';
  assert.throws(()=>assess(short,local,'apply'),DbStop);
});
test('PostgreSQL catalog typmods match reviewed SQL: varchar length + 4; timestamp precision + 4', () => {
  const sql=fs.readFileSync(path.join(__dirname,'../../prisma/migrations',TARGET,'migration.sql'),'utf8');
  assert.match(sql,/"scope" varchar\(40\)/);
  assert.match(sql,/"createdAt" TIMESTAMP\(3\)/);
  assert.deepEqual(POLICY_COLUMNS.filter(([name])=>['scope','createdAt','updatedAt'].includes(name))
    .map(([name,,modifier])=>[name,modifier]),[['scope',44],['createdAt',7],['updatedAt',7]]);
});
test('structure and secure-retention state are verified without modifying a production record', () => {
  const base = fixture(true);
  const altered = [
    (s)=>{s.who.letterColumn=false;},
    (s)=>{s.who.policyColumns[1].modifier=99;},
    (s)=>{s.who.policyColumns[7].required=false;},
    (s)=>{s.who.policyConstraints[0].validated=false;},
    (s)=>{s.who.phase12Functions[0].securityDefiner=true;},
    (s)=>{s.who.phase12Functions[1].definition='RAISE EXCEPTION';},
    (s)=>{s.who.phase12Triggers[2].enabled='D';},
    (s)=>{s.who.phase12Triggers[0].table='Other';},
    (s)=>{s.rights.delete=true;},
    (s)=>{s.runtime.ownerMember=true;},
    (s)=>{s.who.auditTriggers=1;},
    (s)=>{s.permissions[0].module='wrong';},
    (s)=>{s.reservedGrants=1;},
  ];
  for (const mutate of altered) {
    const s=structuredClone(base); mutate(s);
    assert.throws(()=>assess(s,local,'verify'),DbStop);
  }
  const partial=fixture(true);partial.permissions.pop();
  assert.throws(()=>assess(partial,local,'apply'),DbStop);
  const orphan=fixture();orphan.who.letterColumnPresent=true;
  assert.throws(()=>assess(orphan,local,'apply'),DbStop);
  const accidental=fixture();accidental.permissions=[{code:'archive:create',module:'archive',action:'create'}];
  assert.throws(()=>assess(accidental,local,'apply'),DbStop);
});
test('review hash changes with DB catalog/head and contains no URL/secret', () => {
  const a=fixture(), head='a'.repeat(40);
  const first=digest(a,local,head);
  assert.match(first,/^[a-f0-9]{64}$/);
  assert.notEqual(first,digest(a,local,'b'.repeat(40)));
  a.who.server='other-server';
  assert.notEqual(first,digest(a,local,head));
});
