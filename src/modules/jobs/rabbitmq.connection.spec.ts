import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { RabbitMqConnection } from './rabbitmq.connection.js';

vi.mock('../../config/rabbitmq-env.js', () => ({
  rabbitmqEnv: { RABBITMQ_URL: 'amqp://localhost' },
}));

const manager = vi.hoisted(() => ({
  on: vi.fn(),
  close: vi.fn(),
  createChannel: vi.fn(),
}));
vi.mock('amqp-connection-manager', () => ({ connect: () => manager }));

describe('RabbitMqConnection', () => {
  let channel: EventEmitter;
  let logError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    channel = new EventEmitter();
    manager.createChannel.mockReturnValue(channel);
    logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs channel errors instead of throwing them', () => {
    new RabbitMqConnection().createChannel();
    expect(() =>
      channel.emit('error', new Error('ACCESS_REFUSED')),
    ).not.toThrow();
    expect(logError).toHaveBeenCalledWith('Channel error: ACCESS_REFUSED');
  });

  it('stays quiet about channel errors caused by shutdown', async () => {
    const connection = new RabbitMqConnection();
    connection.createChannel();
    await connection.onApplicationShutdown();
    channel.emit(
      'error',
      new Error('Channel ended, no reply will be forthcoming'),
    );
    expect(logError).not.toHaveBeenCalled();
  });
});
