import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { ItemStatus } from '../common/enums/item-status.enum.js';
import { BaseEntity } from './base.entity.js';
import { Product } from './product.entity.js';
import { Site } from './site.entity.js';
import { User } from './user.entity.js';

// One physical unit: one tool, one jacket, or one box of a bulk product.
@Entity('items')
@Unique(['productId', 'serialNumber'])
@Index(['productId', 'siteId', 'status'])
export class Item extends BaseEntity {
  // <product prefix>-<suffix>, printed on the sticker.
  @Column({ length: 40, unique: true })
  code: string;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int' })
  productId: number;

  @ManyToOne(() => Site, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'siteId' })
  site: Site;

  @Column({ type: 'int' })
  siteId: number;

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
