// A user has one primary role (hierarchy, levels) and any number of feature
// roles, which only add permissions.
export enum RoleKind {
  PRIMARY = 'primary',
  FEATURE = 'feature',
}
