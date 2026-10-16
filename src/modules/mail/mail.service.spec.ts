import { createTransport } from 'nodemailer';
import { MailService } from './mail.service.js';

const env = vi.hoisted(() => ({
  MAIL_HOST: 'smtp.example.com',
  MAIL_PORT: 587,
  MAIL_FROM: 'IMS <no-reply@example.com>',
  MAIL_USER: undefined as string | undefined,
  MAIL_PASSWORD: undefined as string | undefined,
  MAIL_SECURE: undefined as boolean | undefined,
}));
vi.mock('../../config/mail-env.js', () => ({ mailEnv: env }));

const transport = vi.hoisted(() => ({
  sendMail: vi.fn(),
  close: vi.fn(),
}));
vi.mock('nodemailer', () => ({ createTransport: vi.fn(() => transport) }));

const message = {
  to: 'a@example.com',
  subject: 'Hi',
  text: 'hello',
  html: '<p>hello</p>',
};

describe('MailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.MAIL_USER = undefined;
    env.MAIL_PASSWORD = undefined;
  });

  it('connects without auth and with short timeouts by default', () => {
    new MailService();
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        connectionTimeout: 10_000,
        auth: undefined,
      }),
    );
  });

  it('uses auth when both user and password are set', () => {
    env.MAIL_USER = 'user';
    env.MAIL_PASSWORD = 'pass';
    new MailService();
    expect(vi.mocked(createTransport).mock.calls[0][0]).toMatchObject({
      auth: { user: 'user', pass: 'pass' },
    });
  });

  it('sends from MAIL_FROM and passes failures on', async () => {
    const service = new MailService();
    transport.sendMail.mockResolvedValueOnce({});
    await service.send(message);
    expect(transport.sendMail).toHaveBeenCalledWith({
      from: 'IMS <no-reply@example.com>',
      ...message,
    });

    transport.sendMail.mockRejectedValueOnce(new Error('refused'));
    await expect(service.send(message)).rejects.toThrow('refused');
  });

  it('closes the transport on shutdown', () => {
    new MailService().onModuleDestroy();
    expect(transport.close).toHaveBeenCalled();
  });
});
