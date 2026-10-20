import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { User } from '../../entities/user.entity.js';
import { CaslAbilityFactory } from './casl-ability.factory.js';
import { CHECK_ABILITY, RequiredAbility } from './check-ability.decorator.js';
import { i18nMessage } from '../../common/i18n/i18n-message.js';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      RequiredAbility | undefined
    >(CHECK_ABILITY, [context.getHandler(), context.getClass()]);
    if (!required) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user: User }>();
    const ability = this.abilityFactory.createForUser(user);
    if (!ability.can(required.action, required.subject)) {
      throw new ForbiddenException(i18nMessage('errors.forbidden'));
    }
    return true;
  }
}
