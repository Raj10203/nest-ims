import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export const MAIL_OPTIONS = Symbol('MAIL_OPTIONS');

export interface MailOptions {
  host: string;
  port: number;
  from: string;
  // true for implicit TLS (usually port 465); STARTTLS is negotiated otherwise.
  secure?: boolean;
  auth?: { user: string; pass: string };
}

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly transport: Transporter;

  constructor(@Inject(MAIL_OPTIONS) private readonly options: MailOptions) {
    this.transport = createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure ?? false,
      // Nodemailer waits 2 minutes by default, which would tie up a worker slot
      // when the SMTP server is unreachable.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      auth: options.auth,
    });
  }

  async send(message: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    await this.transport.sendMail({ from: this.options.from, ...message });
  }

  onModuleDestroy(): void {
    this.transport.close();
  }
}
