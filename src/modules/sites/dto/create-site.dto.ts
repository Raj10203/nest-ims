import { z } from 'zod';
import { createZodDto } from '../../../common/zod/create-zod-dto.js';

export const createSiteSchema = z.object({
  name: z.string().trim().min(1).max(150),
  code: z.string().trim().min(1).max(50).toUpperCase(),
  address: z.string().trim().min(1).max(255).nullish(),
  city: z.string().trim().min(1).max(100).nullish(),
  state: z.string().trim().min(1).max(100).nullish(),
  isActive: z.boolean().default(true),
  inchargeId: z.number().int().positive().nullish(),
});

export class CreateSiteDto extends createZodDto(createSiteSchema) {}
