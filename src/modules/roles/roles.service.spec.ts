import { RoleName } from '../../common/enums/role-name.enum.js';
import { RolesService } from './roles.service.js';

function setup() {
  const store = new Map<string, unknown>();
  const cache = {
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve(value);
    }),
  };
  const find = vi.fn().mockResolvedValue([
    { id: 2, name: RoleName.ADMIN, level: 80, permissions: [] },
    { id: 1, name: RoleName.SITE_TECHNICIAN, level: 20, permissions: [] },
  ]);
  const service = new RolesService({ find } as any, cache as any, {} as any);
  return { service, find, cache };
}

describe('RolesService cache', () => {
  it('reads the database once and serves later calls from the cache', async () => {
    const { service, find } = setup();
    await service.findAll();
    await service.findAll();
    await service.findById(1);
    expect(find).toHaveBeenCalledTimes(1);
  });

  it('caches only id, name and level', async () => {
    const { service } = setup();
    expect((await service.findAll())[0]).toEqual({
      id: 2,
      name: RoleName.ADMIN,
      level: 80,
    });
  });

  it('finds a role by id, or null', async () => {
    const { service } = setup();
    expect((await service.findById(1))?.name).toBe(RoleName.SITE_TECHNICIAN);
    expect(await service.findById(99)).toBeNull();
  });
});
