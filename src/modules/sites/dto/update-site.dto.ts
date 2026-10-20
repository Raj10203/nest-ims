import { z } from 'zod';
import { createSiteSchema } from './create-site.dto.js';

// Built from the base fields so the isActive default does not re-apply on a partial update.
export const updateSiteSchema = z
  .object(createSiteSchema.shape)
  .partial()
  .meta({ example: { name: 'Ahmedabad Central Warehouse' } });

export type UpdateSiteDto = z.output<typeof updateSiteSchema>;
