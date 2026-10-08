import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { z } from 'zod';

// Registered globally via APP_PIPE in AppModule. Validates any @Body(),
// @Query() or @Param() whose type was created with createZodDto(); other
// parameters pass through untouched.
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    const schema = (metadata.metatype as { schema?: unknown } | undefined)
      ?.schema;
    if (!(schema instanceof z.ZodType)) {
      return value;
    }

    const result = schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
