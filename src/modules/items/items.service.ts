import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  Like,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { ItemStatus } from '../../common/enums/item-status.enum.js';
import { MovementAction } from '../../common/enums/movement-action.enum.js';
import { SiteType } from '../../common/enums/site-type.enum.js';
import { i18nMessage } from '../../common/i18n/i18n-message.js';
import { depthOne, findPageDepthOne } from '../../common/typeorm/depth-one.js';
import { containsPattern } from '../../common/typeorm/like-pattern.js';
import { ItemMovement } from '../../entities/item-movement.entity.js';
import { Item } from '../../entities/item.entity.js';
import { Product } from '../../entities/product.entity.js';
import { Site } from '../../entities/site.entity.js';
import { User } from '../../entities/user.entity.js';
import { AuditService } from '../audit/audit.service.js';
import { AddStockDto } from './dto/add-stock.dto.js';
import { CreateItemDto, UpdateItemDto } from './dto/create-item.dto.js';
import {
  ListItemsQueryDto,
  PageQueryDto,
  StockQueryDto,
} from './dto/list-items-query.dto.js';
import {
  autoNumberOf,
  autoSuffix,
  itemCode,
  MAX_AUTO_NUMBER,
} from './item-code.js';
import { assertItemRules, itemDefaults } from './item-rules.js';

