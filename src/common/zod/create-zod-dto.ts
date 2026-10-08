import type { z } from 'zod';

export interface ZodDto<T extends z.ZodType = z.ZodType> {
  new (): z.infer<T>;
  schema: T;
}

// Wraps a zod schema in a class so it can be used as a parameter type
// (e.g. `@Body() body: CreateItemDto`). The global ZodValidationPipe reads
// the static `schema` from the parameter's metatype and validates against it.
export function createZodDto<T extends z.ZodType>(schema: T): ZodDto<T> {
  class Dto {
    static schema = schema;
  }
  return Dto as unknown as ZodDto<T>;
}
