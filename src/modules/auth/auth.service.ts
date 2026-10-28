import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { env } from '../../config/env.js';
import { hashSecret, verifySecret } from '../../common/security/secret-hash.js';
import { User } from '../../entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { i18nMessage } from '../../common/i18n/i18n-message.js';
import { MfaService } from './mfa.service.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly mfa: MfaService,
  ) {}

  async login(email: string, password: string) {
    const found = await this.users.findByEmailWithPassword(email);
    // No password yet means the invitation was not accepted.
    if (!found?.password || !(await verifySecret(password, found.password))) {
      throw new UnauthorizedException(
        i18nMessage('errors.auth.invalidCredentials'),
      );
    }
    if (found.mfaEnabled) return this.mfa.startChallenge(found);
    return this.signIn(found.id);
  }

  async loginWithMfa(challengeToken: string, otp: string) {
    return this.signIn(await this.mfa.completeChallenge(challengeToken, otp));
  }

  // Rotation: each refresh token works once; the new pair replaces the stored hash.
  async refresh(refreshToken: string): Promise<TokenPair> {
    let userId: number;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: number }>(
        refreshToken,
        { secret: env.JWT_REFRESH_SECRET },
      );
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException(
        i18nMessage('errors.auth.invalidRefreshToken'),
      );
    }

    const user = await this.users.findByIdWithRefreshToken(userId);
    if (
      !user?.refreshTokenHash ||
      !(await verifySecret(refreshToken, user.refreshTokenHash))
    ) {
      throw new UnauthorizedException(
        i18nMessage('errors.auth.invalidRefreshToken'),
      );
    }
    return this.issueTokens(user.id);
  }

  logout(user: User): Promise<void> {
    return this.users.setRefreshTokenHash(user.id, null);
  }

  private async signIn(userId: number) {
    const user = await this.users.findById(userId);
    return { user, ...(await this.issueTokens(userId)) };
  }

  private async issueTokens(userId: number): Promise<TokenPair> {
    const payload = { sub: userId };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: env.JWT_ACCESS_SECRET,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN as JwtSignOptions['expiresIn'],
      }),
      // jti: iat has whole seconds, so without it a refresh in the same second
      // as the login re-issued the very same token and the "used" one still worked.
      this.jwt.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: env.JWT_REFRESH_SECRET,
          expiresIn: env.JWT_REFRESH_EXPIRES_IN as JwtSignOptions['expiresIn'],
        },
      ),
    ]);
    await this.users.setRefreshTokenHash(
      userId,
      await hashSecret(refreshToken),
    );
    return { accessToken, refreshToken };
  }
}
