import { createZodDto } from '../../../common/zod/create-zod-dto.js';
import { createUserSchema } from './create-user.dto.js';

// The role of an existing user cannot be changed through this endpoint.
export const updateUserSchema = createUserSchema.omit({ role: true }).partial();

export class UpdateUserDto extends createZodDto(updateUserSchema) {}
