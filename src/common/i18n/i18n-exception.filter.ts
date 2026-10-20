import { STATUS_CODES } from 'node:http';
import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { I18nContext } from 'nestjs-i18n';
import type { I18nTranslations } from '../../generated/i18n.generated.js';
import { isErrorKey } from './i18n-message.js';

// Global (APP_FILTER): translates `errors.*` keys in `message` and in validation
// `errors[].message`; everything else gets Nest's default handling.
@Catch()
export class I18nExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const i18n = I18nContext.current<I18nTranslations>(host);
    if (!(exception instanceof HttpException) || !i18n) {
      return super.catch(exception, host);
    }

    const response = exception.getResponse();
    const body = (
      typeof response === 'string' ? { message: response } : response
    ) as Record<string, unknown>;
    const { message, args, errors, ...rest } = body;
    if (!isErrorKey(message)) return super.catch(exception, host);

    const translate = (text: unknown) =>
      isErrorKey(text)
        ? i18n.t(text, { args: args as Record<string, unknown> | undefined })
        : text;
    const status = exception.getStatus();
    const adapter = this.applicationRef ?? this.httpAdapterHost!.httpAdapter;
    adapter.reply(
      host.switchToHttp().getResponse(),
      {
        statusCode: status,
        error: STATUS_CODES[status],
        ...rest,
        message: translate(message),
        ...(Array.isArray(errors) && {
          errors: errors.map((error: { message: unknown }) => ({
            ...error,
            message: translate(error.message),
          })),
        }),
      },
      status,
    );
  }
}
