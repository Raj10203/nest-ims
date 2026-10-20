import { z } from 'zod';

// The examples are the seeded super admin from .env.example, so Swagger's
// "Try it out" logs in as-is on a development database.
export const loginSchema = z.object({
  email: z.email().toLowerCase().meta({ example: 'superadmin@example.com' }),
  password: z.string().min(1).meta({ example: 'ChangeMe123!' }),
});

export type LoginDto = z.output<typeof loginSchema>;
