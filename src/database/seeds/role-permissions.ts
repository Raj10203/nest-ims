import { FeatureRoleName } from '../../common/enums/feature-role-name.enum.js';
import { RoleName } from '../../common/enums/role-name.enum.js';

type PermissionDef = readonly [action: string, subject: string];

const USER_CRUD: PermissionDef[] = [
  ['create', 'User'],
  ['read', 'User'],
  ['update', 'User'],
  ['delete', 'User'],
];

const SITE_CRUD: PermissionDef[] = [
  ['create', 'Site'],
  ['read', 'Site'],
  ['update', 'Site'],
  ['delete', 'Site'],
];

const CATALOG_CRUD: PermissionDef[] = [
  ['create', 'Category'],
  ['read', 'Category'],
  ['update', 'Category'],
  ['delete', 'Category'],
  ['create', 'Product'],
  ['read', 'Product'],
  ['update', 'Product'],
  ['delete', 'Product'],
];

const CATALOG_READ: PermissionDef[] = [
  ['read', 'Category'],
  ['read', 'Product'],
];

// Single source of truth for what each role may do. The seeder makes the
// database match this exactly (adds missing rows, removes stale ones).
// Hierarchy limits (who can touch whom) are applied by CaslAbilityFactory.
export const ROLE_PERMISSIONS: Record<RoleName, PermissionDef[]> = {
  [RoleName.SUPER_ADMIN]: [['manage', 'all']],
  [RoleName.ADMIN]: [
    ...USER_CRUD,
    ...SITE_CRUD,
    ...CATALOG_CRUD,
    ['assign', 'FeatureRole'],
    ['read', 'Item'],
    ['read', 'AuditLog'],
  ],
  [RoleName.MANAGER]: [
    ...USER_CRUD,
    ...SITE_CRUD,
    ...CATALOG_CRUD,
    ['assign', 'FeatureRole'],
    ['read', 'Item'],
  ],
  [RoleName.SITE_INCHARGE]: [...USER_CRUD, ...CATALOG_READ],
  [RoleName.SITE_TECHNICIAN]: [['read', 'User'], ...CATALOG_READ],
};

// Added on top of the primary role's permissions, for whoever holds them,
// whatever their primary role or site.
export const FEATURE_ROLE_PERMISSIONS: Record<
  FeatureRoleName,
  PermissionDef[]
> = {
  [FeatureRoleName.STOCK_MANAGER]: [
    ['create', 'Item'],
    ['read', 'Item'],
    ['update', 'Item'],
    ['delete', 'Item'],
    ['read', 'Product'],
    ['read', 'Category'],
  ],
};
