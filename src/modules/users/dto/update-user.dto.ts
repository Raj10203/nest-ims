import { z } from 'zod';
import { createUserSchema } from './create-user.dto.js';

// The role of an existing user cannot be changed through this endpoint. The
// example changes only the first name: a new email would reset verification.
export const updateUserSchema = createUserSchema
  .omit({ roleId: true })
  .partial()
  .meta({ example: { firstName: 'Janet' } });

export type UpdateUserDto = z.output<typeof updateUserSchema>;
