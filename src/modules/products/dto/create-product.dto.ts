import { z } from 'zod';
import type { ErrorKey } from '../../../common/i18n/i18n-message.js';
import { MeasureType } from '../../../common/enums/measure-type.enum.js';
import { PackUnit } from '../../../common/enums/pack-unit.enum.js';
import { ProductType } from '../../../common/enums/product-type.enum.js';

// Rules between fields (bulk needs a pack, calibrated needs an interval) are
// checked on the saved-to-be record in ProductsService, so PATCH follows them too.
export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(150).meta({ example: 'Bolt M10 x 50' }),
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z0-9]{2,10}$/,
      'errors.products.prefixFormat' satisfies ErrorKey,
    )
    .meta({ example: 'BLT10' }),
  categoryId: z.number().int().positive().meta({ example: 1 }),
  type: z.enum(ProductType).meta({ example: ProductType.CONSUMABLE }),
  measureType: z.enum(MeasureType).meta({ example: MeasureType.BULK }),
  packSize: z.number().int().positive().nullish().meta({ example: 100 }),
  packUnit: z.enum(PackUnit).nullish().meta({ example: PackUnit.PCS }),
  calibrationIntervalDays: z
    .number()
    .int()
    .positive()
    .max(3650)
    .nullish()
    .meta({ example: null }),
  description: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .nullish()
    .meta({ example: 'Box of 100 zinc-plated hex bolts' }),
  isActive: z.boolean().default(true),
});

export type CreateProductDto = z.output<typeof createProductSchema>;
