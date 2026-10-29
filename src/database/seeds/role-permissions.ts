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

// Any employee of the destination site receives its packages.
const PACKAGE_RECEIVE: PermissionDef[] = [
  ['read', 'Package'],
  ['receive', 'Package'],
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
    ['read', 'StockRequest'],
    ['read', 'Shipment'],
    ['read', 'Package'],
    ['read', 'AuditLog'],
  ],
  [RoleName.MANAGER]: [
    ...USER_CRUD,
    ...SITE_CRUD,
    ...CATALOG_CRUD,
    ['assign', 'FeatureRole'],
    ['read', 'Item'],
    ['read', 'StockRequest'],
    // The final step of the review chain.
    ['approve', 'StockRequest'],
    // Ends a request with what was received.
    ['close', 'StockRequest'],
    ['read', 'Shipment'],
    ['read', 'Package'],
  ],
  // Stock requests and packages of site roles are limited to their own site
  // (CaslAbilityFactory).
  [RoleName.SITE_INCHARGE]: [
    ...USER_CRUD,
    ...CATALOG_READ,
    ['create', 'StockRequest'],
    ['read', 'StockRequest'],
    ...PACKAGE_RECEIVE,
  ],
  [RoleName.SITE_TECHNICIAN]: [
    ['read', 'User'],
    ...CATALOG_READ,
    ...PACKAGE_RECEIVE,
  ],
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
  // The first step of the review chain, at headquarters.
  [FeatureRoleName.STOCK_REQUEST_REVIEWER]: [
    ['read', 'StockRequest'],
    ['review', 'StockRequest'],
    ['read', 'Product'],
    ['read', 'Category'],
  ],
  // Packs approved requests into shipments and dispatches them.
  [FeatureRoleName.SHIPMENT_MANAGER]: [
    ['create', 'Shipment'],
    ['read', 'Shipment'],
    ['update', 'Shipment'],
    ['read', 'Package'],
    ['read', 'StockRequest'],
    ['read', 'Item'],
    ['read', 'Product'],
    ['read', 'Category'],
  ],
};
