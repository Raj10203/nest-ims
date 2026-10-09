import { z } from 'zod';
import { parseEnv } from './parse-env.js';

const seedEnvSchema = z.object({
  SEED_SUPER_ADMIN_EMAIL: z.email(),
  SEED_SUPER_ADMIN_PASSWORD: z.string().min(8),
  SEED_SUPER_ADMIN_FIRST_NAME: z.string().min(1),
  SEED_SUPER_ADMIN_LAST_NAME: z.string().min(1),
});

// Read lazily: only needed on the first run, when the super admin does not exist yet.
export const getSeedEnv = () => parseEnv(seedEnvSchema);
