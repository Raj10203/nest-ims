import { z } from 'zod';
import { createZodDto } from '../../../common/zod/create-zod-dto.js';

export const loginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1),
});

export class LoginDto extends createZodDto(loginSchema) {}
