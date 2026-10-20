#!/usr/bin/env node
/**
 * Phase 1 (acceptance A3) — seed-safety guard.
 *
 * A3 requires that `pnpm db seed` on a fresh database creates ZERO cargo,
 * customers, vessels, voyages or load lists. The seed cannot always be executed
 * in every environment (it needs a database), so this check enforces the
 * property statically and fails loudly if the separation is undone.
 *
 * Run: pnpm check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

/** Models the REQUIRED seed path is allowed to touch (reference/config + admin). */
const CORE_MODELS = new Set([
  'currency',
  'permission',
  'role',
  'rolePermission',
  'port',
  'yard',
  'companySettings',
  'voyageCostCategory',
  // Phase 5 (DEC-059/060/061): configuration rows only (labels), written add-only.
  'blLifecycleLabel',
  'user',
  'userRole',
]);

/** Models only the OPTIONAL demonstration seed may touch. */
const DEMO_ONLY_MODELS = new Set([
  'vessel',
  'voyage',
  'voyageDestination',
  'customer',
  'cargo',
  'inspection',
  'loadList',
  'loadListItem',
  'agent',
  'agentDestination',
  'manifest',
  'billOfLading',
  'releaseOrder',
  'deliveryOrder',
  'bookingRequest',
  'invoice',
  'invoiceItem',
]);

/** Business records that A3 says must not be created by a default seed run. */
const A3_MODELS = ['cargo', 'customer', 'vessel', 'voyage', 'loadList'];

const failures = [];

function modelsUsedIn(source) {
  const found = new Set();
  // The optional portal fixtures run inside an interactive transaction and
  // therefore use `tx.model`; scan those delegates as well as `prisma.model`.
  for (const m of source.matchAll(/\b(?:prisma|tx)\.([A-Za-z_$][\w$]*)\b/g)) {
    if (!m[1].startsWith('$')) found.add(m[1]);
  }
  return found;
}

for (const file of ['prisma/seed.ts', 'prisma/seed/core.ts', 'prisma/seed/demo.ts']) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing file: ${file}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

const orchestrator = read('prisma/seed.ts');
const core = read('prisma/seed/core.ts');
const demo = read('prisma/seed/demo.ts');

// 1. The orchestrator must not touch data models directly.
for (const model of modelsUsedIn(orchestrator)) {
  failures.push(`prisma/seed.ts must not access prisma.${model} directly — it only orchestrates`);
}

// 2. The required seed must not create business records.
for (const model of modelsUsedIn(core)) {
  if (!CORE_MODELS.has(model)) {
    failures.push(`prisma/seed/core.ts uses prisma.${model}, which is not required reference data`);
  }
}

// 3. Demonstration data must be reachable only from the demo module...
for (const model of modelsUsedIn(core)) {
  if (DEMO_ONLY_MODELS.has(model)) failures.push(`prisma/seed/core.ts must not use prisma.${model}`);
}
// ...and the demo module must not have leaked the reverse way.
const demoModels = modelsUsedIn(demo);
for (const model of ['currency', 'permission', 'rolePermission']) {
  if (demoModels.has(model)) failures.push(`prisma/seed/demo.ts must not use prisma.${model}`);
}

// 4. The demo seed must be guarded by an explicit, exact-string opt-in.
if (!/process\.env\.SEED_DEMO_DATA\s*===\s*'true'/.test(orchestrator)) {
  failures.push("prisma/seed.ts must gate the demo seed on process.env.SEED_DEMO_DATA === 'true'");
}
if (!/if\s*\(\s*!?\s*demoDataEnabled\(\)/.test(orchestrator)) {
  failures.push('prisma/seed.ts must branch on the demo-data gate');
}
if (!/await\s+seedDemo\(/.test(orchestrator)) {
  failures.push('prisma/seed.ts must call seedDemo(...) on the opt-in branch');
}

// 5. A default run must not reach the demo module: seedDemo's only call site
//    has to sit after the early return that the gate guards.
const gateIdx = orchestrator.indexOf('demoDataEnabled()');
const demoCallIdx = orchestrator.indexOf('await seedDemo(');
const earlyReturnIdx = orchestrator.indexOf('return;');
if (!(earlyReturnIdx !== -1 && gateIdx !== -1 && earlyReturnIdx < demoCallIdx)) {
  failures.push('seedDemo(...) must be called only on the branch reached after the default path returns');
}

console.log('seed-safety guard');
console.log(`  required seed models : ${[...modelsUsedIn(core)].sort().join(', ')}`);
console.log(`  A3 business models   : ${A3_MODELS.join(', ')} (absent from prisma/seed/core.ts)`);
console.log(`  demo models          : ${[...demoModels].sort().join(', ')}`);
console.log(`  opt-in variable      : SEED_DEMO_DATA === 'true'`);

if (failures.length) {
  console.error(`\nFAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nSEED SAFETY OK — the default seed path creates no cargo, customers, vessels, voyages or load lists.');
