import { ConflictException } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';

function setup({ nameTaken = false, hasProducts = false } = {}) {
  const category = { id: 2, name: 'Tools' };
  const categories = {
    existsBy: vi.fn().mockResolvedValue(nameTaken),
    save: vi.fn((value) => Promise.resolve({ id: 2, ...value })),
    remove: vi.fn().mockResolvedValue(undefined),
    findOne: vi.fn().mockResolvedValue(category),
    metadata: { columns: [], relations: [] },
  };
  const products = { existsBy: vi.fn().mockResolvedValue(hasProducts) };
  const service = new CategoriesService(categories as any, products as any);
  return { service, categories, products };
}

describe('CategoriesService', () => {
  it('refuses to delete a category that still has products', async () => {
    const { service, categories, products } = setup({ hasProducts: true });
    await expect(service.remove(2)).rejects.toThrow(ConflictException);
    expect(products.existsBy).toHaveBeenCalledWith({ categoryId: 2 });
    expect(categories.remove).not.toHaveBeenCalled();
  });

  it('deletes an empty category', async () => {
    const { service, categories } = setup();
    await service.remove(2);
    expect(categories.remove).toHaveBeenCalledWith({ id: 2, name: 'Tools' });
  });

  it('rejects a name another category has', async () => {
    const { service, categories } = setup({ nameTaken: true });
    await expect(service.update(2, { name: 'Fasteners' })).rejects.toThrow(
      'errors.categories.nameTaken',
    );
    expect(categories.save).not.toHaveBeenCalled();
  });

  it('allows changing only the case of its own name', async () => {
    const { service, categories } = setup();
    await service.update(2, { name: 'TOOLS' });
    expect(categories.existsBy).toHaveBeenCalledWith({
      name: 'TOOLS',
      id: expect.anything(),
    });
    expect(categories.save).toHaveBeenCalledWith({ id: 2, name: 'TOOLS' });
  });
});
