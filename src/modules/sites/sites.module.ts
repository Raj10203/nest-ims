import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemMovement } from '../../entities/item-movement.entity.js';
import { Site } from '../../entities/site.entity.js';
import { User } from '../../entities/user.entity.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { UsersModule } from '../users/users.module.js';
import { SitesController } from './sites.controller.js';
import { SitesService } from './sites.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Site, User, ItemMovement]),
    AuthorizationModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
