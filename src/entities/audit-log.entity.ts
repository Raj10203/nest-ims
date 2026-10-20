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

  // Milliseconds keep rows from one request in order. The default must use the
  // same precision, or MySQL rejects it.
  @CreateDateColumn({ precision: 3, default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt: Date;

  @Column({ type: 'varchar', length: 10 })
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

  // Null when no signed-in user made the change (e.g. a job outside a request).
  // The seed command is not audited: CliModule does not load AuditModule.
  @Column({ type: 'int', nullable: true })
  actorId: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  actorRole: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  requestId: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;
}
