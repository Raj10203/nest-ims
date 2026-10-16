import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { mailEnv } from '../../config/mail-env.js';

@Injectable()
export class MailService {
  private readonly transport = createTransport({
    host: mailEnv.MAIL_HOST,
    port: mailEnv.MAIL_PORT,
    secure: mailEnv.MAIL_SECURE ?? false,
    // Nodemailer waits 2 minutes by default, which would tie up a worker slot
    // when the SMTP server is unreachable.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    auth:
      mailEnv.MAIL_USER && mailEnv.MAIL_PASSWORD
        ? { user: mailEnv.MAIL_USER, pass: mailEnv.MAIL_PASSWORD }
        : undefined,
  });

  async send(message: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    await this.transport.sendMail({ from: mailEnv.MAIL_FROM, ...message });
  }
}
