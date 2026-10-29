import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import { NotificationType } from '../../common/enums/notification-type.enum.js';
import { i18nMessage } from '../../common/i18n/i18n-message.js';
import { Notification } from '../../entities/notification.entity.js';
import type { User } from '../../entities/user.entity.js';
import type { ListNotificationsQueryDto } from './dto/list-notifications-query.dto.js';
import { NotificationStreams, sseEvent } from './notification-streams.js';
import type { NotificationData } from './notification.types.js';

const VIEW = {
  id: true,
  type: true,
  data: true,
  readAt: true,
  createdAt: true,
} as const;

const REPLAY_LIMIT = 50;

const view = ({ id, type, data, readAt, createdAt }: Notification) => ({
  id,
  type,
  data,
  readAt,
  createdAt,
});

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    private readonly streams: NotificationStreams,
  ) {}

  // In the caller's transaction, so it exists only if the change does; call
  // send() once that transaction has committed.
  create<T extends NotificationType>(
    manager: EntityManager,
    userId: number,
    type: T,
    data: NotificationData[T],
  ): Promise<Notification> {
    return manager.save(Notification, { userId, type, data, readAt: null });
  }

  // Best effort, never awaited by the request: the notification is stored.
  send(notification: Notification): void {
    this.push(notification).catch((err: Error) =>
      this.logger.warn(
        `Push of notification ${notification.id} failed: ${err.message}`,
      ),
    );
  }

  async findAll(
    actor: User,
    { unread, page, limit }: ListNotificationsQueryDto,
  ) {
    const where = { userId: actor.id, ...(unread && { readAt: IsNull() }) };
    const [items, total] = await Promise.all([
      this.notifications.find({
        select: VIEW,
        where,
        order: { id: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.notifications.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  unreadCount(userId: number): Promise<number> {
    return this.notifications.countBy({ userId, readAt: IsNull() });
  }

  async markRead(actor: User, id: number) {
    const { affected } = await this.notifications.update(
      { id, userId: actor.id, readAt: IsNull() },
      { readAt: new Date() },
    );
    if (
      !affected &&
      !(await this.notifications.existsBy({ id, userId: actor.id }))
    ) {
      throw new NotFoundException(
        i18nMessage('errors.notifications.notFound', { id }),
      );
    }
    return this.announceRead(actor.id, id, !!affected);
  }

  async markAllRead(actor: User) {
    const { affected } = await this.notifications.update(
      { userId: actor.id, readAt: IsNull() },
      { readAt: new Date() },
    );
    return this.announceRead(actor.id, null, !!affected);
  }

  // The first frame of a stream: what was missed since Last-Event-ID, then
  // `ready` with the badge count, so the client needs no other request.
  async streamStart(userId: number, lastEventId: number | null) {
    const missed = lastEventId
      ? await this.notifications.find({
          select: VIEW,
          where: { userId, id: MoreThan(lastEventId) },
          order: { id: 'DESC' },
          take: REPLAY_LIMIT + 1,
        })
      : [];
    const unreadCount = await this.unreadCount(userId);
    return (
      missed
        .slice(0, REPLAY_LIMIT)
        .reverse()
        .map((notification) =>
          sseEvent('notification', { notification }, notification.id),
        )
        .join('') +
      // More were missed than replayed: the client reloads its list.
      sseEvent('ready', { unreadCount, resync: missed.length > REPLAY_LIMIT })
    );
  }

  private async push(notification: Notification): Promise<void> {
    const unreadCount = await this.unreadCount(notification.userId);
    await this.streams.publish(
      notification.userId,
      sseEvent(
        'notification',
        { notification: view(notification), unreadCount },
        notification.id,
      ),
    );
  }

  // Tells the user's other tabs, so every badge agrees.
  private async announceRead(
    userId: number,
    id: number | null,
    changed: boolean,
  ) {
    const unreadCount = await this.unreadCount(userId);
    if (changed) {
      this.streams
        .publish(userId, sseEvent('read', { id, unreadCount }))
        .catch((err: Error) =>
          this.logger.warn(`Push of read failed: ${err.message}`),
        );
    }
    return { unreadCount };
  }
}
