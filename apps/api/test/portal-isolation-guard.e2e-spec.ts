import { portalIsolationTestDatabase } from './support/portal-isolation-test-db';

/** These checks are DB-free and can be run even when the integration DB is absent. */
describe('Portal isolation test-database safety gate', () => {
  const confirmed = {
    PORTAL_ISOLATION_TEST_DATABASE_URL:
      'postgresql://fixture:secret@db.example.test:5432/shipping_erp_test',
    PORTAL_ISOLATION_TEST_DATABASE_NAME: 'shipping_erp_test',
    PORTAL_ISOLATION_TEST_DB_CONFIRMED: 'YES_ISOLATED_TEST_DB',
  };

  it('requires a separate URL, confirmed name and explicit confirmation (never falls back to DATABASE_URL)', () => {
    for (const missing of Object.keys(confirmed)) {
      const env: NodeJS.ProcessEnv = {
        ...confirmed,
        DATABASE_URL: confirmed.PORTAL_ISOLATION_TEST_DATABASE_URL,
      };
      delete env[missing];
      expect(() => portalIsolationTestDatabase(env)).toThrow('no database was opened');
    }
    expect(() =>
      portalIsolationTestDatabase({ DATABASE_URL: confirmed.PORTAL_ISOLATION_TEST_DATABASE_URL })
    ).toThrow('no database was opened');
    expect(() =>
      portalIsolationTestDatabase({ ...confirmed, PORTAL_ISOLATION_TEST_DB_CONFIRMED: 'true' })
    ).toThrow('no database was opened');
  });

  it('rejects a production or mismatched name and non-PostgreSQL URLs without opening a connection', () => {
    for (const url of [
      'postgresql://fixture:secret@db.example.test:5432/shipping_erp',
      'postgresql://fixture:secret@db.example.test:5432/another_test',
      'mysql://fixture:secret@db.example.test:5432/shipping_erp_test',
      'postgresql://fixture:secret@db.example.test:5432/shipping_erp_test%ZZ',
      'not a URL',
    ]) {
      expect(() =>
        portalIsolationTestDatabase({ ...confirmed, PORTAL_ISOLATION_TEST_DATABASE_URL: url })
      ).toThrow('no database was opened');
    }
    expect(() =>
      portalIsolationTestDatabase({
        ...confirmed,
        PORTAL_ISOLATION_TEST_DATABASE_NAME: 'shipping_erp',
      })
    ).toThrow('no database was opened');
  });

  it('accepts only the independently confirmed, test-named database URL without contacting it', () => {
    expect(portalIsolationTestDatabase(confirmed)).toEqual({
      url: confirmed.PORTAL_ISOLATION_TEST_DATABASE_URL,
      name: confirmed.PORTAL_ISOLATION_TEST_DATABASE_NAME,
    });
  });
});
