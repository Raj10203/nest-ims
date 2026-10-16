import { subject } from '@casl/ability';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { RoleName } from '../../common/enums/role-name.enum.js';
import { Role } from '../../entities/role.entity.js';
import { User } from '../../entities/user.entity.js';
import { CaslAbilityFactory } from '../authorization/casl-ability.factory.js';

export interface RoleOption {
  id: number;
  name: RoleName;
  level: number;
}

const CACHE_KEY = 'roles:all';
// Roles only change when the seed command runs, which ships with a deploy.
const CACHE_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  async findAll(): Promise<RoleOption[]> {
    const cached = await this.cache.get<RoleOption[]>(CACHE_KEY);
    if (cached) return cached;

    const roles = await this.roles.find({
      order: { level: 'DESC' },
      loadEagerRelations: false,
    });
    const options = roles.map(({ id, name, level }) => ({ id, name, level }));
    await this.cache.set(CACHE_KEY, options, CACHE_TTL_MS);
    return options;
  }

  async findById(id: number): Promise<RoleOption | null> {
    return (await this.findAll()).find((role) => role.id === id) ?? null;
  }

  // Roles the actor may assign when creating a user. Uses the same 'create'
  // rule as UsersService.create, so the list can never offer a forbidden role.
  async findAssignable(actor: User): Promise<RoleOption[]> {
    const ability = this.abilityFactory.createForUser(actor);
    const roles = await this.findAll();
    return roles.filter((role) =>
      ability.can(
        'create',
        subject('User', {
          role: { level: role.level },
          createdById: actor.id,
        }),
      ),
    );
  }
}
