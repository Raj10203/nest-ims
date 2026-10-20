import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { JobsModule } from '../jobs/jobs.module.js';
import { HealthController } from './health.controller.js';
import { QueueHealthIndicator } from './queue.health.js';
import { SmtpHealthIndicator } from './smtp.health.js';

@Module({
  imports: [TerminusModule.forRoot({ errorLogStyle: 'pretty' }), JobsModule],
  controllers: [HealthController],
  providers: [QueueHealthIndicator, SmtpHealthIndicator],
})
export class HealthModule {}
