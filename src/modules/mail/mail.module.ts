import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { MAIL_QUEUE } from './mail.constants.js';
import { MailProcessor } from './mail.processor.js';
import { MailQueueService } from './mail-queue.service.js';

@Module({
  imports: [
    // BullMQ does not load ioredis itself under ESM, so the client is passed in.
    // maxRetriesPerRequest must be null for the worker's blocking commands.
    BullModule.forRoot({
      connection: new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        maxRetriesPerRequest: null,
      }),
    }),
    BullModule.registerQueue({ name: MAIL_QUEUE }),
  ],
  providers: [MailQueueService, MailProcessor],
  exports: [MailQueueService],
})
export class MailModule {}
