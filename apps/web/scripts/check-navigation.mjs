#!/usr/bin/env node
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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
