import { Injectable } from '@nestjs/common';
import type { JobHandler, JobPayloads } from '../jobs/job.types.js';
import { escapeHtml } from './escape-html.js';
import { MailService } from './mail.service.js';

@Injectable()
export class SendInviteHandler implements JobHandler<'mail.send-invite'> {
  readonly type = 'mail.send-invite';
  // The link in the payload stays usable until it expires, so a failed job is
  // not kept longer than needed to look into it.
  readonly deadLetterTtlMs = 24 * 60 * 60 * 1000;

  constructor(private readonly mail: MailService) {}

  async handle({
    to,
    firstName,
    url,
    expiresInHours,
  }: JobPayloads['mail.send-invite']): Promise<void> {
    const name = escapeHtml(firstName);
    await this.mail.send({
      to,
      subject: 'You have been added to IMS',
      text:
        `Hi ${firstName},\n\nAn IMS account was created for you. Your username is ${to}.\n\n` +
        `Set your password here (the link works once and expires in ${expiresInHours} hours):\n${url}\n`,
      html:
        `<p>Hi ${name},</p><p>An IMS account was created for you. Your username is <b>${escapeHtml(to)}</b>.</p>` +
        `<p><a href="${escapeHtml(url)}">Set your password</a></p>` +
        `<p>The link works once and expires in ${expiresInHours} hours.</p>`,
    });
  }
}
