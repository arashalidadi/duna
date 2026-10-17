#!/usr/bin/env node
'use strict';

// Phase 12 backup and isolated recovery. No owner DB writes: pg_dump/psql read
// the already approved PostgreSQL 16 target. No cleartext dump or asset archive
// touches local disk. The only restore target is a separately approved, EMPTY
// database on a different host. Secrets are never accepted as argv values.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { BackupStop, KEY, BACKUP_ID, FILES, COUNT_TABLES, positive, remoteMount,
  validateManifest, archiveEntries, selectPrune } = require('./backup-policy.cjs');

const E = process.env;
const PRIMARY = { host: '127.0.0.1', port: '5432', db: 'duna_seed_test' };
const ACL_SQL = `SELECT item || ':' || owner || ':' || acl FROM (
  SELECT 'relation:' || c.relname AS item, pg_get_userbyid(c.relowner) AS owner,
    coalesce(c.relacl::text, '<default>') AS acl
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p','S','v','m','f')
  UNION ALL
  SELECT 'schema:' || n.nspname, pg_get_userbyid(n.nspowner),
    coalesce(n.nspacl::text, '<default>') FROM pg_namespace n WHERE n.nspname = 'public'
  UNION ALL
  SELECT 'routine:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    pg_get_userbyid(p.proowner), coalesce(p.proacl::text, '<default>')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
) inventory ORDER BY item`;
const KEYS_SQL = `SELECT "storageKey" FROM public."FileAttachment"
  UNION SELECT "storageKey" FROM public."DocumentTemplateVersion"
  UNION SELECT "storageKey" FROM public."DocumentAsset" ORDER BY 1`;
const ARTWORK_SQL = `SELECT "storageKey", sha256 FROM public."DocumentAsset" ORDER BY 1`;
function verifyArtworkHashes(pg, directory) {
  for (const row of psql(ARTWORK_SQL, pg).split('\n').filter(Boolean)) {
    const [key, expected, extra] = row.split('|');
    if (!KEY.test(key) || !/^[a-f0-9]{64}$/.test(expected || '') || extra !== undefined) {
      stop('Historical artwork has an invalid storage reference/hash');
    }
    const file = path.join(directory, key);
    regular(file);
    if (hashFile(file).sha256 !== expected) stop('Historical artwork bytes differ from signed DB hash');
  }
}
const COUNTS_SQL = `SELECT json_build_object(${COUNT_TABLES.map((table) =>
  `'${table}', (SELECT count(*) FROM public."${table}")`).join(', ')})::text`;
