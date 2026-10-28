import { z } from 'zod';
import { passwordSchema } from '../../../common/security/password-policy.js';
import { createUserSchema } from '../../users/dto/create-user.dto.js';

// Email, role and site stay with the admins (PATCH /users/:id).
export const updateProfileSchema = createUserSchema
  .pick({ firstName: true, middleName: true, lastName: true })
  .partial()
  .meta({ example: { firstName: 'Janet' } });

export type UpdateProfileDto = z.output<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).meta({ example: 'ChangeMe123!' }),
  // `password`, like the other routes that set one: assertPasswordAvoidsNames
  // reports on that path.
  password: passwordSchema,
});

export type ChangePasswordDto = z.output<typeof changePasswordSchema>;
