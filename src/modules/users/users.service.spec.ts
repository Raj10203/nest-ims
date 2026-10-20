import { ConflictException } from '@nestjs/common';
import { RoleName } from '../../common/enums/role-name.enum.js';
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

const target = {
  id: 2,
  email: 'old@example.com',
  createdById: 1,
  role: { level: 20 },
} as unknown as User;

function setup() {
  const users = {
    findOne: vi.fn().mockResolvedValue(target),
    findAndCount: vi.fn(),
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
  const service = new UsersService(
    users as any,
    {} as any,
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
});

describe('UsersService responses', () => {
  const depthOneQuery = expect.objectContaining({
    relations: { role: true, createdBy: true },
    loadEagerRelations: false,
  });

  it('lists users with their direct relations only', async () => {
    const { service, users } = setup();
    users.findAndCount.mockResolvedValue([[target], 1]);
    await service.findAll(admin, { page: 1, limit: 20 });
    expect(users.findAndCount).toHaveBeenCalledWith(depthOneQuery);
  });

  it('returns a single user the same way', async () => {
    const { service, users } = setup();
    await service.findOneFor(admin, 2);
    expect(users.findOne).toHaveBeenCalledWith(depthOneQuery);
  });
});

describe('UsersService.remove', () => {
  it('refuses to delete a user who is in charge of a site', async () => {
    const { service, users, sites } = setup();
    sites.isInchargeOfAnySite.mockResolvedValue(true);
    await expect(service.remove(admin, 2)).rejects.toThrow(ConflictException);
    expect(users.remove).not.toHaveBeenCalled();
  });

  it('deletes a user who is not in charge of any site', async () => {
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
