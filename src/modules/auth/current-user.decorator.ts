import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { User } from '../../entities/user.entity.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest<Request & { user: User }>().user,
);
