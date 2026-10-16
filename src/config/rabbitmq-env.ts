import { z } from 'zod';
import { parseEnv } from './parse-env.js';

// Needed by everything that publishes or consumes jobs: the API and the worker.
export const rabbitmqEnvSchema = z.object({
  // amqp://user:password@host:5672 (amqps:// for TLS). Contains credentials.
  RABBITMQ_URL: z.string().regex(/^amqps?:\/\/.+/),
  // Jobs run at once; defaults to 5.
  WORKER_CONCURRENCY: z.coerce.number().int().positive().optional(),
});

export const rabbitmqEnv = parseEnv(rabbitmqEnvSchema);
