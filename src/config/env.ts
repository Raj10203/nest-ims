import { z } from 'zod';
import { dbEnvSchema } from './db-env.js';
import { parseEnv } from './parse-env.js';

const booleanFlag = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

// Variables the running API needs: the database plus JWT settings.
// Migrations and the seed command import db-env.ts / seed-env.ts instead, so
// they do not require (or expose) the JWT secrets.
const appEnvSchema = dbEnvSchema.extend({
  // The frontend's address; invitation links point to <APP_URL>/set-password.
  APP_URL: z.url().transform((url) => url.replace(/\/+$/, '')),
  // Comma-separated browser origins allowed to call the API, e.g.
  // http://localhost:5173. Unset: no cross-origin access.
  CORS_ORIGINS: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1))
    .optional(),
  // 'true' serves Swagger UI at /docs.
  SWAGGER_ENABLED: booleanFlag.optional(),
  // Number of reverse proxies in front of the API, so rate limiting sees the
  // client's IP (X-Forwarded-For) instead of the proxy's.
  TRUST_PROXY: z.coerce.number().int().min(1).optional(),
  // Optional for the API (the worker requires them, see mail-env.ts): when
  // MAIL_HOST and MAIL_PORT are set, GET /health also checks that SMTP server.
  MAIL_HOST: z.string().min(1).optional(),
  MAIL_PORT: z.coerce.number().int().positive().optional(),
  MAIL_SECURE: booleanFlag.optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .optional(),
  LOG_FILE: z.string().min(1).optional(),
  // Anything but 'development' (including unset) logs like production: no bodies.
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  // Production only: 'true' also logs request bodies (never responses).
  LOG_REQUEST_BODY: booleanFlag.optional(),
});

export const env = parseEnv(appEnvSchema);
