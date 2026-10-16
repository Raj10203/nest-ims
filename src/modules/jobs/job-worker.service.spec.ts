import { JobWorker } from './job-worker.service.js';
import {
  ATTEMPT_HEADER,
  DEAD_QUEUE,
  MAX_ATTEMPTS,
  retryQueue,
} from './jobs.constants.js';

async function setup(
  handle = vi.fn().mockResolvedValue(undefined),
  deadLetterTtlMs?: number,
) {
  const channel = {
    consume: vi.fn().mockResolvedValue(undefined),
    ack: vi.fn(),
    nack: vi.fn(),
    sendToQueue: vi.fn().mockResolvedValue(true),
    cancelAll: vi.fn().mockResolvedValue(undefined),
  };
  const rabbit = { createChannel: () => channel };
  const handler = { type: 'mail.send-email-otp', handle, deadLetterTtlMs };
  const worker = new JobWorker(rabbit as any, [handler] as any);
  await worker.onApplicationBootstrap();
  const deliver = async (body: string, attempt = 1, type = handler.type) => {
    const message = {
      content: Buffer.from(body),
      properties: {
        messageId: 'm1',
        type,
        headers: { [ATTEMPT_HEADER]: attempt },
      },
    };
    channel.consume.mock.calls[0][1](message);
    await worker.onModuleDestroy();
    return message;
  };
  const job = (type = handler.type) =>
    JSON.stringify({ id: 'j1', type, payload: { to: 'a@b.c' } });
  return { channel, handle, deliver, job };
}

describe('JobWorker', () => {
  it('runs the handler for the job type and acks', async () => {
    const { channel, handle, deliver, job } = await setup();
    const message = await deliver(job());
    expect(handle).toHaveBeenCalledWith(
      { to: 'a@b.c' },
      { jobId: 'j1', attempt: 1 },
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });

  it('sends a failed job to the first retry queue with attempt 2', async () => {
    const { channel, deliver, job } = await setup(
      vi.fn().mockRejectedValue(new Error('boom')),
    );
    const message = await deliver(job());
    const [queue, , options] = channel.sendToQueue.mock.calls[0];
    expect(queue).toBe(retryQueue(5_000));
    expect(options.headers[ATTEMPT_HEADER]).toBe(2);
    expect(options.headers['x-last-error']).toBe('boom');
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('dead-letters a job that has used all attempts', async () => {
    const { channel, deliver, job } = await setup(
      vi.fn().mockRejectedValue(new Error('boom')),
    );
    await deliver(job(), MAX_ATTEMPTS);
    expect(channel.sendToQueue.mock.calls[0][0]).toBe(DEAD_QUEUE);
    expect(channel.ack).toHaveBeenCalled();
  });

  it("dead-letters with the handler's TTL, if it sets one", async () => {
    const { channel, deliver, job } = await setup(
      vi.fn().mockRejectedValue(new Error('boom')),
      60_000,
    );
    await deliver(job(), MAX_ATTEMPTS);
    expect(channel.sendToQueue.mock.calls[0][2].expiration).toBe(60_000);
  });

  it('dead-letters unknown job types and malformed messages without retrying', async () => {
    const { channel, deliver, job } = await setup();
    await deliver(job('nope.unknown'));
    await deliver('not json');
    for (const body of ['null', '42', '"text"', '{"payload":{}}']) {
      await deliver(body);
    }
    expect(channel.sendToQueue.mock.calls.map((c) => c[0])).toEqual(
      Array(6).fill(DEAD_QUEUE),
    );
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('requeues the message when it cannot be moved to a retry queue', async () => {
    const { channel, deliver, job } = await setup(
      vi.fn().mockRejectedValue(new Error('boom')),
    );
    channel.sendToQueue.mockRejectedValue(new Error('broker down'));
    const message = await deliver(job());
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });
});
