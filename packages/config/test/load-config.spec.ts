import { loadConfig, ConfigError, ENV_VARS } from '../src';

const validEnv = (): Record<string, string | undefined> => ({
  [ENV_VARS.NODE_ENV]: 'development',
  [ENV_VARS.APP_TIMEZONE]: 'Asia/Dubai',
  [ENV_VARS.API_PORT]: '3001',
  [ENV_VARS.DATABASE_URL]: 'postgresql://user:pass@localhost:5432/db',
  [ENV_VARS.AUTH_JWT_SECRET]: 'secret-A',
  [ENV_VARS.AUTH_JWT_REFRESH_SECRET]: 'secret-B',
});

describe('loadConfig', () => {
  it('loads a valid configuration with defaults applied', () => {
    const config = loadConfig(validEnv());
    expect(config.app.environment).toBe('development');
    expect(config.app.isDevelopment).toBe(true);
    expect(config.app.timezone).toBe('Asia/Dubai');
    expect(config.app.defaultCurrency).toBe('USD');
    expect(config.app.supportedCurrencies).toEqual(['USD', 'AED']);
    expect(config.api.port).toBe(3001);
    expect(config.api.globalPrefix).toBe('api');
    expect(config.api.apiVersion).toBe(1);
  });

  it('defaults to the documented development API port when API_PORT is absent', () => {
    const env = validEnv();
    delete env[ENV_VARS.API_PORT];
    expect(loadConfig(env).api.port).toBe(3010);
    env[ENV_VARS.API_PORT] = '';
    expect(loadConfig(env).api.port).toBe(3010);
  });

  it.each([3001, 3010, 3101])('honors an explicit API_PORT=%s override', (port) => {
    const env = validEnv();
    env[ENV_VARS.API_PORT] = String(port);
    expect(loadConfig(env).api.port).toBe(port);
  });

  it('throws when DATABASE_URL is missing', () => {
    const env = validEnv();
    delete env[ENV_VARS.DATABASE_URL];
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow('DATABASE_URL');
  });

  it('throws when AUTH secrets are missing', () => {
    const env = validEnv();
    delete env[ENV_VARS.AUTH_JWT_SECRET];
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it('throws on invalid NODE_ENV', () => {
    const env = validEnv();
    env[ENV_VARS.NODE_ENV] = 'production-ish';
    expect(() => loadConfig(env)).toThrow('must be one of');
  });

  it('throws on invalid port', () => {
    const env = validEnv();
    env[ENV_VARS.API_PORT] = 'not-a-number';
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it('parses CORS origins as an array', () => {
    const env = validEnv();
    env[ENV_VARS.API_CORS_ORIGINS] = 'http://a.com, http://b.com';
    const config = loadConfig(env);
    expect(config.api.corsOrigins).toEqual(['http://a.com', 'http://b.com']);
  });
});
