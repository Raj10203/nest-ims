import { Logger } from '@nestjs/common';
import { UserCreatedEvent } from '../users/events/user-created.event.js';
import { UserEmailChangedEvent } from '../users/events/user-email-changed.event.js';
import { InvitationListener } from './invitation.listener.js';

function setup({
  pending = true,
  send = vi.fn().mockResolvedValue(undefined),
} = {}) {
  const invitations = {
    send,
    isPending: vi.fn().mockResolvedValue(pending),
  };
  return { listener: new InvitationListener(invitations as any), invitations };
}

describe('InvitationListener', () => {
  it('invites a newly created user', async () => {
    const { listener, invitations } = setup();
    await listener.onUserCreated(
      new UserCreatedEvent(7, 'jane@example.com', 'Jane'),
    );
    expect(invitations.send).toHaveBeenCalledWith({
      id: 7,
      email: 'jane@example.com',
      firstName: 'Jane',
    });
  });

  it('re-invites a pending user at the corrected address', async () => {
    const { listener, invitations } = setup({ pending: true });
    await listener.onEmailChanged(
      new UserEmailChangedEvent(7, 'jane@example.com', 'Jane'),
    );
    expect(invitations.send).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, email: 'jane@example.com' }),
    );
  });

  it('does not invite a user who already set a password', async () => {
    const { listener, invitations } = setup({ pending: false });
    await listener.onEmailChanged(
      new UserEmailChangedEvent(7, 'jane@example.com', 'Jane'),
    );
    expect(invitations.send).not.toHaveBeenCalled();
  });

  it('logs instead of throwing when the invitation cannot be sent', async () => {
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { listener } = setup({
      send: vi.fn().mockRejectedValue(new Error('broker down')),
    });
    await expect(
      listener.onUserCreated(
        new UserCreatedEvent(7, 'jane@example.com', 'Jane'),
      ),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('broker down'));
  });
});
