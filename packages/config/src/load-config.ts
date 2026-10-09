import { ConfigError, type AppEnvironment, type Config } from './types';

/**
 * Environment variable names. Centralized so that renaming requires a single place.
 */
export const ENV_VARS = {
  NODE_ENV: 'NODE_ENV',
  APP_TIMEZONE: 'APP_TIMEZONE',
  APP_DEFAULT_CURRENCY: 'APP_DEFAULT_CURRENCY',
  API_HOST: 'API_HOST',
  API_PORT: 'API_PORT',
  API_VERSION: 'API_VERSION',
  API_CORS_ORIGINS: 'API_CORS_ORIGINS',
  DATABASE_URL: 'DATABASE_URL',
  AUTH_JWT_SECRET: 'AUTH_JWT_SECRET',
  AUTH_JWT_EXPIRES_IN: 'AUTH_JWT_EXPIRES_IN',
  AUTH_JWT_REFRESH_SECRET: 'AUTH_JWT_REFRESH_SECRET',
  AUTH_JWT_REFRESH_EXPIRES_IN: 'AUTH_JWT_REFRESH_EXPIRES_IN',
} as const;

type EnvSource = Record<string, string | undefined>;

const toNumber = (value: string | undefined, name: string): number => {
  if (value === undefined || value === '')
    throw new ConfigError(`Missing required environment variable: ${name}`);
  const parsed = Number(value);
  if (Number.isNaN(parsed))
    throw new ConfigError(`Environment variable ${name} must be a number, got "${value}"`);
  return parsed;
};

const toString = (value: string | undefined, name: string): string => {
  if (value === undefined || value === '')
    throw new ConfigError(`Missing required environment variable: ${name}`);
  return value;
};

const toStringOptional = (value: string | undefined, fallback: string, name: string): string => {
  if (value === undefined || value === '') {
    console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
    return fallback;
  }
  return value;
};

const toNumberOptional = (value: string | undefined, fallback: number, name: string): number => {
  if (value === undefined || value === '') {
    console.warn(`[config] Environment variable ${name} not set, using default "${fallback}"`);
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed))
    throw new ConfigError(`Environment variable ${name} must be a number, got "${value}"`);
  return parsed;
};

const toAppEnvironment = (value: string | undefined, name: string): AppEnvironment => {
  if (value === undefined || value === '') return 'development';
  const normalized = value.toLowerCase();
  if (normalized === 'development' || normalized === 'test' || normalized === 'production') {
    return normalized;
  }
  throw new ConfigError(
    `Environment variable ${name} must be one of development|test|production, got "${value}"`
  );
};

const toCsvArray = (value: string | undefined, name: string): string[] => {
  if (value === undefined || value === '') return ['*'];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

/**
 * Build and validate configuration from a source of environment variables.
 * By default reads process.env. Throws ConfigError when required config is missing.
 */
export function loadConfig(env: EnvSource = process.env): Config {
  const environment = toAppEnvironment(env[ENV_VARS.NODE_ENV], ENV_VARS.NODE_ENV);

  const defaultCurrency = toStringOptional(
    env[ENV_VARS.APP_DEFAULT_CURRENCY],
    'USD',
    ENV_VARS.APP_DEFAULT_CURRENCY
  );
  const supportedCurrencies = ['USD', 'AED'];

  return {
    app: {
      environment,
      isDevelopment: environment === 'development',
      isProduction: environment === 'production',
      isTest: environment === 'test',
      timezone: toStringOptional(env[ENV_VARS.APP_TIMEZONE], 'Asia/Dubai', ENV_VARS.APP_TIMEZONE),
      defaultCurrency,
      supportedCurrencies,
    },
    api: {
      host: toStringOptional(env[ENV_VARS.API_HOST], '0.0.0.0', ENV_VARS.API_HOST),
      port: toNumberOptional(env[ENV_VARS.API_PORT], 3010, ENV_VARS.API_PORT),
      globalPrefix: 'api',
      apiVersion: toNumberOptional(env[ENV_VARS.API_VERSION], 1, ENV_VARS.API_VERSION),
      corsOrigins: toCsvArray(env[ENV_VARS.API_CORS_ORIGINS], ENV_VARS.API_CORS_ORIGINS),
    },
    database: {
      url: toString(env[ENV_VARS.DATABASE_URL], ENV_VARS.DATABASE_URL),
    },
    auth: {
      jwtSecret: toString(env[ENV_VARS.AUTH_JWT_SECRET], ENV_VARS.AUTH_JWT_SECRET),
      jwtExpiresIn: toStringOptional(
        env[ENV_VARS.AUTH_JWT_EXPIRES_IN],
        '15m',
        ENV_VARS.AUTH_JWT_EXPIRES_IN
      ),
      jwtRefreshSecret: toString(
        env[ENV_VARS.AUTH_JWT_REFRESH_SECRET],
        ENV_VARS.AUTH_JWT_REFRESH_SECRET
      ),
      jwtRefreshExpiresIn: toStringOptional(
        env[ENV_VARS.AUTH_JWT_REFRESH_EXPIRES_IN],
        '7d',
        ENV_VARS.AUTH_JWT_REFRESH_EXPIRES_IN
      ),
    },
  };
}
