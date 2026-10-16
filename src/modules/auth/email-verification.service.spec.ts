import { BadRequestException, ConflictException } from '@nestjs/common';
import { hashSecret } from '../../common/security/secret-hash.js';
import { User } from '../../entities/user.entity.js';
import {
  EmailVerificationService,
  OTP_MAX_ATTEMPTS,
} from './email-verification.service.js';

function setup(state: Partial<User> | null = null) {
  const update = vi.fn().mockResolvedValue(undefined);
  const increment = vi.fn().mockResolvedValue(undefined);
  const qb = {
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(state),
  };
  const users = { update, increment, createQueryBuilder: () => qb };
  const jobs = { publish: vi.fn().mockResolvedValue(undefined) };
  const service = new EmailVerificationService(users as any, jobs as any);
  return { service, update, increment, jobs };
}

const user = { id: 1, email: 'a@example.com', emailVerifiedAt: null } as User;

describe('EmailVerificationService', () => {
  it('stores a hashed OTP and publishes exactly one mail job', async () => {
    const { service, update, jobs } = setup();
    await service.sendOtp(user);

    expect(jobs.publish).toHaveBeenCalledTimes(1);
    const { otp, to } = jobs.publish.mock.calls[0][1];
    expect(to).toBe('a@example.com');
    expect(otp).toMatch(/^\d{6}$/);
    const saved = update.mock.calls[0][1];
    expect(saved.emailOtpHash).not.toContain(otp);
    expect(saved.emailOtpAttempts).toBe(0);
  });

  it('never reissues the previous OTP', async () => {
    const { service, jobs } = setup({
      emailOtpHash: await hashSecret('000000'),
    });
    for (let i = 0; i < 20; i++) await service.sendOtp(user);
    const sent = jobs.publish.mock.calls.map((c) => c[1].otp);
    expect(sent).not.toContain('000000');
  });

  it('rejects send and verify for an already verified user', async () => {
    const { service } = setup();
    const verified = { id: 1, emailVerifiedAt: new Date() } as User;
    await expect(service.sendOtp(verified)).rejects.toThrow(ConflictException);
    await expect(service.verifyOtp(verified, '123456')).rejects.toThrow(
      ConflictException,
    );
  });

  it('marks the email verified and clears the OTP on a correct code', async () => {
    const { service, update } = setup({
      emailOtpHash: await hashSecret('123456'),
      emailOtpExpiresAt: new Date(Date.now() + 60_000),
      emailOtpAttempts: 0,
    });
    await service.verifyOtp(user, '123456');
    const saved = update.mock.calls[0][1];
    expect(saved.emailVerifiedAt).toBeInstanceOf(Date);
    expect(saved.emailOtpHash).toBeNull();
  });

  it('counts a wrong code as an attempt', async () => {
    const { service, increment, update } = setup({
      emailOtpHash: await hashSecret('123456'),
      emailOtpExpiresAt: new Date(Date.now() + 60_000),
      emailOtpAttempts: 0,
    });
    await expect(service.verifyOtp(user, '654321')).rejects.toThrow(
      'Invalid OTP',
    );
    expect(increment).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects an expired OTP', async () => {
    const { service } = setup({
      emailOtpHash: await hashSecret('123456'),
      emailOtpExpiresAt: new Date(Date.now() - 1000),
      emailOtpAttempts: 0,
    });
    await expect(service.verifyOtp(user, '123456')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('locks out after too many wrong attempts, even with the right code', async () => {
    const { service, update } = setup({
      emailOtpHash: await hashSecret('123456'),
      emailOtpExpiresAt: new Date(Date.now() + 60_000),
      emailOtpAttempts: OTP_MAX_ATTEMPTS,
    });
    await expect(service.verifyOtp(user, '123456')).rejects.toThrow(
      'Too many attempts',
    );
    expect(update).not.toHaveBeenCalled();
  });
});
