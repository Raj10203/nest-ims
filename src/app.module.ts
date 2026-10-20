import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { minutes, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppI18nModule } from './common/i18n/app-i18n.module.js';
import { I18nExceptionFilter } from './common/i18n/i18n-exception.filter.js';
import type { ErrorKey } from './common/i18n/i18n-message.js';
import { AppLoggerModule } from './common/logger/app-logger.module.js';
import { ZodValidationPipe } from './common/zod/zod-validation.pipe.js';
import { storageEnv } from './config/storage-env.js';
import { dataSourceOptions } from './database/data-source.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AuthorizationModule } from './modules/authorization/authorization.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { SitesModule } from './modules/sites/sites.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    AppLoggerModule,
    AppI18nModule,
    // Per client IP, in memory: each API instance counts on its own.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: minutes(1), limit: 100 }],
      errorMessage: 'errors.tooManyRequests' satisfies ErrorKey,
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    StorageModule.forRoot({
      connectionString: storageEnv.AZURE_STORAGE_CONNECTION_STRING,
      container: storageEnv.AZURE_STORAGE_CONTAINER,
      publicUrl: storageEnv.AZURE_STORAGE_PUBLIC_URL,
    }),
    AuthorizationModule,
    UsersModule,
    RolesModule,
    SitesModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: I18nExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
