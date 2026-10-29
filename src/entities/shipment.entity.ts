import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ShipmentStatus } from '../common/enums/shipment-status.enum.js';
import { BaseEntity } from './base.entity.js';
import { User } from './user.entity.js';

// One trip from headquarters. Its packages say which requests (and so which
// sites) it serves.
@Entity('shipments')
@Index(['status'])
export class Shipment extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  status: ShipmentStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  vehicleNumber: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  driverName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  driverPhone: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  note: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'dispatchedById' })
  dispatchedBy: User | null;

  @Column({ type: 'int', nullable: true })
  dispatchedById: number | null;

  @Column({ type: 'datetime', nullable: true })
  dispatchedAt: Date | null;

  // Who closed or cancelled it; the last receiver when it closed itself.
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'closedById' })
  closedBy: User | null;

  @Column({ type: 'int', nullable: true })
  closedById: number | null;

  @Column({ type: 'datetime', nullable: true })
  closedAt: Date | null;
}
