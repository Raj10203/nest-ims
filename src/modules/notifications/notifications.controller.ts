import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces } from '@nestjs/swagger';
import type { Response } from 'express';
import { idParamSchema } from '../../common/zod/id-param.schema.js';
import { User } from '../../entities/user.entity.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import {
  listNotificationsQuerySchema,
  type ListNotificationsQueryDto,
} from './dto/list-notifications-query.dto.js';
import { NotificationStreams } from './notification-streams.js';
import { NotificationsService } from './notifications.service.js';

// Every route reads or changes the caller's own inbox only, so no ability check.
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly streams: NotificationStreams,
  ) {}

  @ApiOperation({ summary: "The caller's notifications, newest first" })
  @Get()
  findAll(
    @CurrentUser() actor: User,
    @Query({ schema: listNotificationsQuerySchema })
    query: ListNotificationsQueryDto,
  ) {
    return this.notifications.findAll(actor, query);
  }

  @ApiOperation({ summary: "The caller's unread notification count" })
  @Get('unread-count')
  async unreadCount(@CurrentUser() actor: User) {
    return { unreadCount: await this.notifications.unreadCount(actor.id) };
  }

  @ApiOperation({
    summary:
      'Server-sent events: new notifications and read changes, until the access token expires',
  })
  @ApiProduces('text/event-stream')
  @Get('stream')
  async stream(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Headers('last-event-id') lastEventId?: string,
  ) {
    const last = Number(lastEventId);
    const first = await this.notifications.streamStart(
      req.user.id,
      Number.isSafeInteger(last) && last > 0 ? last : null,
    );
    this.streams.open(req.user.id, res, req.tokenExpiresAt, first);
  }

  @ApiOperation({ summary: "Mark all of the caller's notifications read" })
  @Post('read-all')
  @HttpCode(200)
  markAllRead(@CurrentUser() actor: User) {
    return this.notifications.markAllRead(actor);
  }

  @ApiOperation({ summary: 'Mark one notification read' })
  @Post(':id/read')
  @HttpCode(200)
  markRead(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.notifications.markRead(actor, id);
  }
}
