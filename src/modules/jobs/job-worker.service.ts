import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { ConsumeMessage } from 'amqplib';
import { rabbitmqEnv } from '../../config/rabbitmq-env.js';
import {
  ATTEMPT_HEADER,
  DEAD_QUEUE,
  JOB_HANDLERS,
  JOBS_QUEUE,
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
  retryQueue,
} from './jobs.constants.js';
import type { AnyJobHandler, JobEnvelope } from './job.types.js';
import { RabbitMqConnection } from './rabbitmq.connection.js';

const DEFAULT_CONCURRENCY = 5;

// A message is acked only after its handler finishes or it is moved to a retry
// or dead-letter queue, so a crash redelivers it: handlers must be safe to run twice.
@Injectable()
export class JobWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(JobWorker.name);
  private readonly handlers: Map<string, AnyJobHandler>;
  private readonly inFlight = new Set<Promise<void>>();
  private readonly channel: ChannelWrapper;

  constructor(
    rabbit: RabbitMqConnection,
    @Inject(JOB_HANDLERS) handlers: AnyJobHandler[],
  ) {
    this.channel = rabbit.createChannel();
    this.handlers = new Map(handlers.map((handler) => [handler.type, handler]));
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.channel.consume(
      JOBS_QUEUE,
      (message) => {
        const run = this.process(message).finally(() =>
          this.inFlight.delete(run),
        );
        this.inFlight.add(run);
      },
      { prefetch: rabbitmqEnv.WORKER_CONCURRENCY ?? DEFAULT_CONCURRENCY },
    );
    this.logger.log(
      `Consuming "${JOBS_QUEUE}" (${[...this.handlers.keys()].join(', ')})`,
    );
  }

  // Stop taking jobs and let running ones finish before the connection closes.
  async onModuleDestroy(): Promise<void> {
    await this.channel.cancelAll();
    await Promise.allSettled(this.inFlight);
  }

  private async process(message: ConsumeMessage | null): Promise<void> {
    if (!message) return;
    try {
      await this.run(message);
    } catch (error) {
      // Could not even move the message (broker trouble): put it back.
      this.logger.error(`Requeueing message: ${describe(error)}`);
      this.channel.nack(message, false, true);
    }
  }

  private async run(message: ConsumeMessage): Promise<void> {
    let envelope: JobEnvelope;
    try {
      envelope = JSON.parse(message.content.toString());
    } catch {
      return this.deadLetter(message, 1, 'Malformed message');
    }

    const attempt = Number(message.properties.headers?.[ATTEMPT_HEADER] ?? 1);
    const handler = this.handlers.get(envelope.type);
    if (!handler) {
      return this.deadLetter(
        message,
        attempt,
        `No handler for ${envelope.type}`,
      );
    }

    try {
      await handler.handle(envelope.payload as never, {
        jobId: envelope.id,
        attempt,
      });
      this.channel.ack(message);
      this.logger.log(
        `${envelope.type} ${envelope.id} done (attempt ${attempt})`,
      );
    } catch (error) {
      await this.retryOrDeadLetter(message, envelope, attempt, describe(error));
    }
  }

  private async retryOrDeadLetter(
    message: ConsumeMessage,
    envelope: JobEnvelope,
    attempt: number,
    reason: string,
  ): Promise<void> {
    if (attempt >= MAX_ATTEMPTS) {
      this.logger.error(
        `${envelope.type} ${envelope.id} failed for good after ${attempt} attempts: ${reason}`,
      );
      return this.deadLetter(
        message,
        attempt,
        reason,
        this.handlers.get(envelope.type)?.deadLetterTtlMs,
      );
    }

    const delay = RETRY_DELAYS_MS[attempt - 1];
    this.logger.warn(
      `${envelope.type} ${envelope.id} failed (attempt ${attempt}), retrying in ${delay}ms: ${reason}`,
    );
    await this.channel.sendToQueue(retryQueue(delay), message.content, {
      persistent: true,
      contentType: 'application/json',
      messageId: message.properties.messageId,
      type: message.properties.type,
      headers: { [ATTEMPT_HEADER]: attempt + 1, 'x-last-error': reason },
    });
    this.channel.ack(message);
  }

  private async deadLetter(
    message: ConsumeMessage,
    attempt: number,
    reason: string,
    ttlMs?: number,
  ): Promise<void> {
    await this.channel.sendToQueue(DEAD_QUEUE, message.content, {
      persistent: true,
      expiration: ttlMs,
      contentType: 'application/json',
      messageId: message.properties.messageId,
      type: message.properties.type,
      headers: {
        [ATTEMPT_HEADER]: attempt,
        'x-last-error': reason,
        'x-failed-at': new Date().toISOString(),
      },
    });
    this.channel.ack(message);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
