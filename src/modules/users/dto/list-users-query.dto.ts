import { z } from 'zod';
import { UserStatus } from '../../../common/enums/user-status.enum.js';

export const listUsersQuerySchema = z.object({
  // Matches first name, last name or email.
  search: z.string().trim().min(1).max(150).optional(),
  roleId: z.coerce.number().int().positive().optional(),
  siteId: z.coerce.number().int().positive().optional(),
  status: z.enum(UserStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListUsersQueryDto = z.output<typeof listUsersQuerySchema>;
