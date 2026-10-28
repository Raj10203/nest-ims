import { JwtService } from '@nestjs/jwt';
import { hashSecret } from '../../common/security/secret-hash.js';
import { User } from '../../entities/user.entity.js';
import { AuthService } from './auth.service.js';

function setup() {
  let storedHash: string | null = null;
  const users = {
    setRefreshTokenHash: vi.fn((_id: number, hash: string | null) => {
      storedHash = hash;
      return Promise.resolve();
    }),
    findByIdWithRefreshToken: vi.fn(() =>
      Promise.resolve({ id: 7, isActive: true, refreshTokenHash: storedHash }),
    ),
    findById: vi.fn().mockResolvedValue({ id: 7, isActive: true }),
    findByEmailWithPassword: vi.fn(),
    setPassword: vi.fn().mockResolvedValue(undefined),
    markActivated: vi.fn().mockResolvedValue(undefined),
  };
  const mfa = { startChallenge: vi.fn() };
  const service = new AuthService(users as any, new JwtService(), mfa as any);
  return Object.assign(service, { mocks: { users, mfa } });
}

describe('AuthService.refresh', () => {
  // Login and refresh within one second used to sign the same payload, so the
  // "used" token was the new one and kept working.
  it('rejects the used refresh token, even right after login', async () => {
    const service = setup();
    const { refreshToken: first } = await (service as any).signIn(7);

    const rotated = await service.refresh(first);
    expect(rotated.refreshToken).not.toBe(first);
    await expect(service.refresh(first)).rejects.toThrow(
      'errors.auth.invalidRefreshToken',
    );
    await expect(service.refresh(rotated.refreshToken)).resolves.toBeDefined();
  });
});

describe('AuthService deactivated users', () => {
  it('refuses to log in a deactivated user, before any MFA code is sent', async () => {
    const service = setup();
    service.mocks.users.findByEmailWithPassword.mockResolvedValue({
      id: 7,
      isActive: false,
      mfaEnabled: true,
      password: await hashSecret('Password123!'),
    });
    await expect(
      service.login('jane@example.com', 'Password123!'),
    ).rejects.toThrow('errors.auth.accountDeactivated');
    expect(service.mocks.mfa.startChallenge).not.toHaveBeenCalled();
  });

  it('answers a wrong password as usual, without revealing the account state', async () => {
    const service = setup();
    service.mocks.users.findByEmailWithPassword.mockResolvedValue({
      id: 7,
      isActive: false,
      password: await hashSecret('Password123!'),
    });
    await expect(service.login('jane@example.com', 'wrong')).rejects.toThrow(
      'errors.auth.invalidCredentials',
    );
  });

  it('stops refreshing the session of a deactivated user', async () => {
    const service = setup();
    const { refreshToken } = await (service as any).signIn(7);
    service.mocks.users.findByIdWithRefreshToken.mockResolvedValueOnce({
      id: 7,
      isActive: false,
      refreshTokenHash: await hashSecret(refreshToken),
    });
    await expect(service.refresh(refreshToken)).rejects.toThrow(
      'errors.auth.accountDeactivated',
    );
  });
});

describe('AuthService.login', () => {
  it('fills in activatedAt for a password set without it', async () => {
    const service = setup();
    service.mocks.users.findByEmailWithPassword.mockResolvedValue({
      id: 7,
      isActive: true,
      activatedAt: null,
      password: await hashSecret('Password123!'),
    });
    await service.login('jane@example.com', 'Password123!');
    expect(service.mocks.users.markActivated).toHaveBeenCalledWith(7);
  });

  it('leaves an existing activatedAt alone', async () => {
    const service = setup();
    service.mocks.users.findByEmailWithPassword.mockResolvedValue({
      id: 7,
      isActive: true,
      activatedAt: new Date(),
      password: await hashSecret('Password123!'),
    });
    await service.login('jane@example.com', 'Password123!');
    expect(service.mocks.users.markActivated).not.toHaveBeenCalled();
  });
});

describe('AuthService.changePassword', () => {
  const user = {
    id: 7,
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  } as User;

  async function withPassword() {
    const service = setup();
    service.mocks.users.findByEmailWithPassword.mockResolvedValue({
      id: 7,
      password: await hashSecret('Password123!'),
    });
    return service;
  }

  it('rejects a wrong current password', async () => {
    const service = await withPassword();
    await expect(
      service.changePassword(user, 'wrong', 'N3w-Passw0rd!'),
    ).rejects.toThrow('errors.auth.wrongPassword');
    expect(service.mocks.users.setPassword).not.toHaveBeenCalled();
  });

  it('rejects a new password containing the user name', async () => {
    const service = await withPassword();
    await expect(
      service.changePassword(user, 'Password123!', 'JaneDoe#2026'),
    ).rejects.toThrow('errors.validationFailed');
  });

  it('stores the new hash and rotates the refresh token', async () => {
    const service = await withPassword();
    const tokens = await service.changePassword(
      user,
      'Password123!',
      'N3w-Passw0rd!',
    );
    const [id, hash] = service.mocks.users.setPassword.mock.calls[0];
    expect(id).toBe(7);
    expect(hash).not.toBe('N3w-Passw0rd!');
    expect(service.mocks.users.setRefreshTokenHash).toHaveBeenCalledWith(
      7,
      expect.any(String),
    );
    expect(tokens.refreshToken).toEqual(expect.any(String));
  });
});
