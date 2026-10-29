import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { PackageStatus } from '../common/enums/package-status.enum.js';
import { BaseEntity } from './base.entity.js';
import { Shipment } from './shipment.entity.js';
import { Site } from './site.entity.js';
import { StockRequest } from './stock-request.entity.js';
import { User } from './user.entity.js';

// Packed at headquarters for exactly one stock request, so for one site.
@Entity('packages')
@Index(['siteId', 'status'])
export class Package extends BaseEntity {
  @ManyToOne(() => Shipment, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'shipmentId' })
  shipment: Shipment;

  @Column({ type: 'int' })
  shipmentId: number;

  @ManyToOne(() => StockRequest, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requestId' })
  request: StockRequest;

  @Column({ type: 'int' })
  requestId: number;

  // The request's site, copied so receiving and lists can be scoped by site.
  @ManyToOne(() => Site, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'siteId' })
  site: Site;

  @Column({ type: 'int' })
  siteId: number;

  @Column({ type: 'varchar', length: 20 })
  status: PackageStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;

  // Whoever received the last of its items.
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'receivedById' })
  receivedBy: User | null;

  @Column({ type: 'int', nullable: true })
  receivedById: number | null;

  @Column({ type: 'datetime', nullable: true })
  receivedAt: Date | null;
}
