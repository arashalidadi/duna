#!/usr/bin/env node
/**
 * Only manage THIS checkout's PID-file API and Web processes. PostgreSQL is
 * externally managed. No pkill, process-name search, ownership change, DB
 * query or unconditional kill; unknown listeners/PIDs are a hard stop.
 */
import { spawn, spawnSync } from 'node:child_process';
import { apiStartupEnv } from './duna.mjs';
import {
  closeSync,
  existsSync,
  ftruncateSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveApiPort } from './dev-api-port.mjs';
import { apiDotenvSource, verifyApiTarget } from './check-phase11-api-target.mjs';
import { verifyApiBuild } from './check-api-build.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const pause = (ms) => new Promise((done) => setTimeout(done, ms));

function portFor(name, root) {
  if (name === 'web') return 3000;
  return resolveApiPort(process.env, apiDotenvSource(root));
}

export function listenerPids(text, port) {
  const rows = text
    .split('\n')
    .filter((line) => line.trim() && new RegExp(`:${port}(?:\\s|$)`).test(line));
  const pids = new Set();
  let hidden = false;
  for (const row of rows) {
    const found = [...row.matchAll(/\bpid=(\d+)\b/g)];
    if (found.length === 0) hidden = true;
    for (const match of found) pids.add(Number(match[1]));
  }
  return { occupied: rows.length > 0, pids: [...pids], hidden };
}

function listening(port) {
  const result = spawnSync('ss', ['-H', '-ltnp', `( sport = :${port} )`], {
    encoding: 'utf8',
    timeout: 5000,
  });
  if (result.status !== 0 || result.error)
    throw new Error(`Cannot inspect listener on :${port}; install ss or check OS access`);
  return listenerPids(result.stdout, port);
}

function processInfo(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat
      .slice(stat.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/);
    if (fields[0] === 'Z') {
      return { pid, ppid: Number(fields[1]), startTicks: fields[19], state: 'Z' };
    }
    const args = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean);
    return {
      pid,
      ppid: Number(fields[1]),
      startTicks: fields[19],
      state: fields[0],
      exe: realpathSync(`/proc/${pid}/exe`),
      cwd: realpathSync(`/proc/${pid}/cwd`),
      args,
    };
  } catch {
    // EACCES/hidepid must NOT be treated as a dead process: that would allow
    // an operator to delete a live PID file or signal an unrelated listener.
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error?.code === 'ESRCH') return null;
    }
    throw new Error(`Cannot inspect PID ${pid}; no process or PID file touched`);
  }
}

