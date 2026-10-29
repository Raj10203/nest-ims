import { subject } from '@casl/ability';
import { FeatureRoleName } from '../../common/enums/feature-role-name.enum.js';
import { RoleKind } from '../../common/enums/role-kind.enum.js';
import { ROLE_LEVELS, RoleName } from '../../common/enums/role-name.enum.js';
import {
  FEATURE_ROLE_PERMISSIONS,
  ROLE_PERMISSIONS,
} from '../../database/seeds/role-permissions.js';
import { Permission } from '../../entities/permission.entity.js';
import { Role } from '../../entities/role.entity.js';
import { User } from '../../entities/user.entity.js';
import {
  CaslAbilityFactory,
  readablePackagesWhere,
} from '../authorization/casl-ability.factory.js';

const permissions = (defs: readonly (readonly [string, string])[]) =>
  defs.map(([action, subject]) =>
    Object.assign(new Permission(), { action, subject }),
  );

function makeUser(
  roleName: RoleName,
  siteId: number,
  features: FeatureRoleName[] = [],
) {
  const role = Object.assign(new Role(), {
    name: roleName,
    kind: RoleKind.PRIMARY,
    level: ROLE_LEVELS[roleName],
    permissions: permissions(ROLE_PERMISSIONS[roleName]),
  });
  const featureRoles = features.map((name) => ({
    role: Object.assign(new Role(), {
      name,
      kind: RoleKind.FEATURE,
      level: 0,
      permissions: permissions(FEATURE_ROLE_PERMISSIONS[name]),
    }),
  }));
  return Object.assign(new User(), { id: 1, siteId, role, featureRoles });
}

const HQ = 1;
const SITE = 8;
const factory = new CaslAbilityFactory();
const packageAt = (siteId: number) => subject('Package', { siteId });

describe('shipment permissions', () => {
  it('lets any employee of the destination site receive, and nobody else there', () => {
    for (const role of [RoleName.SITE_INCHARGE, RoleName.SITE_TECHNICIAN]) {
      const ability = factory.createForUser(makeUser(role, SITE));
      expect(ability.can('receive', packageAt(SITE))).toBe(true);
      expect(ability.can('receive', packageAt(9))).toBe(false);
      expect(ability.can('read', packageAt(9))).toBe(false);
    }
  });

  it('keeps receiving with the site: HQ roles pack and dispatch but do not receive', () => {
    const shipmentManager = factory.createForUser(
      makeUser(RoleName.SITE_TECHNICIAN, HQ, [
        FeatureRoleName.SHIPMENT_MANAGER,
      ]),
    );
    expect(shipmentManager.can('update', 'Shipment')).toBe(true);
    expect(shipmentManager.can('read', 'StockRequest')).toBe(true);
    expect(shipmentManager.can('receive', packageAt(SITE))).toBe(false);

    const manager = factory.createForUser(makeUser(RoleName.MANAGER, HQ));
    expect(manager.can('close', 'StockRequest')).toBe(true);
    expect(manager.can('read', packageAt(SITE))).toBe(true);
    expect(manager.can('update', 'Shipment')).toBe(false);
    expect(manager.can('receive', packageAt(SITE))).toBe(false);
  });

  it('limits package lists of site roles to their own site', () => {
    const scope = (user: User) =>
      readablePackagesWhere(user, factory.createForUser(user));
    expect(scope(makeUser(RoleName.SITE_TECHNICIAN, SITE))).toEqual({
      siteId: SITE,
    });
    expect(
      scope(
        makeUser(RoleName.SITE_TECHNICIAN, HQ, [
          FeatureRoleName.SHIPMENT_MANAGER,
        ]),
      ),
    ).toBeUndefined();
    expect(scope(makeUser(RoleName.MANAGER, HQ))).toBeUndefined();
  });
});
