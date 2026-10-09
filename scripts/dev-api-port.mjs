// Read only the API port; do not execute .env as shell code or print secrets.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repo = fileURLToPath(new URL('../', import.meta.url));
// dotenv is already an API dependency; no new workspace dependency is needed.
const { parse } = createRequire(path.join(repo, 'apps/api/package.json'))('dotenv');

export function resolveApiPort(env = {}, dotenvSource = '') {
  const configured = env.API_PORT ?? parse(dotenvSource).API_PORT;
  const port = configured === undefined || configured === '' ? 3010 : Number(configured);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be an integer between 1 and 65535');
  }
  return port;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const envFile = path.join(repo, '.env');
  const source = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  console.log(resolveApiPort(process.env, source));
}
