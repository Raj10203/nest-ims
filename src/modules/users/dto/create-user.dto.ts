import { z } from 'zod';

// Every field has an example, so the body Swagger builds from them passes this
// schema; swagger-examples.spec.ts checks it. The docs page swaps in a fresh
// email and the site_technician role id on each load (common/swagger). No
// password: the user sets it through the emailed invitation link.
export const createUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100).meta({ example: 'Jane' }),
  middleName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .nullish()
    .meta({ example: null }),
  lastName: z.string().trim().min(1).max(100).meta({ example: 'Doe' }),
  email: z
    .email()
    .max(255)
    .toLowerCase()
    .meta({ example: 'jane.doe@example.com' }),
  roleId: z.number().int().positive().meta({ example: 5 }),
  // 1 is the headquarters (seeded).
  siteId: z.number().int().positive().meta({ example: 1 }),
});

export type CreateUserDto = z.output<typeof createUserSchema>;
