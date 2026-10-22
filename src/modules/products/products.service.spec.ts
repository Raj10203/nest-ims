import { BadRequestException, ConflictException } from '@nestjs/common';
import { MeasureType } from '../../common/enums/measure-type.enum.js';
import { PackUnit } from '../../common/enums/pack-unit.enum.js';
import { ProductType } from '../../common/enums/product-type.enum.js';
import { User } from '../../entities/user.entity.js';
import { ProductsService } from './products.service.js';

const actor = { id: 1 } as User;
const dto = {
  name: 'Bolt M10',
  prefix: 'BLT10',
  categoryId: 3,
  type: ProductType.CONSUMABLE,
  measureType: MeasureType.BULK,
  packSize: 100,
  packUnit: PackUnit.PCS,
  isActive: true,
};

function setup(stored: object = {}) {
  const products = {
    existsBy: vi.fn().mockResolvedValue(false),
    create: vi.fn((product) => product),
    save: vi.fn((product) => Promise.resolve({ id: 1, ...product })),
    findOne: vi.fn().mockResolvedValue({ id: 1, ...dto, ...stored }),
    metadata: { columns: [], relations: [] },
  };
  const categories = { existsBy: vi.fn().mockResolvedValue(true) };
  const items = { existsBy: vi.fn().mockResolvedValue(false) };
  const service = new ProductsService(
    products as any,
    categories as any,
    items as any,
  );
  return { service, products, categories, items };
}

describe('ProductsService', () => {
  it('creates a product with its creator', async () => {
    const { service, products } = setup();
    await service.create(actor, dto);
    expect(products.save).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: 'BLT10',
        calibrationIntervalDays: null,
        createdById: 1,
      }),
    );
  });

  it('rejects a taken prefix', async () => {
    const { service, products } = setup();
    products.existsBy.mockResolvedValue(true);
    await expect(service.create(actor, dto)).rejects.toThrow(ConflictException);
    expect(products.save).not.toHaveBeenCalled();
  });

  it('rejects a category that does not exist', async () => {
    const { service, categories, products } = setup();
    categories.existsBy.mockResolvedValue(false);
    await expect(service.create(actor, dto)).rejects.toThrow(
      'errors.products.categoryNotFound',
    );
    expect(products.save).not.toHaveBeenCalled();
  });

  it('checks the type rules on the merged record when updating', async () => {
    const { service, products } = setup();
    // Still has its pack from before, so single is not allowed yet.
    await expect(
      service.update(1, { measureType: MeasureType.SINGLE }),
    ).rejects.toThrow(BadRequestException);

    await service.update(1, {
      measureType: MeasureType.SINGLE,
      packSize: null,
      packUnit: null,
    });
    expect(products.save).toHaveBeenCalledWith({
      id: 1,
      measureType: MeasureType.SINGLE,
      packSize: null,
      packUnit: null,
    });
  });

  it('skips the prefix and category lookups when they do not change', async () => {
    const { service, products, categories } = setup();
    await service.update(1, { prefix: 'BLT10', categoryId: 3, name: 'Bolt' });
    expect(products.existsBy).not.toHaveBeenCalled();
    expect(categories.existsBy).not.toHaveBeenCalled();
  });
});
