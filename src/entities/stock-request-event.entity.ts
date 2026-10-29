import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { NotAudited } from '../common/audit/not-audited.decorator.js';
import { StockRequestAction } from '../common/enums/stock-request-action.enum.js';
import { StockRequestStatus } from '../common/enums/stock-request-status.enum.js';
import { BaseEntity } from './base.entity.js';
import { Product } from './product.entity.js';
import { Shipment } from './shipment.entity.js';
import { Site } from './site.entity.js';
import { StockRequest } from './stock-request.entity.js';
import { User } from './user.entity.js';

// Append-only history of one request, like item_movements: it is the
// business trail itself, so the generic audit log leaves it out.
@NotAudited()
@Entity('stock_request_events')
export class StockRequestEvent extends BaseEntity {
  @ManyToOne(() => StockRequest, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: StockRequest;

  @Column({ type: 'int' })
  requestId: number;

  @Column({ type: 'varchar', length: 30 })
  action: StockRequestAction;

  // The request's status after this event.
  @Column({ type: 'varchar', length: 20 })
  status: StockRequestStatus;

  // Quantity changes only.
  @ManyToOne(() => Product, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product | null;

  @Column({ type: 'int', nullable: true })
  productId: number | null;

  // Route changes: the route after it. Assignments: the new assignee
  // (null when cleared). Requester changes: the new requester.
  @ManyToOne(() => Site, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fromSiteId' })
  fromSite: Site | null;

  @Column({ type: 'int', nullable: true })
  fromSiteId: number | null;

  @ManyToOne(() => Site, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'toSiteId' })
  toSite: Site | null;

  @Column({ type: 'int', nullable: true })
  toSiteId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigneeId' })
  assignee: User | null;

  @Column({ type: 'int', nullable: true })
  assigneeId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requesterId' })
  requester: User | null;

  @Column({ type: 'int', nullable: true })
  requesterId: number | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  quantityBefore: number | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  quantityAfter: number | null;

  // Delivery events only.
  @ManyToOne(() => Shipment, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'shipmentId' })
  shipment: Shipment | null;

  @Column({ type: 'int', nullable: true })
  shipmentId: number | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  note: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'performedById' })
  performedBy: User | null;

  @Column({ type: 'int', nullable: true })
  performedById: number | null;
}
