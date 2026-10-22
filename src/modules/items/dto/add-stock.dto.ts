import { z } from 'zod';

export const addStockSchema = z.object({
  productId: z.number().int().positive().meta({ example: 1 }),
  quantity: z.number().int().positive().meta({ example: 10 }),
});

export type AddStockDto = z.output<typeof addStockSchema>;