export function matchesManagedProcess(info, name, root = repo) {
  if (!info || info.state === 'Z' || info.exe !== realpathSync(process.execPath)) return false;
  const cwd = resolve(root, name === 'api' ? 'apps/api' : 'apps/web');
  if (info.cwd !== cwd) return false;
  if (name === 'api') {
    if (info.args.length < 2) return false;
    return resolve(cwd, info.args[1]) === resolve(root, 'apps/api/dist/src/main.js');
  }
  // `next start` renames its own process title to "next-server (vX)", so its argv
  // is no longer readable. The port owner, cwd and executable are still checked,
  // and the listener must still descend from the PID this manager recorded.
  if (info.args.length === 1 && /^next-server \(v[0-9]/.test(info.args[0])) return true;
  if (info.args.length < 2) return false;
  if (resolve(cwd, info.args[1]) !== resolve(root, 'apps/web/node_modules/next/dist/bin/next'))
    return false;
  // A Web process owned by this manager must be a direct Next process, not a
  // pnpm/nest/shell wrapper with a differently owned listener.
  const mode = process.env.DUNA_WEB_MODE === 'development' ? 'dev' : 'start';
  return JSON.stringify(info.args.slice(2)) ===
    JSON.stringify([mode, '-p', '3000', '-H', '0.0.0.0']);
}

function descendedFrom(pid, ancestor) {
  for (let depth = 0; depth < 64 && pid > 1; depth++) {
    if (pid === ancestor) return true;
    const info = processInfo(pid);
    if (!info || info.ppid === pid) return false;
    pid = info.ppid;
  }
  return false;
}

function processBuildFingerprint(pid) {
  try {
    const matches = readFileSync(`/proc/${pid}/environ`, 'utf8')
      .split('\0')
      .filter((line) => line.startsWith('DUNA_API_BUILD_SHA256='));
    return matches.length === 1 ? matches[0].slice('DUNA_API_BUILD_SHA256='.length) : null;
  } catch {
    return null;
  }
}

function pidFile(root, name) {
  return join(root, 'logs', `${name}.pid`);
}

function readPid(root, name) {
  const contents = readFileSync(pidFile(root, name), 'utf8');
  if (!/^[1-9][0-9]*\n?$/.test(contents))
    throw new Error(`${name} PID file is malformed; no process will be touched`);
  const pid = Number(contents.trim());
  if (!Number.isSafeInteger(pid)) throw new Error(`${name} PID file is not a safe integer`);
  return pid;
}

export function attestRunningApi(pid, root = repo) {
  if (!Number.isSafeInteger(pid) || pid <= 0)
    throw new Error('Provide the actual API listener PID');
  const port = portFor('api', root);
  const socket = listening(port);
  const info = processInfo(pid);
  if (
    !socket.occupied ||
    socket.hidden ||
    socket.pids.length !== 1 ||
    socket.pids[0] !== pid ||
    !matchesManagedProcess(info, 'api', root)
  ) {
    throw new Error(
      'PID, canonical entry, cwd and actual API listener do not match; no process touched'
    );
  }
  if (processBuildFingerprint(pid) !== verifyApiBuild(root).fingerprint) {
    throw new Error(
      'Running API build marker differs from the currently attested output; no process touched'
    );
  }
  return { pid, port, entry: 'apps/api/dist/src/main.js', build: 'current' };
}

export function inspectService(name, root = repo) {
  if (!['api', 'web'].includes(name)) throw new Error('Choose api or web');
  const port = portFor(name, root);
  const socket = listening(port);
  if (!existsSync(pidFile(root, name)))
    return { name, port, state: socket.occupied ? 'unmanaged' : 'free', listeners: socket.pids };
  let pid;
  try {
    pid = readPid(root, name);
  } catch {
    return { name, port, state: 'invalid-pidfile', listeners: socket.pids };
  }
  const info = processInfo(pid);
  if (!info) return { name, port, pid, state: 'stale-pidfile', listeners: socket.pids };
  if (
    !matchesManagedProcess(info, name, root) ||
    !socket.occupied ||
    socket.hidden ||
    !socket.pids.length ||
    socket.pids.some((listener) =>
      name === 'api' ? listener !== pid : !descendedFrom(listener, pid)
    )
  ) {
    return { name, port, pid, state: 'unverified-identity', listeners: socket.pids };
  }
  let build = 'not-applicable';
  if (name === 'api') {
    try {
      build =
        processBuildFingerprint(pid) === verifyApiBuild(root).fingerprint
          ? 'current'
          : 'unverified-or-stale';
    } catch {
      build = 'unverified-or-stale';
    }
  }
  return {
    name,
    port,
    pid,
    startTicks: info.startTicks,
    state: 'managed',
    build,
    listeners: socket.pids,
  };
}

function format(status) {
  const entry =
    status.name === 'api'
      ? 'apps/api/dist/src/main.js'
      : `Next ${process.env.DUNA_WEB_MODE === 'development' ? 'dev' : 'start'}`;
  return (
    `[${status.name}] ${status.state} port=${status.port}` +
    (status.pid ? ` pid=${status.pid}` : '') +
    (status.listeners?.length ? ` listenerPid=${status.listeners.join(',')}` : '') +
    (status.state === 'managed' ? ` entry=${entry} build=${status.build}` : '')
  );
}

function select(choice) {
  if (choice === 'api') return ['api'];
  if (choice === 'web') return ['web'];
  if (choice === 'apps') return ['api', 'web'];
  throw new Error('Choose api, web or apps; PostgreSQL is never managed here');
}

function preflight(action, names, root) {
  const statuses = names.map((name) => inspectService(name, root));
  statuses.forEach((status) => console.log(format(status)));
  for (const item of statuses) {
    if (!['free', 'managed'].includes(item.state)) {
      throw new Error(
        `${item.name}: occupied/unknown/stale PID or port; use the actual owner process manager; no processes changed`
      );
    }
    if (action === 'stop' && item.state === 'free') continue;
    if (item.name === 'api' && action !== 'stop') {
      verifyApiBuild(root);
      verifyApiTarget(root);
    }
    if (
      action === 'start' &&
      item.state === 'managed' &&
      item.name === 'api' &&
      item.build !== 'current'
    ) {
      throw new Error(
        'API already running an unproven/older build; inspect its PID and use an approved API-only restart'
      );
    }
  }
  return statuses;
}

async function checkWeb(port) {
  // Next dev may compile /en/login on its first request. Do not mistake a
  // listening socket alone for a ready Web process; retry only this safe GET.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/en/login`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
        cache: 'no-store',
      });
      if (response.status === 200) return;
      if (attempt === 3)
        throw new Error(`Web GET /en/login returned ${response.status}, expected 200`);
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await pause(500);
  }
}