function rowCounts(pg) {
  try {
    const counts = JSON.parse(psql(COUNTS_SQL, pg));
    if (Object.keys(counts).sort().join(',') !== COUNT_TABLES.slice().sort().join(',') ||
        COUNT_TABLES.some((name) => !Number.isSafeInteger(counts[name]) || counts[name] < 0)) {
      stop('Signed recovery row-count inventory is incomplete');
    }
    return counts;
  } catch (error) {
    if (error instanceof BackupStop) throw error;
    stop('Signed recovery row-count inventory is unreadable');
  }
}
function safeEnv() {
  const { DATABASE_URL: _url, PGPASSWORD: _password, ...clean } = E;
  return clean;
}
function stop(message) { throw new BackupStop(message); }
function regular(file, maxMode = 0o600) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || !fs.existsSync(file) ||
      path.resolve(file) !== fs.realpathSync(file)) {
    stop('An approved absolute regular file is missing or is a symlink');
  }
  const st = fs.lstatSync(file);
  if (!st.isFile() || st.uid !== process.getuid() || ((st.mode & 0o777) & ~maxMode)) {
    stop('A protected file has unsafe ownership or permissions');
  }
}
function directory(dir, maxMode = 0o700) {
  if (typeof dir !== 'string' || !path.isAbsolute(dir) || !fs.existsSync(dir) ||
      path.resolve(dir) !== fs.realpathSync(dir)) {
    stop('An approved absolute directory is missing or is a symlink');
  }
  const st = fs.lstatSync(dir);
  if (!st.isDirectory() || st.uid !== process.getuid() || ((st.mode & 0o777) & ~maxMode)) {
    stop('A protected directory has unsafe ownership or permissions');
  }
}
function tool(name) {
  const r = spawnSync('which', [name], { stdio: 'ignore', timeout: 5000 });
  if (r.status !== 0) stop(`Required ${name} executable is unavailable`);
}
function run(bin, args, env = {}, limit = 32 * 1024 * 1024) {
  const child = spawnSync(bin, args, { env: { ...safeEnv(), ...env }, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: limit, timeout: 120000 });
  if (child.error || child.status !== 0) stop(`${bin} check failed; protected logs required`);
  return child.stdout.trim();
}
function log(event, id = '-') {
  const result = spawnSync('logger', ['--priority', 'authpriv.notice', '--tag', 'duna-phase12',
    `phase12 ${event} ${id}`], { stdio: 'ignore', timeout: 5000 });
  if (result.status !== 0) stop('Security audit logger unavailable');
}
function alert(stage) {
  try {
    regular(E.PHASE12_ALERT_COMMAND, 0o700);
    const result = spawnSync(E.PHASE12_ALERT_COMMAND, [stage, 'FAILED'],
      { stdio: 'ignore', timeout: 30000 });
    if (result.status !== 0) throw new Error('notifier returned failure');
    log('failure-notified', stage);
  } catch { console.error('MANDATORY FAILURE ALERT DID NOT CONFIRM DELIVERY; notify the owner out of band.'); }
}
function pgEnv(restoring = false) {
  const user = restoring ? E.PHASE12_RESTORE_PGUSER : E.PHASE12_PGUSER;
  const passfile = restoring ? E.PHASE12_RESTORE_PGPASSFILE : E.PHASE12_PGPASSFILE;
  regular(passfile);
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(user || '')) stop('Explicit approved PostgreSQL login required');
  return { ...safeEnv(), PGHOST: PRIMARY.host, PGPORT: PRIMARY.port,
    PGDATABASE: restoring ? E.PHASE12_RESTORE_DB : PRIMARY.db,
    PGUSER: user, PGPASSFILE: passfile, PGCONNECT_TIMEOUT: '10' };
}
function psql(sql, env) {
  return run('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '--no-password', '-c', sql], env);
}
function identity(env, restoring = false) {
  const fields = psql(`SELECT current_database(), current_user, session_user,
    inet_server_port(), current_setting('server_version_num')`, env).split('|');
  const [db, login, session, port, version] = fields;
  if (db !== (restoring ? E.PHASE12_RESTORE_DB : PRIMARY.db) ||
      login !== env.PGUSER || session !== env.PGUSER || port !== PRIMARY.port ||
      Number(version) < 160000 || Number(version) >= 170000) {
    stop('Live PostgreSQL database/role/port/major differs from approved target');
  }
  return { db, login };
}
function mount(root) {
  const raw = run('findmnt', ['--json', '--target', root, '--output', 'TARGET,SOURCE,FSTYPE']);
  let result;
  try { result = JSON.parse(raw).filesystems?.[0]; } catch { stop('Off-server mount inspection failed'); }
  remoteMount(result, E.PHASE12_EXPECTED_SOURCE, root, os.hostname());
}
function backupRoot() {
  const root = E.PHASE12_BACKUP_ROOT;
  directory(root);
  mount(root);
  regular(E.PHASE12_MANIFEST_PUBLIC_KEY, 0o644);
  regular(E.PHASE12_RESTORE_PUBLIC_KEY, 0o644);
  return root;
}
function assetSource() {
  const dir = E.ATTACHMENT_STORAGE_DIR;
  directory(dir);
  const names = fs.readdirSync(dir);
  for (const name of names) {
    if (!KEY.test(name)) stop('Storage contains an unknown filename; backup stopped');
    regular(path.join(dir, name));
  }
  return { dir, names };
}
function databasePreflight() {
  for (const cmd of ['psql', 'pg_dump', 'pg_dumpall', 'tar', 'age', 'findmnt', 'logger']) tool(cmd);
  const pg = pgEnv();
  identity(pg);
  // pg_dumpall --roles-only must preserve role authentication material, not
  // silently emit unusable redacted passwords. Use only a pre-existing,
  // explicitly approved DBA backup login; never create/grant one here.
  if (psql(`SELECT has_table_privilege(current_user, 'pg_catalog.pg_authid', 'SELECT')`, pg) !== 't') {
    stop('Approved backup login cannot preserve PostgreSQL role authentication material');
  }
  const invalid = psql(`SELECT
    (SELECT count(*) FROM public."FileAttachment" WHERE "storageAdapter" IS DISTINCT FROM 'local') +
    (SELECT count(*) FROM public."DocumentTemplateVersion" WHERE "storageAdapter" IS DISTINCT FROM 'local') +
    (SELECT count(*) FROM public."DocumentTemplate" WHERE "storageAdapter" IS DISTINCT FROM 'local')`, pg);
  if (invalid !== '0') stop('Non-local asset storage is not included; backup cannot continue');
  const source = assetSource();
  const keys = psql(KEYS_SQL, pg).split('\n').filter(Boolean);
  for (const key of keys) {
    if (!KEY.test(key) || !fs.existsSync(path.join(source.dir, key))) {
      stop('A database-referenced private asset is missing; backup cannot continue');
    }
  }
  verifyArtworkHashes(pg, source.dir);
  return { pg, source, keys, counts: rowCounts(pg),
    acl: crypto.createHash('sha256').update(psql(ACL_SQL, pg)).digest('hex') };
}
function backupPreflight() {
  const root = backupRoot();
  positive(E.PHASE12_BACKUP_RETENTION_DAYS, 'Backup retention days');
  positive(E.PHASE12_MAX_AGE_HOURS, 'Backup failure alert threshold (hours)', 876000);
  positive(E.PHASE12_JOB_TIMEOUT_MINUTES, 'Backup subprocess watchdog (minutes)', 10080);
  regular(E.PHASE12_MANIFEST_SIGN_KEY);
  regular(E.PHASE12_ALERT_COMMAND, 0o700);
  if (!/^age1[023456789acdefghjklmnpqrstuvwxyz]{20,}$/.test(E.PHASE12_AGE_RECIPIENT || '')) {
    stop('Approved age public recipient required');
  }
  const pub = fs.readFileSync(E.PHASE12_MANIFEST_PUBLIC_KEY);
  const priv = fs.readFileSync(E.PHASE12_MANIFEST_SIGN_KEY);
  const test = Buffer.from('duna-phase12-key-pair-check');
  if (!crypto.verify(null, test, pub, crypto.sign(null, test, priv))) {
    stop('Manifest signing/public key pair differs');
  }
  const db = databasePreflight();
  return { root, ...db };
}
function wait(child, label) {
  return new Promise((resolve, reject) => {
    child.on('error', () => reject(new BackupStop(`${label} failed to start`)));
    child.on('close', (code) => code === 0 ? resolve() : reject(new BackupStop(`${label} failed`)));
  });
}
async function pipeCommand(sourceBin, sourceArgs, targetBin, targetArgs, sourceEnv, targetEnv,
  outputFile = null, capture = false) {
  const minutes = positive(E.PHASE12_JOB_TIMEOUT_MINUTES, 'Backup subprocess watchdog (minutes)', 10080);
  const fd = outputFile ? fs.openSync(outputFile, 'wx', 0o600) : null;
  const source = spawn(sourceBin, sourceArgs, { env: { ...safeEnv(), ...sourceEnv },
    stdio: ['ignore', 'pipe', 'ignore'] });
  const target = spawn(targetBin, targetArgs, { env: { ...safeEnv(), ...targetEnv },
    stdio: ['pipe', capture ? 'pipe' : fd === null ? 'ignore' : fd, 'ignore'] });
  const chunks = [];
  let length = 0;
  if (capture) target.stdout.on('data', (chunk) => {
    length += chunk.length;
    if (length > 128 * 1024 * 1024) { target.kill(); return; }
    chunks.push(chunk);
  });
  // Errors on a broken pipe must not crash the process before both child
  // failures are observed. An incomplete encrypted file is never published.
  source.stdout.on('error', () => {});
  target.stdin.on('error', () => {});
  source.stdout.pipe(target.stdin);
  let timedOut = false;
  const watchdog = setTimeout(() => {
    timedOut = true;
    source.kill(); target.kill();
  }, minutes * 60000);
  try {
    const result = await Promise.allSettled([wait(source, sourceBin), wait(target, targetBin)]);
    if (timedOut || result.some((r) => r.status === 'rejected') || length > 128 * 1024 * 1024) {
      stop(`${sourceBin}/${targetBin} pipeline failed`);
    }
    if (fd !== null) fs.fsyncSync(fd);
    return capture ? Buffer.concat(chunks).toString('utf8') : '';
  } finally {
    clearTimeout(watchdog);
    if (source.exitCode === null) source.kill();
    if (target.exitCode === null) target.kill();
    if (fd !== null) fs.closeSync(fd);
  }
}
function durable(file) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY);
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function hashFile(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let size;
    while ((size = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, size));
  } finally { fs.closeSync(fd); }
  return { sha256: hash.digest('hex'), bytes: fs.statSync(file).size };
}
function manifestAt(root, id, primaryOnly = false) {
  if (!BACKUP_ID.test(id)) stop('Invalid backup id');
  const dir = path.join(root, id);
  directory(dir);
  regular(path.join(dir, 'manifest.json'));
  regular(path.join(dir, 'manifest.sig'));
  const bytes = fs.readFileSync(path.join(dir, 'manifest.json'));
  const sig = fs.readFileSync(path.join(dir, 'manifest.sig'));
  const data = validateManifest(bytes, sig, fs.readFileSync(E.PHASE12_MANIFEST_PUBLIC_KEY), id,
    primaryOnly ? os.hostname() : undefined);
  for (const name of FILES) {
    regular(path.join(dir, name));
    const actual = hashFile(path.join(dir, name));
    if (actual.sha256 !== data.files[name].sha256 || actual.bytes !== data.files[name].bytes) {
      stop('Encrypted backup checksum differs from the signed manifest');
    }
  }
  return { dir, data };
}
function listBackups(root) {
  const names = fs.readdirSync(root);
  const ids = names.filter((name) => BACKUP_ID.test(name));
  if (names.some((name) => name.startsWith('.partial-'))) {
    stop('Incomplete off-server backup present; inspect the failed run without deleting evidence');
  }
  if (names.some((name) => !BACKUP_ID.test(name) && name !== '.phase12.lock' &&
      name !== 'restore-receipts')) {
    stop('Unknown object in the off-server backup directory; inspect without deleting');
  }
  return ids.sort();
}
async function backup() {
  log('backup-preflight-start');
  const { root, pg, source, keys, counts, acl } = backupPreflight();
  const lock = path.join(root, '.phase12.lock');
  const lockFd = fs.openSync(lock, 'wx', 0o600); // stale lock requires human inspection
  let tmp = null;
  try {
    log('backup-start');
    const now = new Date();
    const id = `b-${now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${crypto.randomBytes(6).toString('hex')}`;
    tmp = fs.mkdtempSync(path.join(root, '.partial-'));
    fs.chmodSync(tmp, 0o700);
    const jobs = [
      ['database.dump.age', 'pg_dump', ['--format=custom', '--no-password', '--lock-wait-timeout=5s']],
      ['roles.sql.age', 'pg_dumpall', ['--roles-only', '--no-password', '-l', PRIMARY.db]],
      ['assets.tar.age', 'tar', ['--create', '--file=-', '--one-file-system', '-C', source.dir, '.']],
    ];
    for (const [name, bin, args] of jobs) {
      await pipeCommand(bin, args, 'age', ['-r', E.PHASE12_AGE_RECIPIENT],
        bin === 'tar' ? safeEnv() : pg, safeEnv(), path.join(tmp, name));
    }
    const aclAfter = crypto.createHash('sha256').update(psql(ACL_SQL, pg)).digest('hex');
    if (aclAfter !== acl) stop('Database access-control inventory changed during backup');
    const sourceAfter = assetSource();
    verifyArtworkHashes(pg, sourceAfter.dir);
    const keysAfter = psql(KEYS_SQL, pg).split('\n').filter(Boolean);
    if (source.names.slice().sort().join('\n') !== sourceAfter.names.slice().sort().join('\n') ||
        keys.join('\n') !== keysAfter.join('\n') ||
        JSON.stringify(counts) !== JSON.stringify(rowCounts(pg))) {
      stop('Private assets or signed row counts changed during backup; retry in a reviewed quiet window');
    }
    const files = Object.fromEntries(FILES.map((name) => [name, hashFile(path.join(tmp, name))]));
    const data = { version: 1, id, createdAt: now.toISOString(), database: PRIMARY.db,
      primaryHost: os.hostname(), pgMajor: 16, storageKind: 'local',
      storageFiles: source.names.length, aclSha256: acl, rowCounts: counts, files };
    const bytes = Buffer.from(JSON.stringify(data) + '\n');
    fs.writeFileSync(path.join(tmp, 'manifest.json'), bytes, { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(path.join(tmp, 'manifest.sig'), crypto.sign(null, bytes,
      fs.readFileSync(E.PHASE12_MANIFEST_SIGN_KEY)), { flag: 'wx', mode: 0o600 });
    const checked = validateManifest(bytes, fs.readFileSync(path.join(tmp, 'manifest.sig')),
      fs.readFileSync(E.PHASE12_MANIFEST_PUBLIC_KEY), id);
    if (checked.aclSha256 !== acl) stop('Backup manifest access-control inventory differs');
    durable(path.join(tmp, 'manifest.json'));
    durable(path.join(tmp, 'manifest.sig'));
    durable(tmp);
    fs.renameSync(tmp, path.join(root, id));
    durable(root);
    tmp = null;
    log('backup-encrypted-and-signed-restore-NOT-PROVEN', id);
    console.log(`BACKUP_COMPLETE ${id}; ciphertext/signature verified; RESTORE_NOT_PROVEN`);
  } finally {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); // only this run's incomplete directory
    fs.closeSync(lockFd);
    fs.unlinkSync(lock);
  }
}
async function decryptTo(dir, file, bin, args, env, capture = false) {
  regular(E.PHASE12_AGE_IDENTITY_FILE);
  const encrypted = path.join(dir, file);
  return pipeCommand('age', ['-d', '-i', E.PHASE12_AGE_IDENTITY_FILE, encrypted],
    bin, args, safeEnv(), env, null, capture);
}
async function verifyArchive(dir) {
  tool('pg_restore');
  await decryptTo(dir, 'database.dump.age', 'pg_restore', ['--list'], safeEnv());
  await decryptTo(dir, 'roles.sql.age', 'wc', ['-c'], safeEnv());
  const names = (await decryptTo(dir, 'assets.tar.age', 'tar', ['--list', '--file=-'], safeEnv(), true))
    .trimEnd().split('\n');
  const verbose = (await decryptTo(dir, 'assets.tar.age', 'tar', ['--list', '--verbose', '--file=-'], safeEnv(), true))
    .trimEnd().split('\n');
  const types = verbose.map((line) => line[0]);
  return archiveEntries(names, types);
}
async function verifyBackup(root, id) {
  log('backup-access-verify', id);
  const { dir, data } = manifestAt(root, id, !E.PHASE12_AGE_IDENTITY_FILE);
  if (E.PHASE12_AGE_IDENTITY_FILE) {
    const count = await verifyArchive(dir);
    if (count !== data.storageFiles) stop('Asset file count differs from signed manifest');
    console.log(`BACKUP_CIPHERTEXT_AND_CONTENTS_VERIFIED ${id}; RESTORE_NOT_PROVEN`);
  } else {
    console.log(`BACKUP_CIPHERTEXT_VERIFIED ${id}; RESTORE_NOT_PROVEN`);
  }
}
function restorePreflight(data) {
  if (E.PHASE12_RESTORE_APPROVAL !== 'I_AUTHORIZE_ISOLATED_RESTORE' ||
      E.PHASE12_GLOBALS_APPROVAL !== 'I_AUTHORIZE_RESTORING_ROLES' ||
      os.hostname() === data.primaryHost || !E.PHASE12_RESTORE_DB ||
      E.PHASE12_RESTORE_DB === PRIMARY.db || !/^[a-z][a-z0-9_]{3,62}$/.test(E.PHASE12_RESTORE_DB)) {
    stop('Explicit isolated-host, empty-database and role-restore approval required');
  }
  regular(E.PHASE12_AGE_IDENTITY_FILE);
  regular(E.PHASE12_RESTORE_SIGN_KEY);
  const token = Buffer.from('duna-phase12-rehearsal-receipt');
  if (!crypto.verify(null, token, fs.readFileSync(E.PHASE12_RESTORE_PUBLIC_KEY),
      crypto.sign(null, token, fs.readFileSync(E.PHASE12_RESTORE_SIGN_KEY)))) {
    stop('Isolated restore signing/public key pair differs');
  }
  directory(E.PHASE12_RESTORE_STORAGE_DIR);
  if (E.PHASE12_RESTORE_STORAGE_DIR === E.PHASE12_BACKUP_ROOT ||
      E.PHASE12_RESTORE_STORAGE_DIR.startsWith(E.PHASE12_BACKUP_ROOT + path.sep)) {
    stop('Isolated restore assets must not be extracted into off-server backup storage');
  }
  if (fs.readdirSync(E.PHASE12_RESTORE_STORAGE_DIR).length) stop('Restore storage must be empty');
  const pg = pgEnv(true);
  identity(pg, true);
  const state = psql(`SELECT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user),
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')),
    (SELECT count(*) FROM pg_roles WHERE rolname IN ('shipping', 'shipping_runtime_p11',
      'shipping_audit_export_p11'))`, pg).split('|');
  if (state.join('|') !== 't|0|0') stop('Restore target is not an empty isolated DB with a fresh role inventory');
  return pg;
}
async function restore(root, id) {
  log('isolated-restore-inspect', id);
  const { dir, data } = manifestAt(root, id);
  const pg = restorePreflight(data); // MUST precede all writes
  log('isolated-restore-start', id);
  const files = await verifyArchive(dir); // authenticated decryption and safe tar paths
  if (files !== data.storageFiles) stop('Asset archive contents differ from signed manifest');
  // No --clean, no --create, no owner/ACL stripping: isolated DBA-provisioned
  // scratch DB only. SQL roles and schema ownership/ACLs must survive intact.
  await decryptTo(dir, 'roles.sql.age', 'psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1',
    '--single-transaction', '--no-password', '-f', '/dev/stdin'], pg);
  await decryptTo(dir, 'database.dump.age', 'pg_restore', ['--exit-on-error',
    '--single-transaction', '--no-password', '-d', E.PHASE12_RESTORE_DB], pg);
  await decryptTo(dir, 'assets.tar.age', 'tar', ['--extract', '--file=-',
    '--no-same-owner', '--no-same-permissions', '-C', E.PHASE12_RESTORE_STORAGE_DIR], safeEnv());
  const acl = crypto.createHash('sha256').update(psql(ACL_SQL, pg)).digest('hex');
  if (acl !== data.aclSha256) stop('Restored table ownership or ACLs differ from production backup');
  if (JSON.stringify(rowCounts(pg)) !== JSON.stringify(data.rowCounts)) {
    stop('Restored business/finance/audit/asset row counts differ from signed backup');
  }
  const protectedState = psql(`SELECT
    (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public."AuditLog"'::regclass
      AND tgenabled = 'A' AND tgname IN
      ('phase11_audit_no_update_delete','phase11_audit_no_truncate')),
    (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public."RetentionPolicy"'::regclass
      AND tgenabled = 'A' AND tgname IN
      ('phase12_retention_no_reduction','phase12_retention_no_truncate')),
    (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public."letters"'::regclass
      AND tgenabled = 'A' AND tgname = 'phase12_letter_no_archive_delete_bypass'),
    has_table_privilege('shipping_runtime_p11', 'public."AuditLog"', 'UPDATE'),
    has_table_privilege('shipping_runtime_p11', 'public."RetentionPolicy"', 'DELETE'),
    has_table_privilege('shipping_runtime_p11', 'public."RetentionPolicy"', 'SELECT'),
    has_table_privilege('shipping_runtime_p11', 'public."RetentionPolicy"', 'INSERT')`, pg);
  if (protectedState !== '2|2|1|f|f|t|t') stop('Restored audit/retention triggers or runtime privileges differ');
  const keys = psql(KEYS_SQL, pg).split('\n').filter(Boolean);
  for (const key of keys) {
    if (!KEY.test(key) || !fs.existsSync(path.join(E.PHASE12_RESTORE_STORAGE_DIR, key))) {
      stop('Restored database references a missing private asset');
    }
  }
  verifyArtworkHashes(pg, E.PHASE12_RESTORE_STORAGE_DIR);
  writeReceipt(root, data, keys.length);
  log('isolated-restore-verified', id);
  console.log(`ISOLATED_RESTORE_OBJECT_ACL_VERIFIED ${id}; source DB was never a restore destination. DBA must separately attest database-level ACL/ownership and full RTO.`);
}
function receiptDirectory(root, create = false) {
  const dir = path.join(root, 'restore-receipts');
  if (create && !fs.existsSync(dir)) fs.mkdirSync(dir, { mode: 0o700 });
  directory(dir);
  return dir;
}
function writeReceipt(root, manifest, references) {
  const dir = receiptDirectory(root, true);
  const target = path.join(dir, manifest.id);
  if (fs.existsSync(target + '.json') || fs.existsSync(target + '.sig')) {
    stop('Restore receipt already exists; do not overwrite a prior rehearsal');
  }
  const body = Buffer.from(JSON.stringify({ version: 1, backupId: manifest.id,
    restoredAt: new Date().toISOString(), primaryHost: manifest.primaryHost,
    isolatedHost: os.hostname(), database: E.PHASE12_RESTORE_DB,
    aclSha256: manifest.aclSha256,
    manifestSha256: hashFile(path.join(root, manifest.id, 'manifest.json')).sha256,
    references }) + '\n');
  const sig = crypto.sign(null, body, fs.readFileSync(E.PHASE12_RESTORE_SIGN_KEY));
  fs.writeFileSync(target + '.json', body, { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(target + '.sig', sig, { flag: 'wx', mode: 0o600 });
  durable(target + '.json'); durable(target + '.sig'); durable(dir);
}
function receipts(root) {
  const dir = receiptDirectory(root);
  const names = fs.readdirSync(dir);
  if (names.some((name) => !BACKUP_ID.test(name.replace(/\.(json|sig)$/, '')) ||
      !/\.(json|sig)$/.test(name))) stop('Unrecognised restore receipt; inspect before pruning');
  const ids = [...new Set(names.map((name) => name.replace(/\.(json|sig)$/, '')))];
  return ids.map((id) => {
    regular(path.join(dir, id + '.json'));
    regular(path.join(dir, id + '.sig'));
    const bytes = fs.readFileSync(path.join(dir, id + '.json'));
    if (bytes.length > 4096 || !crypto.verify(null, bytes,
      fs.readFileSync(E.PHASE12_RESTORE_PUBLIC_KEY), fs.readFileSync(path.join(dir, id + '.sig')))) {
      stop('Isolated-restore receipt signature invalid');
    }
    let data;
    try { data = JSON.parse(bytes.toString('utf8')); } catch { stop('Restore receipt invalid'); }
    // Expired rehearsed copies may be pruned after a newer signed restore.
    // Keep the signed receipt as historical evidence, binding it to the
    // original manifest hash even when the encrypted copy has expired.
    const manifest = fs.existsSync(path.join(root, id)) ? manifestAt(root, id, true).data : null;
    if (data.version !== 1 || data.backupId !== id ||
        (manifest && (data.primaryHost !== manifest.primaryHost ||
          data.aclSha256 !== manifest.aclSha256 ||
          data.manifestSha256 !== hashFile(path.join(root, id, 'manifest.json')).sha256)) ||
        typeof data.primaryHost !== 'string' || !data.primaryHost ||
        !/^[a-f0-9]{64}$/.test(data.aclSha256 || '') ||
        !/^[a-f0-9]{64}$/.test(data.manifestSha256 || '') ||
        data.isolatedHost === data.primaryHost ||
        typeof data.isolatedHost !== 'string' || !data.isolatedHost ||
        typeof data.database !== 'string' || data.database === PRIMARY.db ||
        !Number.isSafeInteger(data.references) || data.references < 0 ||
        typeof data.restoredAt !== 'string' || !Number.isFinite(Date.parse(data.restoredAt))) {
      stop('Restore receipt does not match signed backup and isolation requirements');
    }
    return data;
  });
}
function status(root) {
  log('backup-freshness-inspect');
  const ids = listBackups(root);
  if (!ids.length) stop('No completed backups on off-server storage');
  const newest = ids.at(-1);
  const { data } = manifestAt(root, newest, true);
  const maxHours = positive(E.PHASE12_MAX_AGE_HOURS, 'Backup alert threshold (hours)', 876000);
  if (Date.now() - Date.parse(data.createdAt) > maxHours * 3600000) stop('Latest signed backup is stale');
  const restored = receipts(root).sort((a, b) => a.restoredAt.localeCompare(b.restoredAt)).at(-1);
  const interval = positive(E.PHASE12_RESTORE_INTERVAL_DAYS, 'Restore rehearsal interval (days)');
  if (!restored || Date.now() - Date.parse(restored.restoredAt) > interval * 86400000 ||
      !ids.includes(restored.backupId)) {
    stop('No current signed, independently executed restore with a retained backup copy');
  }
  log('backup-and-restore-freshness-verified', newest);
  console.log(`BACKUP_AND_OBJECT_RESTORE_FRESHNESS_VERIFIED ${newest} rehearsal=${restored.backupId}; database-level ACL requires independent DBA review.`);
}
function prune(root) {
  log('offsite-prune-inspect');
  const entries = listBackups(root).map((id) => {
    const { data } = manifestAt(root, id, true);
    return { id, createdAt: data.createdAt, verified: true };
  });
  const latestRestore = receipts(root).sort((a, b) => a.restoredAt.localeCompare(b.restoredAt)).at(-1);
  const ids = selectPrune(entries, Date.now(), E.PHASE12_BACKUP_RETENTION_DAYS,
    latestRestore?.backupId);
  if (E.PHASE12_PRUNE_APPROVAL !== 'I_APPROVE_OFFSITE_RETENTION') {
    console.log(`PRUNE_DRY_RUN ${ids.join(' ') || 'none'}; no backup removed`);
    return;
  }
  log('offsite-prune-start');
  for (const id of ids) {
    // Only signed, age-expired backup directories; never the last or tested one.
    fs.rmSync(path.join(root, id), { recursive: true });
    log('offsite-pruned', id);
  }
  console.log(`PRUNE_COMPLETE ${ids.length} signed backup(s); newest and restored copy retained.`);
}
async function main() {
  const [mode, id] = process.argv.slice(2);
  if (!['preflight', 'backup', 'verify', 'status', 'restore', 'prune', 'alert-test'].includes(mode) ||
      ((mode === 'verify' || mode === 'restore') !== !!id) || process.argv.length > (id ? 4 : 3)) {
    stop('Usage: backup.cjs preflight|backup|verify ID|status|restore ID|prune|alert-test');
  }
  if (mode === 'alert-test') {
    regular(E.PHASE12_ALERT_COMMAND, 0o700);
    const ok = spawnSync(E.PHASE12_ALERT_COMMAND, ['phase12-alert-test', 'TEST'],
      { stdio: 'ignore', timeout: 30000 });
    if (ok.status !== 0) stop('Alert test failed; confirm actual delivery independently');
    log('alert-test-executed');
    console.log('ALERT_TEST_SUBMITTED; independently confirm receipt before scheduling.');
    return;
  }
  if (mode === 'preflight') {
    log('read-only-backup-preflight-start');
    backupPreflight();
    log('read-only-backup-preflight-pass');
    console.log('PREFLIGHT_PASS: approved DB identity, private assets, encrypted off-server mount and notifier inspected; no dump or restore executed.');
  } else if (mode === 'backup') await backup();
  else {
    const root = backupRoot();
    if (mode === 'verify') await verifyBackup(root, id);
    if (mode === 'status') status(root);
    if (mode === 'restore') await restore(root, id);
    if (mode === 'prune') prune(root);
  }
}
main().catch((error) => {
  console.error('PHASE12_BACKUP_FAIL:', error instanceof BackupStop ? error.message :
    'Protected operation failed; inspect restricted logs without exposing credentials or asset contents');
  if (['backup', 'status', 'restore', 'prune'].includes(process.argv[2])) alert(process.argv[2]);
  process.exitCode = 1;
});
