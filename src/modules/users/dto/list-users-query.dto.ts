import { z } from 'zod';
import { createZodDto } from '../../../common/zod/create-zod-dto.js';

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export class ListUsersQueryDto extends createZodDto(listUsersQuerySchema) {}
