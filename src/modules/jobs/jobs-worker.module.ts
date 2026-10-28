import { Module } from '@nestjs/common';
import { mailEnv } from '../../config/mail-env.js';
import { MailModule } from '../mail/mail.module.js';
import { SendEmailOtpHandler } from '../mail/send-email-otp.handler.js';
import { SendInviteHandler } from '../mail/send-invite.handler.js';
import { SendLoginOtpHandler } from '../mail/send-login-otp.handler.js';
import { SendPasswordResetHandler } from '../mail/send-password-reset.handler.js';
import { JOB_HANDLERS } from './jobs.constants.js';
import { JobWorker } from './job-worker.service.js';
import { JobsModule } from './jobs.module.js';

@Module({
  imports: [
    JobsModule,
    MailModule.forRoot({
      host: mailEnv.MAIL_HOST,
      port: mailEnv.MAIL_PORT,
      from: mailEnv.MAIL_FROM,
      secure: mailEnv.MAIL_SECURE,
      auth:
        mailEnv.MAIL_USER && mailEnv.MAIL_PASSWORD
          ? { user: mailEnv.MAIL_USER, pass: mailEnv.MAIL_PASSWORD }
          : undefined,
    }),
  ],
  providers: [
    JobWorker,
    {
      provide: JOB_HANDLERS,
      useFactory: (...handlers: unknown[]) => handlers,
      inject: [
        SendEmailOtpHandler,
        SendInviteHandler,
        SendLoginOtpHandler,
        SendPasswordResetHandler,
      ],
    },
  ],
})
export class JobsWorkerModule {}
