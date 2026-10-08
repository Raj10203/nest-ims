export enum RoleName {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  SITE_INCHARGE = 'site_incharge',
  SITE_TECHNICIAN = 'site_technician',
}

// Higher level = more authority. A user may only create users with a
// strictly lower level, except super_admin who may create any role.
export const ROLE_LEVELS: Record<RoleName, number> = {
  [RoleName.SUPER_ADMIN]: 100,
  [RoleName.ADMIN]: 80,
  [RoleName.MANAGER]: 60,
  [RoleName.SITE_INCHARGE]: 40,
  [RoleName.SITE_TECHNICIAN]: 20,
};
