import { z } from 'zod';
import { dbEnvSchema } from './db-env.js';
import { parseEnv } from './parse-env.js';

// Variables the running API needs: the database plus JWT settings.
// Migrations and the seed command import db-env.ts / seed-env.ts instead, so
// they do not require (or expose) the JWT secrets.
const appEnvSchema = dbEnvSchema.extend({
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),
  MAIL_HOST: z.string().min(1),
  MAIL_PORT: z.coerce.number().int().positive(),
  MAIL_FROM: z.string().min(1),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .optional(),
  LOG_FILE: z.string().min(1).optional(),
  // Anything but 'development' (including unset) logs like production: no bodies.
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  // Production only: 'true' logs the request body of failed (4xx/5xx) requests.
  LOG_REQUEST_BODY: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const env = parseEnv(appEnvSchema);
