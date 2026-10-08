import { RoleName } from '../../common/enums/role-name.enum.js';

type PermissionDef = readonly [action: string, subject: string];

const USER_CRUD: PermissionDef[] = [
  ['create', 'User'],
  ['read', 'User'],
  ['update', 'User'],
  ['delete', 'User'],
];

// Single source of truth for what each role may do. The seeder makes the
// database match this exactly (adds missing rows, removes stale ones).
// Hierarchy limits (who can touch whom) are applied by CaslAbilityFactory.
export const ROLE_PERMISSIONS: Record<RoleName, PermissionDef[]> = {
  [RoleName.SUPER_ADMIN]: [['manage', 'all']],
  [RoleName.ADMIN]: USER_CRUD,
  [RoleName.MANAGER]: USER_CRUD,
  [RoleName.SITE_INCHARGE]: USER_CRUD,
  [RoleName.SITE_TECHNICIAN]: [['read', 'User']],
};
