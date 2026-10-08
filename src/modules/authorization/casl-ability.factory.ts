import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { FindOptionsWhere, LessThan } from 'typeorm';
import { RoleName } from '../../common/enums/role-name.enum.js';
import { User } from '../../entities/user.entity.js';

export type AppAbility = MongoAbility;

// Users the actor may manage (update / delete / create into): strictly lower
// role level. Everyone except admin is further limited to accounts they created.
function manageableUsers(actor: User) {
  const lowerRole = { 'role.level': { $lt: actor.role.level } };
  return actor.role.name === RoleName.ADMIN
    ? lowerRole
    : { ...lowerRole, createdById: actor.id };
}

// TypeORM equivalent of the CASL 'read' conditions below, for list queries.
// Returns undefined when the actor may read every user (manage all).
export function readableUsersWhere(
  actor: User,
  ability: AppAbility,
): FindOptionsWhere<User>[] | undefined {
  if (ability.can('manage', 'all')) return undefined;
  const lowerRole = { role: { level: LessThan(actor.role.level) } };
  return [
    actor.role.name === RoleName.ADMIN
      ? lowerRole
      : { ...lowerRole, createdById: actor.id },
    { id: actor.id },
  ];
}

@Injectable()
export class CaslAbilityFactory {
  // The role's permissions come from the database (seeded); the hierarchy
  // conditions are applied here so rows stay simple (action + subject).
  createForUser(actor: User): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    for (const { action, subject } of actor.role.permissions) {
      if (subject !== 'User') {
        can(action, subject);
        continue;
      }
      can(action, 'User', manageableUsers(actor));
      if (action === 'read') {
        can('read', 'User', { id: actor.id });
      }
    }

    return build();
  }
}
