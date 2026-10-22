import { FeatureRoleName } from '../../common/enums/feature-role-name.enum.js';
import { RoleKind } from '../../common/enums/role-kind.enum.js';
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
    { id: 3, name: RoleName.ADMIN, kind: 'primary', level: 80 },
    { id: 2, name: RoleName.MANAGER, kind: 'primary', level: 60 },
    { id: 1, name: RoleName.SITE_TECHNICIAN, kind: 'primary', level: 20 },
    { id: 9, name: FeatureRoleName.STOCK_MANAGER, kind: 'feature', level: 0 },
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

  it('caches only id, name, kind and level', async () => {
    const { service } = setup();
    expect((await service.findAll())[0]).toEqual({
      id: 3,
      name: RoleName.ADMIN,
      kind: RoleKind.PRIMARY,
      level: 80,
    });
  });

  it('finds a primary role by id, or null', async () => {
    const { service } = setup();
    expect((await service.findById(1))?.name).toBe(RoleName.SITE_TECHNICIAN);
    expect(await service.findById(99)).toBeNull();
    // A feature role can never be a user's main role.
    expect(await service.findById(9)).toBeNull();
  });

  it('lists primary and feature roles separately', async () => {
    const { service } = setup();
    expect((await service.findAll()).map((r) => r.id)).toEqual([3, 2, 1]);
    expect((await service.findAll(RoleKind.FEATURE)).map((r) => r.id)).toEqual([
      9,
    ]);
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
