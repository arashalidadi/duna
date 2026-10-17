#!/usr/bin/env node
/**
 * Pre-start, NO database connection. Validate the effective API configuration
 * before a process can open a connection to the wrong Phase 11 database.
 * This is NOT proof of the live PostgreSQL session; see process-db and DBA
 * socket/pg_stat_activity correlation after startup. Never print credentials.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repo = fileURLToPath(new URL('../', import.meta.url));
const { parse } = createRequire(join(repo, 'apps/api/package.json'))('dotenv');

export function apiDotenvSource(root = repo) {
  // Same order as apps/api/src/config/config.factory.ts when cwd=apps/api.
  for (const file of [join(root, 'apps/api/.env'), join(root, '.env')]) {
    if (existsSync(file)) return readFileSync(file, 'utf8');
  }
  return '';
}

export function verifyApiTarget(root = repo, env = process.env) {
  const name = env.PHASE11_APPROVED_DB_NAME;
  if (name !== 'duna_seed_test') {
    throw new Error(
      'STOP: owner confirmed duna_seed_test; explicitly set PHASE11_APPROVED_DB_NAME=duna_seed_test after verifying the existing inventory. No DB accessed'
    );
  }
  const configured = env.DATABASE_URL ?? parse(apiDotenvSource(root)).DATABASE_URL;
  let url;
  try {
    url = new URL(configured);
  } catch {
    throw new Error('API DATABASE_URL missing or invalid; values suppressed; no DB accessed');
  }
  let matches = false;
  try {
    matches =
      ['postgresql:', 'postgres:'].includes(url.protocol) &&
      decodeURIComponent(url.username) === 'shipping_runtime_p11' &&
      url.password.length > 0 &&
      url.hostname === '127.0.0.1' &&
      url.port === '5432' &&
      decodeURIComponent(url.pathname) === `/${name}` &&
      url.searchParams.getAll('schema').length <= 1 &&
      (url.searchParams.get('schema') ?? 'public') === 'public';
  } catch {
    /* invalid URL encodings fail closed */
  }
  if (!matches)
    throw new Error(
      'API connection target/role disagrees with approved Phase 11 target; values suppressed; no DB accessed'
    );
  return { dbName: name, dbRole: 'shipping_runtime_p11', host: '127.0.0.1', port: 5432 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const target = verifyApiTarget();
    console.log(
      `Pre-start target check (configuration only): ${target.dbRole} @ ${target.host}:${target.port}/${target.dbName}. Active DB session NOT verified.`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'API target preflight failed');
    process.exitCode = 1;
  }
}
