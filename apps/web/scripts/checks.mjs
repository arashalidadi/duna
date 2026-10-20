/**
 * Web contract guards: API surface contract, navigation, page size and i18n coverage. Each guard exits non-zero on the first violation, exactly as it did standalone.
 *
 * Merged on 2026-10-20 from 4 files. Imports were hoisted and deduped;
 * every original body keeps its own block scope below, so its declarations cannot
 * collide with another file's and no statement was rewritten.
 */

import fs, { readFileSync, readdirSync, statSync } from 'node:fs';
import path, { join } from 'node:path';
import ts from 'typescript';
import { createTranslator } from 'next-intl';
import { fileURLToPath } from 'node:url';

// ---- apps/web/scripts/check-contract.mjs (0 tests) ----
{
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
}

// ---- apps/web/scripts/check-navigation.mjs (0 tests) ----
{
/**
 * Navigation-integrity guard (Phase 1).
 *
 * Phase 1 requires the stale `planned` "Agent portal" entry to be removed. That
 * entry was a *duplicate*: it used the same `labelKey` ('agents') as Agent master
 * data (`/agents`), so `sidebar.tsx` suppressed it — an item survives the filter
 * only when it has an `href` or its label is not already implemented:
 *
 *     (item.href || !implementedLabels.has(item.labelKey))
 *
 * The defect class is therefore "a planned entry that can never render, because
 * another entry with the same label is already implemented". This guard fails if
 * that happens again, and if the real Agent Portal or Agent master data is ever
 * removed by accident.
 *
 * Run: node scripts/check-navigation.mjs   (wired into `pnpm --filter @shipping/web test`)
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(root, '../..');
const NAV = path.join(root, 'src/lib/navigation/nav.ts');

/**
 * Entries that are still dead but are NOT Phase 1 scope.
 *
 * Each was found while doing this work and is left in place deliberately: removing
 * it is a product decision, not a Phase 1 task. Recorded here rather than ignored,
 * so the guard keeps enforcing the invariant for everything else.
 */
const KNOWN_DEAD = new Map([
  [
    'jobs',
    'planned "Job costing" duplicates the implemented `jobs` register (/jobs). ' +
      'Same defect class as the Agent portal entry removed in Phase 1; needs owner sign-off.',
  ],
]);

/** Strip comments so documentation examples are not parsed as nav data. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function parseItems(markdown) {
  const items = [];
  for (const m of markdown.matchAll(/\{([^{}]*?labelKey:\s*'([^']+)'[^{}]*?)\}/gs)) {
    const body = m[1];
    const href = /\bhref:\s*'([^']+)'/.exec(body);
    const status = /\bstatus:\s*'([^']+)'/.exec(body);
    const description = /\bdescription:\s*'([^']*)'/.exec(body);
    items.push({
      line: markdown.slice(0, m.index).split('\n').length,
      labelKey: m[2],
      href: href ? href[1] : null,
      status: status ? status[1] : null,
      description: description ? description[1] : null,
    });
  }
  return items;
}

const source = stripComments(fs.readFileSync(NAV, 'utf8'));
const items = parseItems(source);

const failures = [];
const findings = [];
const rel = path.relative(repoRoot, NAV);

if (items.length === 0) {
  failures.push(`${rel}: parsed 0 nav items — the guard cannot validate anything`);
}

// 1 · implemented items must navigate; planned items must not.
for (const item of items) {
  if (item.status === 'implemented' && !item.href) {
    failures.push(`${rel}:${item.line} item '${item.labelKey}' is marked implemented but has no href`);
  }
  if (item.status === 'planned' && item.href) {
    failures.push(`${rel}:${item.line} item '${item.labelKey}' is marked planned but has an href ('${item.href}')`);
  }
  if (!item.status) {
    failures.push(`${rel}:${item.line} item '${item.labelKey}' has no status`);
  }
}

// 2 · The sidebar's own rule, applied exactly as sidebar.tsx applies it.
const implementedLabels = new Set(items.filter((i) => i.href).map((i) => i.labelKey));
const renders = (i) => Boolean(i.href) || !implementedLabels.has(i.labelKey);

for (const item of items) {
  if (item.status !== 'planned') continue;
  if (renders(item)) continue;
  const allowlisted = KNOWN_DEAD.has(item.labelKey);
  const message =
    `${rel}:${item.line} planned entry '${item.labelKey}' (${item.description ?? 'no description'}) ` +
    `can never render: labelKey '${item.labelKey}' is already implemented elsewhere, so sidebar.tsx ` +
    `suppresses it. Remove the entry, or give it its own labelKey.`;
  if (allowlisted) findings.push(`${message}\n        known and allowed: ${KNOWN_DEAD.get(item.labelKey)}`);
  else failures.push(message);
}

// 3 · Duplicate labelKeys: two entries sharing one translation key is what created
//     the dead entry in the first place.
const byLabel = new Map();
for (const i of items) {
  if (!byLabel.has(i.labelKey)) byLabel.set(i.labelKey, []);
  byLabel.get(i.labelKey).push(i);
}
for (const [label, group] of byLabel) {
  if (group.length < 2) continue;
  const lines = group.map((g) => `:${g.line} (${g.status}, ${g.href ?? 'no href'})`).join(', ');
  const message = `${rel} labelKey '${label}' is used by ${group.length} entries — ${lines}`;
  if (KNOWN_DEAD.has(label)) findings.push(`${message}\n        known and allowed: ${KNOWN_DEAD.get(label)}`);
  else failures.push(`${message}. Each entry needs its own translation key.`);
}

// 4 · The two features Phase 1 must not break.
const agentPortal = items.find((i) => i.href === '/portal');
if (!agentPortal) {
  failures.push(`${rel}: the Agent Portal entry (href '/portal') is missing — it must not be removed`);
} else if (agentPortal.status !== 'implemented') {
  failures.push(`${rel}: the Agent Portal entry ('${agentPortal.labelKey}') is not marked implemented`);
}
const agentMaster = items.find((i) => i.href === '/agents');
if (!agentMaster) {
  failures.push(`${rel}: the Agent master-data entry (href '/agents') is missing — it must not be removed`);
}
for (const href of ['/portal', '/agents', '/users']) {
  if (!items.some((i) => i.href === href)) failures.push(`${rel}: expected entry for '${href}' is missing`);
}

// 5 · No entry may still describe the removed Agent portal duplicate.
for (const item of items) {
  if (item.href) continue;
  if (/agent\s*portal/i.test(item.description ?? '')) {
    failures.push(
      `${rel}:${item.line} a non-navigating entry still describes "Agent portal" ('${item.labelKey}'). ` +
        `The Agent Portal is implemented at /portal; this is the stale duplicate Phase 1 removed.`
    );
  }
}

console.log('navigation guard');
console.log(`  nav items parsed      : ${items.length}`);
console.log(`  implemented (with href): ${implementedLabels.size}`);
console.log(`  planned entries       : ${items.filter((i) => i.status === 'planned').length}`);
console.log(`  Agent Portal          : ${agentPortal ? `'${agentPortal.labelKey}' -> ${agentPortal.href} (${agentPortal.status})` : 'MISSING'}`);
console.log(`  Agent master data     : ${agentMaster ? `'${agentMaster.labelKey}' -> ${agentMaster.href} (${agentMaster.status})` : 'MISSING'}`);

if (findings.length) {
  console.log(`\nknown findings (not failing):`);
  for (const f of findings) console.log(`  - ${f}`);
}

if (failures.length) {
  console.error(`\nFAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nNAVIGATION GUARD OK — no dead planned entries, no duplicate labels, Agent Portal intact.');
}

// ---- apps/web/scripts/check-page-size.mjs (0 tests) ----
{
/**
 * Pagination-contract guard.
 *
 * The API caps `pageSize` at `MAX_PAGE_SIZE` (parsePagination in
 * apps/api/src/common/utils/pagination.util.ts) and every list DTO additionally
 * rejects larger values with `@Max(100)`. Because the API installs a global
 * ValidationPipe with `forbidNonWhitelisted`, `?pageSize=200` is answered with
 * **HTTP 400** — it is not clamped.
 *
 * Three call sites had drifted above the limit (a customers request of 200 and
 * a ports request of 500), which broke whole screens: the Users table loaded its
 * data with `Promise.all`, so a single 400 left the section empty.
 *
 * This guard fails if any request in the web app asks for more than the limit,
 * so the same breakage cannot be reintroduced silently.
 *
 * Run: node scripts/check-page-size.mjs   (wired into `pnpm --filter @shipping/web test`)
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(root, '../..');

const API_UTIL = path.join(repoRoot, 'apps/api/src/common/utils/pagination.util.ts');
const WEB_HELPER = path.join(root, 'src/lib/api/pagination.ts');

/** The helper is the mechanism that enforces the cap; its own file is exempt. */
const EXEMPT_FILES = new Set([WEB_HELPER]);

function readConstant(file, label) {
  const m = fs.readFileSync(file, 'utf8').match(/MAX_PAGE_SIZE\s*=\s*(\d+)/);
  if (!m) throw new Error(`could not read MAX_PAGE_SIZE ${label} from ${file}`);
  return Number(m[1]);
}

/** Remove comments so documentation examples are not mistaken for code. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const failures = [];
const apiMax = readConstant(API_UTIL, '(API)');
const webMax = readConstant(WEB_HELPER, '(web)');

if (apiMax !== webMax) {
  failures.push(
    `web MAX_PAGE_SIZE (${webMax}) != API MAX_PAGE_SIZE (${apiMax}) — the client's mirror must match the server`
  );
}

const files = walk(path.join(root, 'src'));
let requestSizes = 0;

for (const file of files) {
  const rel = path.relative(repoRoot, file);
  const source = stripComments(fs.readFileSync(file, 'utf8'));
  const exempt = EXEMPT_FILES.has(file);

  // Numeric constants declared in this file, so a variable pageSize can be checked.
  const localConsts = new Map();
  for (const m of source.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*(\d+)\s*;/g)) {
    localConsts.set(m[1], Number(m[2]));
  }

  const flag = (index, value, how) => {
    const line = source.slice(0, index).split('\n').length;
    failures.push(
      `${rel}:${line} requests pageSize=${value} (${how}), above the API limit of ${apiMax} — ` +
        `the API answers 400. Use fetchAllPages() from lib/api/pagination, or keep pageSize<=${apiMax}.`
    );
  };

  // 1 · literal in a URL string: pageSize=200
  for (const m of source.matchAll(/pageSize=(\d+)/g)) {
    requestSizes++;
    if (Number(m[1]) > apiMax) flag(m.index, m[1], 'literal');
  }

  // 2 · templated in a URL string: pageSize=${PAGE_SIZE}
  for (const m of source.matchAll(/pageSize=\$\{([^}]+)\}/g)) {
    requestSizes++;
    const expr = m[1].trim();
    if (exempt) continue;
    if (!/^[A-Za-z_$][\w$]*$/.test(expr)) {
      flag(m.index, expr, 'unverifiable expression');
      continue;
    }
    if (!localConsts.has(expr)) {
      flag(m.index, expr, `constant "${expr}" is not defined in this file, so its value cannot be checked`);
      continue;
    }
    if (localConsts.get(expr) > apiMax) flag(m.index, expr, `${expr} = ${localConsts.get(expr)}`);
  }

  // 3 · URLSearchParams style: pageSize: String(25) / pageSize: String(PAGE_SIZE)
  for (const m of source.matchAll(/pageSize:\s*String\(\s*([\w$]+)\s*\)/g)) {
    requestSizes++;
    const arg = m[1];
    if (/^\d+$/.test(arg)) {
      if (Number(arg) > apiMax) flag(m.index, arg, 'literal via String()');
      continue;
    }
    if (exempt) continue;
    if (!localConsts.has(arg)) {
      flag(m.index, arg, `constant "${arg}" is not defined in this file, so its value cannot be checked`);
      continue;
    }
    if (localConsts.get(arg) > apiMax) flag(m.index, arg, `${arg} = ${localConsts.get(arg)}`);
  }
}

console.log('page-size guard');
console.log(`  web files scanned     : ${files.length}`);
console.log(`  pageSize requests seen: ${requestSizes}`);
console.log(`  API MAX_PAGE_SIZE     : ${apiMax}`);
console.log(`  web MAX_PAGE_SIZE     : ${webMax}`);

if (failures.length) {
  console.error(`\nFAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\nPAGE-SIZE GUARD OK — no request exceeds the API limit of ${apiMax}.`);
}

// ---- apps/web/scripts/check-i18n.mjs (0 tests) ----
{
const root = path.resolve(import.meta.dirname, '..');
const locales = ['en', 'fa', 'ar'];
const messages = Object.fromEntries(locales.map(l => [l, JSON.parse(fs.readFileSync(path.join(root, `messages/${l}.json`), 'utf8'))]));
function flatten(value, prefix = '', output = {}) {
  for (const [key, item] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof item === 'object' && item !== null) flatten(item, name, output);
    else output[name] = item;
  }
  return output;
}
const flattened = Object.fromEntries(locales.map(l => [l, flatten(messages[l])]));
const errors = new Set();
for (const locale of locales) {
  const t = createTranslator({ locale, messages: messages[locale], onError: error => errors.add(`${locale}: ${error.message}`) });
  for (const [key, text] of Object.entries(flattened.en)) {
    const translated = flattened[locale][key];
    if (typeof translated !== 'string') { errors.add(`${locale}: missing ${key}`); continue; }
    // Check ICU variables and parse/format every string, including dialogs not opened in route smoke tests.
    const variables = s => Array.from(s.matchAll(/\{\s*([A-Za-z]\w*)\s*[,}]/g), m => m[1]).sort();
    const expected = variables(text), actual = variables(translated);
    if (JSON.stringify([...new Set(expected)]) !== JSON.stringify([...new Set(actual)])) errors.add(`${locale}: ICU variable mismatch at ${key}`);
    const values = Object.fromEntries(expected.map(name => [name, 2]));
    t(key, values);
  }
}
function inspect(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const file = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node, bindings) {
    if (ts.isBlock(node) || ts.isSourceFile(node)) {
      bindings = { ...bindings };
      for (const statement of node.statements ?? []) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
          const init = declaration.initializer;
          if (init && ts.isCallExpression(init) && /^(useTranslations|useUiTranslations)$/.test(init.expression.getText(file)) && init.arguments[0] && ts.isStringLiteral(init.arguments[0])) bindings[declaration.name.getText(file)] = init.arguments[0].text;
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && bindings[node.expression.text] && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const key = `${bindings[node.expression.text]}.${node.arguments[0].text}`;
      for (const locale of locales) if (typeof flattened[locale][key] !== 'string') errors.add(`${locale}: unresolved ${key} in ${path.relative(root, filePath)}`);
    }
    ts.forEachChild(node, child => visit(child, bindings));
  }
  visit(file, {});
}
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.tsx')) inspect(full);
  }
}
walk(path.join(root, 'src'));
if (errors.size) { console.error([...errors].join('\n')); process.exit(1); }
console.log(`I18N GUARD OK — ${Object.keys(flattened.en).length} messages, 3 locales, ICU variables/formats and static translation calls verified.`);
}

