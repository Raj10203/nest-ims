import { randomUUID } from 'node:crypto';
import { subject } from '@casl/ability';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RoleKind } from '../../common/enums/role-kind.enum.js';
import { assertPasswordAvoidsNames } from '../../common/security/password-policy.js';
import { hashSecret } from '../../common/security/secret-hash.js';
import { Site } from '../../entities/site.entity.js';
import { UserFeatureRole } from '../../entities/user-feature-role.entity.js';
import { User } from '../../entities/user.entity.js';
import {
  CaslAbilityFactory,
  readableUsersWhere,
} from '../authorization/casl-ability.factory.js';
import { RolesService } from '../roles/roles.service.js';
import { SitesService } from '../sites/sites.service.js';
import { BlobStorageService } from '../storage/blob-storage.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { SetFeatureRolesDto } from './dto/set-feature-roles.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { USER_CREATED, UserCreatedEvent } from './events/user-created.event.js';
import {
  USER_EMAIL_CHANGED,
  UserEmailChangedEvent,
} from './events/user-email-changed.event.js';
import { i18nMessage } from '../../common/i18n/i18n-message.js';
import { depthOne, findPageDepthOne } from '../../common/typeorm/depth-one.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Site) private readonly sites: Repository<Site>,
    private readonly dataSource: DataSource,
    private readonly roles: RolesService,
    private readonly abilityFactory: CaslAbilityFactory,
    @Inject(forwardRef(() => SitesService))
    // Pick: see the matching constructor in SitesService.
    private readonly sitesService: Pick<SitesService, 'isInchargeOfAnySite'>,
    private readonly storage: BlobStorageService,
    private readonly events: EventEmitter2,
  ) {}

  async create(actor: User, dto: CreateUserDto): Promise<User> {
    const role = await this.roles.findById(dto.roleId);
    if (!role)
      throw new NotFoundException(
        i18nMessage('errors.users.roleNotFound', { id: dto.roleId }),
      );

    const ability = this.abilityFactory.createForUser(actor);
    const candidate = subject('User', {
      role: { level: role.level },
      createdById: actor.id,
    });
    if (!ability.can('create', candidate)) {
      throw new ForbiddenException(
        i18nMessage('errors.users.cannotCreateWithRole', { role: role.name }),
      );
    }

    if (await this.users.existsBy({ email: dto.email })) {
      throw new ConflictException(i18nMessage('errors.users.emailTaken'));
    }
    await this.assertSiteExists(dto.siteId);

    const created = await this.users.save(
      this.users.create({
        firstName: dto.firstName,
        middleName: dto.middleName ?? null,
        lastName: dto.lastName,
        email: dto.email,
        roleId: role.id,
        siteId: dto.siteId,
        createdById: actor.id,
      }),
    );
    // The invitation email is sent by a listener (InvitationsModule).
    this.events.emit(
      USER_CREATED,
      new UserCreatedEvent(created.id, created.email, created.firstName),
    );
    return this.findOneOrFail(created.id);
  }

  async findAll(actor: User, { page, limit }: ListUsersQueryDto) {
    const ability = this.abilityFactory.createForUser(actor);
    const [items, total] = await findPageDepthOne(this.users, {
      where: readableUsersWhere(actor, ability),
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async findOneFor(actor: User, id: number): Promise<User> {
    const target = await this.findOneOrFail(id);
    this.assertCan(actor, 'read', target);
    return target;
  }

  async update(actor: User, id: number, dto: UpdateUserDto): Promise<User> {
    const target = await this.findOneOrFail(id);
    this.assertCan(actor, 'update', target);

    const emailChanged = !!dto.email && dto.email !== target.email;
    if (emailChanged) {
      if (await this.users.existsBy({ email: dto.email })) {
        throw new ConflictException(i18nMessage('errors.users.emailTaken'));
      }
    }

    if (dto.siteId && dto.siteId !== target.siteId) {
      await this.assertSiteExists(dto.siteId);
    }

    const { password, ...rest } = dto;
    if (password) {
      assertPasswordAvoidsNames(password, [
        dto.firstName ?? target.firstName,
        dto.lastName ?? target.lastName,
      ]);
    }
    // save(), not update(): AuditSubscriber records the change.
    await this.users.save({
      id,
      ...rest,
      // A code or invitation link sent to the old address must not verify (or
      // claim) the new one. A pending user is re-invited by the event below.
      ...(emailChanged
        ? {
            emailVerifiedAt: null,
            emailOtpHash: null,
            emailOtpExpiresAt: null,
            emailOtpAttempts: 0,
            inviteTokenHash: null,
            inviteExpiresAt: null,
          }
        : {}),
      // A password set here also cancels a pending invitation link.
      ...(password
        ? {
            password: await hashSecret(password),
            inviteTokenHash: null,
            inviteExpiresAt: null,
          }
        : {}),
    });
    const updated = await this.findOneOrFail(id);
    if (emailChanged) {
      this.events.emit(
        USER_EMAIL_CHANGED,
        new UserEmailChangedEvent(id, updated.email, updated.firstName),
      );
    }
    return updated;
  }

  // Replaces the user's feature roles. Same rule as editing the user, so
  // nobody can grant capabilities to themselves or to a higher role.
  async setFeatureRoles(
    actor: User,
    id: number,
    { roleIds }: SetFeatureRolesDto,
  ): Promise<User> {
    await this.findOneToUpdate(actor, id);
    const featureRoleIds = new Set(
      (await this.roles.findAll(RoleKind.FEATURE)).map((role) => role.id),
    );
    const unknown = roleIds.find((roleId) => !featureRoleIds.has(roleId));
    if (unknown !== undefined) {
      throw new BadRequestException(
        i18nMessage('errors.users.featureRoleNotFound', { id: unknown }),
      );
    }

    // Row by row with save()/remove(), so each grant and revoke is audited.
    await this.dataSource.transaction(async (manager) => {
      const grants = manager.getRepository(UserFeatureRole);
      const current = await grants.find({
        where: { userId: id },
        loadEagerRelations: false,
      });
      const revoked = current.filter((g) => !roleIds.includes(g.roleId));
      if (revoked.length) await grants.remove(revoked);
      const held = new Set(current.map((g) => g.roleId));
      const added = [...new Set(roleIds)].filter((roleId) => !held.has(roleId));
      if (added.length) {
        await grants.save(
          added.map((roleId) =>
            grants.create({ userId: id, roleId, grantedById: actor.id }),
          ),
        );
      }
    });
    return this.findOneOrFail(id);
  }

  async remove(actor: User, id: number): Promise<void> {
    const target = await this.findOneOrFail(id);
    this.assertCan(actor, 'delete', target);
    if (await this.sitesService.isInchargeOfAnySite(id)) {
      throw new ConflictException(i18nMessage('errors.users.inchargeOfSite'));
    }
    await this.users.remove(target);
    if (target.avatarUrl) await this.storage.deleteByUrl(target.avatarUrl);
  }

  async setAvatar(
    actor: User,
    id: number,
    file: { buffer: Buffer; mimetype: string },
  ): Promise<User> {
    const target = await this.findAvatarOwner(actor, id);
    const avatarUrl = await this.storage.upload(
      `users/${id}/${randomUUID()}`,
      file.buffer,
      file.mimetype,
    );
    await this.users.save({ id, avatarUrl });
    if (target.avatarUrl) await this.storage.deleteByUrl(target.avatarUrl);
    return this.findOneOrFail(id);
  }

  async removeAvatar(actor: User, id: number): Promise<void> {
    const target = await this.findAvatarOwner(actor, id);
    if (!target.avatarUrl) return;
    await this.users.save({ id, avatarUrl: null });
    await this.storage.deleteByUrl(target.avatarUrl);
  }

  async findOneToUpdate(actor: User, id: number): Promise<User> {
    const target = await this.findOneOrFail(id);
    this.assertCan(actor, 'update', target);
    return target;
  }

  // Anyone may change their own avatar; another user's needs the update rule.
  private findAvatarOwner(actor: User, id: number): Promise<User> {
    return actor.id === id
      ? this.findOneOrFail(id)
      : this.findOneToUpdate(actor, id);
  }

  // --- used by the auth module ---

  // With the role's permissions: CaslAbilityFactory builds the ability from them.
  findById(id: number): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  // `password` and `refreshTokenHash` are select:false, so they must be asked for.
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  findByIdWithRefreshToken(id: number): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.refreshTokenHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  async setRefreshTokenHash(id: number, hash: string | null): Promise<void> {
    await this.users.update(id, { refreshTokenHash: hash });
  }

  // Includes the feature roles (to-many, so not in depthOne): the user screen
  // shows and edits them.
  private async findOneOrFail(id: number): Promise<User> {
    const { select, relations, loadEagerRelations } = depthOne(this.users);
    const user = await this.users.findOne({
      select: {
        ...select,
        featureRoles: { id: true, role: { id: true, name: true } },
      },
      relations: { ...relations, featureRoles: { role: true } },
      loadEagerRelations,
      where: { id },
    });
    if (!user)
      throw new NotFoundException(i18nMessage('errors.users.notFound', { id }));
    return user;
  }

  private async assertSiteExists(id: number): Promise<void> {
    if (!(await this.sites.existsBy({ id }))) {
      throw new BadRequestException(
        i18nMessage('errors.users.siteNotFound', { id }),
      );
    }
  }

  private assertCan(actor: User, action: string, target: User): void {
    const ability = this.abilityFactory.createForUser(actor);
    if (!ability.can(action, subject('User', target))) {
      // Same as a missing user, so ids outside the actor's scope are not revealed.
      throw new NotFoundException(
        i18nMessage('errors.users.notFound', { id: target.id }),
      );
    }
  }
}
