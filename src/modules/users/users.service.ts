import { subject } from '@casl/ability';
import {
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashSecret } from '../../common/security/secret-hash.js';
import { User } from '../../entities/user.entity.js';
import {
  CaslAbilityFactory,
  readableUsersWhere,
} from '../authorization/casl-ability.factory.js';
import { RolesService } from '../roles/roles.service.js';
import { SitesService } from '../sites/sites.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { i18nMessage } from '../../common/i18n/i18n-message.js';
import { depthOne } from '../../common/typeorm/depth-one.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly roles: RolesService,
    private readonly abilityFactory: CaslAbilityFactory,
    @Inject(forwardRef(() => SitesService))
    // Pick: see the matching constructor in SitesService.
    private readonly sitesService: Pick<SitesService, 'isInchargeOfAnySite'>,
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

    const created = await this.users.save(
      this.users.create({
        firstName: dto.firstName,
        middleName: dto.middleName ?? null,
        lastName: dto.lastName,
        email: dto.email,
        password: await hashSecret(dto.password),
        roleId: role.id,
        createdById: actor.id,
      }),
    );
    return this.findOneOrFail(created.id);
  }

  async findAll(actor: User, { page, limit }: ListUsersQueryDto) {
    const ability = this.abilityFactory.createForUser(actor);
    const [items, total] = await this.users.findAndCount({
      ...depthOne(this.users),
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

    if (dto.email && dto.email !== target.email) {
      if (await this.users.existsBy({ email: dto.email })) {
        throw new ConflictException(i18nMessage('errors.users.emailTaken'));
      }
    }

    const { password, ...rest } = dto;
    await this.users.update(id, {
      ...rest,
      // A code sent to the old address must not verify the new one.
      ...(dto.email && dto.email !== target.email
        ? {
            emailVerifiedAt: null,
            emailOtpHash: null,
            emailOtpExpiresAt: null,
            emailOtpAttempts: 0,
          }
        : {}),
      ...(password ? { password: await hashSecret(password) } : {}),
    });
    return this.findOneOrFail(id);
  }

  async remove(actor: User, id: number): Promise<void> {
    const target = await this.findOneOrFail(id);
    this.assertCan(actor, 'delete', target);
    if (await this.sitesService.isInchargeOfAnySite(id)) {
      throw new ConflictException(i18nMessage('errors.users.inchargeOfSite'));
    }
    await this.users.delete(id);
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

  private async findOneOrFail(id: number): Promise<User> {
    const user = await this.users.findOne({
      ...depthOne(this.users),
      where: { id },
    });
    if (!user)
      throw new NotFoundException(i18nMessage('errors.users.notFound', { id }));
    return user;
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
