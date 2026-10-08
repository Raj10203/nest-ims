import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from './base.entity.js';

// `action` and `subject` use CASL vocabulary, e.g. ('create', 'User') or ('manage', 'all').
@Entity('permissions')
@Unique(['action', 'subject'])
export class Permission extends BaseEntity {
  @Column({ length: 50 })
  action: string;

  @Column({ length: 50 })
  subject: string;
}
