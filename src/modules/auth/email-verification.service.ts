import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashSecret, verifySecret } from '../../common/security/secret-hash.js';
import { User } from '../../entities/user.entity.js';
import { MailQueueService } from '../mail/mail-queue.service.js';

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly mailQueue: MailQueueService,
  ) {}

  // Each call replaces the stored OTP, so only the most recent one is valid.
  async sendOtp(user: User): Promise<void> {
    this.assertNotVerified(user);

    const previous = await this.loadOtpState(user.id);
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
    await this.mailQueue.enqueueEmailOtp({
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
    if (state.emailOtpAttempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many attempts, request a new OTP');
    }

    if (!(await verifySecret(otp, state.emailOtpHash))) {
      await this.users.increment({ id: user.id }, 'emailOtpAttempts', 1);
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
