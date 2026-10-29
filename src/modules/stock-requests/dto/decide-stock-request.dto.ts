import { z } from 'zod';
import type { ErrorKey } from '../../../common/i18n/i18n-message.js';
import { MAX_REQUEST_QUANTITY } from './create-stock-request.dto.js';

const noteSchema = z.string().trim().min(1).max(1000);

// Approving at either step may change line quantities on the way (0 leaves a
// product out); each change is recorded.
export const approveStockRequestSchema = z.object({
  lines: z
    .array(
      z.object({
        id: z.number().int().positive(),
        quantity: z.number().int().min(0).max(MAX_REQUEST_QUANTITY),
      }),
    )
    .max(50)
    .refine(
      (lines) => new Set(lines.map((line) => line.id)).size === lines.length,
      'errors.stockRequests.duplicateLine' satisfies ErrorKey,
    )
    .optional()
    .meta({ example: [] }),
  note: noteSchema.nullish().meta({ example: null }),
});

export type ApproveStockRequestDto = z.output<typeof approveStockRequestSchema>;

export const rejectStockRequestSchema = z.object({
  note: noteSchema.meta({ example: 'Not needed this quarter' }),
});

export type RejectStockRequestDto = z.output<typeof rejectStockRequestSchema>;

export const cancelStockRequestSchema = z.object({
  note: noteSchema.nullish().meta({ example: null }),
});

export type CancelStockRequestDto = z.output<typeof cancelStockRequestSchema>;

export const closeStockRequestSchema = z.object({
  note: noteSchema.meta({ example: 'The rest is no longer needed' }),
});

export type CloseStockRequestDto = z.output<typeof closeStockRequestSchema>;
