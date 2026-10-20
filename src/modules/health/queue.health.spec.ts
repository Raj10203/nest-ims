import { HealthIndicatorService } from '@nestjs/terminus';
import { QueueHealthIndicator } from './queue.health.js';

function setup({ connected = true, consumers = 1 } = {}) {
  const channel = {
    waitForConnect: vi.fn().mockResolvedValue(undefined),
    checkQueue: vi.fn().mockResolvedValue({
      consumerCount: consumers,
      messageCount: 3,
    }),
  };
  const rabbit = {
    isConnected: () => connected,
    createChannel: () => channel,
  };
  return new QueueHealthIndicator(new HealthIndicatorService(), rabbit as any);
}

describe('QueueHealthIndicator', () => {
  it('reports the worker up without exposing queue sizes', async () => {
    const result = await setup().worker();
    expect(result.worker.status).toBe('up');
    expect(Object.keys(result.worker).sort()).toEqual([
      'responseTime',
      'status',
    ]);
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
