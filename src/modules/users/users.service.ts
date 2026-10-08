import { subject } from '@casl/ability';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashSecret } from '../../common/security/secret-hash.js';
import { Role } from '../../entities/role.entity.js';
import { User } from '../../entities/user.entity.js';
import {
  CaslAbilityFactory,
  readableUsersWhere,
} from '../authorization/casl-ability.factory.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  async create(actor: User, dto: CreateUserDto): Promise<User> {
    const role = await this.roles.findOne({ where: { name: dto.role } });
    if (!role) throw new NotFoundException(`Role "${dto.role}" does not exist`);

    const ability = this.abilityFactory.createForUser(actor);
    const candidate = subject('User', {
      role: { level: role.level },
      createdById: actor.id,
    });
    if (!ability.can('create', candidate)) {
      throw new ForbiddenException(
        `You are not allowed to create a user with role "${role.name}"`,
      );
    }

    if (await this.users.existsBy({ email: dto.email })) {
      throw new ConflictException('A user with this email already exists');
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
        throw new ConflictException('A user with this email already exists');
      }
    }

    const { password, ...rest } = dto;
    await this.users.update(id, {
      ...rest,
      ...(password ? { password: await hashSecret(password) } : {}),
    });
    return this.findOneOrFail(id);
  }

  async remove(actor: User, id: number): Promise<void> {
    const target = await this.findOneOrFail(id);
    this.assertCan(actor, 'delete', target);
    await this.users.delete(id);
  }

  // --- used by the auth module ---

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

  // --- helpers ---

  private async findOneOrFail(id: number): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  private assertCan(actor: User, action: string, target: User): void {
    const ability = this.abilityFactory.createForUser(actor);
    if (!ability.can(action, subject('User', target))) {
      // Same response as a missing user so ids outside the actor's scope are not revealed.
      throw new NotFoundException(`User ${target.id} not found`);
    }
  }
}
