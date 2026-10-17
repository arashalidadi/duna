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
