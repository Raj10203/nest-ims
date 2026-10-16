import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { SendEmailOtpHandler } from '../mail/send-email-otp.handler.js';
import { JOB_HANDLERS } from './jobs.constants.js';
import { JobWorker } from './job-worker.service.js';
import { JobsModule } from './jobs.module.js';

@Module({
  imports: [JobsModule, MailModule],
  providers: [
    JobWorker,
    {
      provide: JOB_HANDLERS,
      useFactory: (...handlers: unknown[]) => handlers,
      inject: [SendEmailOtpHandler],
    },
  ],
})
export class JobsWorkerModule {}
