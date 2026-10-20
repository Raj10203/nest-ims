import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ChannelWrapper, connect } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import { rabbitmqEnv } from '../../config/rabbitmq-env.js';
import {
  DEAD_QUEUE,
  JOBS_EXCHANGE,
  JOBS_QUEUE,
  RETRY_DELAYS_MS,
  retryQueue,
} from './jobs.constants.js';

// Runs on every (re)connect, and from both the API and the worker, so either
// can start first. Redeclaring the same queues is a no-op.
async function assertTopology(channel: ConfirmChannel): Promise<void> {
  const quorum = { 'x-queue-type': 'quorum' };
  await channel.assertExchange(JOBS_EXCHANGE, 'direct', { durable: true });
  await channel.assertQueue(JOBS_QUEUE, {
    durable: true,
    arguments: quorum,
  });
  await channel.bindQueue(JOBS_QUEUE, JOBS_EXCHANGE, JOBS_QUEUE);
  await channel.assertQueue(DEAD_QUEUE, { durable: true, arguments: quorum });

  // A retry queue holds a message for its TTL, then dead-letters it back into
  // the jobs queue. This delays retries without a broker plugin.
  for (const delay of RETRY_DELAYS_MS) {
    await channel.assertQueue(retryQueue(delay), {
      durable: true,
      arguments: {
        ...quorum,
        'x-message-ttl': delay,
        'x-dead-letter-exchange': JOBS_EXCHANGE,
        'x-dead-letter-routing-key': JOBS_QUEUE,
      },
    });
  }
}

@Injectable()
export class RabbitMqConnection implements OnApplicationShutdown {
  private readonly logger = new Logger(RabbitMqConnection.name);
  // Reconnects on its own; the URL holds credentials, so it is never logged.
  private readonly connection = connect([rabbitmqEnv.RABBITMQ_URL]);
  private closing = false;

  constructor() {
    this.connection.on('connect', () => this.logger.log('Connected'));
    this.connection.on('disconnect', ({ err }) =>
      this.logger.warn(`Disconnected: ${err?.message}`),
    );
  }

  isConnected(): boolean {
    return this.connection.isConnected();
  }

  createChannel(): ChannelWrapper {
    const channel = this.connection.createChannel({ setup: assertTopology });
    // A failed setup is emitted as 'error'; with no listener, EventEmitter throws
    // it as an unhandled rejection, which crashes the process.
    channel.on('error', (err: Error) => {
      if (!this.closing) this.logger.error(`Channel error: ${err.message}`);
    });
    return channel;
  }

  async onApplicationShutdown(): Promise<void> {
    this.closing = true;
    await this.connection.close();
  }
}
