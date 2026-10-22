import { z } from 'zod';
import { createCategorySchema } from './create-category.dto.js';

// Built from the base fields so the isActive default does not re-apply on a partial update.
export const updateCategorySchema = z
  .object(createCategorySchema.shape)
  .partial()
  .meta({ example: { description: 'Drills, grinders, cutters and saws' } });

export type UpdateCategoryDto = z.output<typeof updateCategorySchema>;
