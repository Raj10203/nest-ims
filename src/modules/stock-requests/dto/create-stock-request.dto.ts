import { z } from 'zod';
import type { ErrorKey } from '../../../common/i18n/i18n-message.js';
import { MAX_ADD_STOCK_QUANTITY } from '../../items/dto/add-stock.dto.js';

// A line is at most what one stock addition can bring in.
export const MAX_REQUEST_QUANTITY = MAX_ADD_STOCK_QUANTITY;

const noteSchema = z.string().trim().min(1).max(1000);

export const createStockRequestSchema = z.object({
  lines: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(MAX_REQUEST_QUANTITY),
        note: noteSchema.nullish(),
      }),
    )
    .min(1)
    .max(50)
    .refine(
      (lines) =>
        new Set(lines.map((line) => line.productId)).size === lines.length,
      'errors.stockRequests.duplicateProduct' satisfies ErrorKey,
    )
    .meta({ example: [{ productId: 1, quantity: 5, note: null }] }),
  note: noteSchema.nullish().meta({ example: 'For the new floor at block B' }),
  neededBy: z.iso.date().nullish().meta({ example: null }),
  // false (the default) keeps it a draft its site can still edit.
  submit: z.boolean().default(false),
});

export type CreateStockRequestDto = z.output<typeof createStockRequestSchema>;

// A draft is saved whole: the lines replace the old ones.
export const updateStockRequestSchema = createStockRequestSchema.meta({
  example: {
    lines: [{ productId: 1, quantity: 5, note: 'Size L' }],
    note: null,
    neededBy: null,
    submit: false,
  },
});

export type UpdateStockRequestDto = z.output<typeof updateStockRequestSchema>;
