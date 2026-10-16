import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ChannelWrapper } from 'amqp-connection-manager';
import { ATTEMPT_HEADER, JOBS_EXCHANGE, JOBS_QUEUE } from './jobs.constants.js';
import type { JobEnvelope, JobPayloads, JobType } from './job.types.js';
import { RabbitMqConnection } from './rabbitmq.connection.js';

@Injectable()
export class JobQueueService {
  private readonly channel: ChannelWrapper;

  constructor(rabbit: RabbitMqConnection) {
    this.channel = rabbit.createChannel();
  }

  // Resolves when the broker confirms the message; rejects after 5s if unreachable.
  async publish<T extends JobType>(
    type: T,
    payload: JobPayloads[T],
  ): Promise<void> {
    const envelope: JobEnvelope<T> = {
      id: randomUUID(),
      type,
      payload,
      createdAt: new Date().toISOString(),
    };
    await this.channel.publish(
      JOBS_EXCHANGE,
      JOBS_QUEUE,
      Buffer.from(JSON.stringify(envelope)),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: envelope.id,
        type,
        headers: { [ATTEMPT_HEADER]: 1 },
        timeout: 5000,
      },
    );
  }
}
