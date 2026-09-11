import 'dotenv/config';
import { loadConfig, ConfigError } from '@shipping/config';
import { registerAs } from '@nestjs/config';

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
