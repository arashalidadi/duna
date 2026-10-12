/**
 * Phase 1 — runtime seed-safety test (acceptance A3 + the P1 testing row).
 *
 * The static guard (`pnpm check:seed-safety`) proves the seed *modules* are
 * separated. This script proves the behaviour, by actually running the seed and
 * inspecting the database:
 *
 *   1. `pnpm db:seed` with SEED_DEMO_DATA unset creates ZERO cargo, customers,
 *      vessels, voyages and load lists.                              (acceptance A3)
 *   2. Running it a second time changes nothing.                        (idempotency)
 *   3. The required administrator setup survives both runs: the admin account,
 *      its ADMIN role, and exactly one primary administrator.   (must not regress)
 *
 * Run:  pnpm test:seed-safety
 *
 * ---------------------------------------------------------------------------
 * PREREQUISITES — read before running
 * ---------------------------------------------------------------------------
 *  • A **disposable** database of its own. It is passed as SEED_TEST_DATABASE_URL,
 *    NOT DATABASE_URL, so a production database cannot be targeted by mistake.
 *  • That database must have the schema applied:
 *        DATABASE_URL=<url> npx prisma migrate deploy
 *  • Node dependencies installed (`pnpm install`).
 *
 * DATA: this test WRITES to the database it is given — exactly what the seed
 * writes (currencies, permissions, roles, ports, yards, company settings, the
 * admin account). It NEVER deletes anything and never drops the schema. Point it
 * at a dedicated test database, e.g. `duna_seed_test`, not at production.
 */
import { spawnSync } from 'node:child_process';

const testUrl = process.env.SEED_TEST_DATABASE_URL;

/** The five models acceptance A3 says a default seed must not populate. */
const A3_MODELS = ['cargo', 'customer', 'vessel', 'voyage', 'loadList'] as const;

function fail(message: string): never {
  console.error(`\nFAILED — ${message}`);
  process.exit(1);
}

// The prerequisite check runs BEFORE Prisma is imported, so an operator with an
// unconfigured environment gets the setup instructions rather than a module-load
// error. (Prisma needs a generated client, which is a step they may not have run.)
if (!testUrl) {
  console.error(
    [
      'SEED_TEST_DATABASE_URL is not set.',
      '',
      'This test writes seed data, so it refuses to run against the default',
      'DATABASE_URL. Create a disposable database and pass it explicitly:',
      '',
      '  createdb duna_seed_test',
      '  DATABASE_URL=postgresql://localhost:5432/duna_seed_test npx prisma migrate deploy',
      '  SEED_TEST_DATABASE_URL=postgresql://localhost:5432/duna_seed_test pnpm test:seed-safety',
      '',
    ].join('\n')
  );
  process.exit(2);
}

