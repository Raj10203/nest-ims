import { Injectable } from '@nestjs/common';
import { OTP_TTL_MINUTES } from '../auth/email-verification.service.js';
import type { JobHandler, JobPayloads } from '../jobs/job.types.js';
import { MailService } from './mail.service.js';

@Injectable()
export class SendEmailOtpHandler implements JobHandler<'mail.send-email-otp'> {
  readonly type = 'mail.send-email-otp';
  // The code is useless once it expires, so do not keep it any longer.
  readonly deadLetterTtlMs = OTP_TTL_MINUTES * 60_000;

  constructor(private readonly mail: MailService) {}

  async handle({
    to,
    otp,
    expiresInMinutes,
  }: JobPayloads['mail.send-email-otp']): Promise<void> {
    await this.mail.send({
      to,
      subject: 'Your verification code',
      text: `Your verification code is ${otp}. It expires in ${expiresInMinutes} minutes.`,
      html: `<p>Your verification code is <b>${otp}</b>.</p><p>It expires in ${expiresInMinutes} minutes.</p>`,
    });
  }
}
