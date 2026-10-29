import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { FindOptionsWhere, LessThan } from 'typeorm';
import { RoleKind } from '../../common/enums/role-kind.enum.js';
import { RoleName, ROLE_LEVELS } from '../../common/enums/role-name.enum.js';
import { Package } from '../../entities/package.entity.js';
import { Role } from '../../entities/role.entity.js';
import { StockRequest } from '../../entities/stock-request.entity.js';
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

const SITE_SUBJECTS = new Set(['StockRequest', 'Package']);

// Primary roles below manager work for one site: their stock request and
// package permissions only reach that site's records. Feature roles (the HQ
// reviewer, the shipment manager) and higher roles reach every site.
function siteScoped(role: Role, subject: string) {
  return (
    SITE_SUBJECTS.has(subject) &&
    role.kind === RoleKind.PRIMARY &&
    role.level < ROLE_LEVELS[RoleName.MANAGER]
  );
}

// TypeORM equivalent of the 'read' rule of a site-scoped subject, for list
// queries. Returns undefined when the actor may read every site's records.
function readableBySiteWhere(
  actor: User,
  ability: AppAbility,
  subject: string,
): { siteId: number } | undefined {
  const everySite = ability
    .rulesFor('read', subject)
    .some((rule) => !rule.inverted && !rule.conditions);
  // -1 matches nothing: a user without a site sees no records.
  return everySite ? undefined : { siteId: actor.siteId ?? -1 };
}

export function readableStockRequestsWhere(
  actor: User,
  ability: AppAbility,
): FindOptionsWhere<StockRequest> | undefined {
  return readableBySiteWhere(actor, ability, 'StockRequest');
}

export function readablePackagesWhere(
  actor: User,
  ability: AppAbility,
): FindOptionsWhere<Package> | undefined {
  return readableBySiteWhere(actor, ability, 'Package');
}

@Injectable()
export class CaslAbilityFactory {
  // The roles' permissions come from the database (seeded); the hierarchy
  // conditions are applied here so rows stay simple (action + subject).
  createForUser(actor: User): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    const roles = [
      actor.role,
      ...(actor.featureRoles ?? []).map((grant) => grant.role),
    ];

    const grants = roles.flatMap((role) =>
      role.permissions.map(({ action, subject }) => ({
        role,
        action,
        subject,
      })),
    );
    for (const { role, action, subject } of grants) {
      if (siteScoped(role, subject)) {
        can(action, subject, { siteId: actor.siteId });
        continue;
      }
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
