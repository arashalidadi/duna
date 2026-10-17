'use strict';
// Owner/server-only connection resolution and independent Docker identity proof.
// Never print a URL, password, Docker environment, SQL rows or raw child error.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DbStop } = require('./db-policy.cjs');
const HOST = '127.0.0.1';
const DB = 'duna_seed_test';
const CONTAINER = 'erp-postgres';
function stop(message) { throw new DbStop(message); }
function exactUrl(raw, role) {
  let url;
  try { url = new URL(raw); } catch { stop(`${role} credential is missing or malformed (value suppressed)`); }
  try {
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== HOST ||
        url.port !== '5432' || url.pathname !== `/${DB}` ||
        decodeURIComponent(url.username) !== role || !url.password ||
        url.searchParams.getAll('schema').length > 1 ||
        (url.searchParams.get('schema') ?? 'public') !== 'public' ||
        url.hash) stop(`${role} credential is not the approved PostgreSQL 16 endpoint/role/public schema`);
  } catch (error) {
    if (error instanceof DbStop) throw error;
    stop(`${role} credential has invalid encoding (value suppressed)`);
  }
  return raw;
}
function envFile(file) {
  if (!fs.existsSync(file)) return {};
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const values = {};
  for (const line of lines) {
    const found = line.match(/^\s*(?:export\s+)?(DATABASE_URL|MIGRATOR_DATABASE_URL)\s*=\s*(.*?)\s*$/);
    if (!found) continue;
    let value = found[2];
    if ((value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))) value = value.slice(1, -1);
    if (values[found[1]] !== undefined) stop(`Duplicate ${found[1]} in existing configuration; inspect privately`);
    values[found[1]] = value;
  }
  return values;
}
function pgpassPassword(file) {
  if (!file || !fs.existsSync(file)) return null;
  const stats = fs.statSync(file);
  if (!stats.isFile() || stats.uid !== process.getuid() || (stats.mode & 0o077)) {
    stop('Existing PostgreSQL passfile must be owned by the invoking account and inaccessible to group/others');
  }
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const parts = []; let part = ''; let escape = false;
    for (const char of line) {
      if (escape) { part += char; escape = false; }
      else if (char === '\\') escape = true;
      else if (char === ':' && parts.length < 4) { parts.push(part); part = ''; }
      else part += char;
    }
    parts.push(part);
    if (parts.length === 5 && parts.slice(0, 4).join(':') === `${HOST}:5432:${DB}:shipping` && parts[4]) {
      return parts[4];
    }
  }
  return null;
}
function inspectContainer(run = spawnSync) {
  const result = run('docker', ['inspect', CONTAINER], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000, maxBuffer: 512 * 1024,
  });
  if (result.error || result.status !== 0) stop('Cannot inspect running erp-postgres Docker container');
  let info;
  try { info = JSON.parse(result.stdout)[0]; } catch { stop('Docker returned an invalid container inspection'); }
  const mappings = info?.NetworkSettings?.Ports?.['5432/tcp'];
  if (info?.Name !== `/${CONTAINER}` || info?.State?.Running !== true ||
      !Array.isArray(mappings) || !mappings.some((x) =>
        x.HostPort === '5432' && ['127.0.0.1', '0.0.0.0', '::'].includes(x.HostIp))) {
    stop('erp-postgres is not running with the approved localhost PostgreSQL port mapping');
  }
  const environment = Object.fromEntries((info.Config?.Env || []).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
  const version = run('docker', ['exec', CONTAINER, 'psql', '--version'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000, maxBuffer: 4096,
  });
  if (version.error || version.status !== 0 || !/^psql \(PostgreSQL\) 16\./.test(version.stdout.trim())) {
    stop('PostgreSQL 16 client is unavailable inside the approved container');
  }
  return { environment }; // secret metadata is memory-only; never serialized
}
function connections(env, root, container) {
  const config = [envFile(path.join(root, 'apps/api/.env')), envFile(path.join(root, '.env'))];
  const find = (key) => config.map((values) => values[key]).find((value) => value !== undefined);
  const runtime = exactUrl(env.DATABASE_URL || find('DATABASE_URL'), 'shipping_runtime_p11');
  let owner = env.MIGRATOR_DATABASE_URL || find('MIGRATOR_DATABASE_URL');
  if (!owner) {
    const fileUrl = find('DATABASE_URL');
    if (fileUrl) {
      try { if (decodeURIComponent(new URL(fileUrl).username) === 'shipping') owner = fileUrl; }
      catch { stop('Existing configuration contains an invalid migration credential'); }
    }
  }
  if (!owner) {
    const password = pgpassPassword(env.PGPASSFILE || path.join(os.homedir(), '.pgpass'));
    if (password) owner = `postgresql://shipping:${encodeURIComponent(password)}@${HOST}:5432/${DB}?schema=public`;
  }
  if (!owner && container.environment.POSTGRES_USER === 'shipping' &&
      container.environment.POSTGRES_PASSWORD) {
    owner = `postgresql://shipping:${encodeURIComponent(container.environment.POSTGRES_PASSWORD)}@${HOST}:5432/${DB}?schema=public`;
  }
  if (!owner) stop('Missing existing shipping-owner credential: supply MIGRATOR_DATABASE_URL securely; runtime DATABASE_URL must remain unchanged');
  exactUrl(owner, 'shipping');
  if (owner === runtime) stop('Migration-owner and runtime credentials must be distinct');
  return { owner, runtime };
}
function dockerQuery(sql, container, run = spawnSync, requiredRole = null) {
  const preferred = container.environment.POSTGRES_USER;
  if (requiredRole && !['postgres', 'shipping'].includes(requiredRole)) stop('Unapproved container DBA identity');
  const roles = requiredRole ? [requiredRole] :
    [...new Set([preferred, 'postgres', 'shipping'].filter((r) =>
      ['postgres', 'shipping'].includes(r)))];
  for (const role of roles) {
    // Local socket authentication first. No passwords in argv/stdout or Docker exec -e.
    const args = ['exec', '-i', '-u', 'postgres', CONTAINER, 'psql', '-X', '-A', '-t',
      '-v', 'ON_ERROR_STOP=1', '--no-password', '-U', role, '-d', DB];
    let result = run('docker', args, { input: sql, encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
    if (result.status === 0) return { output: result.stdout.trim(), role };
    // A Docker image configured for password-only socket auth may expose its
    // existing bootstrap secret through its own protected environment. The
    // shell script is constant; no credential is interpolated into argv.
    if (role === preferred && container.environment.POSTGRES_PASSWORD) {
      result = run('docker', ['exec', '-i', '-u', 'postgres', CONTAINER, 'sh', '-c',
        'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -h 127.0.0.1 -X -A -t -v ON_ERROR_STOP=1 --no-password -U "$POSTGRES_USER" -d duna_seed_test'],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
      if (result.status === 0) return { output: result.stdout.trim(), role };
    }
  }
  stop('Cannot run read-only PostgreSQL 16 psql inside erp-postgres on duna_seed_test; approved local DBA socket access required');
}
function inspectSession(container, pid, nonce, run = spawnSync, requiredRole = null) {
  if (!Number.isSafeInteger(pid) || pid < 1 || !/^phase12-[a-f0-9]{24}$/.test(nonce)) {
    stop('Invalid host/backend correlation token');
  }
  const sql = `SELECT json_build_object(
    'match', current_database() = '${DB}' AND current_setting('port')::int = 5432
      AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999
      AND EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid = ${pid}
        AND datname = '${DB}' AND usename = 'shipping' AND application_name = '${nonce}'),
    'journalOwner', (SELECT pg_get_userbyid(c.relowner) FROM pg_class c
      WHERE c.oid = 'public._prisma_migrations'::regclass),
    'history', (SELECT coalesce(json_agg(json_build_object('name', migration_name,
      'checksum', checksum, 'finished', finished_at IS NOT NULL,
      'rolledback', rolled_back_at IS NOT NULL) ORDER BY started_at, id), '[]'::json)
      FROM public._prisma_migrations))::text;`;
  const result = dockerQuery(sql, container, run, requiredRole);
  let data;
  try { data = JSON.parse(result.output); } catch { stop('Docker PostgreSQL identity/journal inspection returned invalid data'); }
  if (data.match !== true || !Array.isArray(data.history) || !data.journalOwner) {
    stop('Host owner session did not correlate to erp-postgres PG16 and its migration journal');
  }
  return { ...data, adminRole: result.role };
}
function journalGrantSql(pid, nonce, journalOwner) {
  if (!Number.isSafeInteger(pid) || pid < 1 || !/^phase12-[a-f0-9]{24}$/.test(nonce) ||
      !['shipping','postgres'].includes(journalOwner)) stop('Journal grant scope is not approved');
  return `DO $phase12$ BEGIN
    IF current_database() <> '${DB}' OR current_setting('port')::int <> 5432
      OR current_setting('server_version_num')::int NOT BETWEEN 160000 AND 169999
      OR NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid = ${pid}
        AND datname = '${DB}' AND usename = 'shipping' AND application_name = '${nonce}')
      OR (SELECT pg_get_userbyid(c.relowner) FROM pg_class c
        WHERE c.oid = 'public._prisma_migrations'::regclass) IS DISTINCT FROM '${journalOwner}'
      OR has_table_privilege('shipping_runtime_p11', 'public._prisma_migrations', 'SELECT')
      OR has_table_privilege('shipping_runtime_p11', 'public._prisma_migrations', 'INSERT')
      OR has_table_privilege('shipping_runtime_p11', 'public._prisma_migrations', 'UPDATE')
      OR has_table_privilege('shipping_runtime_p11', 'public._prisma_migrations', 'DELETE')
    THEN RAISE EXCEPTION 'Phase 12 journal-grant target changed'; END IF;
    GRANT SELECT, INSERT, UPDATE ON TABLE public._prisma_migrations TO shipping;
  END $phase12$;`;
}
module.exports = { HOST, DB, CONTAINER, exactUrl, envFile, pgpassPassword,
  inspectContainer, connections, dockerQuery, inspectSession, journalGrantSql };
