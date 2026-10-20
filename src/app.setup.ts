import { INestApplication } from '@nestjs/common';
import type { Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';

// Shared by main.ts and the e2e tests so both behave the same.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api', { exclude: ['health', 'health/live'] });

  if (env.TRUST_PROXY) {
    const express: Express = app.getHttpAdapter().getInstance();
    express.set('trust proxy', env.TRUST_PROXY);
  }

  // upgrade-insecure-requests is dropped so the Swagger UI page also loads over
  // plain http (local development); TLS is the reverse proxy's job.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
    }),
  );

  if (env.CORS_ORIGINS) {
    app.enableCors({
      origin: env.CORS_ORIGINS,
      allowedHeaders: ['Authorization', 'Content-Type', 'Accept-Language'],
      exposedHeaders: ['Retry-After'],
      maxAge: 3600,
    });
  }

  // Close the HTTP server and the database pool on SIGTERM/SIGINT. Without it a
  // container running as PID 1 ignores `docker stop` and is killed after 10s.
  app.enableShutdownHooks();
}
