import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  USER_CREATED,
  UserCreatedEvent,
} from '../users/events/user-created.event.js';
import { InvitationsService } from './invitations.service.js';

@Injectable()
export class UserCreatedListener {
  private readonly logger = new Logger(UserCreatedListener.name);

  constructor(private readonly invitations: InvitationsService) {}

  // Async, after the create response: a broker outage must not fail user
  // creation. The admin can resend with POST /api/users/:id/invitation.
  @OnEvent(USER_CREATED, { async: true })
  async handle({ userId, email, firstName }: UserCreatedEvent): Promise<void> {
    try {
      await this.invitations.send({ id: userId, email, firstName });
    } catch (error) {
      this.logger.error(
        `Invitation for user ${userId} was not sent: ${(error as Error).message}`,
      );
    }
  }
}
