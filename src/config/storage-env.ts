import { z } from 'zod';
import { parseEnv } from './parse-env.js';

// Needed by the API (uploads). Contains the account key, so it is never logged.
export const storageEnvSchema = z.object({
  AZURE_STORAGE_CONNECTION_STRING: z.string().min(1),
  AZURE_STORAGE_CONTAINER: z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,62}$/),
  // Replaces the account endpoint in stored URLs: Azurite inside Docker is
  // http://azurite:10000, which the browser cannot reach. Also fits a CDN.
  AZURE_STORAGE_PUBLIC_URL: z.url().optional(),
});

export const storageEnv = parseEnv(storageEnvSchema);
