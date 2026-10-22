import { z } from 'zod';

// z.coerce.boolean() would read the query string "false" as true.
export const booleanQuerySchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');
