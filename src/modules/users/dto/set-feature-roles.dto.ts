import { z } from 'zod';

// The full set the user should hold: an empty list revokes every feature role.
export const setFeatureRolesSchema = z.object({
  roleIds: z.array(z.number().int().positive()).max(50).meta({ example: [] }),
});

export type SetFeatureRolesDto = z.output<typeof setFeatureRolesSchema>;
