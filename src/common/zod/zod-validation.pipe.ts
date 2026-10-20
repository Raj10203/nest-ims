import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { z } from 'zod';
import { i18nMessage } from '../i18n/i18n-message.js';
import { FALLBACK_LANGUAGE, Language } from '../i18n/languages.js';

// zod's built-in messages in each supported language. A message set in a schema
// is used instead; make it a translation key (errors.*) so I18nExceptionFilter
// translates it.
const zodErrorMaps: Record<Language, z.core.$ZodErrorMap> = {
  en: z.locales.en().localeError,
  hi: z.locales.hi().localeError,
  gu: z.locales.gu().localeError,
};

// Registered globally via APP_PIPE in AppModule. Validates any parameter declared
// with a zod schema, e.g. `@Body({ schema: createUserSchema })` (the same schema
// Swagger documents); other parameters pass through untouched.
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, { schema }: ArgumentMetadata) {
    if (!(schema instanceof z.ZodType)) {
      return value;
    }

    const lang = I18nContext.current()?.lang as Language | undefined;
    const result = schema.safeParse(value, {
      error: zodErrorMaps[lang ?? FALLBACK_LANGUAGE] ?? zodErrorMaps.en,
    });
    if (!result.success) {
      throw new BadRequestException({
        ...i18nMessage('errors.validationFailed'),
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
