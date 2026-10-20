import { Logger } from '@nestjs/common';
import { UserCreatedEvent } from '../users/events/user-created.event.js';
import { UserCreatedListener } from './user-created.listener.js';

describe('UserCreatedListener', () => {
  it('sends the invitation for the new user', async () => {
    const invitations = { send: vi.fn().mockResolvedValue(undefined) };
    await new UserCreatedListener(invitations as any).handle(
      new UserCreatedEvent(7, 'jane@example.com', 'Jane'),
    );
    expect(invitations.send).toHaveBeenCalledWith({
      id: 7,
      email: 'jane@example.com',
      firstName: 'Jane',
    });
  });

  it('logs instead of throwing when the invitation cannot be sent', async () => {
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const invitations = {
      send: vi.fn().mockRejectedValue(new Error('broker down')),
    };
    await expect(
      new UserCreatedListener(invitations as any).handle(
        new UserCreatedEvent(7, 'jane@example.com', 'Jane'),
      ),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('broker down'));
  });
});
