'use strict';

const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { TEST_DATABASE, OWNER_ROLE } = require('./setup.cjs');
const { assertDatabaseIdentity, verifyMigrations, verifySeed } = require('./setup.cjs');

function run(args, label, timeout = 600_000) {
  const result = spawnSync('pnpm', args, {
    cwd: '/app',
    env: process.env,
    stdio: ['ignore', 'ignore', 'ignore'],
    timeout,
  });
  if (result.status !== 0) throw new Error(`${label} failed (private tool output suppressed)`);
  console.log(`PASS ${label}`);
}
async function main() {
  if (
    process.env.DUNA_FRESH_DATABASE !== TEST_DATABASE ||
    process.env.SEED_DEMO_DATA !== 'false' ||
    process.env.DUNA_FRESH_SEED !== '1'
  ) {
    throw new Error('Dedicated non-demo integration fixture missing');
  }
  const db = new PrismaClient();
  try {
    await assertDatabaseIdentity(db, OWNER_ROLE, 'test-db');
    const [empty] = await db.$queryRawUnsafe(`
      SELECT count(*)::int AS total FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p')`);
    if (empty?.total !== 0)
      throw new Error('Integration fixture database is not empty; never reuse it');
    run(['exec', 'prisma', 'migrate', 'deploy'], 'isolated PG16 committed migrations');
    await verifyMigrations(db);
    run(['db:seed'], 'isolated non-demo core seed');
    await verifySeed(db);
    run(
      [
        '--filter',
        '@shipping/api',
        'exec',
        'jest',
        '--config',
        'test/jest-e2e.cjs',
        '--runInBand',
        '--runTestsByPath',
        'test/auth.e2e-spec.ts',
        'test/master-data.e2e-spec.ts',
      ],
      'isolated Auth/RBAC and master-data E2E suites',
      900_000
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Isolated integration tests failed; no production database or services were targeted'
  );
  process.exitCode = 1;
});
