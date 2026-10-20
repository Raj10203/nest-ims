import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { env } from '../../config/env.js';
import { User } from '../../entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { ALLOW_UNVERIFIED_EMAIL } from './allow-unverified-email.decorator.js';
import { IS_PUBLIC } from './public.decorator.js';
import { i18nMessage } from '../../common/i18n/i18n-message.js';

// Registered globally (APP_GUARD): every route needs a valid access token
// unless it is marked @Public(), and the user's email must be verified unless
// it is marked @AllowUnverifiedEmail().
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: User }>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        i18nMessage('errors.auth.missingBearerToken'),
      );
    }

    let userId: number;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: number }>(token, {
        secret: env.JWT_ACCESS_SECRET,
      });
      userId = payload.sub;
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

    const allowUnverified = this.reflector.getAllAndOverride<
      boolean | undefined
    >(ALLOW_UNVERIFIED_EMAIL, [context.getHandler(), context.getClass()]);
    if (!user.emailVerifiedAt && !allowUnverified) {
      throw new ForbiddenException(i18nMessage('errors.auth.emailNotVerified'));
    }

    request.user = user;
    return true;
  }
}
