import { hashToken } from '../../common/security/secret-hash.js';
import { User } from '../../entities/user.entity.js';
import { InvitationsService } from './invitations.service.js';

function setup({
  found = { id: 7, firstName: 'Jane', lastName: 'Doe' } as Partial<User> | null,
  affected = 1,
  hasPassword = false,
} = {}) {
  const users = {
    update: vi.fn().mockResolvedValue({ affected }),
    findOne: vi.fn().mockResolvedValue(found),
    existsBy: vi.fn().mockResolvedValue(hasPassword),
  };
  const usersService = {
    findOneToUpdate: vi.fn().mockResolvedValue({
      id: 7,
      email: 'jane@example.com',
      firstName: 'Jane',
    }),
  };
  const jobs = { publish: vi.fn().mockResolvedValue(undefined) };
  const service = new InvitationsService(
    users as any,
    usersService as any,
    jobs as any,
  );
  return { service, users, usersService, jobs };
}

describe('InvitationsService', () => {
  it('stores only the token hash and emails a link with the raw token', async () => {
    const { service, users, jobs } = setup();
    await service.send({ id: 7, email: 'jane@example.com', firstName: 'Jane' });

    const { url, to, expiresInHours } = jobs.publish.mock.calls[0][1];
    const token = new URL(url).searchParams.get('token')!;
    expect(to).toBe('jane@example.com');
    expect(expiresInHours).toBe(72);
    expect(new URL(url).pathname).toBe('/set-password');
    const saved = users.update.mock.calls[0][1];
    expect(saved.inviteTokenHash).toBe(hashToken(token));
    expect(saved.inviteTokenHash).not.toContain(token);
  });

  it('sets the password, verifies the email and clears the token', async () => {
    const { service, users } = setup();
    await service.accept('tok', 'Password123!');
    const [where, changes] = users.update.mock.calls[0];
    expect(where).toMatchObject({ id: 7, inviteTokenHash: hashToken('tok') });
    expect(changes.password).not.toBe('Password123!');
    expect(changes.emailVerifiedAt).toBeInstanceOf(Date);
    expect(changes.inviteTokenHash).toBeNull();
  });

  it('rejects an unknown, used or expired token', async () => {
    const { service, users } = setup({ found: null });
    await expect(service.accept('tok', 'Password123!')).rejects.toThrow(
      'errors.invite.invalid',
    );
    expect(users.update).not.toHaveBeenCalled();
  });

  it('rejects the link when a concurrent request used it first', async () => {
    const { service } = setup({ affected: 0 });
    await expect(service.accept('tok', 'Password123!')).rejects.toThrow(
      'errors.invite.invalid',
    );
  });

  it('rejects a password containing the user name', async () => {
    const { service, users } = setup();
    await expect(service.accept('tok', 'JaneDoe#2026')).rejects.toThrow(
      'errors.validationFailed',
    );
    expect(users.update).not.toHaveBeenCalled();
  });

  it('does not resend to a user who already set a password', async () => {
    const { service, jobs } = setup({ hasPassword: true });
    await expect(service.resend({ id: 1 } as User, 7)).rejects.toThrow(
      'errors.invite.alreadyAccepted',
    );
    expect(jobs.publish).not.toHaveBeenCalled();
  });
});
