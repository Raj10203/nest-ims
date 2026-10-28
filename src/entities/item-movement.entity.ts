import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { NotAudited } from '../common/audit/not-audited.decorator.js';
import { ItemStatus } from '../common/enums/item-status.enum.js';
import { MovementAction } from '../common/enums/movement-action.enum.js';
import { BaseEntity } from './base.entity.js';
import { Item } from './item.entity.js';
import { Site } from './site.entity.js';
import { User } from './user.entity.js';

// Append-only history of one item: never updated. It is a business audit
// trail itself, so the generic audit log leaves it out.
@NotAudited()
@Entity('item_movements')
export class ItemMovement extends BaseEntity {
  @ManyToOne(() => Item, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @Column({ type: 'int' })
  itemId: number;

  @Column({ type: 'varchar', length: 30 })
  action: MovementAction;

  // Where it happened. RESTRICT: a site with inventory history is never deleted.
  @ManyToOne(() => Site, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'siteId' })
  site: Site;

  @Column({ type: 'int' })
  siteId: number;

  // The item's status after this movement.
  @Column({ type: 'varchar', length: 20 })
  status: ItemStatus;

  @Column({ type: 'tinyint', unsigned: true, nullable: true })
  conditionBefore: number | null;

  @Column({ type: 'tinyint', unsigned: true, nullable: true })
  conditionAfter: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'performedById' })
  performedBy: User | null;

  @Column({ type: 'int', nullable: true })
  performedById: number | null;
}
