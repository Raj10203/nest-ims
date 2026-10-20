import { JwtService } from '@nestjs/jwt';
import { OTP_MAX_ATTEMPTS } from '../../common/otp.constants.js';
import { hashSecret } from '../../common/security/secret-hash.js';
import { env } from '../../config/env.js';
import { User } from '../../entities/user.entity.js';
import { MfaService } from './mfa.service.js';

const user = { id: 3, email: 'jane@example.com' } as User;

function setup(state: Partial<User> | null = null) {
  const qb = {
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(state),
  };
  const users = {
    update: vi.fn().mockResolvedValue(undefined),
    increment: vi.fn().mockResolvedValue({
      affected: (state?.mfaOtpAttempts ?? 0) < OTP_MAX_ATTEMPTS ? 1 : 0,
    }),
    createQueryBuilder: () => qb,
  };
  const jobs = { publish: vi.fn().mockResolvedValue(undefined) };
  const jwt = new JwtService();
  return {
    service: new MfaService(users as any, jobs as any, jwt),
    users,
    jobs,
    jwt,
  };
}

describe('MfaService', () => {
  it('emails a code, stores only its hash and returns a challenge token', async () => {
    const { service, users, jobs, jwt } = setup();
    const challenge = await service.startChallenge(user);

    const { otp } = jobs.publish.mock.calls[0][1];
    expect(otp).toMatch(/^\d{6}$/);
    expect(users.update.mock.calls[0][1].mfaOtpHash).not.toContain(otp);
    const payload = await jwt.verifyAsync(challenge.challengeToken, {
      secret: env.JWT_ACCESS_SECRET,
    });
    expect(payload).toMatchObject({ sub: 3, typ: 'mfa' });
  });

  it('keeps the attempt count and expiry when a code is requested again inside the window', async () => {
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const { service, users, jobs } = setup({
      mfaOtpExpiresAt: expiresAt,
      mfaOtpAttempts: 2,
    });
    const challenge = await service.startChallenge(user);
    const saved = users.update.mock.calls[0][1];
    expect(saved.mfaOtpExpiresAt).toBe(expiresAt);
    expect(saved).not.toHaveProperty('mfaOtpAttempts');
    expect(challenge.expiresInMinutes).toBe(5);
    expect(jobs.publish.mock.calls[0][1].expiresInMinutes).toBe(5);
  });

  it('refuses a new code once the window has used all attempts', async () => {
    const { service, users, jobs } = setup({
      mfaOtpExpiresAt: new Date(Date.now() + 3 * 60_000),
      mfaOtpAttempts: OTP_MAX_ATTEMPTS,
    });
    await expect(service.startChallenge(user)).rejects.toMatchObject({
      status: 429,
      message: 'errors.mfa.locked',
    });
    expect(users.update).not.toHaveBeenCalled();
    expect(jobs.publish).not.toHaveBeenCalled();
  });

  it('returns the user id for the right code and clears it', async () => {
    const { service, users, jwt } = setup({
      mfaOtpHash: await hashSecret('123456'),
      mfaOtpExpiresAt: new Date(Date.now() + 60_000),
    });
    const token = await jwt.signAsync(
      { sub: 3, typ: 'mfa' },
      { secret: env.JWT_ACCESS_SECRET },
    );
    await expect(service.completeChallenge(token, '123456')).resolves.toBe(3);
    expect(users.update).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ mfaOtpHash: null }),
    );
  });

  it('rejects an access token used as a challenge', async () => {
    const { service, jwt } = setup();
    const accessToken = await jwt.signAsync(
      { sub: 3 },
      { secret: env.JWT_ACCESS_SECRET },
    );
    await expect(
      service.completeChallenge(accessToken, '123456'),
    ).rejects.toThrow('errors.mfa.invalidChallenge');
  });

  it('rejects a wrong code and stops after too many attempts', async () => {
    const valid = {
      mfaOtpHash: await hashSecret('123456'),
      mfaOtpExpiresAt: new Date(Date.now() + 60_000),
    };
    const first = setup(valid);
    const token = await first.jwt.signAsync(
      { sub: 3, typ: 'mfa' },
      { secret: env.JWT_ACCESS_SECRET },
    );
    await expect(
      first.service.completeChallenge(token, '654321'),
    ).rejects.toThrow('errors.otp.invalid');

    const locked = setup({ ...valid, mfaOtpAttempts: OTP_MAX_ATTEMPTS });
    await expect(
      locked.service.completeChallenge(token, '123456'),
    ).rejects.toMatchObject({ status: 429, message: 'errors.mfa.locked' });
  });
});
