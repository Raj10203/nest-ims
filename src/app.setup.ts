import { INestApplication } from '@nestjs/common';

// Shared by main.ts and the e2e tests so both expose the same URLs:
// every route lives under /api except the health check.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api', { exclude: ['health'] });
  // Close the HTTP server and the database pool on SIGTERM/SIGINT. Without it a
  // container running as PID 1 ignores `docker stop` and is killed after 10s.
  app.enableShutdownHooks();
}
