import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apiDotenvSource, verifyApiTarget } from './check-phase11-api-target.mjs';
import { resolveApiPort } from './dev-api-port.mjs';

const dbUrl = (name, role = 'shipping_runtime_p11') =>
  `postgresql://${role}:private-sentinel@127.0.0.1:5432/${name}?schema=public`;

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'duna-api-target-'));
  mkdirSync(join(root, 'apps/api'), { recursive: true });
  return root;
}

test('pre-start target uses owner-approved exact name and never exposes credentials', () => {
  const root = fixture();
  try {
    const result = verifyApiTarget(root, {
      PHASE11_APPROVED_DB_NAME: 'duna_seed_test',
      DATABASE_URL: dbUrl('duna_seed_test'),
    });
    assert.deepEqual(result, {
      dbName: 'duna_seed_test',
      dbRole: 'shipping_runtime_p11',
      host: '127.0.0.1',
      port: 5432,
    });
    assert.ok(!JSON.stringify(result).includes('private-sentinel'));
    assert.throws(
      () => verifyApiTarget(root, { DATABASE_URL: dbUrl('duna_seed_test') }),
      /STOP: owner confirmed/
    );
    assert.throws(
      () =>
        verifyApiTarget(root, {
          PHASE11_APPROVED_DB_NAME: 'duna_seed_test1',
          DATABASE_URL: dbUrl('duna_seed_test1'),
        }),
      /STOP: owner confirmed/
    );
    assert.throws(
      () =>
        verifyApiTarget(root, {
          PHASE11_APPROVED_DB_NAME: 'dna_seed_test',
          DATABASE_URL: dbUrl('dna_seed_test'),
        }),
      /STOP: owner confirmed/
    );
    assert.throws(
      () =>
        verifyApiTarget(root, {
          PHASE11_APPROVED_DB_NAME: 'duna_seed_test',
          DATABASE_URL: dbUrl('dna_seed_test'),
        }),
      /values suppressed/
    );
    assert.throws(
      () =>
        verifyApiTarget(root, {
          PHASE11_APPROVED_DB_NAME: 'duna_seed_test',
          DATABASE_URL: dbUrl('duna_seed_test', 'shipping'),
        }),
      /values suppressed/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('same dotenv selection as API config.factory: apps/api/.env before root .env, env overrides both', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, '.env'), `DATABASE_URL=${dbUrl('duna_seed_test')}\nAPI_PORT=3101\n`);
    writeFileSync(
      join(root, 'apps/api/.env'),
      `DATABASE_URL=${dbUrl('dna_seed_test')}\nAPI_PORT=4242\n`
    );
    assert.equal(resolveApiPort({}, apiDotenvSource(root)), 4242);
    assert.throws(
      () => verifyApiTarget(root, { PHASE11_APPROVED_DB_NAME: 'duna_seed_test' }),
      /values suppressed/
    );
    assert.equal(
      verifyApiTarget(root, {
        PHASE11_APPROVED_DB_NAME: 'duna_seed_test',
        DATABASE_URL: dbUrl('duna_seed_test'),
      }).dbName,
      'duna_seed_test'
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