async function stopOne(name, root) {
  const initial = inspectService(name, root);
  if (initial.state === 'free') {
    console.log(`[${name}] already stopped`);
    return;
  }
  if (initial.state !== 'managed')
    throw new Error(`${name}: process identity cannot be verified; refusing stop`);
  const final = inspectService(name, root);
  if (
    final.state !== 'managed' ||
    final.pid !== initial.pid ||
    final.startTicks !== initial.startTicks
  )
    throw new Error(`${name}: PID/listener changed during preflight; refusing stop`);
  process.kill(initial.pid, 'SIGTERM'); // one verified PID only; never SIGKILL or process-group kill
  for (let i = 0; i < 75; i++) {
    await pause(200);
    const proc = processInfo(initial.pid);
    if ((!proc || proc.state === 'Z') && !listening(initial.port).occupied) {
      unlinkSync(pidFile(root, name)); // only this verified, stopped repo-managed PID file
      console.log(`[${name}] stopped pid=${initial.pid}; port ${initial.port} free`);
      return;
    }
  }
  throw new Error(
    `${name}: shutdown not confirmed; PID file retained; inspect process/listener and logs`
  );
}

async function startOne(name, root) {
  const initial = inspectService(name, root);
  if (initial.state === 'managed') {
    if (name === 'web') await checkWeb(initial.port);
    console.log(
      name === 'api'
        ? `[api] already running; PID/listener/build attested (NOT DB or HTTP checked); pid=${initial.pid}`
        : `[web] already running and HTTP checked; pid=${initial.pid}`
    );
    return;
  }
  if (initial.state !== 'free') throw new Error(`${name}: listener/PID conflict; refusing start`);
  if (name === 'api') {
    verifyApiBuild(root);
    verifyApiTarget(root);
  }
  const logDir = join(root, 'logs');
  mkdirSync(logDir, { recursive: true });
  // Reserve this checkout's PID file before spawning, so a concurrent manager
  // cannot start a second process between the free-port check and PID capture.
  const claim = openSync(pidFile(root, name), 'wx', 0o600);
  let child;
  try {
    writeSync(claim, 'PENDING\n');
    const fd = openSync(join(logDir, `${name}.log`), 'a', 0o600);
    const command = process.execPath;
    // The API must be spawned directly: the PID file has to name the real
    // process, and the build digest has to sit in *its* startup environment.
    const apiStartup = name === 'api' ? apiStartupEnv() : null;
    if (apiStartup && !apiStartup.ok) {
      closeSync(claim);
      throw new Error('API pre-start verification failed; see the messages above');
    }
    const args =
      name === 'api'
        ? [apiStartup.entry]
        : [
            join(root, 'apps/web/node_modules/next/dist/bin/next'),
            // `pnpm start` serves the production build that `pnpm setup` made;
            // `pnpm dev` keeps the development server with on-demand compiling.
            process.env.DUNA_WEB_MODE === 'development' ? 'dev' : 'start',
            '-p',
            '3000',
            '-H',
            '0.0.0.0',
          ];
    try {
      child = spawn(command, args, {
        cwd: join(root, `apps/${name}`),
        detached: true,
        stdio: ['ignore', fd, fd],
        env: apiStartup ? { ...process.env, ...apiStartup.env } : process.env,
      });
    } finally {
      closeSync(fd);
    }
    child.on('error', () => {}); // spawn failure is reported below, not unhandled
    child.unref();
    if (!child.pid)
      throw new Error(`${name}: could not spawn; PID claim retained; inspect OS access`);
    // Write via OUR open fd, not the path: never truncate someone else's file
    // even if an operator races by replacing the reserved PID file.
    ftruncateSync(claim, 0);
    writeSync(claim, `${child.pid}\n`, 0, 'utf8');
  } finally {
    closeSync(claim);
  }
  for (let i = 0; i < (name === 'api' ? 150 : 300); i++) {
    await pause(200);
    const status = inspectService(name, root);
    if (status.state === 'managed' && (name !== 'api' || status.build === 'current')) {
      if (name === 'web') await checkWeb(status.port);
      console.log(
        name === 'api'
          ? `[api] started pid=${status.pid}, listener=${status.listeners.join(',')}; build attested; DB and HTTP NOT verified`
          : `[web] started pid=${status.pid}, listener=${status.listeners.join(',')}; HTTP verified`
      );
      return;
    }
    if (!processInfo(child.pid) && !listening(initial.port).occupied) {
      throw new Error(
        `${name}: process exited before listening; PID file retained; inspect logs/${name}.log`
      );
    }
  }
  throw new Error(
    `${name}: listener or runtime build not verified; PID file retained; inspect logs/${name}.log`
  );
}

