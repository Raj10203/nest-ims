import { Column, Entity, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { NotAudited } from '../common/audit/not-audited.decorator.js';
import { BaseEntity } from './base.entity.js';
import { StockRequest } from './stock-request.entity.js';
import { User } from './user.entity.js';

// The request's conversation. Never edited or deleted, so the audit log
// leaves it out. Replies are one level deep: parentId is a top comment.
@NotAudited()
@Entity('stock_request_comments')
export class StockRequestComment extends BaseEntity {
  @ManyToOne(() => StockRequest, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: StockRequest;

  @Column({ type: 'int' })
  requestId: number;

  // Relation<>: a plain self type breaks decorator metadata in ESM.
  @ManyToOne(() => StockRequestComment, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentId' })
  parent: Relation<StockRequestComment> | null;

  @Column({ type: 'int', nullable: true })
  parentId: number | null;

  @Column({ type: 'varchar', length: 2000 })
  body: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author: User | null;

  @Column({ type: 'int', nullable: true })
  authorId: number | null;
}
