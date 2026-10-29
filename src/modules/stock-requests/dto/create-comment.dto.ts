import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .meta({ example: 'Can we send 3 now and the rest next week?' }),
  // A reply; a reply to a reply joins the same top comment.
  parentId: z.number().int().positive().nullish().meta({ example: null }),
});

export type CreateCommentDto = z.output<typeof createCommentSchema>;
