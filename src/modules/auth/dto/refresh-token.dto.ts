import { z } from 'zod';

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1)
    .meta({ example: 'refreshToken from the login response' }),
});

export type RefreshTokenDto = z.output<typeof refreshTokenSchema>;
