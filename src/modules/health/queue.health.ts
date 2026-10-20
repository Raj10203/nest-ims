import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { ChannelWrapper } from 'amqp-connection-manager';
import { JOBS_QUEUE } from '../jobs/jobs.constants.js';
import { RabbitMqConnection } from '../jobs/rabbitmq.connection.js';
import { HEALTH_TIMEOUT_MS } from './health.constants.js';

@Injectable()
export class QueueHealthIndicator {
  private channel?: ChannelWrapper;

  constructor(
    private readonly health: HealthIndicatorService,
    private readonly rabbit: RabbitMqConnection,
  ) {}

  broker() {
    return this.health.check('rabbitmq').attempt(() => {
      if (!this.rabbit.isConnected()) {
        throw new Error('Not connected to RabbitMQ');
      }
    });
  }

  // The worker is a separate process, so it is seen through the broker: it is up
  // while at least one worker consumes the jobs queue. Queue sizes are left out of
  // this public response; the RabbitMQ management UI has them.
  worker() {
    return this.health
      .check('worker')
      .attempt(async () => {
        // A channel queues operations while disconnected, so without this check
        // the attempt would only end at the timeout.
        if (!this.rabbit.isConnected()) {
          throw new Error('Unknown: RabbitMQ is unreachable');
        }
        this.channel ??= this.rabbit.createChannel();
        // checkQueue throws instead of waiting while the channel is still opening.
        await this.channel.waitForConnect();
        const { consumerCount } = await this.channel.checkQueue(JOBS_QUEUE);
        if (consumerCount === 0) {
          throw new Error('No worker is consuming the jobs queue');
        }
      })
      .withTimeout(HEALTH_TIMEOUT_MS);
  }
}
