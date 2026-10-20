import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { i18nMessage, type ErrorKey } from '../i18n/i18n-message.js';

// Used wherever a password is SET (invitation, admin update), not at login.
export const passwordSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Z]/, 'errors.password.uppercase' satisfies ErrorKey)
  .regex(/[a-z]/, 'errors.password.lowercase' satisfies ErrorKey)
  .regex(/\d/, 'errors.password.digit' satisfies ErrorKey)
  .regex(/[^A-Za-z0-9]/, 'errors.password.symbol' satisfies ErrorKey)
  .meta({ example: 'Password123!' });

// Names shorter than 3 letters are skipped: "al" or "li" would reject far too
// many passwords. Same 400 shape as ZodValidationPipe, so clients handle one format.
export function assertPasswordAvoidsNames(
  password: string,
  names: (string | null | undefined)[],
): void {
  const lower = password.toLowerCase();
  const found = names.some(
    (name) =>
      name &&
      name.trim().length >= 3 &&
      lower.includes(name.trim().toLowerCase()),
  );
  if (found) {
    throw new BadRequestException({
      ...i18nMessage('errors.validationFailed'),
      errors: [
        {
          path: 'password',
          message: 'errors.password.containsName' satisfies ErrorKey,
        },
      ],
    });
  }
}
