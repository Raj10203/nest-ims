import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { createTransport } from 'nodemailer';
import { env } from '../../config/env.js';
import {
  MAIL_QUEUE,
  SEND_EMAIL_OTP_JOB,
  SendEmailOtpJob,
} from './mail.constants.js';

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);
  private readonly transport = createTransport({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
  });

  async process(job: Job<SendEmailOtpJob>): Promise<void> {
    if (job.name !== SEND_EMAIL_OTP_JOB) {
      throw new Error(`Unknown mail job "${job.name}"`);
    }
    const { to, otp, expiresInMinutes } = job.data;
    await this.transport.sendMail({
      from: env.MAIL_FROM,
      to,
      subject: 'Your verification code',
      text: `Your verification code is ${otp}. It expires in ${expiresInMinutes} minutes.`,
      html: `<p>Your verification code is <b>${otp}</b>.</p><p>It expires in ${expiresInMinutes} minutes.</p>`,
    });
    this.logger.log(`Sent ${job.name} email (job ${job.id})`);
  }
}
