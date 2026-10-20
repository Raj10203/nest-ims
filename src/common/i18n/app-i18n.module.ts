import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { FALLBACK_LANGUAGE } from './languages.js';

// nestjs-i18n's middleware stores the language for the whole request, so guards,
// pipes and filters can read it (I18nContext.current()).
@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: FALLBACK_LANGUAGE,
      // src/i18n is copied next to the compiled code (assets in nest-cli.json).
      loaderOptions: { path: join(import.meta.dirname, '../../i18n') },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
      ],
    }),
  ],
})
export class AppI18nModule {}
