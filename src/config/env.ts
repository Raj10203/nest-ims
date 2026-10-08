import { existsSync } from 'node:fs';
import { z } from 'zod';

// Load .env from the project root when present. Variables already set in the
// process environment (e.g. by docker-compose) take precedence over the file.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const envSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1),
  // Credentials of the first super admin created by the seeder.
  SEED_SUPER_ADMIN_EMAIL: z.email(),
  SEED_SUPER_ADMIN_PASSWORD: z.string().min(8),
  SEED_SUPER_ADMIN_FIRST_NAME: z.string().min(1),
  SEED_SUPER_ADMIN_LAST_NAME: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables:\n${z.prettifyError(parsed.error)}`,
  );
}

export const env = parsed.data;
