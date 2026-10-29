import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../../entities/notification.entity.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { NotificationStreams } from './notification-streams.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), JobsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationStreams],
  exports: [NotificationsService],
})
export class NotificationsModule {}
