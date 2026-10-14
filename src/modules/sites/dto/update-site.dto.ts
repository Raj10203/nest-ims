import { z } from 'zod';
import { createZodDto } from '../../../common/zod/create-zod-dto.js';
import { createSiteSchema } from './create-site.dto.js';

// Built from the base fields so the isActive default does not re-apply on a partial update.
export const updateSiteSchema = z.object(createSiteSchema.shape).partial();

export class UpdateSiteDto extends createZodDto(updateSiteSchema) {}
