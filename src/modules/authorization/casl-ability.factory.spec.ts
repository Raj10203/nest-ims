import { subject } from '@casl/ability';
import { ROLE_LEVELS, RoleName } from '../../common/enums/role-name.enum.js';
import { Permission } from '../../entities/permission.entity.js';
import { Role } from '../../entities/role.entity.js';
import { User } from '../../entities/user.entity.js';
import { ROLE_PERMISSIONS } from '../../database/seeds/role-permissions.js';
import { CaslAbilityFactory } from './casl-ability.factory.js';

function makeUser(id: number, roleName: RoleName, createdById: number | null) {
  const role = Object.assign(new Role(), {
    name: roleName,
    level: ROLE_LEVELS[roleName],
    permissions: ROLE_PERMISSIONS[roleName].map(([action, subject]) =>
      Object.assign(new Permission(), { action, subject }),
    ),
  });
  return Object.assign(new User(), { id, role, createdById });
}

// What the API would pass when checking "may this actor create a user with this role?"
const newUserWith = (roleName: RoleName, creatorId: number) =>
  subject('User', {
    role: { level: ROLE_LEVELS[roleName] },
    createdById: creatorId,
  });

describe('CaslAbilityFactory', () => {
  const factory = new CaslAbilityFactory();

  it('lets a super admin create and manage any role', () => {
    const ability = factory.createForUser(
      makeUser(1, RoleName.SUPER_ADMIN, null),
    );
    for (const role of Object.values(RoleName)) {
      expect(ability.can('create', newUserWith(role, 1))).toBe(true);
    }
  });

  it('only lets a user create roles strictly below their own', () => {
    const manager = factory.createForUser(makeUser(2, RoleName.MANAGER, 1));
    expect(manager.can('create', newUserWith(RoleName.SITE_INCHARGE, 2))).toBe(
      true,
    );
    expect(
      manager.can('create', newUserWith(RoleName.SITE_TECHNICIAN, 2)),
    ).toBe(true);
    expect(manager.can('create', newUserWith(RoleName.MANAGER, 2))).toBe(false);
    expect(manager.can('create', newUserWith(RoleName.ADMIN, 2))).toBe(false);
  });

  it('limits non-admin roles to accounts they created', () => {
    const manager = makeUser(2, RoleName.MANAGER, 1);
    const ability = factory.createForUser(manager);
    const own = makeUser(4, RoleName.SITE_INCHARGE, 2);
    const others = makeUser(5, RoleName.SITE_INCHARGE, 3);
    expect(ability.can('update', subject('User', own))).toBe(true);
    expect(ability.can('update', subject('User', others))).toBe(false);
  });

  it('lets an admin manage every lower role regardless of creator', () => {
    const ability = factory.createForUser(makeUser(3, RoleName.ADMIN, 1));
    const manager = makeUser(9, RoleName.MANAGER, 1);
    expect(ability.can('delete', subject('User', manager))).toBe(true);
    expect(
      ability.can('delete', subject('User', makeUser(10, RoleName.ADMIN, 1))),
    ).toBe(false);
  });

  it('gives a technician read access to themselves only', () => {
    const tech = makeUser(7, RoleName.SITE_TECHNICIAN, 4);
    const ability = factory.createForUser(tech);
    expect(ability.can('read', subject('User', tech))).toBe(true);
    expect(
      ability.can(
        'read',
        subject('User', makeUser(8, RoleName.SITE_TECHNICIAN, 4)),
      ),
    ).toBe(false);
    expect(ability.can('create', 'User')).toBe(false);
    expect(ability.can('update', subject('User', tech))).toBe(false);
  });
});
