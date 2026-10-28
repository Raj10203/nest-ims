import { ConflictException } from '@nestjs/common';
import { RoleKind } from '../../common/enums/role-kind.enum.js';
import { RoleName } from '../../common/enums/role-name.enum.js';
import { UserStatus } from '../../common/enums/user-status.enum.js';
import { User } from '../../entities/user.entity.js';
import { CaslAbilityFactory } from '../authorization/casl-ability.factory.js';
import { UsersService } from './users.service.js';

const admin = {
  id: 1,
  role: {
    name: RoleName.ADMIN,
    level: 80,
    permissions: [
      { action: 'read', subject: 'User' },
      { action: 'update', subject: 'User' },
      { action: 'delete', subject: 'User' },
    ],
  },
} as unknown as User;

const targetRow = {
  id: 2,
  email: 'old@example.com',
  createdById: 1,
  roleId: 5,
  role: { level: 20 },
  isActive: true,
  activatedAt: null,
};
const target = targetRow as unknown as User;

function setup() {
  const users = {
    findOne: vi.fn().mockResolvedValue(target),
    find: vi.fn(),
    count: vi.fn(),
    metadata: {
      columns: [],
      relations: ['role', 'createdBy'].map((propertyName) => ({
        propertyName,
        isManyToOne: true,
        inverseEntityMetadata: { target: undefined, columns: [] },
      })),
    },
    existsBy: vi.fn().mockResolvedValue(false),
    update: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const sites = { isInchargeOfAnySite: vi.fn().mockResolvedValue(false) };
  const storage = {
    upload: vi.fn().mockResolvedValue('https://blob.test/avatars/new'),
    deleteByUrl: vi.fn().mockResolvedValue(undefined),
  };
  const events = { emit: vi.fn() };
  const roles = {
    findById: vi.fn((id: number) =>
      Promise.resolve(
        [
          { id: 3, name: RoleName.MANAGER, level: 60 },
          { id: 4, name: RoleName.SITE_INCHARGE, level: 40 },
          { id: 5, name: RoleName.SITE_TECHNICIAN, level: 20 },
          { id: 2, name: RoleName.ADMIN, level: 80 },
        ].find((role) => role.id === id) ?? null,
      ),
    ),
  };
  const service = new UsersService(
    users as any,
    {} as any,
    {} as any,
    roles as any,
    new CaslAbilityFactory(),
    sites as any,
    storage as any,
    events as any,
  );
  return { service, users, sites, storage, events };
}

describe('UsersService.update', () => {
  it('resets verification and cancels any OTP or invitation link sent to the old address', async () => {
    const { service, users, events } = setup();
    users.findOne.mockResolvedValueOnce(target).mockResolvedValue({
      id: 2,
      email: 'new@example.com',
      firstName: 'Ann',
      createdById: 1,
      role: { level: 20 },
    });
    await service.update(admin, 2, { email: 'new@example.com' });
    expect(users.save).toHaveBeenCalledWith({
      id: 2,
      email: 'new@example.com',
      emailVerifiedAt: null,
      emailOtpHash: null,
      emailOtpExpiresAt: null,
      emailOtpAttempts: 0,
      inviteTokenHash: null,
      inviteExpiresAt: null,
    });
    expect(events.emit).toHaveBeenCalledWith(
      'user.email-changed',
      expect.objectContaining({ userId: 2, email: 'new@example.com' }),
    );
  });

  it('keeps verification when the email is unchanged', async () => {
    const { service, users, events } = setup();
    await service.update(admin, 2, { firstName: 'Ann' });
    expect(users.save).toHaveBeenCalledWith({ id: 2, firstName: 'Ann' });
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('activates a pending user when an admin sets the password', async () => {
    const { service, users } = setup();
    await service.update(admin, 2, { password: 'N3w-Passw0rd!' });
    expect(users.save.mock.calls[0][0].activatedAt).toBeInstanceOf(Date);
  });
});

describe('UsersService.findAll filters', () => {
  async function whereFor(actor: User, query: object) {
    const { service, users } = setup();
    users.find.mockResolvedValue([]);
    users.count.mockResolvedValue(0);
    await service.findAll(actor, { page: 1, limit: 20, ...query });
    return users.count.mock.calls[0][0].where;
  }

  it('adds the filters to every branch of the read scope', async () => {
    const where = await whereFor(admin, {
      roleId: 5,
      siteId: 3,
      status: UserStatus.INACTIVE,
    });
    // Admin scope: lower roles OR themselves.
    expect(where).toHaveLength(2);
    for (const branch of where) {
      expect(branch).toMatchObject({ roleId: 5, siteId: 3, isActive: false });
    }
  });

  it('searches names and email inside the scope', async () => {
    const where = await whereFor(admin, { search: 'jan' });
    expect(where).toHaveLength(6);
    expect(where.map((b: object) => Object.keys(b).at(-1))).toEqual([
      'firstName',
      'lastName',
      'email',
      'firstName',
      'lastName',
      'email',
    ]);
  });

  it('uses a single condition when the actor sees everyone', async () => {
    const superAdmin = {
      id: 1,
      role: {
        name: RoleName.SUPER_ADMIN,
        level: 100,
        permissions: [{ action: 'manage', subject: 'all' }],
      },
    } as unknown as User;
    const where = await whereFor(superAdmin, { status: UserStatus.INVITED });
    expect(where).toMatchObject({ isActive: true });
    expect(where.activatedAt).toBeDefined();
  });
});

describe('UsersService.changeRole', () => {
  it('saves a role lower than the actor’s', async () => {
    const { service, users } = setup();
    await service.changeRole(admin, 2, { roleId: 3 });
    expect(users.save).toHaveBeenCalledWith({ id: 2, roleId: 3 });
  });

  it('refuses a role at or above the actor’s level', async () => {
    const { service, users } = setup();
    await expect(service.changeRole(admin, 2, { roleId: 2 })).rejects.toThrow(
      'errors.users.cannotAssignRole',
    );
    expect(users.save).not.toHaveBeenCalled();
  });

  it('refuses a primary role that does not exist', async () => {
    const { service } = setup();
    await expect(service.changeRole(admin, 2, { roleId: 99 })).rejects.toThrow(
      'errors.users.roleNotFound',
    );
  });

  it('keeps a site in-charge in the site_incharge role', async () => {
    const { service, users, sites } = setup();
    sites.isInchargeOfAnySite.mockResolvedValue(true);
    await expect(service.changeRole(admin, 2, { roleId: 3 })).rejects.toThrow(
      'errors.users.inchargeOfSite',
    );
    await service.changeRole(admin, 2, { roleId: 4 });
    expect(users.save).toHaveBeenCalledWith({ id: 2, roleId: 4 });
  });

  it('does nothing when the role is unchanged', async () => {
    const { service, users } = setup();
    await service.changeRole(admin, 2, { roleId: 5 });
    expect(users.save).not.toHaveBeenCalled();
  });
});

describe('UsersService.deactivate / reactivate', () => {
  it('deactivates, ends every session and voids pending links', async () => {
    const { service, users } = setup();
    await service.deactivate(admin, 2);
    expect(users.save).toHaveBeenCalledWith({
      id: 2,
      isActive: false,
      refreshTokenHash: null,
      inviteTokenHash: null,
      inviteExpiresAt: null,
    });
  });

  it('refuses to deactivate a site in-charge', async () => {
    const { service, users, sites } = setup();
    sites.isInchargeOfAnySite.mockResolvedValue(true);
    await expect(service.deactivate(admin, 2)).rejects.toThrow(
      'errors.users.inchargeOfSite',
    );
    expect(users.save).not.toHaveBeenCalled();
  });

  it('reactivates a deactivated user', async () => {
    const { service, users } = setup();
    users.findOne.mockResolvedValue({ ...targetRow, isActive: false });
    await service.reactivate(admin, 2);
    expect(users.save).toHaveBeenCalledWith({ id: 2, isActive: true });
  });

  it('hides users the actor may not update', async () => {
    const { service, users } = setup();
    users.findOne.mockResolvedValue({ ...targetRow, createdById: 3 });
    const manager = {
      id: 8,
      role: {
        name: RoleName.MANAGER,
        level: 60,
        permissions: [{ action: 'update', subject: 'User' }],
      },
    } as unknown as User;
    await expect(service.deactivate(manager, 2)).rejects.toThrow(
      'errors.users.notFound',
    );
  });
});

describe('UsersService responses', () => {
  const depthOneQuery = expect.objectContaining({
    relations: { role: true, createdBy: true },
    loadEagerRelations: false,
  });

  it('lists users with their direct relations only', async () => {
    const { service, users } = setup();
    users.find.mockResolvedValue([target]);
    users.count.mockResolvedValue(1);
    const page = await service.findAll(admin, { page: 1, limit: 20 });
    expect(users.find).toHaveBeenCalledWith(depthOneQuery);
    // Counted without select: see findPageDepthOne.
    expect(Object.keys(users.count.mock.calls[0][0])).toEqual(['where']);
    expect(page.total).toBe(1);
  });

  it('returns a single user with its feature roles too', async () => {
    const { service, users } = setup();
    await service.findOneFor(admin, 2);
    expect(users.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: {
          role: true,
          createdBy: true,
          featureRoles: { role: true },
        },
        loadEagerRelations: false,
      }),
    );
  });
});

describe('UsersService.remove', () => {
  it('refuses to delete a user who is in charge of a site', async () => {
    const { service, users, sites } = setup();
    sites.isInchargeOfAnySite.mockResolvedValue(true);
    await expect(service.remove(admin, 2)).rejects.toThrow(ConflictException);
    expect(users.remove).not.toHaveBeenCalled();
  });

  it('refuses to delete a user who has set a password', async () => {
    const { service, users } = setup();
    users.findOne.mockResolvedValue({ ...targetRow, activatedAt: new Date() });
    await expect(service.remove(admin, 2)).rejects.toThrow(
      'errors.users.deleteActivated',
    );
    expect(users.remove).not.toHaveBeenCalled();
  });

  it('deletes a pending user who is not in charge of any site', async () => {
    const { service, users } = setup();
    await service.remove(admin, 2);
    expect(users.remove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
    );
  });
});

describe('UsersService.setAvatar', () => {
  const file = { buffer: Buffer.from('img'), mimetype: 'image/png' };

  it('lets a user change their own avatar and removes the old blob', async () => {
    const { service, users, storage } = setup();
    const technician = {
      id: 2,
      role: { name: RoleName.SITE_TECHNICIAN, level: 20, permissions: [] },
    } as unknown as User;
    users.findOne.mockResolvedValue({
      id: 2,
      createdById: 1,
      role: { level: 20 },
      avatarUrl: 'https://blob.test/avatars/old',
    });

    await service.setAvatar(technician, 2, file);

    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^users\/2\//),
      file.buffer,
      'image/png',
    );
    expect(users.save).toHaveBeenCalledWith({
      id: 2,
      avatarUrl: 'https://blob.test/avatars/new',
    });
    expect(storage.deleteByUrl).toHaveBeenCalledWith(
      'https://blob.test/avatars/old',
    );
  });

  it("hides another user's record when the actor may not update it", async () => {
    const { service, storage } = setup();
    const reader = {
      id: 9,
      role: {
        name: RoleName.SITE_TECHNICIAN,
        level: 20,
        permissions: [{ action: 'read', subject: 'User' }],
      },
    } as unknown as User;
    await expect(service.setAvatar(reader, 2, file)).rejects.toThrow(
      'errors.users.notFound',
    );
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

describe('UsersService.removeAvatar', () => {
  const self = {
    id: 2,
    role: { name: RoleName.SITE_TECHNICIAN, level: 20, permissions: [] },
  } as unknown as User;

  it('clears the URL and deletes the blob', async () => {
    const { service, users, storage } = setup();
    users.findOne.mockResolvedValue({
      id: 2,
      createdById: 1,
      role: { level: 20 },
      avatarUrl: 'https://blob.test/avatars/old',
    });
    await service.removeAvatar(self, 2);
    expect(users.save).toHaveBeenCalledWith({ id: 2, avatarUrl: null });
    expect(storage.deleteByUrl).toHaveBeenCalledWith(
      'https://blob.test/avatars/old',
    );
  });

  it('does nothing when there is no avatar', async () => {
    const { service, users, storage } = setup();
    users.findOne.mockResolvedValue({ id: 2, avatarUrl: null });
    await service.removeAvatar(self, 2);
    expect(users.save).not.toHaveBeenCalled();
    expect(storage.deleteByUrl).not.toHaveBeenCalled();
  });
});

describe('UsersService.setFeatureRoles', () => {
  function setupGrants(current: { id: number; roleId: number }[]) {
    const grants = {
      find: vi.fn().mockResolvedValue(current),
      remove: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      create: vi.fn((value) => value),
    };
    const users = {
      findOne: vi.fn().mockResolvedValue(target),
      metadata: { columns: [], relations: [] },
    };
    const roles = {
      findAll: vi.fn().mockResolvedValue([{ id: 9 }, { id: 10 }]),
    };
    const dataSource = {
      transaction: vi.fn((work) => work({ getRepository: () => grants })),
    };
    const service = new UsersService(
      users as any,
      {} as any,
      dataSource as any,
      roles as any,
      new CaslAbilityFactory(),
      {} as any,
      {} as any,
      {} as any,
    );
    return { service, grants, roles };
  }

  it('adds missing grants and revokes the rest', async () => {
    const { service, grants, roles } = setupGrants([
      { id: 1, roleId: 9 },
      { id: 2, roleId: 11 },
    ]);
    await service.setFeatureRoles(admin, 2, { roleIds: [9, 10] });
    expect(roles.findAll).toHaveBeenCalledWith(RoleKind.FEATURE);
    expect(grants.remove).toHaveBeenCalledWith([{ id: 2, roleId: 11 }]);
    expect(grants.save).toHaveBeenCalledWith([
      { userId: 2, roleId: 10, grantedById: 1 },
    ]);
  });

  it('rejects a role that is not a feature role', async () => {
    const { service, grants } = setupGrants([]);
    await expect(
      service.setFeatureRoles(admin, 2, { roleIds: [3] }),
    ).rejects.toThrow('errors.users.featureRoleNotFound');
    expect(grants.save).not.toHaveBeenCalled();
  });

  it('hides users outside the actor scope', async () => {
    const { service } = setupGrants([]);
    const manager = {
      id: 8,
      role: {
        name: RoleName.MANAGER,
        level: 60,
        permissions: [{ action: 'update', subject: 'User' }],
      },
    } as unknown as User;
    await expect(
      service.setFeatureRoles(manager, 2, { roleIds: [9] }),
    ).rejects.toThrow('errors.users.notFound');
  });
});
