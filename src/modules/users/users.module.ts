import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from '../../entities/site.entity.js';
import { User } from '../../entities/user.entity.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { SitesModule } from '../sites/sites.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Site]),
    AuthorizationModule,
    RolesModule,
    forwardRef(() => SitesModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
