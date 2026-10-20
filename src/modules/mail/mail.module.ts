import { DynamicModule, Module } from '@nestjs/common';
import { MAIL_OPTIONS, MailOptions, MailService } from './mail.service.js';
import { SendEmailOtpHandler } from './send-email-otp.handler.js';
import { SendInviteHandler } from './send-invite.handler.js';
import { SendLoginOtpHandler } from './send-login-otp.handler.js';

// Worker side only: the API publishes mail jobs through JobsModule.
@Module({})
export class MailModule {
  static forRoot(options: MailOptions): DynamicModule {
    return {
      module: MailModule,
      providers: [
        { provide: MAIL_OPTIONS, useValue: options },
        MailService,
        SendEmailOtpHandler,
        SendInviteHandler,
        SendLoginOtpHandler,
      ],
      exports: [SendEmailOtpHandler, SendInviteHandler, SendLoginOtpHandler],
    };
  }
}
