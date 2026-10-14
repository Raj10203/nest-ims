import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from '../../entities/site.entity.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { SitesController } from './sites.controller.js';
import { SitesService } from './sites.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Site]), AuthorizationModule],
  controllers: [SitesController],
  providers: [SitesService],
})
export class SitesModule {}
