import { z } from 'zod';

// No example on purpose, so Swagger never pre-fills an id for a DELETE.
export const idParamSchema = z.coerce.number().int().positive();
