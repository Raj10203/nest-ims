import { z } from 'zod';
import { booleanQuerySchema } from '../../../common/zod/boolean-query.schema.js';

export const listNotificationsQuerySchema = z.object({
  unread: booleanQuerySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListNotificationsQueryDto = z.output<
  typeof listNotificationsQuerySchema
>;