export const INSERT_CHUNK = 1000;

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item) private readonly items: Repository<Item>,
    @InjectRepository(ItemMovement)
    private readonly movements: Repository<ItemMovement>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  // Rows are inserted in chunks without per-row audit entries (one bulk entry
  // instead): the item_movements rows are each item's own history.
  async addStock(actor: User, { productId, quantity }: AddStockDto) {
    return this.dataSource.transaction(async (manager) => {
      const product = await this.lockProduct(manager, productId);
      const hq = await this.headquarters(manager);
      const first = product.lastItemNumber + 1;
      const last = product.lastItemNumber + quantity;
      if (last > MAX_AUTO_NUMBER) {
        throw new BadRequestException(
          i18nMessage('errors.items.numbersExhausted'),
        );
      }
      await manager.save(Product, { id: productId, lastItemNumber: last });

      const defaults = itemDefaults(product);
      const codes = Array.from({ length: quantity }, (_, i) =>
        itemCode(product.prefix, autoSuffix(first + i)),
      );
      const created: Pick<Item, 'id' | 'code'>[] = [];
      for (let start = 0; start < codes.length; start += INSERT_CHUNK) {
        const chunk = codes.slice(start, start + INSERT_CHUNK);
        await manager
          .createQueryBuilder()
          .insert()
          .into(Item)
          .values(
            chunk.map((code) => ({
              code,
              productId,
              siteId: hq.id,
              status: ItemStatus.AVAILABLE,
              ...defaults,
              createdById: actor.id,
            })),
          )
          .callListeners(false)
          .updateEntity(false)
          .execute();
        const rows = await manager.find(Item, {
          select: { id: true, code: true },
          where: { code: In(chunk) },
          order: { id: 'ASC' },
          loadEagerRelations: false,
        });
        await manager.insert(
          ItemMovement,
          rows.map((row) => ({
            itemId: row.id,
            action: MovementAction.ADDED,
            siteId: hq.id,
            status: ItemStatus.AVAILABLE,
            conditionAfter: defaults.condition,
            performedById: actor.id,
          })),
        );
        created.push(...rows);
      }

      await this.audit.record(
        {
          action: 'create',
          entityType: 'Item',
          entityId: `${codes[0]}..${codes[codes.length - 1]}`,
          newValues: { productId, siteId: hq.id, quantity, ...defaults },
        },
        manager,
      );
      return { productId, siteId: hq.id, quantity, items: created };
    });
  }

  async create(actor: User, dto: CreateItemDto): Promise<Item> {
    const id = await this.dataSource.transaction(async (manager) => {
      const product = await this.lockProduct(manager, dto.productId);
      assertItemRules(product.type, dto);
      const hq = await this.headquarters(manager);

      // A typed suffix that an automatic code could produce later moves the
      // counter past it, so the two never collide.
      const typed = dto.codeSuffix ?? null;
      const number =
        typed === null ? product.lastItemNumber + 1 : autoNumberOf(typed);
      if (number !== null && number > MAX_AUTO_NUMBER) {
        throw new BadRequestException(
          i18nMessage('errors.items.numbersExhausted'),
        );
      }
      const code = itemCode(product.prefix, typed ?? autoSuffix(number!));
      if (await manager.existsBy(Item, { code })) {
        throw new ConflictException(
          i18nMessage('errors.items.codeTaken', { code }),
        );
      }
      if (number !== null && number > product.lastItemNumber) {
        await manager.save(Product, { id: product.id, lastItemNumber: number });
      }
      if (dto.serialNumber) {
        await this.assertSerialFree(manager, product.id, dto.serialNumber);
      }

      const defaults = itemDefaults(product);
      const item = await manager.save(
        Item,
        manager.create(Item, {
          code,
          productId: product.id,
          siteId: hq.id,
          status: ItemStatus.AVAILABLE,
          condition: dto.condition ?? defaults.condition,
          nextCalibrationDueAt:
            dto.nextCalibrationDueAt ?? defaults.nextCalibrationDueAt,
          serialNumber: dto.serialNumber ?? null,
          note: dto.note ?? null,
          createdById: actor.id,
        }),
      );
      await manager.insert(ItemMovement, {
        itemId: item.id,
        action: MovementAction.ADDED,
        siteId: hq.id,
        status: item.status,
        conditionAfter: item.condition,
        note: item.note,
        performedById: actor.id,
      });
      return item.id;
    });
    return this.findOneOrFail(id);
  }

  async findAll({
    search,
    productId,
    categoryId,
    siteId,
    status,
    page,
    limit,
  }: ListItemsQueryDto) {
    const filters: FindOptionsWhere<Item> = {
      ...(productId && { productId }),
      ...(categoryId && { product: { categoryId } }),
      ...(siteId && { siteId }),
      ...(status && { status }),
    };
    const pattern = search && Like(containsPattern(search));
    const [items, total] = await findPageDepthOne(this.items, {
      where: pattern
        ? [
            { ...filters, code: pattern },
            { ...filters, serialNumber: pattern },
          ]
        : filters,
      order: { code: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  findOne(id: number): Promise<Item> {
    return this.findOneOrFail(id);
  }

  async findMovements(id: number, { page, limit }: PageQueryDto) {
    if (!(await this.items.existsBy({ id }))) throw this.notFound(id);
    const [items, total] = await findPageDepthOne(this.movements, {
      where: { itemId: id },
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async stock(query: StockQueryDto) {
    const { page, limit } = query;
    const rows = await this.stockQuery(query)
      .select('product.id', 'productId')
      .addSelect('product.name', 'productName')
      .addSelect('product.prefix', 'prefix')
      .addSelect('site.id', 'siteId')
      .addSelect('site.name', 'siteName')
      .addSelect('item.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('product.id')
      .addGroupBy('site.id')
      .addGroupBy('item.status')
      .orderBy('product.name')
      .addOrderBy('site.name')
      .addOrderBy('item.status')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<Record<string, unknown>>();
    const totalRow = await this.stockQuery(query)
      .select(
        'COUNT(DISTINCT item.productId, item.siteId, item.status)',
        'total',
      )
      .getRawOne<{ total: string }>();
    return {
      items: rows.map((row) => ({ ...row, count: Number(row.count) })),
      total: Number(totalRow?.total ?? 0),
      page,
      limit,
    };
  }

  async update(actor: User, id: number, dto: UpdateItemDto): Promise<Item> {
    const item = await this.findOneOrFail(id);
    assertItemRules(item.product.type, dto);
    await this.dataSource.transaction(async (manager) => {
      if (dto.serialNumber && dto.serialNumber !== item.serialNumber) {
        // Under the product lock, as in create, so two writers of one serial
        // get a 409 instead of a duplicate-key 500.
        await this.findProductForUpdate(manager, item.productId);
        await this.assertSerialFree(manager, item.productId, dto.serialNumber);
      }
      // save(), not update(): AuditSubscriber records the change.
      await manager.save(Item, { id, ...dto });
      if (dto.condition !== undefined && dto.condition !== item.condition) {
        await manager.insert(ItemMovement, {
          itemId: id,
          action: MovementAction.CONDITION_CHANGED,
          siteId: item.siteId,
          status: item.status,
          conditionBefore: item.condition,
          conditionAfter: dto.condition,
          note: dto.note ?? null,
          performedById: actor.id,
        });
      }
    });
    return this.findOneOrFail(id);
  }

  // Only to correct a wrong entry: an item that has left headquarters keeps
  // its record. Its movements go with it (ON DELETE CASCADE).
  async remove(id: number): Promise<void> {
    const item = await this.findOneOrFail(id);
    if (
      item.site.type !== SiteType.HQ ||
      item.status !== ItemStatus.AVAILABLE
    ) {
      throw new ConflictException(i18nMessage('errors.items.notDeletable'));
    }
    await this.items.remove(item);
  }

  // FOR UPDATE: concurrent adds of one product queue here, so each gets its
  // own numbers. Other products are not blocked.
  private async lockProduct(
    manager: EntityManager,
    id: number,
  ): Promise<Product> {
    const product = await this.findProductForUpdate(manager, id);
    if (!product) {
      throw new BadRequestException(
        i18nMessage('errors.items.productNotFound', { id }),
      );
    }
    if (!product.isActive) {
      throw new BadRequestException(
        i18nMessage('errors.items.productInactive', { id }),
      );
    }
    return product;
  }

  private findProductForUpdate(
    manager: EntityManager,
    id: number,
  ): Promise<Product | null> {
    return manager.findOne(Product, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
      loadEagerRelations: false,
    });
  }

  private async headquarters(manager: EntityManager): Promise<Site> {
    const hq = await manager.findOne(Site, {
      where: { type: SiteType.HQ },
      loadEagerRelations: false,
    });
    if (!hq) throw new ConflictException(i18nMessage('errors.sites.hqMissing'));
    return hq;
  }

  private async assertSerialFree(
    manager: EntityManager,
    productId: number,
    serialNumber: string,
  ): Promise<void> {
    if (await manager.existsBy(Item, { productId, serialNumber })) {
      throw new ConflictException(i18nMessage('errors.items.serialTaken'));
    }
  }

  private stockQuery({
    productId,
    categoryId,
    siteId,
    status,
  }: StockQueryDto): SelectQueryBuilder<Item> {
    const query = this.items
      .createQueryBuilder('item')
      .innerJoin('item.product', 'product')
      .innerJoin('item.site', 'site');
    if (productId) query.andWhere('item.productId = :productId', { productId });
    if (categoryId) {
      query.andWhere('product.categoryId = :categoryId', { categoryId });
    }
    if (siteId) query.andWhere('item.siteId = :siteId', { siteId });
    if (status) query.andWhere('item.status = :status', { status });
    return query;
  }

  private async findOneOrFail(id: number): Promise<Item> {
    const item = await this.items.findOne({
      ...depthOne(this.items),
      where: { id },
    });
    if (!item) throw this.notFound(id);
    return item;
  }

  private notFound(id: number) {
    return new NotFoundException(i18nMessage('errors.items.notFound', { id }));
  }
}
