import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Like, Repository } from 'typeorm';
import { MeasureType } from '../../common/enums/measure-type.enum.js';
import { PackUnit } from '../../common/enums/pack-unit.enum.js';
import { ProductType } from '../../common/enums/product-type.enum.js';
import { i18nMessage } from '../../common/i18n/i18n-message.js';
import { depthOne, findPageDepthOne } from '../../common/typeorm/depth-one.js';
import { containsPattern } from '../../common/typeorm/like-pattern.js';
import { Category } from '../../entities/category.entity.js';
import { Item } from '../../entities/item.entity.js';
import { Product } from '../../entities/product.entity.js';
import { User } from '../../entities/user.entity.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { assertProductRules } from './product-rules.js';

// Printed on stickers or relied on by existing items: an item code keeps the
// prefix it was given, and a box of 20 stays a box of 20.
const LOCKED_ONCE_STOCKED = [
  'prefix',
  'type',
  'measureType',
  'packSize',
  'packUnit',
] as const;

// The catalog is shared: anyone holding the permission can act on every record.
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Item) private readonly items: Repository<Item>,
  ) {}

  async create(actor: User, dto: CreateProductDto): Promise<Product> {
    const product = this.products.create({
      name: dto.name,
      prefix: dto.prefix,
      categoryId: dto.categoryId,
      type: dto.type,
      measureType: dto.measureType,
      packSize: dto.packSize ?? null,
      packUnit: dto.packUnit ?? null,
      calibrationIntervalDays: dto.calibrationIntervalDays ?? null,
      description: dto.description ?? null,
      isActive: dto.isActive,
      createdById: actor.id,
    });
    assertProductRules(product);
    await this.assertPrefixFree(dto.prefix);
    await this.assertCategoryExists(dto.categoryId);
    const saved = await this.products.save(product);
    return this.findOneOrFail(saved.id);
  }

  async findAll({
    search,
    categoryId,
    type,
    measureType,
    isActive,
    page,
    limit,
  }: ListProductsQueryDto) {
    const filters: FindOptionsWhere<Product> = {
      ...(categoryId && { categoryId }),
      ...(type && { type }),
      ...(measureType && { measureType }),
      ...(isActive !== undefined && { isActive }),
    };
    const pattern = search && Like(containsPattern(search));
    const [items, total] = await findPageDepthOne(this.products, {
      where: pattern
        ? [
            { ...filters, name: pattern },
            { ...filters, prefix: pattern },
          ]
        : filters,
      order: { name: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  findOne(id: number): Promise<Product> {
    return this.findOneOrFail(id);
  }

  // Rules see the merged record: leaving bulk also needs packSize/packUnit null.
  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOneOrFail(id);
    const { type, measureType, packSize, packUnit, calibrationIntervalDays } =
      product;
    assertProductRules({
      type,
      measureType,
      packSize,
      packUnit,
      calibrationIntervalDays,
      ...dto,
    });
    if (dto.prefix && dto.prefix !== product.prefix) {
      await this.assertPrefixFree(dto.prefix);
    }
    if (dto.categoryId && dto.categoryId !== product.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }
    const changesIdentity = LOCKED_ONCE_STOCKED.some(
      (field) => dto[field] !== undefined && dto[field] !== product[field],
    );
    if (changesIdentity && (await this.items.existsBy({ productId: id }))) {
      throw new ConflictException(i18nMessage('errors.products.lockedByItems'));
    }
    await this.products.save({ id, ...dto });
    return this.findOneOrFail(id);
  }

  async remove(id: number): Promise<void> {
    const product = await this.findOneOrFail(id);
    if (await this.items.existsBy({ productId: id })) {
      throw new ConflictException(i18nMessage('errors.products.hasItems'));
    }
    await this.products.remove(product);
  }

  options() {
    return {
      types: Object.values(ProductType),
      measureTypes: Object.values(MeasureType),
      packUnits: Object.values(PackUnit),
    };
  }

  private async findOneOrFail(id: number): Promise<Product> {
    const product = await this.products.findOne({
      ...depthOne(this.products),
      where: { id },
    });
    if (!product) {
      throw new NotFoundException(
        i18nMessage('errors.products.notFound', { id }),
      );
    }
    return product;
  }

  private async assertPrefixFree(prefix: string): Promise<void> {
    if (await this.products.existsBy({ prefix })) {
      throw new ConflictException(i18nMessage('errors.products.prefixTaken'));
    }
  }

  private async assertCategoryExists(id: number): Promise<void> {
    if (!(await this.categories.existsBy({ id }))) {
      throw new BadRequestException(
        i18nMessage('errors.products.categoryNotFound', { id }),
      );
    }
  }
}
