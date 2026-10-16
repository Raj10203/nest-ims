import { z } from 'zod';
import { parseEnv } from './parse-env.js';

// Only the worker sends mail, so only the worker needs these.
export const mailEnvSchema = z.object({
  MAIL_HOST: z.string().min(1),
  MAIL_PORT: z.coerce.number().int().positive(),
  MAIL_FROM: z.string().min(1),
  // Leave MAIL_USER and MAIL_PASSWORD out for an open relay such as Mailpit.
  MAIL_USER: z.string().min(1).optional(),
  MAIL_PASSWORD: z.string().min(1).optional(),
  // 'true' for implicit TLS (usually port 465); STARTTLS is negotiated otherwise.
  MAIL_SECURE: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const mailEnv = parseEnv(mailEnvSchema);
