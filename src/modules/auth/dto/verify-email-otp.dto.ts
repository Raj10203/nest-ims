import { z } from 'zod';
import { createZodDto } from '../../../common/zod/create-zod-dto.js';

export const verifyEmailOtpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export class VerifyEmailOtpDto extends createZodDto(verifyEmailOtpSchema) {}
