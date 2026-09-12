import * as fs from 'fs';
import * as path from 'path';
import { config as loadDotenv } from 'dotenv';
import { loadConfig, ConfigError } from '@shipping/config';
import { registerAs } from '@nestjs/config';

// Load the repo-root .env regardless of where the process was started from.
// `nest start --watch` runs with cwd=apps/api, where no .env exists; the
// workspace .env lives at the monorepo root (../../ from apps/api).
for (const candidate of [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
]) {
  if (fs.existsSync(candidate)) {
    loadDotenv({ path: candidate });
    break;
  }
}

/**
 * Loads and validates the centralized configuration from environment variables.
 * Fails fast at startup if required configuration is missing.
 *
 * dotenv is loaded first so that process.env is populated from the project
 * .env file before validation runs.
 */
const config = loadConfig();

export const configFactory = registerAs('config', () => config);

export { loadConfig, ConfigError };
