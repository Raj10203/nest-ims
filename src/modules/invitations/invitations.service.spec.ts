import { hashToken } from '../../common/security/secret-hash.js';
import { User } from '../../entities/user.entity.js';
import { InvitationsService } from './invitations.service.js';

function setup({
  found = { id: 7, firstName: 'Jane', lastName: 'Doe' } as Partial<User> | null,
  targetActive = true,
  affected = 1,
  hasPassword = false,
  byEmail = {
    id: 7,
    email: 'jane@example.com',
    firstName: 'Jane',
    password: 'hash',
    isActive: true,
  } as Partial<User> | null,
} = {}) {
  const manager = { update: vi.fn().mockResolvedValue({ affected }) };
  const users = {
    update: vi.fn().mockResolvedValue({ affected }),
    manager: { transaction: (work: (m: unknown) => unknown) => work(manager) },
    findOne: vi.fn().mockResolvedValue(found),
    // isPending: an active user without a password.
    existsBy: vi.fn().mockResolvedValue(!hasPassword),
  };
  const usersService = {
    findOneToUpdate: vi.fn().mockResolvedValue({
      id: 7,
      email: 'jane@example.com',
      firstName: 'Jane',
      isActive: targetActive,
    }),
    findByEmailWithPassword: vi.fn().mockResolvedValue(byEmail),
  };
  const jobs = { publish: vi.fn().mockResolvedValue(undefined) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new InvitationsService(
    users as any,
    usersService as any,
    jobs as any,
    audit as any,
  );
  return { service, users, usersService, jobs, manager, audit };
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
    expect(saved.invitedAt).toBeInstanceOf(Date);
  });

  it('sets the password, verifies the email and clears the token, audited in the same transaction', async () => {
    const { service, manager, audit } = setup();
    await service.accept('tok', 'Password123!');
    const [, where, changes] = manager.update.mock.calls[0];
    expect(where).toMatchObject({ id: 7, inviteTokenHash: hashToken('tok') });
    expect(changes.password).not.toBe('Password123!');
    expect(changes.emailVerifiedAt).toBeInstanceOf(Date);
    expect(changes.inviteTokenHash).toBeNull();
    expect(changes.refreshTokenHash).toBeNull();
    expect(changes.activatedAt).toBeInstanceOf(Date);
    expect(where).toMatchObject({ isActive: true });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'User',
        entityId: '7',
        actorId: 7,
      }),
      manager,
    );
  });

  it('rejects an unknown, used or expired token', async () => {
    const { service, manager } = setup({ found: null });
    await expect(service.accept('tok', 'Password123!')).rejects.toThrow(
      'errors.invite.invalid',
    );
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('rejects the link when a concurrent request used it first', async () => {
    const { service } = setup({ affected: 0 });
    await expect(service.accept('tok', 'Password123!')).rejects.toThrow(
      'errors.invite.invalid',
    );
  });

  it('rejects a password containing the user name', async () => {
    const { service, manager } = setup();
    await expect(service.accept('tok', 'JaneDoe#2026')).rejects.toThrow(
      'errors.validationFailed',
    );
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('does not resend to a user who already set a password', async () => {
    const { service, jobs } = setup({ hasPassword: true });
    await expect(service.resend({ id: 1 } as User, 7)).rejects.toThrow(
      'errors.invite.alreadyAccepted',
    );
    expect(jobs.publish).not.toHaveBeenCalled();
  });

  it('does not resend to a deactivated user', async () => {
    const { service, jobs } = setup({ targetActive: false });
    await expect(service.resend({ id: 1 } as User, 7)).rejects.toThrow(
      'errors.users.inactive',
    );
    expect(jobs.publish).not.toHaveBeenCalled();
  });

  it('keeps the original verification and activation times on a password reset', async () => {
    const verifiedAt = new Date('2026-01-01T00:00:00Z');
    const { service, manager } = setup({
      found: {
        id: 7,
        firstName: 'Jane',
        lastName: 'Doe',
        emailVerifiedAt: verifiedAt,
        activatedAt: verifiedAt,
      },
    });
    await service.accept('tok', 'Password123!');
    expect(manager.update.mock.calls[0][2].emailVerifiedAt).toBe(verifiedAt);
    expect(manager.update.mock.calls[0][2].activatedAt).toBe(verifiedAt);
  });

  it('emails a one-hour reset link to the /set-password page', async () => {
    const { service, users, jobs } = setup();
    await service.sendPasswordReset('jane@example.com');

    const [type, { url, to, expiresInMinutes }] = jobs.publish.mock.calls[0];
    expect(type).toBe('mail.send-password-reset');
    expect(to).toBe('jane@example.com');
    expect(expiresInMinutes).toBe(60);
    expect(new URL(url).pathname).toBe('/set-password');
    const token = new URL(url).searchParams.get('token')!;
    const saved = users.update.mock.calls[0][1];
    expect(saved.inviteTokenHash).toBe(hashToken(token));
    expect(saved.inviteExpiresAt.getTime() - Date.now()).toBeLessThanOrEqual(
      3_600_000,
    );
  });

  it('sends the invitation again to a user who never set a password', async () => {
    const { service, jobs } = setup({
      byEmail: {
        id: 7,
        email: 'jane@example.com',
        firstName: 'Jane',
        isActive: true,
      },
    });
    await service.sendPasswordReset('jane@example.com');
    expect(jobs.publish.mock.calls[0][0]).toBe('mail.send-invite');
  });

  it('sends nothing to a deactivated user', async () => {
    const { service, users, jobs } = setup({
      byEmail: { id: 7, email: 'jane@example.com', isActive: false },
    });
    await service.sendPasswordReset('jane@example.com');
    expect(users.update).not.toHaveBeenCalled();
    expect(jobs.publish).not.toHaveBeenCalled();
  });

  it('does nothing for an unknown email', async () => {
    const { service, users, jobs } = setup({ byEmail: null });
    await service.sendPasswordReset('nobody@example.com');
    expect(users.update).not.toHaveBeenCalled();
    expect(jobs.publish).not.toHaveBeenCalled();
  });

  it('answers a reset request before the work is done, and logs a failure', async () => {
    const { service, usersService } = setup();
    usersService.findByEmailWithPassword.mockRejectedValue(
      new Error('db down'),
    );
    const log = vi
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);

    expect(service.requestPasswordReset('jane@example.com')).toBeUndefined();
    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith('Password reset was not sent: db down'),
    );
  });
});
