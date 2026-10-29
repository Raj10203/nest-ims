import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { NotAudited } from '../common/audit/not-audited.decorator.js';
import { PackageItemStatus } from '../common/enums/package-item-status.enum.js';
import { BaseEntity } from './base.entity.js';
import { Item } from './item.entity.js';
import { Package } from './package.entity.js';
import { StockRequestLine } from './stock-request-line.entity.js';
import { User } from './user.entity.js';

// What travelled in a package, kept after delivery. The received count of a
// request line is counted here, never stored. Each change also writes an
// item_movements row, so the audit log leaves this table out.
@NotAudited()
@Entity('package_items')
@Unique(['packageId', 'itemId'])
@Index(['requestLineId', 'status'])
export class PackageItem extends BaseEntity {
  @ManyToOne(() => Package, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'packageId' })
  package: Package;

  @Column({ type: 'int' })
  packageId: number;

  @ManyToOne(() => Item, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @Column({ type: 'int' })
  itemId: number;

  @ManyToOne(() => StockRequestLine, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requestLineId' })
  requestLine: StockRequestLine;

  @Column({ type: 'int' })
  requestLineId: number;

  @Column({ type: 'varchar', length: 20 })
  status: PackageItemStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'receivedById' })
  receivedBy: User | null;

  @Column({ type: 'int', nullable: true })
  receivedById: number | null;

  @Column({ type: 'datetime', nullable: true })
  receivedAt: Date | null;
}
