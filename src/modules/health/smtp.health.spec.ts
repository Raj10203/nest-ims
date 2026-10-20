import { createServer, type AddressInfo, type Server } from 'node:net';
import { Logger } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { SmtpHealthIndicator } from './smtp.health.js';

async function serverGreeting(greeting: string): Promise<Server> {
  const server = createServer((socket) => socket.end(greeting));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

describe('SmtpHealthIndicator', () => {
  const indicator = new SmtpHealthIndicator(new HealthIndicatorService());
  const portOf = (server: Server) => (server.address() as AddressInfo).port;
  const check = (port: number) => indicator.check({ host: '127.0.0.1', port });

  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('is up when the server greets with 220', async () => {
    const server = await serverGreeting('220 mail.test ESMTP\r\n');
    await expect(check(portOf(server))).resolves.toMatchObject({
      mail: { status: 'up' },
    });
    server.close();
  });

  it('is down, without connection details, when the server is not SMTP', async () => {
    const server = await serverGreeting('HTTP/1.1 400 Bad Request\r\n');
    await expect(check(portOf(server))).resolves.toMatchObject({
      mail: { status: 'down', message: 'SMTP server is unreachable' },
    });
    server.close();
  });

  it('is down when nothing listens', async () => {
    const server = await serverGreeting('');
    const port = portOf(server);
    await new Promise((resolve) => server.close(resolve));
    await expect(check(port)).resolves.toMatchObject({
      mail: { status: 'down' },
    });
  });
});
