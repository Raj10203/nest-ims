import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { MeasureType } from '../common/enums/measure-type.enum.js';
import { PackUnit } from '../common/enums/pack-unit.enum.js';
import { ProductType } from '../common/enums/product-type.enum.js';
import { BaseEntity } from './base.entity.js';
import { Category } from './category.entity.js';
import { User } from './user.entity.js';

// Which fields go with which type and measure type: product-rules.ts.
@Entity('products')
export class Product extends BaseEntity {
  @Column({ length: 150 })
  name: string;

  // Stock unit ids are built from it (DRL-000001).
  @Column({ length: 10, unique: true })
  prefix: string;

  // CategoriesService refuses to delete a category in use; RESTRICT is the backstop.
  @ManyToOne(() => Category, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ type: 'int' })
  categoryId: number;

  @Column({ type: 'varchar', length: 20 })
  type: ProductType;

  @Column({ type: 'varchar', length: 10 })
  measureType: MeasureType;

  @Column({ type: 'int', unsigned: true, nullable: true })
  packSize: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  packUnit: PackUnit | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  calibrationIntervalDays: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  // Last number used for an automatic item code; ItemsService raises it under
  // a row lock, so codes are never handed out twice or reused.
  @Column({ type: 'int', unsigned: true, default: 0 })
  lastItemNumber: number;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;
}
