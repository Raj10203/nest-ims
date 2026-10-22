import { z } from 'zod';

// Far above any real delivery: it only stops a typo from holding the product
// row lock while millions of rows are inserted.
export const MAX_ADD_STOCK_QUANTITY = 10_000;

export const addStockSchema = z.object({
  productId: z.number().int().positive().meta({ example: 1 }),
  quantity: z
    .number()
    .int()
    .positive()
    .max(MAX_ADD_STOCK_QUANTITY)
    .meta({ example: 10 }),
});

export type AddStockDto = z.output<typeof addStockSchema>;
