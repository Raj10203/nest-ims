// One folder per language in src/i18n/. Adding a language also needs its zod
// locale in ZodValidationPipe.
export const LANGUAGES = ['en', 'hi', 'gu'] as const;
export type Language = (typeof LANGUAGES)[number];
export const FALLBACK_LANGUAGE: Language = 'en';
