#!/usr/bin/env node
/**
 * Inspect the API process's *initial* environment, not the current .env file.
 * Never print DATABASE_URL, password, hashes, query string or the raw environ.
 * If dotenv set/changed it after exec, /proc cannot prove the loaded value:
 * report UNPROVEN and use a DBA's pg_stat_activity/socket correlation instead.
 * Linux-only, same-user /proc access required. No API/DB requests or writes.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function classifyProcessDbEnvironment(environ) {
  const matches = environ
    .toString('utf8')
    .split('\0')
    .filter((line) => line.startsWith('DATABASE_URL='));
  if (matches.length !== 1) return 'UNPROVEN: exactly one startup DATABASE_URL was not visible';
  let url;
  try {
    url = new URL(matches[0].slice('DATABASE_URL='.length));
  } catch {
    return 'UNPROVEN: startup DATABASE_URL was not a parseable URL';
  }
  // Do not echo any unexpected value: malformed usernames may contain secrets.
  try {
    const expected =
      ['postgresql:', 'postgres:'].includes(url.protocol) &&
      decodeURIComponent(url.username) === 'shipping_runtime_p11' &&
      url.hostname === '127.0.0.1' &&
      url.port === '5432' &&
      decodeURIComponent(url.pathname) === '/duna_seed_test' &&
      (url.searchParams.get('schema') ?? 'public') === 'public';
    return expected
      ? 'EXPECTED STARTUP ENV: shipping_runtime_p11 @ 127.0.0.1:5432/duna_seed_test (public)'
      : 'MISMATCH: startup connection target/DB role differs from the reviewed Phase 11 target (values suppressed)';
  } catch {
    return 'UNPROVEN: startup DATABASE_URL could not be decoded';
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const pid = Number(process.argv[2]);
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    console.error('Provide the actual running API PID (positive integer).');
    process.exitCode = 1;
  } else {
    try {
      const status = classifyProcessDbEnvironment(readFileSync(`/proc/${pid}/environ`));
      console.log(status);
      console.log(
        'This observes process startup environment only, NOT the active DB session. ' +
          'Corroborate the API PID/socket with pg_stat_activity; never infer from .env alone.'
      );
      if (!status.startsWith('EXPECTED')) process.exitCode = 1;
    } catch {
      console.error(
        'Could not read the process environment; ask the operator for approved access.'
      );
      process.exitCode = 1;
    }
  }
}
