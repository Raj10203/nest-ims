import { Injectable } from '@nestjs/common';
import type { JobHandler, JobPayloads } from '../jobs/job.types.js';
import { MailService } from './mail.service.js';

@Injectable()
export class SendLoginOtpHandler implements JobHandler<'mail.send-login-otp'> {
  readonly type = 'mail.send-login-otp';
  readonly deadLetterTtlMs = 24 * 60 * 60 * 1000;

  constructor(private readonly mail: MailService) {}

  async handle({
    to,
    otp,
    expiresInMinutes,
  }: JobPayloads['mail.send-login-otp']): Promise<void> {
    await this.mail.send({
      to,
      subject: 'Your sign-in code',
      text: `Your IMS sign-in code is ${otp}. It expires in ${expiresInMinutes} minutes. If you did not try to sign in, tell your administrator: your password is known to someone else.`,
      html: `<p>Your IMS sign-in code is <b>${otp}</b>.</p><p>It expires in ${expiresInMinutes} minutes. If you did not try to sign in, tell your administrator: your password is known to someone else.</p>`,
    });
  }
}
