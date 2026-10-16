import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
} from '../../common/otp.constants.js';
import { hashSecret, verifySecret } from '../../common/security/secret-hash.js';
import { User } from '../../entities/user.entity.js';
import { JobQueueService } from '../jobs/job-queue.service.js';

@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jobs: JobQueueService,
  ) {}

  // Each call replaces the stored OTP, so only the most recent one is valid.
  async sendOtp(user: User): Promise<void> {
    this.assertNotVerified(user);

    const previous = await this.loadOtpState(user.id);
    const now = Date.now();
    // A code sent within the cooldown expires after this cutoff.
    const cooldownCutoff = new Date(
      now + OTP_TTL_MINUTES * 60_000 - OTP_RESEND_COOLDOWN_SECONDS * 1000,
    );
    // Cheap early exit, before any scrypt hashing.
    if (
      previous?.emailOtpExpiresAt &&
      previous.emailOtpExpiresAt > cooldownCutoff
    ) {
      throw tooSoon();
    }

    let otp = generateOtp();
    while (
      previous?.emailOtpHash &&
      (await verifySecret(otp, previous.emailOtpHash))
    ) {
      otp = generateOtp();
    }

    const emailOtpHash = await hashSecret(otp);
    // The UPDATE repeats the cooldown check, so concurrent sends cannot all pass it.
    const { affected } = await this.users
      .createQueryBuilder()
      .update(User)
      .set({
        emailOtpHash,
        emailOtpExpiresAt: new Date(now + OTP_TTL_MINUTES * 60_000),
        emailOtpAttempts: 0,
      })
      .where('id = :id', { id: user.id })
      .andWhere(
        '(emailOtpExpiresAt IS NULL OR emailOtpExpiresAt <= :cooldownCutoff)',
        { cooldownCutoff },
      )
      .execute();
    if (!affected) throw tooSoon();

    try {
      await this.jobs.publish('mail.send-email-otp', {
        to: user.email,
        otp,
        expiresInMinutes: OTP_TTL_MINUTES,
      });
    } catch (error) {
      // The broker may have taken the message anyway (a confirm timeout), so keep
      // the new code valid and only lift the cooldown, letting the user retry at
      // once. Matching the hash leaves a newer code from another request alone.
      await this.users.update(
        { id: user.id, emailOtpHash },
        { emailOtpExpiresAt: cooldownCutoff },
      );
      throw error;
    }
  }

  async verifyOtp(user: User, otp: string): Promise<void> {
    this.assertNotVerified(user);

    const state = await this.loadOtpState(user.id);
    if (
      !state?.emailOtpHash ||
      !state.emailOtpExpiresAt ||
      state.emailOtpExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('OTP expired or not requested');
    }
    // Claim the attempt before checking the code, in one conditional UPDATE, so
    // concurrent requests cannot all pass the limit.
    const claim = await this.users.increment(
      { id: user.id, emailOtpAttempts: LessThan(OTP_MAX_ATTEMPTS) },
      'emailOtpAttempts',
      1,
    );
    if (!claim.affected) {
      throw new BadRequestException('Too many attempts, request a new OTP');
    }

    if (!(await verifySecret(otp, state.emailOtpHash))) {
      throw new BadRequestException('Invalid OTP');
    }

    await this.users.update(user.id, {
      emailVerifiedAt: new Date(),
      emailOtpHash: null,
      emailOtpExpiresAt: null,
      emailOtpAttempts: 0,
    });
  }

  private assertNotVerified(user: User): void {
    if (user.emailVerifiedAt) {
      throw new ConflictException('Email is already verified');
    }
  }

  // The OTP columns are select:false, so they must be asked for.
  private loadOtpState(id: number): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect([
        'user.emailOtpHash',
        'user.emailOtpExpiresAt',
        'user.emailOtpAttempts',
      ])
      .where('user.id = :id', { id })
      .getOne();
  }
}

function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function tooSoon(): HttpException {
  return new HttpException(
    `Wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code`,
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
