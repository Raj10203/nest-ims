import { z } from 'zod';
import { createZodDto } from '../../../common/zod/create-zod-dto.js';

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
