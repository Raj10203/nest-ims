import { z } from 'zod';
import { StockRequestStatus } from '../../../common/enums/stock-request-status.enum.js';
import { booleanQuerySchema } from '../../../common/zod/boolean-query.schema.js';

export const listStockRequestsQuerySchema = z.object({
  status: z.enum(StockRequestStatus).optional(),
  siteId: z.coerce.number().int().positive().optional(),
  // Only the requests waiting for the caller's step of the review chain.
  awaitingMe: booleanQuerySchema.optional(),
  // Only the requests the caller raised.
  mine: booleanQuerySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListStockRequestsQueryDto = z.output<
  typeof listStockRequestsQuerySchema
>;
