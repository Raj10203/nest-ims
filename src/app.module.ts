import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZodValidationPipe } from './common/zod/zod-validation.pipe.js';
import { dataSourceOptions } from './database/data-source.js';
import { HealthController } from './health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AuthorizationModule } from './modules/authorization/authorization.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    AuthorizationModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
})
export class AppModule {}
