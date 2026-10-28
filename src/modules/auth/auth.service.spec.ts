import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';

function setup() {
  let storedHash: string | null = null;
  const users = {
    setRefreshTokenHash: vi.fn((_id: number, hash: string | null) => {
      storedHash = hash;
      return Promise.resolve();
    }),
    findByIdWithRefreshToken: vi.fn(() =>
      Promise.resolve({ id: 7, refreshTokenHash: storedHash }),
    ),
    findById: vi.fn().mockResolvedValue({ id: 7 }),
  };
  return new AuthService(users as any, new JwtService(), {} as any);
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
