import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { UsersModule } from '../users/users.module.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { InvitationListener } from './invitation.listener.js';

// Depends on UsersModule, never the other way round: users only emit
// user.created and user.email-changed, so there is no import cycle.
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    UsersModule,
    JobsModule,
    AuthorizationModule,
    AuditModule,
  ],
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationListener],
})
export class InvitationsModule {}
