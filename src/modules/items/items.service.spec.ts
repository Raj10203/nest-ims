import { BadRequestException, ConflictException } from '@nestjs/common';
import { ItemStatus } from '../../common/enums/item-status.enum.js';
import { MeasureType } from '../../common/enums/measure-type.enum.js';
import { ProductType } from '../../common/enums/product-type.enum.js';
import { SiteType } from '../../common/enums/site-type.enum.js';
import { ItemMovement } from '../../entities/item-movement.entity.js';
import { Item } from '../../entities/item.entity.js';
import { Product } from '../../entities/product.entity.js';
import { User } from '../../entities/user.entity.js';
import { ItemsService } from './items.service.js';

const actor = { id: 4 } as User;
const hq = { id: 1, type: SiteType.HQ };

function setup(product: Partial<Product> = {}, takenCodes: string[] = []) {
  const stored = {
    id: 7,
    prefix: 'DRL',
    type: ProductType.NON_CONSUMABLE,
    measureType: MeasureType.SINGLE,
    calibrationIntervalDays: null,
    lastItemNumber: 10,
    isActive: true,
    ...product,
  };
  const manager = {
    findOne: vi.fn((entity) =>
      Promise.resolve(entity === Product ? stored : hq),
    ),
    existsBy: vi.fn((_entity, where) =>
      Promise.resolve(takenCodes.includes(where.code)),
    ),
    save: vi.fn((_entity, value) => Promise.resolve({ id: 30, ...value })),
    create: vi.fn((_entity, value) => value),
    insert: vi.fn().mockResolvedValue(undefined),
  };
  const items = {
    findOne: vi.fn().mockResolvedValue({ id: 30 }),
    metadata: { columns: [], relations: [] },
  };
  const dataSource = { transaction: vi.fn((work) => work(manager)) };
  const service = new ItemsService(
    items as any,
    {} as any,
    dataSource as any,
    {} as any,
  );
  return { service, manager };
}

const savedItem = (manager: ReturnType<typeof setup>['manager']) =>
  manager.save.mock.calls.find(([entity]) => entity === Item)?.[1];
const counterUpdate = (manager: ReturnType<typeof setup>['manager']) =>
  manager.save.mock.calls.find(([entity]) => entity === Product)?.[1];

describe('ItemsService.create', () => {
  it('gives the next automatic code and records the addition', async () => {
    const { service, manager } = setup();
    await service.create(actor, { productId: 7 });
    expect(savedItem(manager)).toMatchObject({
      code: 'DRL-000011',
      siteId: 1,
      status: ItemStatus.AVAILABLE,
      condition: 100,
    });
    expect(counterUpdate(manager)).toEqual({ id: 7, lastItemNumber: 11 });
    expect(manager.insert).toHaveBeenCalledWith(
      ItemMovement,
      expect.objectContaining({ action: 'added', siteId: 1 }),
    );
  });

  it('keeps the counter for a typed suffix automatic codes never produce', async () => {
    const { service, manager } = setup();
    await service.create(actor, { productId: 7, codeSuffix: 'OLD17' });
    expect(savedItem(manager)?.code).toBe('DRL-OLD17');
    expect(counterUpdate(manager)).toBeUndefined();
  });

  it('moves the counter past a typed automatic-looking suffix', async () => {
    const { service, manager } = setup();
    await service.create(actor, { productId: 7, codeSuffix: '000050' });
    expect(counterUpdate(manager)).toEqual({ id: 7, lastItemNumber: 50 });
  });

  it('rejects a code that is taken', async () => {
    const { service, manager } = setup({}, ['DRL-OLD17']);
    await expect(
      service.create(actor, { productId: 7, codeSuffix: 'OLD17' }),
    ).rejects.toThrow(ConflictException);
    expect(savedItem(manager)).toBeUndefined();
  });

  it('rejects a condition for a consumable', async () => {
    const { service } = setup({ type: ProductType.CONSUMABLE });
    await expect(
      service.create(actor, { productId: 7, condition: 90 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses stock for an inactive product', async () => {
    const { service } = setup({ isActive: false });
    await expect(service.create(actor, { productId: 7 })).rejects.toThrow(
      'errors.items.productInactive',
    );
  });
});
