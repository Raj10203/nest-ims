import { SendPasswordResetHandler } from './send-password-reset.handler.js';

const payload = {
  to: 'a@example.com',
  firstName: '<Jane>',
  url: 'http://localhost:3002/set-password?token=abc',
  expiresInMinutes: 60,
};

describe('SendPasswordResetHandler', () => {
  it('emails the link and its expiry, escaping the name in HTML', async () => {
    const mail = { send: vi.fn().mockResolvedValue(undefined) };
    await new SendPasswordResetHandler(mail as any).handle(payload);

    const message = mail.send.mock.calls[0][0];
    expect(message.to).toBe('a@example.com');
    expect(message.subject).toBe('Reset your IMS password');
    for (const body of [message.text, message.html]) {
      expect(body).toContain('set-password?token=abc');
      expect(body).toContain('60 minutes');
    }
    expect(message.html).toContain('&lt;Jane&gt;');
  });

  it('lets a mail failure through so the job is retried', async () => {
    const mail = { send: vi.fn().mockRejectedValue(new Error('smtp down')) };
    await expect(
      new SendPasswordResetHandler(mail as any).handle(payload),
    ).rejects.toThrow('smtp down');
  });
});
