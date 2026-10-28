import { Injectable } from '@nestjs/common';
import type { JobHandler, JobPayloads } from '../jobs/job.types.js';
import { escapeHtml } from './escape-html.js';
import { MailService } from './mail.service.js';

@Injectable()
export class SendPasswordResetHandler implements JobHandler<'mail.send-password-reset'> {
  readonly type = 'mail.send-password-reset';
  // The link is dead after it expires, so the failed job is no use either.
  readonly deadLetterTtlMs = 60 * 60 * 1000;

  constructor(private readonly mail: MailService) {}

  async handle({
    to,
    firstName,
    url,
    expiresInMinutes,
  }: JobPayloads['mail.send-password-reset']): Promise<void> {
    await this.mail.send({
      to,
      subject: 'Reset your IMS password',
      text:
        `Hi ${firstName},\n\nSomeone asked to reset the password of your IMS account (${to}).\n\n` +
        `Set a new password here (the link works once and expires in ${expiresInMinutes} minutes):\n${url}\n\n` +
        `If you did not ask for this, ignore this email: your password stays the same.\n`,
      html:
        `<p>Hi ${escapeHtml(firstName)},</p><p>Someone asked to reset the password of your IMS account (<b>${escapeHtml(to)}</b>).</p>` +
        `<p><a href="${escapeHtml(url)}">Set a new password</a></p>` +
        `<p>The link works once and expires in ${expiresInMinutes} minutes.</p>` +
        `<p>If you did not ask for this, ignore this email: your password stays the same.</p>`,
    });
  }
}
