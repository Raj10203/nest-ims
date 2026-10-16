import { Module } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { SendEmailOtpHandler } from './send-email-otp.handler.js';

// Worker side only: the API publishes mail jobs through JobsModule.
@Module({
  providers: [MailService, SendEmailOtpHandler],
  exports: [SendEmailOtpHandler],
})
export class MailModule {}
