import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockRequestComment } from '../../entities/stock-request-comment.entity.js';
import { StockRequestEvent } from '../../entities/stock-request-event.entity.js';
import { StockRequestLine } from '../../entities/stock-request-line.entity.js';
import { StockRequest } from '../../entities/stock-request.entity.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { StockRequestsController } from './stock-requests.controller.js';
import { StockRequestsService } from './stock-requests.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockRequest,
      StockRequestLine,
      StockRequestEvent,
      StockRequestComment,
    ]),
    AuthorizationModule,
    NotificationsModule,
  ],
  controllers: [StockRequestsController],
  providers: [StockRequestsService],
})
export class StockRequestsModule {}
