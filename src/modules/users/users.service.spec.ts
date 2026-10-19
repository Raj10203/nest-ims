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
    existsBy: vi.fn().mockResolvedValue(false),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const sites = { isInchargeOfAnySite: vi.fn().mockResolvedValue(false) };
  const service = new UsersService(
    users as any,
    {} as any,
    new CaslAbilityFactory(),
    sites as any,
  );
  return { service, users, sites };
}

describe('UsersService.update', () => {
  it('resets verification and drops any pending OTP when the email changes', async () => {
    const { service, users } = setup();
    await service.update(admin, 2, { email: 'new@example.com' });
    expect(users.update).toHaveBeenCalledWith(2, {
      email: 'new@example.com',
      emailVerifiedAt: null,
      emailOtpHash: null,
      emailOtpExpiresAt: null,
      emailOtpAttempts: 0,
    });
  });

  it('keeps verification when the email is unchanged', async () => {
    const { service, users } = setup();
    await service.update(admin, 2, { firstName: 'Ann' });
    expect(users.update).toHaveBeenCalledWith(2, { firstName: 'Ann' });
  });
});

describe('UsersService.remove', () => {
  it('refuses to delete a user who is in charge of a site', async () => {
    const { service, users, sites } = setup();
    sites.isInchargeOfAnySite.mockResolvedValue(true);
    await expect(service.remove(admin, 2)).rejects.toThrow(ConflictException);
    expect(users.delete).not.toHaveBeenCalled();
  });

  it('deletes a user who is not in charge of any site', async () => {
    const { service, users } = setup();
    await service.remove(admin, 2);
    expect(users.delete).toHaveBeenCalledWith(2);
  });
});
