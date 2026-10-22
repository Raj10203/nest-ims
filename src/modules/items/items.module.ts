import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemMovement } from '../../entities/item-movement.entity.js';
import { Item } from '../../entities/item.entity.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { ItemsController } from './items.controller.js';
import { ItemsService } from './items.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Item, ItemMovement]),
    AuthorizationModule,
    AuditModule,
  ],
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}
