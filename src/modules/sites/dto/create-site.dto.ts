import { z } from 'zod';
import type { ErrorKey } from '../../../common/i18n/i18n-message.js';

// Every field has an example (or a default), so the body Swagger builds from
// them passes this schema; swagger-examples.spec.ts checks it.
export const createSiteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(150)
    .meta({ example: 'Ahmedabad Warehouse' }),
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .toUpperCase()
    .meta({ example: 'AMD-01' }),
  address: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .nullish()
    .meta({ example: '12 Ring Road' }),
  city: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .nullish()
    .meta({ example: 'Ahmedabad' }),
  state: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .nullish()
    .meta({ example: 'Gujarat' }),
  pincode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, 'errors.sites.pincodeFormat' satisfies ErrorKey)
    .nullish()
    .meta({ example: '380001' }),
  isActive: z.boolean().default(true),
  inchargeId: z.number().int().positive().nullish().meta({ example: null }),
});

export type CreateSiteDto = z.output<typeof createSiteSchema>;
