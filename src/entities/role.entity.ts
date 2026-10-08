import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { RoleName } from '../common/enums/role-name.enum.js';
import { BaseEntity } from './base.entity.js';
import { Permission } from './permission.entity.js';

@Entity('roles')
export class Role extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  name: RoleName;

  @Column({ type: 'int' })
  level: number;

  @ManyToMany(() => Permission, { eager: true })
  @JoinTable({ name: 'role_permissions' })
  permissions: Permission[];
}
