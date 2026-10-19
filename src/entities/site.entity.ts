import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { User } from './user.entity.js';

@Entity('sites')
export class Site extends BaseEntity {
  @Column({ length: 150 })
  name: string;

  @Column({ length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ default: true })
  isActive: boolean;

  // The user who created this site (null if that user was later deleted).
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;

  // UsersService refuses to delete an in-charge, so SET NULL is only a backstop.
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'inchargeId' })
  incharge: User | null;

  @Column({ type: 'int', nullable: true })
  inchargeId: number | null;
}