function describeTarget(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || '5432'}${u.pathname}`;
  } catch {
    return '(unparseable url)';
  }
}

// Loaded here rather than at module scope so the prerequisite check above can run
// even when the generated client is missing.
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });

/** Counts for the A3 models plus the required configuration the seed must keep. */
async function snapshot() {
  const [cargo, customer, vessel, voyage, loadList] = await Promise.all([
    prisma.cargo.count(),
    prisma.customer.count(),
    prisma.vessel.count(),
    prisma.voyage.count(),
    prisma.loadList.count(),
  ]);
  const [permissions, roles, ports, yards, users, primaryAdmins] = await Promise.all([
    prisma.permission.count(),
    prisma.role.count(),
    prisma.port.count(),
    prisma.yard.count(),
    prisma.user.count(),
    prisma.user.count({ where: { isPrimaryAdmin: true } }),
  ]);
  return { cargo, customer, vessel, voyage, loadList, permissions, roles, ports, yards, users, primaryAdmins };
}

/** Run the seed exactly as an operator would, with the demo opt-in forced off. */
function runSeed(label: string) {
  const env = { ...process.env, DATABASE_URL: testUrl };
  delete (env as Record<string, string | undefined>).SEED_DEMO_DATA;

  const result = spawnSync('pnpm', ['db:seed'], { env, encoding: 'utf8', shell: false });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  console.log(`\n--- ${label} ---`);
  for (const line of output.trim().split('\n')) console.log(`    ${line}`);

  if (result.status !== 0) {
    fail(`${label} exited with status ${result.status}`);
  }
  if (!/Demo data: SKIPPED/.test(output)) {
    fail(
      `${label} did not report "Demo data: SKIPPED" — the opt-in gate did not take effect. ` +
        'Check SEED_DEMO_DATA in the environment.'
    );
  }
  return output;
}

const problems: string[] = [];

async function main() {
  console.log('seed-safety runtime test');
  console.log(`  target database : ${describeTarget(testUrl!)}`);
  console.log(`  opt-in variable : SEED_DEMO_DATA (forced unset)`);

  // Fail fast with a clear message if the schema is not applied.
  try {
    await prisma.$queryRaw`SELECT 1 FROM "User" LIMIT 1`;
  } catch (e) {
    fail(
      `cannot read the "User" table on ${describeTarget(testUrl!)} — is the schema applied?\n` +
        `        ${(e as Error).message}\n` +
        '        Run: DATABASE_URL=<url> npx prisma migrate deploy'
    );
  }

  const before = await snapshot();
  console.log(`\n  before seeding : ${JSON.stringify(before)}`);

  runSeed('first run — SEED_DEMO_DATA unset');
  const afterFirst = await snapshot();

  runSeed('second run — idempotency');
  const afterSecond = await snapshot();

  console.log('\n--- results ---');
  const row = (name: string, a: number, b: number, c: number) =>
    console.log(`    ${name.padEnd(14)} before=${String(a).padStart(5)}  after1=${String(b).padStart(5)}  after2=${String(c).padStart(5)}`);
  for (const m of A3_MODELS) row(m, before[m], afterFirst[m], afterSecond[m]);
  row('permissions', before.permissions, afterFirst.permissions, afterSecond.permissions);
  row('roles', before.roles, afterFirst.roles, afterSecond.roles);
  row('ports', before.ports, afterFirst.ports, afterSecond.ports);
  row('yards', before.yards, afterFirst.yards, afterSecond.yards);
  row('users', before.users, afterFirst.users, afterSecond.users);
  row('primaryAdmins', before.primaryAdmins, afterFirst.primaryAdmins, afterSecond.primaryAdmins);

  // 1 · Acceptance A3 — the default seed creates no business rows.
  for (const m of A3_MODELS) {
    if (afterFirst[m] !== before[m]) {
      problems.push(
        `A3 VIOLATED: '${m}' went from ${before[m]} to ${afterFirst[m]} rows — the default seed created business data`
      );
    }
  }

  // 2 · Idempotency — the second run changes nothing.
  for (const key of Object.keys(afterSecond) as (keyof typeof afterSecond)[]) {
    if (afterSecond[key] !== afterFirst[key]) {
      problems.push(
        `NOT IDEMPOTENT: '${key}' changed on the second run (${afterFirst[key]} -> ${afterSecond[key]})`
      );
    }
  }

  // 3 · The required administrator setup must survive.
  if (afterSecond.primaryAdmins !== 1) {
    problems.push(
      `expected exactly 1 primary administrator after seeding, found ${afterSecond.primaryAdmins}`
    );
  }
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@shipping.local';
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { isActive: true, isPrimaryAdmin: true, roles: { select: { role: { select: { code: true } } } } },
  });
  if (!admin) {
    problems.push(`the administrator account '${adminEmail}' was not created`);
  } else {
    if (!admin.isActive) problems.push(`the administrator account '${adminEmail}' is not active`);
    if (!admin.roles.some((r) => r.role.code === 'ADMIN')) {
      problems.push(`the administrator account '${adminEmail}' does not hold the ADMIN role`);
    }
  }
  // The ADMIN role must NOT have been given release-exception authority by default.
  const override = await prisma.rolePermission.findFirst({
    where: { role: { code: 'ADMIN' }, permission: { code: 'release:override' } },
    select: { roleId: true },
  });
  if (override) {
    problems.push(
      "the ADMIN role was granted 'release:override' by the seed — DEC-116 requires it to be an explicit grant by the primary administrator"
    );
  }

  console.log(
    `\n    admin account  : ${admin ? `${adminEmail} (active=${admin.isActive}, primary=${admin.isPrimaryAdmin}, roles=${admin.roles.map((r) => r.role.code).join('+')})` : 'MISSING'}`
  );

  await prisma.$disconnect();

  if (problems.length) {
    console.error(`\nFAILED — ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    '\nSEED-SAFETY RUNTIME TEST PASSED — default seed created no cargo/customers/vessels/voyages/load lists, ' +
      'is idempotent, and kept the administrator setup.'
  );
}

void main();
