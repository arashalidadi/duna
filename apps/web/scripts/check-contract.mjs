#!/usr/bin/env node
/**
 * Contract guard (Phase 3 unit 4 root-cause fix) — run via `pnpm --filter @shipping/web test`.
 *
 * Two static checks, both zero-dependency, that would have caught the 2026-10-02
 * Inspections/Cargo UI defects:
 *
 *  1) SHARED STATUS UNION ⊆ PRISMA ENUM.
 *     Every `export type XStatus = 'A' | …` (and `XStatusValues` const arrays) in
 *     packages/shared/src must only contain values that exist in the like-named Prisma
 *     enum. Catches: shared shipping 'READY' while the DB enum is 'READY_FOR_LOADING'
 *     (=> every ?status=READY filter 400s) and shared shipping 'APPROVED'/'REJECTED'
 *     while the DB enum moved to Phase 3A (=> stale type + dead vocabulary). Web maps
 *     are `Record<SharedType>` so `tsc` then forces exhaustive key coverage.
 *
 *  2) WEB api.post() ROUTES EXIST AS @Post IN A CONTROLLER.
 *     Every literal `api.post('…')` path in apps/web/src (with `${…}` placeholders
 *     normalised to `:p`) must match some `@Controller(prefix) + @Post(path)` in
 *     apps/api/src. Catches: pages still POSTing /inspections/:id/approve after the
 *     API renamed it to /book|/done|/fail (live 404s, silent no-ops in the UI).
 *
 * WHAT THIS DOES NOT CATCH (recorded in the unit-4 log):
 *  - direction Prisma enum → shared (an API-only value missing from a shared union is
 *    not flagged; runtime crash protection for that direction is the mandated `??`
 *    fallback on every STATUS_META/INSPECTION_META index);
 *  - GET/PATCH/DELETE routes, request bodies, query DTOs, permissions, response shapes;
 *  - computed/dynamic api.post paths (non-literal first argument) — skipped, counted;
 *  - non-status types, i18n keys, rendering logic, anything runtime.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const REPO_ROOT = join(WEB_ROOT, '..', '..');

const failures = [];
const skips = [];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// --------------------------------------------------------------------------
// Check 1 — shared status unions ⊆ Prisma enums
// --------------------------------------------------------------------------
function checkStatusParity() {
  const schema = readFileSync(join(REPO_ROOT, 'prisma', 'schema.prisma'), 'utf8');
  const prismaEnums = new Map();
  for (const m of schema.matchAll(/enum\s+(\w+)\s*\{([^}]*)\}/g)) {
    const values = m[2]
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter((l) => l && !l.startsWith('@@'))
      .map((l) => l.split(/\s+/)[0]);
    prismaEnums.set(m[1], new Set(values));
  }

  const sharedFiles = walk(join(REPO_ROOT, 'packages', 'shared', 'src')).filter((f) =>
    f.endsWith('.ts'),
  );
  let checked = 0;
  for (const file of sharedFiles) {
    const src = readFileSync(file, 'utf8');
    const decls = [
      // export type CargoStatus = 'A' | 'B' …;
      ...src.matchAll(/export\s+type\s+(\w*Status)\s*=\s*([^;]+);/g),
      // export const SalaryStatusValues = ['A', 'B'] as const;
      ...src.matchAll(/export\s+const\s+(\w*StatusValues)\s*=\s*\[([^\]]+)\]/g),
    ];
    for (const m of decls) {
      const name = m[1].endsWith('StatusValues') ? m[1] : m[1];
      const enumName = name.replace(/Values$/, '');
      const values = [...m[2].matchAll(/'([A-Z0-9_]+)'/g)].map((v) => v[1]);
      if (values.length === 0) continue;
      const prisma = prismaEnums.get(enumName);
      if (!prisma) {
        skips.push(`status parity: ${enumName} (from ${file}) has no like-named Prisma enum — skipped`);
        continue;
      }
      checked += 1;
      for (const v of values) {
        if (!prisma.has(v)) {
          failures.push(
            `STATUS PARITY: shared ${enumName} contains '${v}' which is NOT in prisma enum ${enumName} ` +
              `(${[...prisma].join(' | ')}) — source: ${file.replace(REPO_ROOT + '/', '')}`,
          );
        }
      }
    }
  }
  return checked;
}

// --------------------------------------------------------------------------
// Check 2 — web api.post() routes exist as @Post
// --------------------------------------------------------------------------
function normaliseRoute(r) {
  return r
    .replace(/\$\{[^}]*\}/g, ':p') // ${id} -> :p
    .replace(/:[A-Za-z0-9_]+/g, ':p') // :id -> :p (controller side)
    .replace(/\?.*$/, '') // query
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

function checkPostRoutes() {
  const controllerRoutes = new Set();
  const apiFiles = walk(join(REPO_ROOT, 'apps', 'api', 'src')).filter((f) =>
    f.endsWith('.controller.ts'),
  );
  for (const file of apiFiles) {
    const src = readFileSync(file, 'utf8');
    const prefixMatch = src.match(/@Controller\(\s*[`'"]([^`'"]*)[`'"]/);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    // @Post('path') and bare @Post()
    for (const m of src.matchAll(/@Post\(\s*[`'"]([^`'"]*)[`'"]\s*\)/g)) {
      controllerRoutes.add(normaliseRoute(`${prefix}/${m[1]}`));
    }
    const bareCount = [...src.matchAll(/@Post\(\s*\)/g)].length;
    for (let i = 0; i < bareCount; i += 1) controllerRoutes.add(normaliseRoute(prefix));
  }

  let posts = 0;
  let dynamic = 0;
  let computed = 0;
  const webFiles = walk(join(REPO_ROOT, 'apps', 'web', 'src')).filter((f) =>
    /\.(tsx|ts)$/.test(f),
  );
  for (const file of webFiles) {
    const src = readFileSync(file, 'utf8');
    const flat = src.replace(/\n/g, ' ');
    for (const m of flat.matchAll(/api\.post(?:<.*?>)?\(\s*([`'"])([^`'"]*)\1/g)) {
      const raw = m[2];
      if (/^(https?:)?\/\//.test(raw)) continue; // external URL — not our API
      if (raw.includes('${') && raw.indexOf('${') === 0) {
        dynamic += 1; // computed path (starts with an expression) — cannot check statically
        continue;
      }
      const route = normaliseRoute(raw);
      if (controllerRoutes.has(route)) {
        posts += 1;
        continue;
      }
      // Computed FINAL segment (`/voyages/${row.id}/${action}`): the id/action part is a
      // variable, so the exact route cannot be resolved statically. Verify everything up
      // to the dynamic tail resolves to a controller route, then skip + count it —
      // literal routes (the /approve defect class) are still enforced strictly.
      const segs = route.split('/');
      const dynamicTail = /:p$/.test(route);
      const hasPrefix =
        dynamicTail && segs.length > 1
          ? [...controllerRoutes].some((cr) => cr.startsWith(segs.slice(0, -1).join('/') + '/'))
          : false;
      if (hasPrefix) {
        computed += 1;
        continue;
      }
      posts += 1;
      failures.push(
        `POST ROUTE MISSING: apps/web posts to '${raw}' (normalised '${route}') but no ` +
          `@Controller + @Post combination in apps/api/src declares it — file: ${file.replace(REPO_ROOT + '/', '')}`,
      );
    }
  }
  return { posts, dynamic, computed, controllers: controllerRoutes.size };
}

const checkedTypes = checkStatusParity();
const { posts, dynamic, computed, controllers } = checkPostRoutes();

if (skips.length) {
  console.log('skipped:');
  for (const s of skips) console.log(`  - ${s}`);
}
if (failures.length) {
  console.error(`\nCONTRACT GUARD FAILED (${failures.length}):`);
  for (const f of failures) console.error(`  x ${f}`);
  process.exit(1);
}
console.log(
  `CONTRACT GUARD OK — ${checkedTypes} shared status unions ⊆ Prisma enums; ` +
    `${posts} web api.post routes ⊆ ${controllers} controller @Post routes` +
    (dynamic ? ` (${dynamic} dynamic posts skipped)` : '') +
    (computed ? ` (${computed} computed-tail routes prefix-verified + skipped)` : ''),
);
