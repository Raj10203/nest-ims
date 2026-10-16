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
import { hashSecret, verifySecret } from '../../common/security/secret-hash.js';
import { User } from '../../entities/user.entity.js';
import { JobQueueService } from '../jobs/job-queue.service.js';

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

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
    const sentAt = previous?.emailOtpExpiresAt
      ? previous.emailOtpExpiresAt.getTime() - OTP_TTL_MINUTES * 60_000
      : null;
    if (sentAt && Date.now() - sentAt < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      throw new HttpException(
        `Wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    let otp = generateOtp();
    while (
      previous?.emailOtpHash &&
      (await verifySecret(otp, previous.emailOtpHash))
    ) {
      otp = generateOtp();
    }

    await this.users.update(user.id, {
      emailOtpHash: await hashSecret(otp),
      emailOtpExpiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      emailOtpAttempts: 0,
    });
    await this.jobs.publish('mail.send-email-otp', {
      to: user.email,
      otp,
      expiresInMinutes: OTP_TTL_MINUTES,
    });
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
