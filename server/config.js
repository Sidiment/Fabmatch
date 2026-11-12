/** Server settings, read from environment variables with prototype-friendly defaults. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SERVER_DIR, '..');
const HOUR_MS = 3600000;
const DEFAULT_SESSION_HOURS = 24 * 7;
const DEFAULT_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';

function positiveNumber(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number, got "${value}".`);
  return n;
}

export function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  return Object.freeze({
    isProduction,
    port: positiveNumber(env.PORT, 3001, 'PORT'),
    dataDir: path.resolve(env.DATA_DIR || path.join(SERVER_DIR, '.data')),
    seedDir: path.join(SERVER_DIR, 'data', 'seed'),
    staticDir: path.resolve(env.STATIC_DIR || path.join(PROJECT_DIR, 'dist')),
    sessionTtlMs: positiveNumber(env.SESSION_TTL_HOURS, DEFAULT_SESSION_HOURS, 'SESSION_TTL_HOURS') * HOUR_MS,
    // The __Host- prefix makes browsers insist on Secure, path=/, and no Domain.
    cookieName: isProduction ? '__Host-fm_session' : 'fm_session',
    allowedOrigins: Object.freeze((env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map((o) => o.trim()).filter(Boolean)),
    trustProxy: env.TRUST_PROXY === '1',
    rateLimits: Object.freeze({
      windowMs: 15 * 60 * 1000,
      auth: positiveNumber(env.AUTH_RATE_LIMIT, 20, 'AUTH_RATE_LIMIT'),
      contact: positiveNumber(env.CONTACT_RATE_LIMIT, 10, 'CONTACT_RATE_LIMIT'),
      api: positiveNumber(env.API_RATE_LIMIT, 1000, 'API_RATE_LIMIT'),
    }),
  });
}
