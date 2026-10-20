import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard.js';

function setup(
  user: object,
  meta: { allowUnverified?: boolean } = {},
  payload: object = { sub: 1 },
) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
    key === 'allow_unverified_email' ? meta.allowUnverified : undefined,
  );
  const jwt = { verifyAsync: vi.fn().mockResolvedValue(payload) };
  const users = { findById: vi.fn().mockResolvedValue(user) };
  const request = { headers: { authorization: 'Bearer token' } };
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  };
  const cls = { set: vi.fn() };
  const guard = new JwtAuthGuard(
    reflector,
    jwt as any,
    users as any,
    cls as any,
  );
  return { guard, context: context as any };
}

describe('JwtAuthGuard email verification', () => {
  it('blocks an unverified user', async () => {
    const { guard, context } = setup({
      id: 1,
      emailVerifiedAt: null,
      role: { name: 'admin' },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lets an unverified user reach @AllowUnverifiedEmail routes', async () => {
    const { guard, context } = setup(
      { id: 1, emailVerifiedAt: null, role: { name: 'admin' } },
      { allowUnverified: true },
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('lets a verified user through', async () => {
    const { guard, context } = setup({
      id: 1,
      emailVerifiedAt: new Date(),
      role: { name: 'admin' },
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects an MFA challenge token used as an access token', async () => {
    const { guard, context } = setup(
      { id: 1, emailVerifiedAt: new Date(), role: { name: 'admin' } },
      {},
      { sub: 1, typ: 'mfa' },
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'errors.auth.invalidAccessToken',
    );
  });
});
