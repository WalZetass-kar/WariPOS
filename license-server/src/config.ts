import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH ?? './data/license.db';
const DATA_DIR = path.dirname(path.resolve(DB_PATH));
const SECRETS_FILE = path.join(DATA_DIR, '.secrets.json');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'initial-admin-credentials.txt');

/** Values that must never reach production. */
const KNOWN_WEAK_SECRETS = new Set([
  'dev-access-secret',
  'dev-refresh-secret',
  'change-me',
  'change-me-please',
  'secret',
  'jwt-secret',
]);

const KNOWN_WEAK_PASSWORDS = new Set(['admin#12345', 'admin123', 'password', '12345678']);

function isWeakSecret(value: string): boolean {
  return KNOWN_WEAK_SECRETS.has(value.trim().toLowerCase()) || value.trim().length < 32;
}

function isWeakPassword(value: string): boolean {
  return KNOWN_WEAK_PASSWORDS.has(value.trim().toLowerCase()) || value.trim().length < 12;
}

function isProduction(): boolean {
  return (process.env.NODE_ENV ?? 'development').trim().toLowerCase() === 'production';
}

function readPersistedSecrets(): Record<string, string> {
  try {
    const raw = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8')) as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' && value.length > 0) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function writePersistedSecret(key: string, value: string): void {
  const current = readPersistedSecrets();
  current[key] = value;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(current, null, 2), { mode: 0o600 });
}

/**
 * Resolve a JWT secret.
 *
 * The value comes from the environment when it is strong enough. Otherwise a
 * random secret is generated once and stored next to the database with owner
 * only permissions, so restarts keep working without a known default.
 */
function resolveSecret(name: string, persisted: Record<string, string>): string {
  const fromEnv = process.env[name];

  if (fromEnv && !isWeakSecret(fromEnv)) return fromEnv;

  if (isProduction() && fromEnv) {
    throw new Error(
      `${name} ditolak karena lemah. Gunakan nilai acak minimal 32 karakter pada production.`,
    );
  }

  if (persisted[name]) return persisted[name];

  const generated = crypto.randomBytes(48).toString('hex');
  writePersistedSecret(name, generated);
  console.warn(
    `[config] ${name} tidak diatur, secret acak dibuat di ${SECRETS_FILE} (mode 0600).`,
  );
  return generated;
}

function resolveAdminPassword(): { password: string; generated: boolean } {
  const fromEnv = process.env.ADMIN_PASSWORD;

  if (fromEnv && !isWeakPassword(fromEnv)) return { password: fromEnv, generated: false };

  if (isProduction() && fromEnv) {
    throw new Error(
      'ADMIN_PASSWORD ditolak karena lemah. Gunakan kata sandi acak minimal 12 karakter pada production.',
    );
  }

  return { password: crypto.randomBytes(18).toString('base64url'), generated: true };
}

const persistedSecrets = readPersistedSecrets();
const adminPassword = resolveAdminPassword();

export const config = {
  PORT: Number(process.env.PORT ?? 4000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  DB_PATH,
  DATA_DIR,
  SECRETS_FILE,
  CREDENTIALS_FILE,

  JWT_ACCESS_SECRET: resolveSecret('JWT_ACCESS_SECRET', persistedSecrets),
  JWT_REFRESH_SECRET: resolveSecret('JWT_REFRESH_SECRET', persistedSecrets),
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '15m',
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? '30d',

  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? 'admin@zetass.local',
  ADMIN_PASSWORD: adminPassword.password,
  /** True when the password was generated locally instead of taken from the environment. */
  ADMIN_PASSWORD_GENERATED: adminPassword.generated,
  ADMIN_NAME: process.env.ADMIN_NAME ?? 'Super Admin',

  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),

  APP_BILLING_URL: process.env.APP_BILLING_URL ?? 'https://wa.me/628123456789',
  APP_WHATSAPP: process.env.APP_WHATSAPP ?? '628123456789',
};
