import { z } from 'zod';

export const listSitesQuerySchema = z.object({
  // Matches name or code.
  search: z.string().trim().min(1).max(150).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListSitesQueryDto = z.output<typeof listSitesQuerySchema>;
