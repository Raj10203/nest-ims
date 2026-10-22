import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { FeatureRoleName } from '../common/enums/feature-role-name.enum.js';
import { RoleKind } from '../common/enums/role-kind.enum.js';
import { RoleName } from '../common/enums/role-name.enum.js';
import { BaseEntity } from './base.entity.js';
import { Permission } from './permission.entity.js';

@Entity('roles')
export class Role extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  name: RoleName | FeatureRoleName;

  @Column({ type: 'varchar', length: 10, default: RoleKind.PRIMARY })
  kind: RoleKind;

  // 0 for feature roles: they take no part in the hierarchy.
  @Column({ type: 'int' })
  level: number;

  @ManyToMany(() => Permission, { eager: true })
  @JoinTable({ name: 'role_permissions' })
  permissions: Permission[];
}
