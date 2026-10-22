import { z } from 'zod';
import { MeasureType } from '../../../common/enums/measure-type.enum.js';
import { ProductType } from '../../../common/enums/product-type.enum.js';
import { booleanQuerySchema } from '../../../common/zod/boolean-query.schema.js';

export const listProductsQuerySchema = z.object({
  search: z.string().trim().min(1).max(150).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  type: z.enum(ProductType).optional(),
  measureType: z.enum(MeasureType).optional(),
  isActive: booleanQuerySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListProductsQueryDto = z.output<typeof listProductsQuerySchema>;
