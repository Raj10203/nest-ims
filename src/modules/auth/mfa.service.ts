import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { i18nMessage } from '../../common/i18n/i18n-message.js';
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
} from '../../common/otp.constants.js';
import {
  generateOtp,
  hashSecret,
  verifySecret,
} from '../../common/security/secret-hash.js';
import { env } from '../../config/env.js';
import { User } from '../../entities/user.entity.js';
import { JobQueueService } from '../jobs/job-queue.service.js';

// Signed with the access secret but never accepted as an access token:
// JwtAuthGuard rejects this type.
export const MFA_TOKEN_TYPE = 'mfa';

export interface MfaChallenge {
  mfaRequired: true;
  challengeToken: string;
  expiresInMinutes: number;
}

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jobs: JobQueueService,
    private readonly jwt: JwtService,
  ) {}

  // Login step 1 for a user with MFA: a new code replaces the previous one.
  async startChallenge(user: User): Promise<MfaChallenge> {
    const otp = generateOtp();
    await this.users.update(user.id, {
      mfaOtpHash: await hashSecret(otp),
      mfaOtpExpiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      mfaOtpAttempts: 0,
    });
    await this.jobs.publish('mail.send-login-otp', {
      to: user.email,
      otp,
      expiresInMinutes: OTP_TTL_MINUTES,
    });
    const challengeToken = await this.jwt.signAsync(
      { sub: user.id, typ: MFA_TOKEN_TYPE },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: `${OTP_TTL_MINUTES}m` },
    );
    return {
      mfaRequired: true,
      challengeToken,
      expiresInMinutes: OTP_TTL_MINUTES,
    };
  }

  // Login step 2: returns the user id once the code matches. A code works once.
  async completeChallenge(
    challengeToken: string,
    otp: string,
  ): Promise<number> {
    let userId: number;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: number; typ?: string }>(
        challengeToken,
        { secret: env.JWT_ACCESS_SECRET },
      );
      if (payload.typ !== MFA_TOKEN_TYPE) throw new Error('Not a challenge');
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException(
        i18nMessage('errors.mfa.invalidChallenge'),
      );
    }

    const state = await this.users
      .createQueryBuilder('user')
      .addSelect(['user.mfaOtpHash', 'user.mfaOtpExpiresAt'])
      .where('user.id = :id', { id: userId })
      .getOne();
    if (
      !state?.mfaOtpHash ||
      !state.mfaOtpExpiresAt ||
      state.mfaOtpExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        i18nMessage('errors.otp.expiredOrNotRequested'),
      );
    }
    // Claim the attempt first, in one conditional UPDATE, so concurrent
    // requests cannot all pass the limit.
    const claim = await this.users.increment(
      { id: userId, mfaOtpAttempts: LessThan(OTP_MAX_ATTEMPTS) },
      'mfaOtpAttempts',
      1,
    );
    if (!claim.affected) {
      throw new BadRequestException(i18nMessage('errors.otp.tooManyAttempts'));
    }
    if (!(await verifySecret(otp, state.mfaOtpHash))) {
      throw new BadRequestException(i18nMessage('errors.otp.invalid'));
    }

    await this.users.update(userId, {
      mfaOtpHash: null,
      mfaOtpExpiresAt: null,
      mfaOtpAttempts: 0,
    });
    return userId;
  }

  // The password is asked again, so a stolen access token alone cannot turn
  // MFA off.
  async setEnabled(
    user: User,
    enabled: boolean,
    password: string,
  ): Promise<void> {
    const found = await this.users
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: user.id })
      .getOne();
    if (!found?.password || !(await verifySecret(password, found.password))) {
      throw new BadRequestException(i18nMessage('errors.mfa.wrongPassword'));
    }
    await this.users.update(user.id, { mfaEnabled: enabled });
  }
}
