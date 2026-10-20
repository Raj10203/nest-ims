import type { I18nPath } from '../../generated/i18n.generated.js';

export type ErrorKey = Extract<I18nPath, `errors.${string}`>;

export interface I18nMessage {
  message: ErrorKey;
  args?: Record<string, unknown>;
}

// Exceptions carry a key that I18nExceptionFilter translates. `message` stays
// the key, so tests can match it with toThrow('errors.users.notFound').
export function i18nMessage(
  key: ErrorKey,
  args?: Record<string, unknown>,
): I18nMessage {
  return args ? { message: key, args } : { message: key };
}

export function isErrorKey(value: unknown): value is ErrorKey {
  return typeof value === 'string' && value.startsWith('errors.');
}
