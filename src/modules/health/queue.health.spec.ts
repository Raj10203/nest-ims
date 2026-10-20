import { HealthIndicatorService } from '@nestjs/terminus';
import { QueueHealthIndicator } from './queue.health.js';

function setup({ connected = true, consumers = 1 } = {}) {
  const channel = {
    waitForConnect: vi.fn().mockResolvedValue(undefined),
    checkQueue: vi.fn(async (queue: string) =>
      queue === 'jobs'
        ? { consumerCount: consumers, messageCount: 3 }
        : { consumerCount: 0, messageCount: 1 },
    ),
  };
  const rabbit = {
    isConnected: () => connected,
    createChannel: () => channel,
  };
  return new QueueHealthIndicator(new HealthIndicatorService(), rabbit as any);
}

describe('QueueHealthIndicator', () => {
  it('reports the worker up with its queue counts', async () => {
    await expect(setup().worker()).resolves.toMatchObject({
      worker: { status: 'up', consumers: 1, pendingJobs: 3, deadJobs: 1 },
    });
  });

  it('reports the worker down when nothing consumes the jobs queue', async () => {
    await expect(setup({ consumers: 0 }).worker()).resolves.toMatchObject({
      worker: {
        status: 'down',
        message: 'No worker is consuming the jobs queue',
      },
    });
  });

  it('reports broker and worker down when RabbitMQ is unreachable', async () => {
    const indicator = setup({ connected: false });
    await expect(indicator.broker()).resolves.toMatchObject({
      rabbitmq: { status: 'down' },
    });
    await expect(indicator.worker()).resolves.toMatchObject({
      worker: { status: 'down' },
    });
  });
});
