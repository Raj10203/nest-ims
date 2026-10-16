import { SendEmailOtpHandler } from './send-email-otp.handler.js';

const payload = { to: 'a@example.com', otp: '042917', expiresInMinutes: 10 };

describe('SendEmailOtpHandler', () => {
  it('emails the code and its expiry', async () => {
    const mail = { send: vi.fn().mockResolvedValue(undefined) };
    await new SendEmailOtpHandler(mail as any).handle(payload);

    const message = mail.send.mock.calls[0][0];
    expect(message.to).toBe('a@example.com');
    expect(message.subject).toBe('Your verification code');
    for (const body of [message.text, message.html]) {
      expect(body).toContain('042917');
      expect(body).toContain('10 minutes');
    }
  });

  it('lets a mail failure through so the job is retried', async () => {
    const mail = { send: vi.fn().mockRejectedValue(new Error('smtp down')) };
    await expect(
      new SendEmailOtpHandler(mail as any).handle(payload),
    ).rejects.toThrow('smtp down');
  });
});
