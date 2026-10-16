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
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .optional(),
  LOG_FILE: z.string().min(1).optional(),
  // Anything but 'development' (including unset) logs like production: no bodies.
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  // Production only: 'true' also logs request bodies (never responses).
  LOG_REQUEST_BODY: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const env = parseEnv(appEnvSchema);
