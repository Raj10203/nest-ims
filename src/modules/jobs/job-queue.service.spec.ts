import { JobQueueService } from './job-queue.service.js';
import { ATTEMPT_HEADER, JOBS_EXCHANGE, JOBS_QUEUE } from './jobs.constants.js';

function setup(publish = vi.fn().mockResolvedValue(true)) {
  const rabbit = { createChannel: () => ({ publish }) };
  return { service: new JobQueueService(rabbit as any), publish };
}

const payload = { to: 'a@example.com', otp: '123456', expiresInMinutes: 10 };

describe('JobQueueService', () => {
  it('publishes a persistent envelope as attempt 1', async () => {
    const { service, publish } = setup();
    await service.publish('mail.send-email-otp', payload);

    const [exchange, routingKey, content, options] = publish.mock.calls[0];
    const envelope = JSON.parse(content.toString());
    expect(exchange).toBe(JOBS_EXCHANGE);
    expect(routingKey).toBe(JOBS_QUEUE);
    expect(envelope).toMatchObject({ type: 'mail.send-email-otp', payload });
    expect(envelope.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(envelope.createdAt).toISOString()).toBe(envelope.createdAt);
    expect(options).toMatchObject({
      persistent: true,
      messageId: envelope.id,
      type: 'mail.send-email-otp',
      headers: { [ATTEMPT_HEADER]: 1 },
      timeout: 5000,
    });
  });

  it('rejects when the broker does not confirm', async () => {
    const { service } = setup(vi.fn().mockRejectedValue(new Error('nack')));
    await expect(
      service.publish('mail.send-email-otp', payload),
    ).rejects.toThrow('nack');
  });
});
