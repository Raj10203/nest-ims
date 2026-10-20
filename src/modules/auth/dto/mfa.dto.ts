import { z } from 'zod';
import type { ErrorKey } from '../../../common/i18n/i18n-message.js';

export const loginMfaSchema = z.object({
  challengeToken: z
    .string()
    .min(1)
    .meta({ example: 'challengeToken from the login response' }),
  otp: z
    .string()
    .regex(/^\d{6}$/, 'errors.otp.format' satisfies ErrorKey)
    .meta({ example: '123456' }),
});

export type LoginMfaDto = z.output<typeof loginMfaSchema>;

export const setMfaSchema = z.object({
  enabled: z.boolean().meta({ example: true }),
  password: z.string().min(1).meta({ example: 'ChangeMe123!' }),
});

export type SetMfaDto = z.output<typeof setMfaSchema>;
