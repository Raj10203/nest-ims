import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import type { Request } from 'express';
import type { AppClsStore } from '../../common/context/app-cls.js';
import { env } from '../../config/env.js';
import { User } from '../../entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { ALLOW_UNVERIFIED_EMAIL } from './allow-unverified-email.decorator.js';
import { assertActive } from './auth.service.js';
import { MFA_TOKEN_TYPE } from './mfa.service.js';
import { IS_PUBLIC } from './public.decorator.js';
import { i18nMessage } from '../../common/i18n/i18n-message.js';

export type AuthenticatedRequest = Request & {
  user: User;
  // Epoch ms; a long-lived response (the notification stream) ends here.
  tokenExpiresAt: number;
};

// Registered globally (APP_GUARD): every route needs a valid access token
// unless it is marked @Public(), and the user's email must be verified unless
// it is marked @AllowUnverifiedEmail().
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        i18nMessage('errors.auth.missingBearerToken'),
      );
    }

    let userId: number;
    let expiresAt: number;
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: number;
        exp: number;
        typ?: string;
      }>(token, { secret: env.JWT_ACCESS_SECRET });
      // An MFA challenge is signed with the same secret but is not a login.
      if (payload.typ === MFA_TOKEN_TYPE) throw new Error('MFA challenge');
      userId = payload.sub;
      expiresAt = payload.exp * 1000;
    } catch {
      throw new UnauthorizedException(
        i18nMessage('errors.auth.invalidAccessToken'),
      );
    }

    // Loaded fresh so role / permission changes apply immediately.
    const user = await this.users.findById(userId);
    if (!user)
      throw new UnauthorizedException(
        i18nMessage('errors.auth.userNoLongerExists'),
      );
    // 401, not 403: the UI treats it as a lost session and signs out.
    assertActive(user);

    const allowUnverified = this.reflector.getAllAndOverride<
      boolean | undefined
    >(ALLOW_UNVERIFIED_EMAIL, [context.getHandler(), context.getClass()]);
    if (!user.emailVerifiedAt && !allowUnverified) {
      throw new ForbiddenException(i18nMessage('errors.auth.emailNotVerified'));
    }

    request.user = user;
    request.tokenExpiresAt = expiresAt;
    this.cls.set('actor', { id: user.id, role: user.role.name });
    return true;
  }
}
