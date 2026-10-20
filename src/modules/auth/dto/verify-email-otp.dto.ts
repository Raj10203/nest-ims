import { z } from 'zod';
import type { ErrorKey } from '../../../common/i18n/i18n-message.js';

export const verifyEmailOtpSchema = z.object({
  otp: z
    .string()
    .regex(/^\d{6}$/, 'errors.otp.format' satisfies ErrorKey)
    .meta({ example: '123456' }),
});

export type VerifyEmailOtpDto = z.output<typeof verifyEmailOtpSchema>;
