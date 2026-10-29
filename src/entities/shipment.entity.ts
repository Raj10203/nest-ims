import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ShipmentStatus } from '../common/enums/shipment-status.enum.js';
import { BaseEntity } from './base.entity.js';
import { Site } from './site.entity.js';
import { User } from './user.entity.js';

// One trip from one site (headquarters, or another site for a request routed
// from there). Its packages say which requests (and so which sites) it serves;
// every request in it leaves from fromSiteId.
@Entity('shipments')
@Index(['status'])
export class Shipment extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  status: ShipmentStatus;

  // Always written; nullable in the database only until a release after
  // StockRequestRouting makes it NOT NULL.
  @ManyToOne(() => Site, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fromSiteId' })
  fromSite: Site;

  @Column({ type: 'int', nullable: true })
  fromSiteId: number;

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
