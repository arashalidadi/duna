'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_FILE = path.join(ROOT, '.env.fresh.local');
const STATE_DIR = path.join(ROOT, '.fresh-setup');
const TEST_DATABASE = 'duna_fresh_integration_test';
const OWNER_ROLE = 'shipping';
const RUNTIME_ROLE = 'shipping_runtime_p11';
const EXPORT_ROLE = 'shipping_audit_export_p11';
const KEYS = Object.freeze([
  'FRESH_INSTANCE_ID',
  'FRESH_DATABASE_NAME',
  'FRESH_NEW_SERVER_ACK',
  'FRESH_DB_SUPER_PASSWORD',
  'FRESH_DB_OWNER_PASSWORD',
  'FRESH_DB_RUNTIME_PASSWORD',
  'FRESH_ADMIN_EMAIL',
  'FRESH_ADMIN_PASSWORD',
  'FRESH_AUTH_JWT_SECRET',
  'FRESH_AUTH_REFRESH_SECRET',
  'FRESH_ATTACHMENT_URL_SECRET',
]);
const SECRETS = Object.freeze([
  'FRESH_DB_SUPER_PASSWORD',
  'FRESH_DB_OWNER_PASSWORD',
  'FRESH_DB_RUNTIME_PASSWORD',
  'FRESH_ADMIN_PASSWORD',
  'FRESH_AUTH_JWT_SECRET',
  'FRESH_AUTH_REFRESH_SECRET',
  'FRESH_ATTACHMENT_URL_SECRET',
]);

function parseConfig(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const match = /^([A-Z_]+)=(.*)$/.exec(line);
    if (!match || !KEYS.includes(match[1]) || Object.hasOwn(values, match?.[1])) {
      throw new Error(
        'Fresh configuration has an unknown, repeated or malformed key; use .env.fresh.example'
      );
    }
    values[match[1]] = match[2];
  }
  for (const key of KEYS) {
    if (!values[key] || values[key] !== values[key].trim()) {
      throw new Error(`Fresh configuration requires a nonempty, unquoted ${key}`);
    }
  }
  if (!/^[a-z][a-z0-9-]{3,19}$/.test(values.FRESH_INSTANCE_ID)) {
    throw new Error('FRESH_INSTANCE_ID must be 4-20 lowercase letters, digits or hyphens');
  }
  if (
    !/^duna_fresh_[a-z0-9]{3,24}$/.test(values.FRESH_DATABASE_NAME) ||
    values.FRESH_DATABASE_NAME === TEST_DATABASE
  ) {
    throw new Error(
      'FRESH_DATABASE_NAME must be a dedicated duna_fresh_... database, not an owner/test database'
    );
  }
  if (values.FRESH_NEW_SERVER_ACK !== `NEW_EMPTY_SERVER:${values.FRESH_DATABASE_NAME}`) {
    throw new Error(
      'FRESH_NEW_SERVER_ACK must name the exact new empty database; existing installations are excluded'
    );
  }
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.FRESH_ADMIN_EMAIL) ||
    values.FRESH_ADMIN_EMAIL.length > 200 ||
    values.FRESH_ADMIN_EMAIL !== values.FRESH_ADMIN_EMAIL.toLowerCase()
  ) {
    throw new Error('FRESH_ADMIN_EMAIL must be a lowercase email address');
  }
  for (const key of SECRETS) {
    const value = values[key];
    const min = key === 'FRESH_ADMIN_PASSWORD' ? 16 : 32;
    if (
      value.length < min ||
      /[\x00-\x1f\x7f]/.test(value) ||
      /^(change.?me|example|password|placeholder|your)/i.test(value) ||
      value.startsWith('"') ||
      value.startsWith("'")
    ) {
      throw new Error(`${key} needs a private, unquoted secret of at least ${min} characters`);
    }
  }
  if (new Set(SECRETS.map((key) => values[key])).size !== SECRETS.length) {
    throw new Error('Fresh database, admin, signing and attachment secrets must be distinct');
  }
  return Object.freeze(values);
}

function loadConfig() {
  const stat = fs.lstatSync(CONFIG_FILE);
  if (!stat.isFile() || stat.mode & 0o077 || stat.uid !== process.getuid() || stat.size > 16_384) {
    throw new Error(
      '.env.fresh.local must be a regular, current-user-owned file with mode 0600 or 0400 (no symlinks)'
    );
  }
  return parseConfig(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function projectName(config) {
  return `duna-fresh-${config.FRESH_INSTANCE_ID}`;
}
function imageName(config) {
  return `${projectName(config)}:local`;
}
function statePath(config) {
  return path.join(STATE_DIR, `${config.FRESH_INSTANCE_ID}.json`);
}
function databaseUrl(host, database, role, password) {
  const url = new URL(`postgresql://${host}:5432/${database}`);
  url.username = role;
  url.password = password;
  url.searchParams.set('schema', 'public');
  return url.toString();
}
function composeEnvironment(config, testSecrets = {}) {
  // These values go to Docker Compose ONLY in its process environment, never
  // command arguments, console output, source files or a compose --env-file.
  const testPassword = testSecrets.password || randomBytes(36).toString('base64url');
  return {
    ...process.env,
    DUNA_FRESH_INSTANCE: config.FRESH_INSTANCE_ID,
    DUNA_FRESH_DATABASE: config.FRESH_DATABASE_NAME,
    DUNA_PG_SUPER_PASSWORD: config.FRESH_DB_SUPER_PASSWORD,
    DUNA_OWNER_DATABASE_URL: databaseUrl(
      'db',
      config.FRESH_DATABASE_NAME,
      OWNER_ROLE,
      config.FRESH_DB_OWNER_PASSWORD
    ),
    DUNA_RUNTIME_DATABASE_URL: databaseUrl(
      'db',
      config.FRESH_DATABASE_NAME,
      RUNTIME_ROLE,
      config.FRESH_DB_RUNTIME_PASSWORD
    ),
    DUNA_ADMIN_EMAIL: config.FRESH_ADMIN_EMAIL,
    DUNA_ADMIN_PASSWORD: config.FRESH_ADMIN_PASSWORD,
    DUNA_AUTH_JWT_SECRET: config.FRESH_AUTH_JWT_SECRET,
    DUNA_AUTH_REFRESH_SECRET: config.FRESH_AUTH_REFRESH_SECRET,
    DUNA_ATTACHMENT_URL_SECRET: config.FRESH_ATTACHMENT_URL_SECRET,
    DUNA_TEST_PASSWORD: testPassword,
    DUNA_TEST_DATABASE_URL: databaseUrl('test-db', TEST_DATABASE, OWNER_ROLE, testPassword),
    DUNA_TEST_ADMIN_PASSWORD: testSecrets.adminPassword || randomBytes(36).toString('base64url'),
  };
}

module.exports = {
  ROOT,
  CONFIG_FILE,
  STATE_DIR,
  TEST_DATABASE,
  OWNER_ROLE,
  RUNTIME_ROLE,
  EXPORT_ROLE,
  parseConfig,
  loadConfig,
  projectName,
  imageName,
  statePath,
  databaseUrl,
  composeEnvironment,
};
