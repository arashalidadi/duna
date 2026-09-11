export type AppEnvironment = 'development' | 'test' | 'production';

export interface AppConfig {
  environment: AppEnvironment;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  timezone: string;
  defaultCurrency: string;
  supportedCurrencies: string[];
}

export interface ApiConfig {
  host: string;
  port: number;
  globalPrefix: string;
  apiVersion: number;
  corsOrigins: string[];
}

export interface DatabaseConfig {
  url: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  jwtRefreshSecret: string;
}

export interface Config {
  app: AppConfig;
  api: ApiConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
