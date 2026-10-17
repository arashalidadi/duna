'use strict';

const path = require('node:path');
const { createHash, verify } = require('node:crypto');

class BackupStop extends Error {}
const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]{1,10})?$/;
const BACKUP_ID = /^b-\d{8}T\d{6}Z-[a-f0-9]{12}$/;
const REMOTE_FS = new Set(['nfs', 'nfs4', 'cifs', 'fuse.sshfs']);
const FILES = ['database.dump.age', 'roles.sql.age', 'assets.tar.age'];
// Signed inventory spans the business, finance, archive, audit and private
// asset metadata whose loss would otherwise be invisible to a file checksum.
const COUNT_TABLES = ['User', 'invoices', 'accounts', 'general_journals', 'AuditLog',
  'FileAttachment', 'DocumentTemplateVersion', 'DocumentAsset', 'DocumentIssuedSnapshot',
  'DocumentRenderedOutput', 'RetentionPolicy', 'letters', 'vouchers', 'salary_records'];
function fail(message) { throw new BackupStop(message); }
function positive(value, name, max = 365000) {
  const n = Number(value);
  if (!/^[1-9][0-9]*$/.test(String(value || '')) || !Number.isSafeInteger(n) || n > max) {
    fail(`${name} must be explicitly configured as a positive integer`);
  }
  return n;
}
function remoteMount(record, expectedSource, root, hostname) {
  if (typeof expectedSource !== 'string' || !expectedSource ||
      !record || !REMOTE_FS.has(record.fstype) || record.source !== expectedSource ||
      !path.isAbsolute(record.target) || record.target === '/' ||
      !path.resolve(root).startsWith(path.resolve(record.target) + path.sep)) {
    fail('Backup destination is not the specifically approved off-server mount');
  }
  const sourceHost = record.source.split(':')[0].replace(/^\/\//, '').split('/')[0].split('@').pop();
  if (!sourceHost || ['localhost', '127.0.0.1', '::1', hostname].includes(sourceHost)) {
    fail('Backup destination resolves to the primary host');
  }
  return true;
}
function validateManifest(manifest, signature, publicKey, id, primaryHost) {
  const bytes = Buffer.isBuffer(manifest) ? manifest : Buffer.from(manifest);
  if (bytes.length > 64 * 1024 || !verify(null, bytes, publicKey, signature)) {
    fail('Manifest signature invalid');
  }
  let data;
  try { data = JSON.parse(bytes.toString('utf8')); } catch { fail('Manifest is not JSON'); }
  if (data.version !== 1 || data.id !== id || !BACKUP_ID.test(id) ||
      data.database !== 'duna_seed_test' || data.pgMajor !== 16 ||
      data.storageKind !== 'local' || !Number.isSafeInteger(data.storageFiles) ||
      data.storageFiles < 0 || !/^[a-f0-9]{64}$/.test(data.aclSha256 || '') ||
      typeof data.primaryHost !== 'string' || !data.primaryHost ||
      (primaryHost && data.primaryHost !== primaryHost) ||
      typeof data.createdAt !== 'string' || !Number.isFinite(Date.parse(data.createdAt)) ||
      Object.keys(data.files || {}).sort().join(',') !== FILES.slice().sort().join(',') ||
      Object.keys(data.rowCounts || {}).sort().join(',') !== COUNT_TABLES.slice().sort().join(',') ||
      COUNT_TABLES.some((table) => !Number.isSafeInteger(data.rowCounts[table]) ||
        data.rowCounts[table] < 0)) {
    fail('Manifest is incomplete or does not match the approved source');
  }
  for (const file of FILES) {
    const info = data.files[file];
    if (!/^[a-f0-9]{64}$/.test(info?.sha256 || '') ||
        !Number.isSafeInteger(info?.bytes) || info.bytes < 1) fail('Incomplete encrypted-file manifest');
  }
  return data;
}
function archiveEntries(names, types) {
  if (names.length !== types.length || !names.length || names[0] !== './') {
    fail('Asset archive has unexpected entries');
  }
  for (let i = 0; i < names.length; i++) {
    if (i === 0 ? types[i] !== 'd' : types[i] !== '-' || !KEY.test(names[i].slice(2)) ||
        names[i] !== `./${names[i].slice(2)}`) {
      fail('Asset archive contains a path, link or unexpected object');
    }
  }
  if (new Set(names).size !== names.length) fail('Asset archive repeats an entry');
  return names.length - 1;
}
function selectPrune(entries, now, retentionDays, testedId) {
  positive(retentionDays, 'Off-server backup retention');
  if (!BACKUP_ID.test(testedId) || !entries.some((e) => e.id === testedId && e.verified)) {
    fail('The most recently restored, signed backup must remain available');
  }
  if (entries.some((e) => !e.verified || !BACKUP_ID.test(e.id))) {
    fail('Unrecognised off-server entry; do not remove anything');
  }
  const latest = entries.reduce((a, b) => !a || a.createdAt < b.createdAt ? b : a, null);
  const threshold = now - retentionDays * 86400000;
  return entries.filter((e) => e.id !== testedId && e.id !== latest.id &&
    Date.parse(e.createdAt) < threshold).map((e) => e.id);
}
function sha256(data) { return createHash('sha256').update(data).digest('hex'); }
module.exports = { BackupStop, KEY, BACKUP_ID, REMOTE_FS, FILES, COUNT_TABLES, positive,
  remoteMount, validateManifest, archiveEntries, selectPrune, sha256 };
