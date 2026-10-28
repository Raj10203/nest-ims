import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  type Relation,
  Unique,
} from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Role } from './role.entity.js';
import { User } from './user.entity.js';

// A row (not a plain join table) so each grant and revoke is audited.
@Entity('user_feature_roles')
@Unique(['userId', 'roleId'])
export class UserFeatureRole extends BaseEntity {
  @ManyToOne(() => User, (user) => user.featureRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  // Relation<>: User imports this file too, and a plain `User` type here
  // would make decorator metadata read the class before it is initialized.
  user: Relation<User>;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => Role, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ type: 'int' })
  roleId: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'grantedById' })
  grantedBy: User | null;

  @Column({ type: 'int', nullable: true })
  grantedById: number | null;
}
