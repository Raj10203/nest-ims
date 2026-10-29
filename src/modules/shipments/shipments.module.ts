import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackageItem } from '../../entities/package-item.entity.js';
import { Package } from '../../entities/package.entity.js';
import { Shipment } from '../../entities/shipment.entity.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { PackagesController } from './packages.controller.js';
import { ShipmentsController } from './shipments.controller.js';
import { ShipmentsService } from './shipments.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shipment, Package, PackageItem]),
    AuthorizationModule,
    AuditModule,
  ],
  controllers: [ShipmentsController, PackagesController],
  providers: [ShipmentsService],
})
export class ShipmentsModule {}
