import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { ItemStatus } from '../common/enums/item-status.enum.js';
import { BaseEntity } from './base.entity.js';
import { Product } from './product.entity.js';
import { Shipment } from './shipment.entity.js';
import { Site } from './site.entity.js';
import { User } from './user.entity.js';

// One physical unit: one tool, one jacket, or one box of a bulk product.
@Entity('items')
@Unique(['productId', 'serialNumber'])
@Index(['productId', 'siteId', 'status'])
// Written by hand in the Shipments migration: TypeORM skips CHECKs on MySQL.
@Check('CHK_items_location', '(`siteId` IS NULL) <> (`shipmentId` IS NULL)')
export class Item extends BaseEntity {
  // <product prefix>-<suffix>, printed on the sticker.
  @Column({ length: 40, unique: true })
  code: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int' })
  productId: number;

  // Where it is: a site, or a shipment while on the road (and for good once
  // it went missing there). Exactly one is set.
  @ManyToOne(() => Site, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'siteId' })
  site: Site | null;

  @Column({ type: 'int', nullable: true })
  siteId: number | null;

  @ManyToOne(() => Shipment, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'shipmentId' })
  shipment: Shipment | null;

  @Column({ type: 'int', nullable: true })
  shipmentId: number | null;

  @Column({ type: 'varchar', length: 20 })
  status: ItemStatus;

  // 0-100; null for consumables.
  @Column({ type: 'tinyint', unsigned: true, nullable: true })
  condition: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  serialNumber: string | null;

  // Calibrated products only. 'YYYY-MM-DD': a date column comes back as a string.
  @Column({ type: 'date', nullable: true })
  nextCalibrationDueAt: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;
}
