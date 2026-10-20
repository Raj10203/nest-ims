import { connect as connectTcp, type Socket } from 'node:net';
import { connect as connectTls } from 'node:tls';
import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { HEALTH_TIMEOUT_MS } from './health.constants.js';

export interface SmtpTarget {
  host: string;
  port: number;
  secure?: boolean;
}

// Connects and waits for the server's 220 greeting, then quits: no login and no
// mail sent.
export function readSmtpGreeting(
  { host, port, secure }: SmtpTarget,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket: Socket = secure
      ? connectTls({ host, port, servername: host })
      : connectTcp({ host, port });
    signal.addEventListener('abort', () => socket.destroy(signal.reason), {
      once: true,
    });
    socket.setEncoding('utf8');
    socket.once('data', (greeting: string) => {
      socket.end('QUIT\r\n');
      if (greeting.startsWith('220')) resolve();
      else reject(new Error('Unexpected SMTP greeting'));
    });
    socket.once('error', reject);
    socket.once('close', () => reject(new Error('Closed without a greeting')));
  });
}

@Injectable()
export class SmtpHealthIndicator {
  private readonly logger = new Logger(SmtpHealthIndicator.name);

  constructor(private readonly health: HealthIndicatorService) {}

  check(target: SmtpTarget) {
    return this.health
      .check('mail')
      .attempt(async ({ signal }) => {
        try {
          await readSmtpGreeting(target, signal);
        } catch (error) {
          // The health response is public, so the details (addresses) only go to the log.
          this.logger.warn(`SMTP check failed: ${(error as Error).message}`);
          throw new Error('SMTP server is unreachable');
        }
      })
      .withTimeout(HEALTH_TIMEOUT_MS);
  }
}
