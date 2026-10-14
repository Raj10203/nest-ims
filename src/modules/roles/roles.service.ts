import { subject } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  // Roles the actor may assign when creating a user. Uses the same 'create'
  // rule as UsersService.create, so the list can never offer a forbidden role.
  async findAssignable(actor: User): Promise<RoleOption[]> {
    const ability = this.abilityFactory.createForUser(actor);
    const roles = await this.roles.find({ order: { level: 'DESC' } });
    return roles
      .filter((role) =>
        ability.can(
          'create',
          subject('User', {
            role: { level: role.level },
            createdById: actor.id,
          }),
        ),
      )
      .map(({ id, name, level }) => ({ id, name, level }));
  }
}
