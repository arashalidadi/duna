#!/usr/bin/env node
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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
