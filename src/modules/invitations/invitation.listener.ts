import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  USER_CREATED,
  UserCreatedEvent,
} from '../users/events/user-created.event.js';
import {
  USER_EMAIL_CHANGED,
  UserEmailChangedEvent,
} from '../users/events/user-email-changed.event.js';
import { InvitationsService } from './invitations.service.js';

// Async, after the response: a broker outage must not fail the user change.
// Failures are logged; the admin can resend with POST /api/users/:id/invitation.
@Injectable()
export class InvitationListener {
  private readonly logger = new Logger(InvitationListener.name);

  constructor(private readonly invitations: InvitationsService) {}

  @OnEvent(USER_CREATED, { async: true })
  async onUserCreated({
    userId,
    email,
    firstName,
  }: UserCreatedEvent): Promise<void> {
    await this.sendSafely({ id: userId, email, firstName });
  }

  // Only a user who has not set a password yet still needs the link.
  @OnEvent(USER_EMAIL_CHANGED, { async: true })
  async onEmailChanged({
    userId,
    email,
    firstName,
  }: UserEmailChangedEvent): Promise<void> {
    try {
      if (!(await this.invitations.isPending(userId))) return;
    } catch (error) {
      this.logFailure(userId, error);
      return;
    }
    await this.sendSafely({ id: userId, email, firstName });
  }

  private async sendSafely(user: {
    id: number;
    email: string;
    firstName: string;
  }): Promise<void> {
    try {
      await this.invitations.send(user);
    } catch (error) {
      this.logFailure(user.id, error);
    }
  }

  private logFailure(userId: number, error: unknown): void {
    this.logger.error(
      `Invitation for user ${userId} was not sent: ${(error as Error).message}`,
    );
  }
}
