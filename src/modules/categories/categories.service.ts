import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Like, Not, Repository } from 'typeorm';
import { i18nMessage } from '../../common/i18n/i18n-message.js';
import { depthOne } from '../../common/typeorm/depth-one.js';
import { containsPattern } from '../../common/typeorm/like-pattern.js';
import { Category } from '../../entities/category.entity.js';
import { Product } from '../../entities/product.entity.js';
import { User } from '../../entities/user.entity.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

// The catalog is shared: anyone holding the permission can act on every record.
@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  async create(actor: User, dto: CreateCategoryDto): Promise<Category> {
    await this.assertNameFree(dto.name);
    const saved = await this.categories.save(
      this.categories.create({
        name: dto.name,
        description: dto.description ?? null,
        isActive: dto.isActive,
        createdById: actor.id,
      }),
    );
    return this.findOneOrFail(saved.id);
  }

  async findAll({ search, isActive, page, limit }: ListCategoriesQueryDto) {
    const where: FindOptionsWhere<Category> = {
      ...(search && { name: Like(containsPattern(search)) }),
      ...(isActive !== undefined && { isActive }),
    };
    const [items, total] = await this.categories.findAndCount({
      ...depthOne(this.categories),
      where,
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  findOne(id: number): Promise<Category> {
    return this.findOneOrFail(id);
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOneOrFail(id);
    if (dto.name && dto.name !== category.name) {
      await this.assertNameFree(dto.name, id);
    }
    await this.categories.save({ id, ...dto });
    return this.findOneOrFail(id);
  }

  async remove(id: number): Promise<void> {
    const category = await this.findOneOrFail(id);
    if (await this.products.existsBy({ categoryId: id })) {
      throw new ConflictException(i18nMessage('errors.categories.inUse'));
    }
    await this.categories.remove(category);
  }

  private async findOneOrFail(id: number): Promise<Category> {
    const category = await this.categories.findOne({
      ...depthOne(this.categories),
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(
        i18nMessage('errors.categories.notFound', { id }),
      );
    }
    return category;
  }

  // Not(id): renaming "tools" to "Tools" must not collide with itself (the
  // collation is case-insensitive).
  private async assertNameFree(name: string, id?: number): Promise<void> {
    if (await this.categories.existsBy({ name, ...(id && { id: Not(id) }) })) {
      throw new ConflictException(i18nMessage('errors.categories.nameTaken'));
    }
  }
}
