import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditAction = 'create' | 'update' | 'delete';

// Append-only, so it does not extend BaseEntity (no updatedAt). actorId has no
// foreign key on purpose: the history must outlive the user who made it.
@Entity('audit_logs')
@Index(['entityType', 'entityId', 'createdAt'])
@Index(['actorId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @CreateDateColumn({ precision: 3 })
  createdAt: Date;

  @Column({ length: 10 })
  action: AuditAction;

  @Column({ length: 50 })
  entityType: string;

  @Column({ length: 64 })
  entityId: string;

  // Changed fields only for an update; the whole record for create and delete.
  @Column({ type: 'json', nullable: true })
  oldValues: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  newValues: Record<string, any> | null;

  // Null for changes made outside a signed-in request (seed, CLI).
  @Column({ type: 'int', nullable: true })
  actorId: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  actorRole: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  requestId: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;
}
