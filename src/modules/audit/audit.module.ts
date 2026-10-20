import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../entities/audit-log.entity.js';
import { User } from '../../entities/user.entity.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditSubscriber } from './audit.subscriber.js';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, User]), AuthorizationModule],
  controllers: [AuditController],
  providers: [AuditService, AuditSubscriber],
  exports: [AuditService],
})
export class AuditModule {}
