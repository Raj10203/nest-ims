import { Test } from '@nestjs/testing';
import { createTransport } from 'nodemailer';
import { MailModule } from './mail.module.js';
import { MailService, type MailOptions } from './mail.service.js';

const transport = vi.hoisted(() => ({
  sendMail: vi.fn(),
  close: vi.fn(),
}));
vi.mock('nodemailer', () => ({ createTransport: vi.fn(() => transport) }));

const options: MailOptions = {
  host: 'smtp.example.com',
  port: 587,
  from: 'IMS <no-reply@example.com>',
};

const message = {
  to: 'a@example.com',
  subject: 'Hi',
  text: 'hello',
  html: '<p>hello</p>',
};

describe('MailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('connects without auth and with short timeouts by default', () => {
    new MailService(options);
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

  it('uses auth when it is given', () => {
    new MailService({ ...options, auth: { user: 'user', pass: 'pass' } });
    expect(vi.mocked(createTransport).mock.calls[0][0]).toMatchObject({
      auth: { user: 'user', pass: 'pass' },
    });
  });

  it('sends from the configured address and passes failures on', async () => {
    const service = new MailService(options);
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
    new MailService(options).onModuleDestroy();
    expect(transport.close).toHaveBeenCalled();
  });
});

describe('MailModule.forRoot', () => {
  it('injects the given options into MailService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MailModule.forRoot({ ...options, port: 2525 })],
    }).compile();

    expect(moduleRef.get(MailService)).toBeInstanceOf(MailService);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.example.com', port: 2525 }),
    );
    await moduleRef.close();
  });
});
