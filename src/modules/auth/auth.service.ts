import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { env } from '../../config/env.js';
import { hashSecret, verifySecret } from '../../common/security/secret-hash.js';
import { User } from '../../entities/user.entity.js';
import { UsersService } from '../users/users.service.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const found = await this.users.findByEmailWithPassword(email);
    if (!found || !(await verifySecret(password, found.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const user = await this.users.findById(found.id);
    return { user, ...(await this.issueTokens(found.id)) };
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
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.users.findByIdWithRefreshToken(userId);
    if (
      !user?.refreshTokenHash ||
      !(await verifySecret(refreshToken, user.refreshTokenHash))
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return this.issueTokens(user.id);
  }

  logout(user: User): Promise<void> {
    return this.users.setRefreshTokenHash(user.id, null);
  }

  private async issueTokens(userId: number): Promise<TokenPair> {
    const payload = { sub: userId };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: env.JWT_ACCESS_SECRET,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN as JwtSignOptions['expiresIn'],
      }),
      this.jwt.signAsync(payload, {
        secret: env.JWT_REFRESH_SECRET,
        expiresIn: env.JWT_REFRESH_EXPIRES_IN as JwtSignOptions['expiresIn'],
      }),
    ]);
    await this.users.setRefreshTokenHash(
      userId,
      await hashSecret(refreshToken),
    );
    return { accessToken, refreshToken };
  }
}
