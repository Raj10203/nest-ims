import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).meta({ example: 'Power Tools' }),
  description: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .nullish()
    .meta({ example: 'Drills, grinders and cutters' }),
  isActive: z.boolean().default(true),
});

export type CreateCategoryDto = z.output<typeof createCategorySchema>;
