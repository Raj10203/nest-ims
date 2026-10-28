import { z } from 'zod';
import type { ErrorKey } from '../../../common/i18n/i18n-message.js';

const conditionSchema = z.number().int().min(0).max(100);
const dueDateSchema = z.iso.date();

// codeSuffix is what follows the product's prefix; left out, the next
// automatic number is used. condition and nextCalibrationDueAt default from
// the product (item-rules.ts).
export const createItemSchema = z.object({
  productId: z.number().int().positive().meta({ example: 1 }),
  codeSuffix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,20}$/, 'errors.items.suffixFormat' satisfies ErrorKey)
    .nullish()
    .meta({ example: null }),
  serialNumber: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .nullish()
    .meta({ example: null }),
  condition: conditionSchema.nullish().meta({ example: null }),
  nextCalibrationDueAt: dueDateSchema.nullish().meta({ example: null }),
  note: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .nullish()
    .meta({ example: 'Opening stock' }),
});

export type CreateItemDto = z.output<typeof createItemSchema>;

// The product and code of an item never change.
export const updateItemSchema = z
  .object({
    serialNumber: createItemSchema.shape.serialNumber,
    condition: conditionSchema,
    nextCalibrationDueAt: dueDateSchema,
    note: createItemSchema.shape.note,
  })
  .partial()
  .meta({ example: { note: 'Kept in rack B2' } });

export type UpdateItemDto = z.output<typeof updateItemSchema>;
