import { Module } from '@nestjs/common';
import { JobQueueService } from './job-queue.service.js';
import { RabbitMqConnection } from './rabbitmq.connection.js';

@Module({
  providers: [RabbitMqConnection, JobQueueService],
  exports: [RabbitMqConnection, JobQueueService],
})
export class JobsModule {}
