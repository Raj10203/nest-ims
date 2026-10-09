import { z } from 'zod';
import { parseEnv } from './parse-env.js';

// Everything that connects to the database (the API, migrations, the seed
// command) needs exactly these, and nothing else.
export const dbEnvSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1),
  // 'true' for managed databases that require TLS.
  DB_SSL: z.enum(['true', 'false']).transform((value) => value === 'true'),
  // Optional path to a PEM file with the CA certificate(s) used to verify the
  // server (only used when DB_SSL=true). Without it, Node's built-in trusted
  // authorities are used.
  DB_SSL_CA: z.string().min(1).optional(),
});

export const dbEnv = parseEnv(dbEnvSchema);
