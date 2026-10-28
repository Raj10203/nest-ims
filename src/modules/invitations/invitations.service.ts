import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { i18nMessage } from '../../common/i18n/i18n-message.js';
import { assertPasswordAvoidsNames } from '../../common/security/password-policy.js';
import {
  generateToken,
  hashSecret,
  hashToken,
} from '../../common/security/secret-hash.js';
import { env } from '../../config/env.js';
import { User } from '../../entities/user.entity.js';
import { AuditService } from '../audit/audit.service.js';
import { JobQueueService } from '../jobs/job-queue.service.js';
import { UsersService } from '../users/users.service.js';
import {
  INVITE_PATH,
  INVITE_TTL_HOURS,
  PASSWORD_RESET_TTL_MINUTES,
} from './invitation.constants.js';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly usersService: UsersService,
    private readonly jobs: JobQueueService,
    private readonly audit: AuditService,
  ) {}

  async send(user: Pick<User, 'id' | 'email' | 'firstName'>): Promise<void> {
    const url = await this.issueLink(user.id, INVITE_TTL_HOURS * 60, {
      invitedAt: new Date(),
    });
    await this.jobs.publish('mail.send-invite', {
      to: user.email,
      firstName: user.firstName,
      url,
      expiresInHours: INVITE_TTL_HOURS,
    });
  }

  // Not awaited, and silent about unknown emails: neither the answer nor the
  // time it takes may reveal whether an account exists.
  requestPasswordReset(email: string): void {
    this.sendPasswordReset(email).catch((error: unknown) => {
      this.logger.error(
        `Password reset was not sent: ${(error as Error).message}`,
      );
    });
  }

  async sendPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user?.isActive) return;
    // Never set a password: the invitation is the right email, and it lasts longer.
    if (!user.password) return this.send(user);

    const url = await this.issueLink(user.id, PASSWORD_RESET_TTL_MINUTES);
    await this.jobs.publish('mail.send-password-reset', {
      to: user.email,
      firstName: user.firstName,
      url,
      expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
    });
  }

  // One token column for both emails: each call replaces the stored token, so
  // only the latest link of either kind works.
  private async issueLink(
    userId: number,
    ttlMinutes: number,
    changes: Pick<Partial<User>, 'invitedAt'> = {},
  ): Promise<string> {
    const token = generateToken();
    await this.users.update(userId, {
      ...changes,
      inviteTokenHash: hashToken(token),
      inviteExpiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    });
    return `${env.APP_URL}${INVITE_PATH}?token=${token}`;
  }

  isPending(id: number): Promise<boolean> {
    return this.users.existsBy({ id, isActive: true, password: IsNull() });
  }

  async resend(actor: User, id: number): Promise<void> {
    const target = await this.usersService.findOneToUpdate(actor, id);
    if (!target.isActive) {
      throw new ConflictException(i18nMessage('errors.users.inactive'));
    }
    if (!(await this.isPending(id))) {
      throw new ConflictException(i18nMessage('errors.invite.alreadyAccepted'));
    }
    await this.send(target);
  }

  // Sets the password from an invitation or a password reset link. Opening the
  // emailed link proves the user owns the address, so this also verifies the
  // email, and it signs out every session (a reset is often after a leak).
  async accept(token: string, password: string): Promise<void> {
    const valid = {
      inviteTokenHash: hashToken(token),
      inviteExpiresAt: MoreThan(new Date()),
      isActive: true,
    };
    const user = await this.users.findOne({
      where: valid,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        password: true,
        emailVerifiedAt: true,
        activatedAt: true,
      },
      loadEagerRelations: false,
    });
    if (!user) {
      throw new BadRequestException(i18nMessage('errors.invite.invalid'));
    }
    assertPasswordAvoidsNames(password, [user.firstName, user.lastName]);

    const passwordHash = await hashSecret(password);
    const emailVerifiedAt = user.emailVerifiedAt ?? new Date();
    const activatedAt = user.activatedAt ?? new Date();
    await this.users.manager.transaction(async (manager) => {
      // Conditional UPDATE: concurrent requests cannot both use the link. The
      // audit subscriber cannot see such an update, so the entry is explicit.
      const { affected } = await manager.update(
        User,
        { id: user.id, ...valid },
        {
          password: passwordHash,
          inviteTokenHash: null,
          inviteExpiresAt: null,
          refreshTokenHash: null,
          emailVerifiedAt,
          activatedAt,
        },
      );
      if (!affected) {
        throw new BadRequestException(i18nMessage('errors.invite.invalid'));
      }
      await this.audit.record(
        {
          action: 'update',
          entityType: 'User',
          entityId: String(user.id),
          oldValues: {
            password: user.password ?? null,
            emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
            activatedAt: user.activatedAt?.toISOString() ?? null,
          },
          newValues: {
            password: passwordHash,
            emailVerifiedAt: emailVerifiedAt.toISOString(),
            activatedAt: activatedAt.toISOString(),
          },
          // No session: the user acts on their own account through the link.
          actorId: user.id,
        },
        manager,
      );
    });
  }
}
