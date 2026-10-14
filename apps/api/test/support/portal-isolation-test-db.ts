/**
 * The isolation E2E writes *only uncommitted fixtures* and rolls them back. It
 * must never silently use Jest's .env/DATABASE_URL or an unconfirmed database.
 */
export function portalIsolationTestDatabase(env: NodeJS.ProcessEnv): {
  url: string;
  name: string;
} {
  const url = env.PORTAL_ISOLATION_TEST_DATABASE_URL;
  const name = env.PORTAL_ISOLATION_TEST_DATABASE_NAME;

  if (env.PORTAL_ISOLATION_TEST_DB_CONFIRMED !== 'YES_ISOLATED_TEST_DB' || !url || !name) {
    throw new Error(
      'Portal isolation E2E requires PORTAL_ISOLATION_TEST_DATABASE_URL, ' +
        'PORTAL_ISOLATION_TEST_DATABASE_NAME and ' +
        'PORTAL_ISOLATION_TEST_DB_CONFIRMED=YES_ISOLATED_TEST_DB; no database was opened'
    );
  }

  let parsed: URL;
  let urlDatabaseName: string;
  try {
    parsed = new URL(url);
    urlDatabaseName = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error('Portal isolation test database URL is invalid; no database was opened');
  }

  // An explicit test-named database AND an exact match to the independently
  // confirmed name are required. Never interpolate the URL into an error (secrets).
  if (
    !['postgresql:', 'postgres:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.hash ||
    !/^[a-z0-9_-]+$/i.test(name) ||
    !/(^|[_-])test($|[_-])/i.test(name) ||
    urlDatabaseName !== name
  ) {
    throw new Error(
      'Portal isolation test database name/URL is not confirmed; no database was opened'
    );
  }

  return { url, name };
}
