import { z } from 'zod';
import { passwordSchema } from '../../../common/security/password-policy.js';

export const acceptInvitationSchema = z.object({
  token: z
    .string()
    .min(1)
    .max(200)
    .meta({ example: 'token from the invitation link' }),
  password: passwordSchema,
});

export type AcceptInvitationDto = z.output<typeof acceptInvitationSchema>;
