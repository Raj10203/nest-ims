import { z } from 'zod';
import { RoleName } from '../../../common/enums/role-name.enum.js';
import { createZodDto } from '../../../common/zod/create-zod-dto.js';

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  middleName: z.string().trim().min(1).max(100).nullish(),
  lastName: z.string().trim().min(1).max(100),
  email: z.email().max(255).toLowerCase(),
  password: z.string().min(8).max(128),
  role: z.enum(RoleName),
});

export class CreateUserDto extends createZodDto(createUserSchema) {}
