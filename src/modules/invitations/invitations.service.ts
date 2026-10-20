import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
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
import { INVITE_PATH, INVITE_TTL_HOURS } from './invitation.constants.js';

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly usersService: UsersService,
    private readonly jobs: JobQueueService,
    private readonly audit: AuditService,
  ) {}

  // Each call replaces the stored token, so only the latest link works.
  async send(user: Pick<User, 'id' | 'email' | 'firstName'>): Promise<void> {
    const token = generateToken();
    await this.users.update(user.id, {
      inviteTokenHash: hashToken(token),
      inviteExpiresAt: new Date(Date.now() + INVITE_TTL_HOURS * 3_600_000),
    });
    await this.jobs.publish('mail.send-invite', {
      to: user.email,
      firstName: user.firstName,
      url: `${env.APP_URL}${INVITE_PATH}?token=${token}`,
      expiresInHours: INVITE_TTL_HOURS,
    });
  }

  // Invited but has not set a password yet.
  async isPending(id: number): Promise<boolean> {
    return !(await this.users.existsBy({ id, password: Not(IsNull()) }));
  }

  async resend(actor: User, id: number): Promise<void> {
    const target = await this.usersService.findOneToUpdate(actor, id);
    if (!(await this.isPending(id))) {
      throw new ConflictException(i18nMessage('errors.invite.alreadyAccepted'));
    }
    await this.send(target);
  }

  // Opening the emailed link proves the user owns the address, so this also
  // verifies the email.
  async accept(token: string, password: string): Promise<void> {
    const valid = {
      inviteTokenHash: hashToken(token),
      inviteExpiresAt: MoreThan(new Date()),
    };
    const user = await this.users.findOne({
      where: valid,
      select: { id: true, firstName: true, lastName: true },
      loadEagerRelations: false,
    });
    if (!user) {
      throw new BadRequestException(i18nMessage('errors.invite.invalid'));
    }
    assertPasswordAvoidsNames(password, [user.firstName, user.lastName]);

    const passwordHash = await hashSecret(password);
    const emailVerifiedAt = new Date();
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
          emailVerifiedAt,
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
          oldValues: { password: null, emailVerifiedAt: null },
          newValues: {
            password: passwordHash,
            emailVerifiedAt: emailVerifiedAt.toISOString(),
          },
          // No session yet: the invited user acts on their own account.
          actorId: user.id,
        },
        manager,
      );
    });
  }
}
