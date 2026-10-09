import { existsSync } from 'node:fs';
import { z } from 'zod';

// Load .env from the working directory when present. Variables already set in
// the process environment (docker-compose, the hosting platform) take precedence.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export function parseEnv<T extends z.ZodType>(schema: T): z.infer<T> {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
