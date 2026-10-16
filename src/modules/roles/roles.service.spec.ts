import { RoleName } from '../../common/enums/role-name.enum.js';
import { User } from '../../entities/user.entity.js';
import { CaslAbilityFactory } from '../authorization/casl-ability.factory.js';
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
    { id: 3, name: RoleName.ADMIN, level: 80, permissions: [] },
    { id: 2, name: RoleName.MANAGER, level: 60, permissions: [] },
    { id: 1, name: RoleName.SITE_TECHNICIAN, level: 20, permissions: [] },
  ]);
  const service = new RolesService(
    { find } as any,
    cache as any,
    new CaslAbilityFactory(),
  );
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
      id: 3,
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

describe('RolesService.findAssignable', () => {
  const actor = (name: RoleName, level: number, actions: string[]) =>
    ({
      id: 5,
      role: {
        name,
        level,
        permissions: actions.map((action) => ({ action, subject: 'User' })),
      },
    }) as unknown as User;

  it('offers only roles below the actor level', async () => {
    const { service } = setup();
    const roles = await service.findAssignable(
      actor(RoleName.MANAGER, 60, ['create']),
    );
    expect(roles.map((r) => r.name)).toEqual([RoleName.SITE_TECHNICIAN]);
  });

  it('offers nothing without the create permission', async () => {
    const { service } = setup();
    expect(
      await service.findAssignable(actor(RoleName.ADMIN, 80, ['read'])),
    ).toEqual([]);
  });
});
