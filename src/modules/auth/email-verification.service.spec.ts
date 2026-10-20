import {
  BadRequestException,
  ConflictException,
  HttpStatus,
} from '@nestjs/common';
import { hashSecret } from '../../common/security/secret-hash.js';
import { User } from '../../entities/user.entity.js';
import { OTP_MAX_ATTEMPTS } from '../../common/otp.constants.js';
import { EmailVerificationService } from './email-verification.service.js';

// `updated` is what the conditional UPDATE in sendOtp reports: false means
// another request claimed the cooldown first.
function setup(state: Partial<User> | null = null, { updated = true } = {}) {
  const update = vi.fn().mockResolvedValue(undefined);
  const increment = vi.fn().mockResolvedValue({
    affected: (state?.emailOtpAttempts ?? 0) < OTP_MAX_ATTEMPTS ? 1 : 0,
  });
  const qb = {
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(state),
    execute: vi.fn().mockResolvedValue({ affected: updated ? 1 : 0 }),
  };
  const users = { update, increment, createQueryBuilder: () => qb };
  const jobs = { publish: vi.fn().mockResolvedValue(undefined) };
  const service = new EmailVerificationService(users as any, jobs as any);
  return { service, update, increment, jobs, qb };
}

const user = { id: 1, email: 'a@example.com', emailVerifiedAt: null } as User;

describe('EmailVerificationService', () => {
  it('stores a hashed OTP and publishes exactly one mail job', async () => {
    const { service, qb, jobs } = setup();
    await service.sendOtp(user);

    expect(jobs.publish).toHaveBeenCalledTimes(1);
    const { otp, to } = jobs.publish.mock.calls[0][1];
    expect(to).toBe('a@example.com');
    expect(otp).toMatch(/^\d{6}$/);
    const saved = qb.set.mock.calls[0][0];
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

  it('rejects a resend inside the cooldown with 429 before writing anything', async () => {
    const { service, jobs, qb } = setup({
      emailOtpExpiresAt: new Date(Date.now() + 9.5 * 60_000),
    });
    await expect(service.sendOtp(user)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(qb.execute).not.toHaveBeenCalled();
    expect(jobs.publish).not.toHaveBeenCalled();
  });

  it('answers 429 and publishes nothing when a concurrent send wins the UPDATE', async () => {
    const { service, jobs } = setup(null, { updated: false });
    await expect(service.sendOtp(user)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(jobs.publish).not.toHaveBeenCalled();
  });

  it('lifts the cooldown on its own code only when the mail job cannot be queued', async () => {
    const { service, jobs, update, qb } = setup();
    jobs.publish.mockRejectedValue(new Error('broker down'));
    await expect(service.sendOtp(user)).rejects.toThrow('broker down');

    const { emailOtpHash, emailOtpExpiresAt } = qb.set.mock.calls[0][0];
    const [where, changes] = update.mock.calls[0];
    expect(where).toEqual({ id: user.id, emailOtpHash });
    expect(Object.keys(changes)).toEqual(['emailOtpExpiresAt']);
    // Still valid, but already past the cooldown.
    expect(changes.emailOtpExpiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(changes.emailOtpExpiresAt.getTime()).toBeLessThan(
      emailOtpExpiresAt.getTime(),
    );
  });

  it('allows a resend after the cooldown', async () => {
    const { service, jobs } = setup({
      emailOtpExpiresAt: new Date(Date.now() + 8 * 60_000),
    });
    await service.sendOtp(user);
    expect(jobs.publish).toHaveBeenCalledTimes(1);
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
      'errors.otp.invalid',
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
      'errors.otp.tooManyAttempts',
    );
    expect(update).not.toHaveBeenCalled();
  });
});
