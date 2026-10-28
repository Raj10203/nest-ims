import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z
    .email()
    .max(255)
    .toLowerCase()
    .meta({ example: 'superadmin@example.com' }),
});

export type ForgotPasswordDto = z.output<typeof forgotPasswordSchema>;
