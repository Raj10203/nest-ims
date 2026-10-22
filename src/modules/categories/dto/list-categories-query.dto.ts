import { z } from 'zod';
import { booleanQuerySchema } from '../../../common/zod/boolean-query.schema.js';

export const listCategoriesQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  isActive: booleanQuerySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListCategoriesQueryDto = z.output<typeof listCategoriesQuerySchema>;
