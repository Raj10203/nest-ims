import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { minutes, Throttle } from '@nestjs/throttler';
import { I18n, I18nContext } from 'nestjs-i18n';
import { idParamSchema } from '../../common/zod/id-param.schema.js';
import { User } from '../../entities/user.entity.js';
import type { I18nTranslations } from '../../generated/i18n.generated.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { CheckAbility } from '../authorization/check-ability.decorator.js';
import { PoliciesGuard } from '../authorization/policies.guard.js';
import {
  acceptInvitationSchema,
  type AcceptInvitationDto,
} from './dto/accept-invitation.dto.js';
import { InvitationsService } from './invitations.service.js';

@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @ApiOperation({
    summary: 'Set the first password with the token from the invitation email',
  })
  @Public()
  @Throttle({ default: { limit: 10, ttl: minutes(1) } })
  @Post('invitations/accept')
  @HttpCode(200)
  async accept(
    @Body({ schema: acceptInvitationSchema }) dto: AcceptInvitationDto,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    await this.invitations.accept(dto.token, dto.password);
    return { message: i18n.t('messages.passwordSet') };
  }

  @ApiOperation({
    summary: 'Email a new invitation link (the previous one stops working)',
  })
  @ApiBearerAuth()
  @UseGuards(PoliciesGuard)
  @CheckAbility('update', 'User')
  @Post('users/:id/invitation')
  @HttpCode(202)
  async resend(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @I18n() i18n: I18nContext<I18nTranslations>,
  ) {
    await this.invitations.resend(actor, id);
    return { message: i18n.t('messages.invitationSent') };
  }
}
