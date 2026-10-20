import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { env } from '../../config/env.js';
import { Public } from '../auth/public.decorator.js';
import { HEALTH_TIMEOUT_MS } from './health.constants.js';
import { QueueHealthIndicator } from './queue.health.js';
import { SmtpHealthIndicator } from './smtp.health.js';
import { StorageHealthIndicator } from './storage.health.js';

// Served at /health and /health/live, outside the global /api prefix (see app.setup.ts).
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly queue: QueueHealthIndicator,
    private readonly smtp: SmtpHealthIndicator,
    private readonly storage: StorageHealthIndicator,
  ) {}

  // Each dependency is reported under info (up) or error (down); any down
  // service makes the response a 503.
  @ApiOperation({ summary: 'Status of every service the API depends on' })
  @Get()
  @HealthCheck()
  check() {
    const { MAIL_HOST, MAIL_PORT, MAIL_SECURE } = env;
    return this.health.check([
      () => this.db.pingCheck('database').withTimeout(HEALTH_TIMEOUT_MS),
      () => this.queue.broker(),
      () => this.queue.worker(),
      () => this.storage.check(),
      ...(MAIL_HOST && MAIL_PORT
        ? [
            () =>
              this.smtp.check({
                host: MAIL_HOST,
                port: MAIL_PORT,
                secure: MAIL_SECURE,
              }),
          ]
        : []),
    ]);
  }

  // Liveness only (the process answers). The Docker HEALTHCHECK uses it, so an
  // outage of a dependency does not mark the API container itself unhealthy.
  @ApiOperation({ summary: 'Liveness probe' })
  @SkipThrottle()
  @Get('live')
  live() {
    return { status: 'ok' };
  }
}
