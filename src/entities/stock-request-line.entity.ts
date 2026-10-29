import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { Product } from './product.entity.js';
import { StockRequest } from './stock-request.entity.js';

// One product of a request: units of it (boxes for a bulk product).
@Entity('stock_request_lines')
@Unique(['requestId', 'productId'])
export class StockRequestLine extends BaseEntity {
  @ManyToOne(() => StockRequest, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: StockRequest;

  @Column({ type: 'int' })
  requestId: number;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int' })
  productId: number;

  // As the site asked; never changed.
  @Column({ type: 'int', unsigned: true })
  requestedQuantity: number;

  // As the reviewers set it; 0 leaves the product out.
  @Column({ type: 'int', unsigned: true })
  quantity: number;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  note: string | null;
}
