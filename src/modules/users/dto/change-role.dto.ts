import { z } from 'zod';

export const changeRoleSchema = z.object({
  roleId: z.number().int().positive().meta({ example: 5 }),
});

export type ChangeRoleDto = z.output<typeof changeRoleSchema>;
