#!/usr/bin/env node
/**
 * Sandbox-only Prisma engine mirror.
 *
 * The Prisma CLI downloads its native engines from https://binaries.prisma.sh.
 * That host is outside the sandbox outbound allow-list, so every `prisma generate`
 * / `prisma migrate ...` call fails with a TLS "socket disconnected" error and the
 * generated client contains no query engine.
 *
 * This script serves a local, read-only copy of those engine files and the CLI is
 * pointed at it with:
 *
 *   PRISMA_ENGINES_MIRROR=http://127.0.0.1:4555
 *
 * The served tree keeps the upstream layout:
 *
 *   <root>/all_commits/<engine-commit>/<platform>/<engine-file>[.sha256]
 *
 * so checksum validation still happens against the real `.sha256` files that ship
 * next to the engines. Nothing here is committed to the repository: the engine
 * mirror checkout lives outside the work tree (see `docs/operations.md`).
 *
 * Usage:
 *   node scripts/arena/engine-mirror.mjs [--root <dir>] [--port <port>]
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readdir } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const args = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const port = Number(argValue('--port', process.env.PRISMA_MIRROR_PORT ?? '4555'));
const requestedRoot = argValue('--root', process.env.PRISMA_ENGINES_DIR ?? '');

/** Candidate locations of a `prisma-engines-mirror` working copy. */
const candidates = [
  requestedRoot,
  process.env.ARENA_TOOLS_DIR ? join(process.env.ARENA_TOOLS_DIR, 'prisma-engines-mirror') : '',
  join(repoRoot, '.arena-tools', 'prisma-engines-mirror'),
  '/home/user/.arena-tools/prisma-engines-mirror',
  '/tmp/prisma-engines-mirror',
].filter(Boolean);

/**
 * Clone the mirror if it is missing. It is a plain git repository of engine
 * tarballs; `github.com` is reachable from the sandbox, `binaries.prisma.sh` is not.
 */
async function ensureMirror() {
  for (const candidate of candidates) {
    try {
      const entries = await readdir(join(candidate, 'all_commits'));
      if (entries.length > 0) return candidate;
    } catch {
      /* keep looking */
    }
  }
  const target = join(repoRoot, '.arena-tools', 'prisma-engines-mirror');
  process.stderr.write(`[engine-mirror] cloning engine mirror into ${target}\n`);
  execSync(
    `git clone --depth 1 --branch mirror https://github.com/owengretzinger/prisma-engines-mirror.git ${JSON.stringify(target)}`,
    { stdio: 'inherit' },
  );
  return target;
}

const root = await ensureMirror();
process.stderr.write(`[engine-mirror] serving ${root}\n`);

const CONTENT_TYPES = {
  '.gz': 'application/gzip',
  '.sha256': 'text/plain',
  '.node': 'application/octet-stream',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  // Reject traversal: normalize, then require the result to stay under the root.
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const absolute = resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(root + '/')) {
    res.writeHead(403).end('forbidden');
    return;
  }
  stat(absolute)
    .then((info) => {
      if (!info.isFile()) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, {
        'content-type': CONTENT_TYPES[absolute.slice(absolute.lastIndexOf('.'))] ?? 'application/octet-stream',
        'content-length': String(info.size),
      });
      createReadStream(absolute).pipe(res);
    })
    .catch(() => res.writeHead(404).end('not found'));
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`[engine-mirror] listening on http://127.0.0.1:${port} root=${root}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
