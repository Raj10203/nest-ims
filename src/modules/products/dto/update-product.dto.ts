import { z } from 'zod';
import { createProductSchema } from './create-product.dto.js';

// Built from the base fields so the isActive default does not re-apply on a partial update.
export const updateProductSchema = z
  .object(createProductSchema.shape)
  .partial()
  .meta({ example: { name: 'Hex bolt M10 x 50' } });

export type UpdateProductDto = z.output<typeof updateProductSchema>;
