import { BadRequestException, ConflictException } from '@nestjs/common';
import { ItemStatus } from '../../common/enums/item-status.enum.js';
import { MeasureType } from '../../common/enums/measure-type.enum.js';
import { ProductType } from '../../common/enums/product-type.enum.js';
import { SiteType } from '../../common/enums/site-type.enum.js';
import { ItemMovement } from '../../entities/item-movement.entity.js';
import { Item } from '../../entities/item.entity.js';
import { Product } from '../../entities/product.entity.js';
import { User } from '../../entities/user.entity.js';
import { MAX_AUTO_NUMBER } from './item-code.js';
import { INSERT_CHUNK, ItemsService } from './items.service.js';

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
    createQueryBuilder: vi.fn(() => queryBuilder),
    find: vi.fn((_entity, { where }) =>
      Promise.resolve(
        where.code.value.map((code: string) => ({ id: ++lastId, code })),
      ),
    ),
  };
  let lastId = 100;
  const queryBuilder = {
    insert: vi.fn(() => queryBuilder),
    into: vi.fn(() => queryBuilder),
    values: vi.fn((_rows: Partial<Item>[]) => queryBuilder),
    callListeners: vi.fn(() => queryBuilder),
    updateEntity: vi.fn(() => queryBuilder),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  const audit = {
    record: vi.fn((_entry: Record<string, unknown>, _manager?: unknown) =>
      Promise.resolve(),
    ),
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
    audit as any,
  );
  return { service, manager, items, queryBuilder, audit };
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

describe('ItemsService.addStock', () => {
  it('reserves one block of codes and inserts it in chunks with a movement per item', async () => {
    const quantity = INSERT_CHUNK + 500;
    const { service, manager, queryBuilder, audit } = setup();
    const result = await service.addStock(actor, { productId: 7, quantity });

    expect(counterUpdate(manager)).toEqual({ id: 7, lastItemNumber: 1510 });
    const chunks = queryBuilder.values.mock.calls.map(([rows]) => rows);
    expect(chunks.map((rows) => rows.length)).toEqual([INSERT_CHUNK, 500]);
    expect(chunks[0][0]).toMatchObject({
      code: 'DRL-000011',
      siteId: 1,
      status: ItemStatus.AVAILABLE,
      condition: 100,
    });
    expect(chunks[1].at(-1)?.code).toBe('DRL-001510');
    expect(queryBuilder.callListeners).toHaveBeenCalledWith(false);

    const movements = manager.insert.mock.calls
      .filter(([entity]) => entity === ItemMovement)
      .flatMap(([, rows]) => rows);
    expect(movements).toHaveLength(quantity);
    expect(movements[0]).toMatchObject({ itemId: 101, action: 'added' });
    expect(movements.at(-1)).toMatchObject({ itemId: 100 + quantity });

    expect(audit.record).toHaveBeenCalledOnce();
    expect(audit.record.mock.calls[0][0]).toMatchObject({
      entityId: 'DRL-000011..DRL-001510',
      newValues: { quantity },
    });
    expect(result.items).toHaveLength(quantity);
  });

  it('refuses a block that runs past the largest counter value', async () => {
    const { service, manager, queryBuilder } = setup({
      lastItemNumber: MAX_AUTO_NUMBER - 1,
    });
    await expect(
      service.addStock(actor, { productId: 7, quantity: 2 }),
    ).rejects.toThrow('errors.items.numbersExhausted');
    expect(counterUpdate(manager)).toBeUndefined();
    expect(queryBuilder.execute).not.toHaveBeenCalled();
  });
});

describe('ItemsService.update', () => {
  it('checks a new serial number under the product lock', async () => {
    const { service, manager, items } = setup({ isActive: false });
    items.findOne.mockResolvedValue({
      id: 30,
      productId: 7,
      serialNumber: null,
      condition: 100,
      product: { type: ProductType.NON_CONSUMABLE },
    });
    await service.update(actor, 30, { serialNumber: 'SN-1' });

    const lockCall = manager.findOne.mock.invocationCallOrder[0];
    const serialCheck = manager.existsBy.mock.invocationCallOrder[0];
    expect(manager.findOne).toHaveBeenCalledWith(
      Product,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(lockCall).toBeLessThan(serialCheck);
    expect(savedItem(manager)).toEqual({ id: 30, serialNumber: 'SN-1' });
  });
});
