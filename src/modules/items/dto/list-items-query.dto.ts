import { z } from 'zod';
import { ItemStatus } from '../../../common/enums/item-status.enum.js';
import { MovementAction } from '../../../common/enums/movement-action.enum.js';

const filters = {
  productId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  siteId: z.coerce.number().int().positive().optional(),
  status: z.enum(ItemStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const listItemsQuerySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  ...filters,
});

export type ListItemsQueryDto = z.output<typeof listItemsQuerySchema>;

export const stockQuerySchema = z.object(filters);

export type StockQueryDto = z.output<typeof stockQuerySchema>;

export const movementsQuerySchema = z.object({
  siteId: filters.siteId,
  productId: filters.productId,
  action: z.enum(MovementAction).optional(),
  page: filters.page,
  limit: filters.limit,
});

export type MovementsQueryDto = z.output<typeof movementsQuerySchema>;

export const pageQuerySchema = z.object({
  page: filters.page,
  limit: filters.limit,
});

export type PageQueryDto = z.output<typeof pageQuerySchema>;
