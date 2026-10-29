import { z } from 'zod';
import type { ErrorKey } from '../../../common/i18n/i18n-message.js';

export const createPackageSchema = z.object({
  requestId: z.number().int().positive().meta({ example: 1 }),
});

export type CreatePackageDto = z.output<typeof createPackageSchema>;

const codesSchema = z
  .array(z.string().trim().toUpperCase().min(1).max(40))
  .min(1)
  .max(500)
  .refine(
    (codes) => new Set(codes).size === codes.length,
    'errors.packages.duplicateCode' satisfies ErrorKey,
  );

export const packItemsSchema = z.object({
  codes: codesSchema.meta({ example: ['DRL-000001'] }),
});

export type PackItemsDto = z.output<typeof packItemsSchema>;

// Without codes the whole package is received.
export const receivePackageSchema = z
  .object({ codes: codesSchema.optional() })
  .meta({ example: {} });

export type ReceivePackageDto = z.output<typeof receivePackageSchema>;
