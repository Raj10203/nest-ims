import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Role } from './role.entity.js';

@Entity('users')
export class User extends BaseEntity {
  @Column({ length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  middleName: string | null;

  @Column({ length: 100 })
  lastName: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ type: 'timestamp', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ length: 255, select: false })
  password: string;

  // Hash of the latest issued refresh token; null when logged out.
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  refreshTokenHash: string | null;

  @ManyToOne(() => Role, { nullable: false, eager: true })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column()
  roleId: number;

  // The user who created this account (null for the seeded super admin).
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;
}
