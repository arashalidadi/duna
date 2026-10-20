/**
 * Phase 12 archive/retention workflow contracts: backup, database policy, render units, server target, migration contract and the server workflow itself.
 *
 * Merged on 2026-10-20 from 6 files. Every original file keeps its own
 * block scope below, so its declarations cannot collide with another file's and no
 * assertion was rewritten. Run it with: node --test scripts/phase12/workflow.test.cjs
 */

// ---- scripts/phase12/backup.test.cjs (7 tests) ----
{
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { BackupStop, COUNT_TABLES, positive, remoteMount, validateManifest, archiveEntries,
  selectPrune, sha256 } = require('./backup-policy.cjs');
const id1 = 'b-20261001T010101Z-abcdef123456';
const id2 = 'b-20261002T010101Z-aabbccddeeff';
const id3 = 'b-20261003T010101Z-112233445566';
const hash = sha256('encrypted bytes');
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
function manifest(id = id1) {
  const bytes = Buffer.from(JSON.stringify({ version: 1, id,
    database: 'duna_seed_test', pgMajor: 16, storageKind: 'local',
    primaryHost: 'primary-host', storageFiles: 1, aclSha256: hash,
    rowCounts: Object.fromEntries(COUNT_TABLES.map((name) => [name, 1])),
    createdAt: '2026-10-01T01:01:01.000Z', files: Object.fromEntries(
      ['database.dump.age', 'roles.sql.age', 'assets.tar.age'].map((name) =>
        [name, { bytes: 20, sha256: hash }])) }));
  return { bytes, sig: sign(null, bytes, privateKey) };
}
test('backup retention, restore interval and failure threshold are explicit, never defaulted', () => {
  for (const value of [undefined, null, '', '0', '-1', '1.5', '90days', '99999999']) {
    assert.throws(() => positive(value, 'period'), BackupStop);
  }
  assert.equal(positive('17', 'period'), 17);
});
test('backup destination must be an approved remote mount, not another local directory', () => {
  const good = { target: '/mnt/offsite', source: 'backup-host:/encrypted', fstype: 'nfs4' };
  assert.equal(remoteMount(good, good.source, '/mnt/offsite/private', 'primary'), true);
  for (const bad of [{ ...good, fstype: 'ext4' }, { ...good, source: 'primary:/data' },
    { ...good, target: '/' }, { ...good, source: 'backup-host:/other' }]) {
    assert.throws(() => remoteMount(bad, good.source, '/mnt/offsite/private', 'primary'), BackupStop);
  }
  assert.throws(() => remoteMount(good, good.source, '/mnt/offsite2/private', 'primary'), BackupStop);
});
test('signed manifest binds exact source, files and ciphertext hashes; changes are refused', () => {
  const { bytes, sig } = manifest();
  assert.equal(validateManifest(bytes, sig, publicKey, id1).id, id1);
  assert.throws(() => validateManifest(Buffer.concat([bytes, Buffer.from(' ')]), sig, publicKey, id1), BackupStop);
  assert.throws(() => validateManifest(bytes, sig, publicKey, id2), BackupStop);
  assert.throws(() => validateManifest(bytes, sig, publicKey, id1, 'other-host'), BackupStop);
  const wrong = generateKeyPairSync('ed25519').publicKey;
  assert.throws(() => validateManifest(bytes, sig, wrong, id1), BackupStop);
  const missing = JSON.parse(bytes.toString('utf8'));
  delete missing.rowCounts.AuditLog;
  const rewritten = Buffer.from(JSON.stringify(missing));
  assert.throws(() => validateManifest(rewritten, sign(null, rewritten, privateKey), publicKey, id1), BackupStop);
  for (const invalid of [-1, 0.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    const changed = JSON.parse(bytes.toString('utf8'));
    changed.rowCounts.AuditLog = invalid;
    const signed = Buffer.from(JSON.stringify(changed));
    assert.throws(() => validateManifest(signed, sign(null, signed, privateKey), publicKey, id1), BackupStop);
  }
  const empty = JSON.parse(bytes.toString('utf8'));
  empty.rowCounts.AuditLog = 0;
  const signed = Buffer.from(JSON.stringify(empty));
  assert.equal(validateManifest(signed, sign(null, signed, privateKey), publicKey, id1).rowCounts.AuditLog, 0);
});
test('backup signs actual SQL row counts and restore checks them before a receipt', () => {
  const source = fs.readFileSync(path.join(__dirname, 'backup.cjs'), 'utf8');
  assert.match(source, /const COUNTS_SQL = `SELECT json_build_object\(\$\{COUNT_TABLES\.map/);
  assert.match(source, /storageFiles: source\.names\.length, aclSha256: acl, rowCounts: counts/);
  assert.match(source, /JSON\.stringify\(counts\) !== JSON\.stringify\(rowCounts\(pg\)\)/);
  const checked = source.indexOf('JSON.stringify(rowCounts(pg)) !== JSON.stringify(data.rowCounts)');
  assert.ok(checked > 0 && checked < source.indexOf('writeReceipt(root, data, keys.length)'));
  for (const table of ['FileAttachment', 'DocumentTemplate', 'DocumentTemplateVersion']) {
    assert.match(source, new RegExp(`FROM public\\."${table}" WHERE "storageAdapter" IS DISTINCT FROM 'local'`));
  }
  assert.match(source, /verifyArtworkHashes\(pg, E\.PHASE12_RESTORE_STORAGE_DIR\);/);
});
test('asset listing accepts only private regular UUID-key files; never traversal or links', () => {
  const ok = './00112233-4455-6677-8899-aabbccddeeff.pdf';
  assert.equal(archiveEntries(['./', ok], ['d', '-']), 1);
  for (const [names, types] of [
    [['./', '../.env'], ['d', '-']], [['./', ok], ['d', 'l']],
    [['./', ok, ok], ['d', '-', '-']], [['./', './secret'], ['d', '-']],
    [['./', ok], ['-', '-']],
  ]) assert.throws(() => archiveEntries(names, types), BackupStop);
});
test('prune is dry until operator approval, and never selects newest/restored/unknown copies', () => {
  const entries = [id1, id2, id3].map((id, i) => ({ id, verified: true,
    createdAt: `2026-10-0${i + 1}T01:01:01.000Z` }));
  assert.deepEqual(selectPrune(entries, Date.parse('2026-10-17T00:00:00Z'), 7, id2), [id1]);
  assert.deepEqual(selectPrune(entries, Date.parse('2026-10-17T00:00:00Z'), 30, id1), []);
  assert.throws(() => selectPrune(entries, Date.now(), 7, undefined), BackupStop);
  assert.throws(() => selectPrune(entries, Date.now(), 7, 'unverified'), BackupStop);
  assert.throws(() => selectPrune([{ ...entries[0], verified: false }, ...entries.slice(1)],
    Date.now(), 7, id2), BackupStop);
});
test('CLI without off-server configuration fails closed before connecting; no credential reflected', () => {
  const command = path.join(__dirname, 'backup.cjs');
  for (const args of [['preflight'], ['restore', id1], ['backup']]) {
    const result = spawnSync(process.execPath, [command, ...args], { encoding: 'utf8',
      env: { PATH: process.env.PATH, DATABASE_URL: 'postgresql://secret:SHOULD_NOT_PRINT@127.0.0.1:5432/duna_seed_test' } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PHASE12_BACKUP_FAIL/);
    assert.doesNotMatch(result.stdout + result.stderr, /SHOULD_NOT_PRINT/);
    assert.doesNotMatch(result.stdout + result.stderr, /ISOLATED_RESTORE_VERIFIED|BACKUP_COMPLETE/);
  }
});
}

// ---- scripts/phase12/db-policy.test.cjs (8 tests) ----
{
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DbStop, TARGET, CODES, POLICY_COLUMNS, POLICY_CONSTRAINTS,
  checkUrl, assess, digest, reviewedApply } = require('./db-policy.cjs');
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
test('reviewed SQL expects PostgreSQL 16 catalog typmods: varchar length + 4, timestamp precision directly', () => {
  const sql=fs.readFileSync(path.join(__dirname,'../../prisma/migrations',TARGET,'migration.sql'),'utf8');
  assert.match(sql,/"scope" varchar\(40\)/);
  assert.match(sql,/"createdAt" TIMESTAMP\(3\)/);
  assert.match(sql,/"updatedAt" TIMESTAMP\(3\)/);
  assert.deepEqual(POLICY_COLUMNS.filter(([name])=>['scope','createdAt','updatedAt'].includes(name))
    .map(([name,,modifier])=>[name,modifier]),[['scope',44],['createdAt',3],['updatedAt',3]]);
  // The additional isolated PostgreSQL 16 fixture executes the SQL and reads
  // pg_attribute itself; this check alone would not detect a wrong assumption.
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
test('catalog errors identify the safe mismatched object without echoing raw catalog definitions', () => {
  const bad = fixture(true);
  bad.who.policyColumns[7].modifier = 7;
  bad.who.policyColumns[8].modifier = 7;
  bad.who.phase12Functions[0].definition = 'private: do not display';
  assert.throws(() => assess(bad, local, 'verify'), (error) =>
    error instanceof DbStop &&
    /RetentionPolicy column createdAt position\/type\/precision\/nullability/.test(error.message) &&
    /RetentionPolicy column updatedAt position\/type\/precision\/nullability/.test(error.message) &&
    /Phase 12 protection function owner\/security\/search_path\/body/.test(error.message) &&
    !error.message.includes('private: do not display'));
  const disabled = fixture(true);
  disabled.who.phase12Triggers[0].enabled = 'D';
  assert.throws(() => assess(disabled, local, 'verify'),
    /Phase 12 trigger enablement\/internals/);
});
test('apply refuses a stale approved inspection when migration/seed or catalog changes', () => {
  const head='a'.repeat(40);
  const inspected=fixture();
  const approved=digest(inspected,local,head);
  assert.deepEqual(reviewedApply(inspected,local,head,approved).pending,[TARGET]);
  const manuallyCompleted=fixture(true);
  assert.throws(() => reviewedApply(manuallyCompleted,local,head,approved),
    /inspection became stale \(migration recorded=true; permissions=7\/7\); no apply write attempted/);
  const changed=structuredClone(inspected);changed.who.archiveCriteria=1;
  assert.throws(() => reviewedApply(changed,local,head,approved),
    /inspection became stale/);
  assert.throws(() => reviewedApply(inspected,local,'b'.repeat(40),approved),
    /inspection became stale/);
  assert.throws(() => reviewedApply(inspected,local,head,'x'.repeat(64)),
    /inspection digest required/);
  const partial=fixture(true);partial.permissions.pop();
  assert.throws(() => reviewedApply(partial,local,head,approved),
    /Partial Phase 12 permission seed/);
});
test('review hash changes with DB catalog/head and contains no URL/secret', () => {
  const a=fixture(), head='a'.repeat(40);
  const first=digest(a,local,head);
  assert.match(first,/^[a-f0-9]{64}$/);
  assert.notEqual(first,digest(a,local,'b'.repeat(40)));
  a.who.server='other-server';
  assert.notEqual(first,digest(a,local,head));
});
}

// ---- scripts/phase12/render-units.test.cjs (1 tests) ----
{
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { render } = require('./render-units.cjs');
const { BackupStop } = require('./backup-policy.cjs');
test('systemd templates require operator calendars and affect only new Phase 12 jobs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'duna-p12-units-'));
  try {
    const backupEnv = path.join(dir, 'backup.env');
    const archiveEnv = path.join(dir, 'archive.env');
    fs.writeFileSync(backupEnv, 'TEST_ONLY=1\n');
    fs.writeFileSync(archiveEnv, 'TEST_ONLY=1\n');
    const inputs = { repo: fs.realpathSync(path.resolve(__dirname, '../..')),
      serviceUser: os.userInfo().username, node: fs.realpathSync(process.execPath),
      corepack: fs.realpathSync(process.execPath), backupEnv, archiveEnv,
      backupSchedule: '*-*-* 04:01:00', archiveSchedule: '*-*-* 04:11:00',
      monitorSchedule: '*-*-* 05:01:00' };
    const files = render(inputs);
    assert.equal(Object.keys(files).length, 7);
    assert.match(files['duna-phase12-backup.timer'], /OnCalendar=\*-\*-\* 04:01:00/);
    assert.match(files['duna-phase12-backup.service'], /backup\.cjs backup/);
    assert.match(files['duna-phase12-backup.service'], /ExecStartPost=.*backup\.cjs prune/);
    assert.match(files['duna-phase12-archive.service'], /run-phase12-archive\.ts/);
    assert.match(files['duna-phase12-monitor.service'], /backup\.cjs status/);
    assert.match(files['duna-phase12-backup.service'], /OnFailure=duna-phase12-alert@%n\.service/);
    assert.match(files['duna-phase12-alert@.service'], /alert-mail\.sh %i FAILED/);
    assert.ok(Object.values(files).every((v) => !v.includes('postgres') && !v.includes('systemctl')));
    assert.throws(() => render({ ...inputs, backupSchedule: '' }), BackupStop);
    assert.throws(() => render({ ...inputs, archiveSchedule: 'OnFailure=bad\n' }), BackupStop);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
}

// ---- scripts/phase12/server-target.test.cjs (4 tests) ----
{
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DbStop } = require('./db-policy.cjs');
const { exactUrl, envFile, pgpassPassword, inspectContainer, connections,
  dockerQuery, inspectSession, journalGrantSql } = require('./server-target.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(),'phase12-server-target-'));
const runtime = 'postgresql://shipping_runtime_p11:runtime-secret@127.0.0.1:5432/duna_seed_test?schema=public';
const owner = 'postgresql://shipping:owner-secret@127.0.0.1:5432/duna_seed_test?schema=public';
const container = {environment:{POSTGRES_USER:'shipping',POSTGRES_PASSWORD:'docker-secret'}};
test('real runtime DATABASE_URL remains separate from migration-owner connection', () => {
  assert.equal(exactUrl(runtime,'shipping_runtime_p11'),runtime);
  assert.throws(()=>exactUrl(runtime,'shipping'),DbStop);
  assert.throws(()=>exactUrl(owner,'shipping_runtime_p11'),DbStop);
  assert.deepEqual(connections({DATABASE_URL:runtime,MIGRATOR_DATABASE_URL:owner},root,container),
    {owner,runtime});
  // Supplying RUNTIME_DATABASE_URL alongside an owner DATABASE_URL does NOT
  // replace the actual API runtime DATABASE_URL; this mistaken invocation
  // failed the owner's credential preflight without touching a DB.
  assert.throws(() => connections({DATABASE_URL:owner,RUNTIME_DATABASE_URL:runtime,
    MIGRATOR_DATABASE_URL:owner},root,container),DbStop);
  assert.equal(connections({DATABASE_URL:runtime},root,container).owner,
    'postgresql://shipping:docker-secret@127.0.0.1:5432/duna_seed_test?schema=public');
  assert.throws(()=>connections({DATABASE_URL:runtime},root,{environment:{POSTGRES_USER:'postgres'}}),DbStop);
  const elsewhere='postgresql://shipping:owner-secret@127.0.0.1:5432/duna_seed_test1?schema=public';
  assert.throws(()=>connections({DATABASE_URL:runtime,MIGRATOR_DATABASE_URL:elsewhere},root,container),DbStop);
  for(const url of [runtime.replace('?schema=public','?schema=private'),
    runtime.replace('127.0.0.1','localhost'),runtime.replace(':5432',':5433')])
    assert.throws(()=>exactUrl(url,'shipping_runtime_p11'),DbStop);
});
test('reads an existing dotenv/pgpass as data, never executes or prints it', () => {
  const template=path.join(root,'.env.example');
  fs.writeFileSync(template,`DATABASE_URL=${runtime}\n`);
  assert.throws(() => connections({MIGRATOR_DATABASE_URL:owner},root,container),DbStop,
    'a template is not an actual runtime credential');
  fs.unlinkSync(template);
  const file=path.join(root,'.env');
  fs.writeFileSync(file,`# comment\nDATABASE_URL='${owner}'\nMIGRATOR_DATABASE_URL="${owner}"\nOTHERS=ignored\n`,{mode:0o600});
  assert.equal(envFile(file).MIGRATOR_DATABASE_URL,owner);
  assert.equal(connections({DATABASE_URL:runtime},root,container).owner,owner);
  fs.writeFileSync(file,`DATABASE_URL=${runtime}\nDATABASE_URL=${owner}\n`);
  assert.throws(()=>envFile(file),DbStop);
  fs.unlinkSync(file);
  const apiFile=path.join(root,'apps/api/.env');
  fs.mkdirSync(path.dirname(apiFile),{recursive:true});
  fs.writeFileSync(apiFile,`DATABASE_URL=${runtime}\n`);
  fs.writeFileSync(file,`DATABASE_URL=${owner}\n`);
  assert.equal(connections({DATABASE_URL:runtime},root,container).owner,
    'postgresql://shipping:docker-secret@127.0.0.1:5432/duna_seed_test?schema=public',
    'the first file defining DATABASE_URL is runtime, so a later owner value is not selected');
  fs.unlinkSync(apiFile);fs.unlinkSync(file);
  const passfile=path.join(root,'pgpass');
  fs.writeFileSync(passfile,'127.0.0.1:5432:duna_seed_test:shipping:has\\:colon\n',{mode:0o600});
  assert.equal(pgpassPassword(passfile),'has:colon');
  assert.match(connections({DATABASE_URL:runtime,PGPASSFILE:passfile},root,{environment:{}}).owner,
    /shipping:has%3Acolon@127\.0\.0\.1/);
  fs.chmodSync(passfile,0o644);
  assert.throws(()=>pgpassPassword(passfile),DbStop);
  fs.unlinkSync(passfile);
});
test('Docker inspection refuses wrong/stopped container, port mapping or PG client major', () => {
  function run(_bin,args) {
    if (args[0]==='inspect') return {status:0,stdout:JSON.stringify([{Name:'/erp-postgres',
      State:{Running:true},NetworkSettings:{Ports:{'5432/tcp':[
        {HostPort:'5432',HostIp:'127.0.0.1'}]}},
      Config:{Env:['POSTGRES_USER=shipping','POSTGRES_PASSWORD=private']}}])};
    return {status:0,stdout:'psql (PostgreSQL) 16.8\n'};
  }
  const inspected=inspectContainer(run);
  assert.equal(inspected.environment.POSTGRES_USER,'shipping');
  assert.equal(inspected.environment.POSTGRES_PASSWORD,'private');
  const wrong=(_bin,args) => args[0]==='inspect' ?
    {status:0,stdout:JSON.stringify([{Name:'/other',State:{Running:true},
      NetworkSettings:{Ports:{'5432/tcp':[{HostPort:'5432',HostIp:'127.0.0.1'}]}}}])} :
    {status:0,stdout:'psql (PostgreSQL) 16.8'};
  assert.throws(()=>inspectContainer(wrong),DbStop);
});
test('correlates host backend PID to container session and restricts any grant to shipping', () => {
  const nonce='phase12-'+'a'.repeat(24),pid=4321;
  let command='';
  const runner=(_bin,args,config)=>{
    command=JSON.stringify(args)+' '+config.input;
    return {status:0,stdout:JSON.stringify({match:true,journalOwner:'postgres',history:[{
      name:'reviewed',checksum:'2'.repeat(64),finished:true,rolledback:false}]})};
  };
  const result=inspectSession(container,pid,nonce,runner,'postgres');
  assert.equal(result.journalOwner,'postgres');
  assert.equal(result.adminRole,'postgres');
  assert.match(command,/pg_stat_activity/);
  assert.match(command,/application_name/);
  assert.match(command,/4321/);
  assert(!command.includes('docker-secret'));
  const sql=journalGrantSql(pid,nonce,'postgres');
  assert.match(sql,/GRANT SELECT, INSERT, UPDATE ON TABLE public\._prisma_migrations TO shipping;/);
  assert.doesNotMatch(sql,/GRANT.*shipping_runtime_p11/);
  assert.doesNotMatch(sql,/ALTER.*OWNER|DROP|DELETE FROM/i);
  assert.match(fs.readFileSync(path.join(__dirname,'../../apps/api/scripts/phase12-db-deploy.ts'),'utf8'),
    /inspectSession\(container, session\.pid, nonce, undefined, 'postgres'\)/);
  assert.throws(()=>journalGrantSql(pid,'invalid','postgres'),DbStop);
  assert.throws(()=>journalGrantSql(pid,nonce,'random-owner'),DbStop);
  assert.throws(()=>inspectSession(container,pid,nonce,()=>({status:0,stdout:'{"match":false}'})),DbStop);
  const fail=()=>({status:1,stderr:'password=secret'});
  assert.throws(()=>dockerQuery('SELECT 1;',container,fail), (error)=>
    error instanceof DbStop && !/secret|password=/.test(error.message));
});
test.after(()=>fs.rmSync(root,{recursive:true,force:true}));
}

// ---- scripts/phase12/migration-contract.test.cjs (2 tests) ----
{
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
// The 49 original migrations were squashed into a three-file baseline on
// 2026-10-19, so the Phase 12 DDL now lives inside
// 20261004000001_post_lifecycle_baseline. Read the whole committed history so
// this contract follows the migrations instead of pinning one deleted name.
const MIGRATIONS = path.join(ROOT, 'prisma/migrations');
const sql = fs.readdirSync(MIGRATIONS)
  .filter((entry) => /^2\d{13}_/.test(entry))
  .sort()
  .map((entry) => fs.readFileSync(path.join(MIGRATIONS, entry, 'migration.sql'), 'utf8'))
  .join('\n');
test('automatic archive worker cannot start unrelated API notification poller', () => {
  const worker = fs.readFileSync(path.join(ROOT, 'apps/api/scripts/run-phase12-archive.ts'), 'utf8');
  assert.match(worker, /createApplicationContext\(ArchiveWorkerModule/);
  assert.match(worker, /PrismaModule, AuditModule, ArchiveModule/);
  assert.doesNotMatch(worker, /createApplicationContext\(AppModule/);
  assert.doesNotMatch(worker, /NotificationsModule/);
});
test('Phase 12 migration is atomic/additive, seeds no legal periods and protects floor/letter deletion', () => {
  // Additive and ordered: the comment, the column, then the policy table.
  assert.match(sql, /-- Phase 12: additive policy vocabulary\.[\s\S]{0,200}?\nALTER TABLE public\."letters" ADD COLUMN "archivedFromStatus" public\."LetterStatus";\nCREATE TABLE public\."RetentionPolicy"/);
  // Prisma owns the transaction for each migration file, so none of them may
  // wrap itself in an explicit BEGIN/COMMIT pair.
  assert.doesNotMatch(sql, /^(?:BEGIN|COMMIT);/m);
  // The Phase 11 append-only audit protection moved into this baseline with the
  // squash; db-policy.cjs no longer pins its former migration name, so the
  // protection itself is what this contract holds onto.
  for (const required of [
    'phase11_reject_audit_mutation()',
    'phase11_audit_no_update_delete',
    'phase11_audit_no_truncate',
  ]) assert.ok(sql.includes(required), `missing audit protection ${required}`);
  assert.doesNotMatch(sql, /\b(?:DROP TABLE|TRUNCATE TABLE|DELETE FROM|UPDATE public\."(?:Invoice|Voucher|FileAttachment)")\b/i);
  assert.match(sql, /"minimumDays" integer,/);
  assert.match(sql, /"minimumDays" IS NULL OR/);
  assert.match(sql, /NEW\."minimumDays" < OLD\."minimumDays"/);
  assert.match(sql, /NEW\."scope" IS DISTINCT FROM OLD\."scope"/);
  assert.match(sql, /phase12_retention_no_reduction/);
  assert.match(sql, /phase12_retention_no_truncate/);
  assert.match(sql, /phase12_letter_no_archive_delete_bypass/);
  assert.match(sql, /a\."action" = 'letter\.archive'/);
  assert.match(sql, /GREATEST\(OLD\."createdAt", OLD\."letterDate"\)/);
  assert.match(sql, /p\."minimumDays" IS NOT NULL/);
  assert.match(sql, /ENABLE ALWAYS TRIGGER phase12_retention_no_reduction/);
  assert.match(sql, /ENABLE ALWAYS TRIGGER phase12_letter_no_archive_delete_bypass/);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON public\."RetentionPolicy" TO shipping_runtime_p11/);
  assert.match(sql, /REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER/);
});
}

// ---- scripts/phase12/server-workflow.test.cjs (9 tests) ----
{
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { StageFailure, inspectLine, safeDbResult, dbFailureHint, prechangeApproval, offlineCommands,
  workflow, needsInstall, applicationManager, verifyWebArchive, readOnlyRoutes } = require('./server-workflow.cjs');
const runtime='postgresql://shipping_runtime_p11:runtime-secret@127.0.0.1:5432/duna_seed_test?schema=public';
const owner='postgresql://shipping:owner-secret@127.0.0.1:5432/duna_seed_test?schema=public';
const inspect=`PHASE12_DB_INSPECT_PASS: PG16 erp-postgres correlation; journal owner=shipping; pending Phase 12=1; owner journal grant needed=false; permissions=0/7; digest=${'a'.repeat(64)}`;
const dbMarker='PHASE12_DB_VERIFY_PASS: checksum/history, RetentionPolicy structure, three protective triggers, seven Phase 12 permission codes (reserved actions ungranted), runtime read-only identity/privileges; configured archive criteria=0; configured deletion thresholds=0. No policy/schedule set by this command.';
test('one-command dependency preflight installs the new isolated PG16 fixture when missing', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'phase12-deps-'));
  try {
    for (const name of ['node_modules/.bin/prisma','node_modules/.bin/tsx',
      'apps/api/node_modules/.bin/nest','apps/web/node_modules/.bin/next']) {
      const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.writeFileSync(file,'');
    }
    assert.equal(needsInstall(dir),true);
    const fixture=path.join(dir,'apps/api/node_modules/pglite-pg16/package.json');
    fs.mkdirSync(path.dirname(fixture),{recursive:true});fs.writeFileSync(fixture,'{}');
    assert.equal(needsInstall(dir),false);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('bounded catalog mismatch survives the outer redactor; raw credentials never do', () => {
  const diagnostic='Phase 12 catalog differs: RetentionPolicy column createdAt position/type/precision/nullability; RetentionPolicy column updatedAt position/type/precision/nullability. Catalog check is read-only; stop before any further write';
  assert(diagnostic.length>210,'old outer limit concealed the timestamp diagnosis');
  assert.equal(dbFailureHint(`PHASE12_DB_FAIL: ${diagnostic}`,''),diagnostic);
  for (const unsafe of ['postgresql://shipping:secret@127.0.0.1:5432/duna_seed_test',
    'password=secret','token=secret','secret: visible']) {
    assert.equal(dbFailureHint(`PHASE12_DB_FAIL: ${unsafe}`,''),null);
  }
  assert.equal(dbFailureHint('raw Prisma stderr: connection failed',''),null);
});
test('inspection marker identifies idempotent/no-op vs required writes; backup prerequisite never guessed', () => {
  assert.equal(inspectLine(inspect).needsWrite,true);
  assert.equal(inspectLine(inspect.replace('pending Phase 12=1','pending Phase 12=0')
    .replace('permissions=0/7','permissions=7/7')).needsWrite,false);
  assert.equal(prechangeApproval({},false),'NO_DB_CHANGE');
  assert.throws(()=>prechangeApproval({},true,{isTTY:false}),StageFailure);
  assert.equal(prechangeApproval({PHASE12_PRECHANGE_BACKUP_ATTESTED:'I_HAVE_RESTORED_PRECHANGE_BACKUP'},true),
    'I_HAVE_RESTORED_PRECHANGE_BACKUP');
  assert.throws(()=>inspectLine('prisma status failed'),StageFailure);
  assert.match(safeDbResult(dbMarker),/runtime Prisma read: PASS/);
  assert.throws(()=>safeDbResult('PASS'),StageFailure);
});
test('apply uses owner only for DB, checks/restarts only apps AFTER verification, no schedules or demo seed', async () => {
  const commands=[],output=[];
  const run=(bin,args,env={})=>{
    commands.push({bin,args,env:{DATABASE_URL:env.DATABASE_URL,
      MIGRATOR_DATABASE_URL:env.MIGRATOR_DATABASE_URL,
      RUNTIME_DATABASE_URL:env.RUNTIME_DATABASE_URL,
      PGPASSFILE:env.PGPASSFILE,
      PHASE12_INSPECTION_DIGEST:env.PHASE12_INSPECTION_DIGEST,
      PHASE12_PRECHANGE_BACKUP_ATTESTED:env.PHASE12_PRECHANGE_BACKUP_ATTESTED}});
    if (bin==='pnpm' && args.join(' ')==='--version') return '9.15.9\n';
    if (bin==='systemctl' && args.includes('MainPID')) return '12345\n';
    if (args.at(-1)==='inspect') return inspect;
    if (args.at(-1)==='apply' || args.at(-1)==='verify') return dbMarker;
    return 'PASS\n';
  };
  const options={run,env:{DATABASE_URL:runtime,MIGRATOR_DATABASE_URL:owner,
    PHASE12_INSPECTION_DIGEST:'b'.repeat(64), // stale shell input cannot authorize apply
    PGPASSFILE:'/protected/owner-passfile',
    PHASE12_PRECHANGE_BACKUP_ATTESTED:'I_HAVE_RESTORED_PRECHANGE_BACKUP'},
    containerInspect:()=>({environment:{POSTGRES_USER:'shipping'}}),
    resolveUrls:()=>({owner,runtime}),review:()=>{},installCheck:()=>false,
    commands:()=>[['test-only-offline','scripts/phase12','node',['--test','fake.test.cjs']]],
    managerFactory:(env)=>{
      assert.equal(env.DATABASE_URL,runtime);
      assert.equal(env.MIGRATOR_DATABASE_URL,undefined);
      assert.equal(env.PGPASSFILE,undefined);
      return {kind:'systemd',units:['duna-api.service','duna-web.service']};
    },
    activations:()=>[['duna-phase12-archive.timer','disabled']],routes:(env)=>{
      assert.equal(env.DATABASE_URL,runtime);
      assert.equal(env.MIGRATOR_DATABASE_URL,undefined);
    },
    output:(line)=>output.push(line)};
  await workflow('apply',options);
  const calls=commands.map(({args})=>args.join(' '));
  const inspected=calls.findIndex((x)=>x.endsWith('phase12-db-deploy.ts inspect'));
  const applied=calls.findIndex((x)=>x.endsWith('phase12-db-deploy.ts apply'));
  const verified=calls.findIndex((x)=>x.endsWith('phase12-db-deploy.ts verify'));
  const restart=calls.findIndex((x)=>x==='restart duna-api.service duna-web.service');
  assert.ok(inspected>=0 && inspected<applied && applied<verified && verified<restart);
  for (const cmd of commands) {
    if (cmd.args[0]==='exec' && cmd.args[1]==='tsx' &&
        cmd.args[2]==='apps/api/scripts/phase12-db-deploy.ts') {
      assert.equal(cmd.env.DATABASE_URL,owner);
      assert.equal(cmd.env.RUNTIME_DATABASE_URL,runtime);
      assert.equal(cmd.env.PHASE12_INSPECTION_DIGEST,
        cmd.args.at(-1)==='apply' ? 'a'.repeat(64) : undefined);
    } else {
      assert.equal(cmd.env.PHASE12_INSPECTION_DIGEST,undefined);
      assert.notEqual(cmd.env.DATABASE_URL,owner);
      assert.equal(cmd.env.MIGRATOR_DATABASE_URL,undefined);
      assert.equal(cmd.env.PGPASSFILE,undefined);
      assert.equal(cmd.env.RUNTIME_DATABASE_URL,undefined);
      if (cmd.bin==='node') assert.equal(cmd.env.DATABASE_URL,runtime);
    }
  }
  assert.equal(commands.find((x)=>x.args.at(-1)==='apply').env.PHASE12_PRECHANGE_BACKUP_ATTESTED,
    'I_HAVE_RESTORED_PRECHANGE_BACKUP');
  assert(output.some((line)=>line.startsWith('PHASE12_APPLY_PASS:')));
  assert(!commands.some(({args})=>args.join(' ').includes('seed:demo')));
  const unsafe=[];
  await assert.rejects(workflow('apply',{...options,run:(bin,args,env)=>{
    unsafe.push(args.join(' ')); return run(bin,args,env);
  },activations:()=>[['duna-phase12-archive.timer','enabled']],output:()=>{}}),StageFailure);
  assert(!unsafe.some((args)=>args.endsWith('phase12-db-deploy.ts apply')));
});
test('independent test executes NO migrate/seed/restart and fails closed with readable summary', async () => {
  const calls=[],lines=[];
  const run=(bin,args)=>{
    calls.push(`${bin} ${args.join(' ')}`);
    if(bin==='pnpm'&&args[0]==='--version') return '9.15.9';
    if(args.at(-1)==='inspect') return inspect.replace('pending Phase 12=1','pending Phase 12=0')
      .replace('permissions=0/7','permissions=7/7');
    if(args.at(-1)==='verify') return dbMarker;
    return 'PASS';
  };
  await workflow('test',{run,env:{DATABASE_URL:runtime},output:(m)=>lines.push(m),
    containerInspect:()=>({environment:{}}),resolveUrls:()=>({runtime,owner}),
    review:()=>{},installCheck:()=>false,commands:()=>[],
    activations:()=>[['duna-phase12-archive.timer','disabled']],routes:()=>{}});
  assert(!calls.some((line)=>/migrate deploy|seed-phase12|restart|docker compose/.test(line)));
  assert(lines.some((line)=>line.startsWith('PHASE12_TEST_PASS:')));
  const failed=[];
  await assert.rejects(workflow('test',{run:(bin,args)=>{
    if (bin==='pnpm'&&args[0]==='--version') return '9.15.9';
    if (args.at(-1)==='inspect') throw new StageFailure('Migration checksum differs');
    return 'PASS';
  },env:{DATABASE_URL:runtime},output:(m)=>failed.push(m),
  containerInspect:()=>({environment:{}}),resolveUrls:()=>({runtime,owner}),
  review:()=>{},installCheck:()=>false,commands:()=>[]}),StageFailure);
  assert(failed.some((line)=>line.includes('[FAIL] Independent read-only')));
  assert(failed.some((line)=>line.startsWith('PHASE12_TEST_FAIL:')));
});
test('test plan includes static/mocks/authorization/legacy regression, isolated Web build, no DB fixture runner', () => {
  const offline=offlineCommands('test');
  const commands=offline.map(([, ,bin,args])=>`${bin} ${args.join(' ')}`).join('\n');
  assert.match(commands,/prisma generate/);
  assert.match(commands,/prisma validate/);
  assert.match(commands,/test-phase12-archive\.ts/);
  assert.match(commands,/test-phase12-http\.ts/);
  assert.match(commands,/test-phase12-catalog\.cjs/);
  assert.match(commands,/check-phase11-authz\.mjs/);
  assert.match(commands,/check-seed-safety\.mjs/);
  assert.match(commands,/check-api-build\.mjs verify/);
  assert.match(commands,/@shipping\/web build/);
  assert.doesNotMatch(commands,/migrate deploy|db:seed|seed-demo|seed-phase12-permissions\.ts --/);
  assert.doesNotMatch(commands,/(?:exec tsx|node) apps\/api\/scripts\/run-phase12-archive\.ts/);
  const source=fs.readFileSync(path.join(__dirname,'server-workflow.cjs'),'utf8');
  assert.doesNotMatch(source,/run\('systemctl',\s*\['(?:enable|start|daemon-reload)'/);
  assert.doesNotMatch(source,/run\('node',\s*\['scripts\/phase12\/render-units\.cjs'/);
  assert.doesNotMatch(source,/prisma migrate reset/);
});
test('dashboard proof reads the actual App Router manifest, not the prerender manifest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'p12-archive-route-'));
  try {
    const manifest = path.join(root,'apps/web/.next/app-path-routes-manifest.json');
    fs.mkdirSync(path.dirname(manifest),{ recursive:true });
    fs.mkdirSync(path.join(root,'apps/web/messages'),{ recursive:true });
    for (const locale of ['en','fa','ar']) {
      fs.writeFileSync(path.join(root,`apps/web/messages/${locale}.json`),
        JSON.stringify({ archive:{ title:'Archive' } }));
    }
    fs.writeFileSync(manifest,JSON.stringify({ '/[locale]/(dashboard)/archive/page':'/[locale]/archive' }));
    assert.doesNotThrow(() => verifyWebArchive(root));
    fs.writeFileSync(manifest,'{}');
    assert.throws(() => verifyWebArchive(root), /protected archive dashboard route/);
  } finally { fs.rmSync(root,{ recursive:true, force:true }); }
});

test('live route probe uses only unauthenticated GETs and catches a missing audit/archive handler', async () => {
  const requests=[];
  let bad=false;
  const api=http.createServer((request,response)=>{
    requests.push([request.method,request.url,request.headers.authorization]);
    response.statusCode=request.url==='/api/v1/health' ? 200 :
      bad && request.url==='/api/v1/audit/export' ? 404 : 401;
    response.end('');
  });
  const web=http.createServer((request,response)=>{
    requests.push([request.method,request.url,request.headers.authorization]);
    response.statusCode=request.url?.endsWith('/archive') ? 200 : 404;
    response.end('');
  });
  try {
    await Promise.all([new Promise(resolve=>api.listen(0,'127.0.0.1',resolve)),
      new Promise(resolve=>web.listen(0,'127.0.0.1',resolve))]);
    const env={API_PORT:String(api.address().port),PHASE12_WEB_PORT:String(web.address().port)};
    await readOnlyRoutes(env);
    assert.equal(requests.length,9);
    assert.ok(requests.every(([method,,auth])=>method==='GET' && auth===undefined));
    bad=true;
    await assert.rejects(readOnlyRoutes(env),/audit\/export: expected 401, got 404/);
  } finally { await Promise.all([new Promise(resolve=>api.close(resolve)),
    new Promise(resolve=>web.close(resolve))]); }
});

test('app manager refuses incomplete/unapproved systemd units without touching any service', () => {
  assert.throws(()=>applicationManager({PHASE12_API_SYSTEMD_UNIT:'erp-postgres.service'},()=>''),StageFailure);
  assert.throws(()=>applicationManager({PHASE12_API_SYSTEMD_UNIT:'duna-api.service'},()=>''),StageFailure);
  assert.deepEqual(applicationManager({PHASE12_API_SYSTEMD_UNIT:'duna-api.service',
    PHASE12_WEB_SYSTEMD_UNIT:'duna-web.service'},(_bin,args)=>
      `ActiveState=active\nWorkingDirectory=/home/user/duna/apps/${args[1]==='duna-api.service'?'api':'web'}\n`,
    '/home/user/duna'),{kind:'systemd',units:['duna-api.service','duna-web.service']});
});
}