export async function runApps(action, choice = 'apps', root = repo) {
  if (action === 'status') {
    const statuses = ['api', 'web'].map((name) => inspectService(name, root));
    statuses.forEach((status) => console.log(format(status)));
    console.log(
      `[postgresql] externally managed; listener on :5432 ${listening(5432).occupied ? 'present' : 'absent'}; database identity NOT verified`
    );
    if (
      statuses.some(
        (item) =>
          !['free', 'managed'].includes(item.state) ||
          (item.name === 'api' && item.state === 'managed' && item.build !== 'current')
      )
    ) {
      throw new Error('A service is unmanaged, stale or unverified; status is not healthy');
    }
    return statuses;
  }
  if (action === 'clean-stale') {
    const statuses = select(choice).map((name) => inspectService(name, root));
    for (const status of statuses) {
      if (status.state !== 'stale-pidfile' || listening(status.port).occupied) {
        throw new Error(
          `${status.name}: PID file is not provably stale with a free port; refusing cleanup`
        );
      }
    }
    for (const status of statuses) {
      unlinkSync(pidFile(root, status.name));
      console.log(`[${status.name}] removed only the proven-stale PID file; no process touched`);
    }
    return;
  }
  if (!['preflight', 'start', 'stop', 'restart'].includes(action)) {
    throw new Error(
      'Usage: phase11-apps.mjs status|preflight|start|stop|restart|clean-stale [api|web|apps]'
    );
  }
  const names = select(choice);
  if (names.length === 2 && portFor('api', root) === portFor('web', root)) {
    throw new Error('API and Web configured for the same port; no services changed');
  }
  preflight(action === 'preflight' ? 'restart' : action, names, root);
  if (action === 'preflight') {
    console.log('App-only preflight passed; PostgreSQL untouched.');
    return;
  }
  if (action === 'stop' || action === 'restart') {
    for (const name of [...names].reverse()) await stopOne(name, root);
  }
  if (action === 'start' || action === 'restart') {
    for (const name of names) await startOne(name, root);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const operation =
    process.argv.length > 4
      ? Promise.reject(new Error('Too many arguments; choose one service'))
      : runApps(process.argv[2] ?? 'status', process.argv[3] ?? 'apps');
  operation.catch((error) => {
    console.error(error instanceof Error ? error.message : 'Service operation failed');
    process.exitCode = 1;
  });
}
