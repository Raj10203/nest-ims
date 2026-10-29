import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { StockRequestStatus } from '../common/enums/stock-request-status.enum.js';
import { BaseEntity } from './base.entity.js';
import { Site } from './site.entity.js';
import { User } from './user.entity.js';

// A site asking headquarters for stock. Its products are stock_request_lines;
// what happened to it is in stock_request_events.
@Entity('stock_requests')
@Index(['status', 'siteId'])
export class StockRequest extends BaseEntity {
  @ManyToOne(() => Site, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'siteId' })
  site: Site;

  @Column({ type: 'int' })
  siteId: number;

  @Column({ type: 'varchar', length: 20 })
  status: StockRequestStatus;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  note: string | null;

  // 'YYYY-MM-DD': a date column comes back as a string.
  @Column({ type: 'date', nullable: true })
  neededBy: string | null;

  // Who sent it to HQ, null while a draft: any employee of the site may edit
  // a draft, but the sender alone owns the request (cancel, notifications).
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requestedById' })
  requestedBy: User | null;

  @Column({ type: 'int', nullable: true })
  requestedById: number | null;

  @Column({ type: 'datetime', nullable: true })
  requestedAt: Date | null;

  // First step: the HQ stock request reviewer.
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: User | null;

  @Column({ type: 'int', nullable: true })
  reviewedById: number | null;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  // Second step: a manager, never the same person as the reviewer.
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approvedById' })
  approvedBy: User | null;

  @Column({ type: 'int', nullable: true })
  approvedById: number | null;

  @Column({ type: 'datetime', nullable: true })
  approvedAt: Date | null;

  // Who rejected, cancelled or closed it, or whose receipt fulfilled it.
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'closedById' })
  closedBy: User | null;

  @Column({ type: 'int', nullable: true })
  closedById: number | null;

  @Column({ type: 'datetime', nullable: true })
  closedAt: Date | null;
}
