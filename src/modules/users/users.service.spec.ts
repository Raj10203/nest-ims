import { RoleName } from '../../common/enums/role-name.enum.js';
import { User } from '../../entities/user.entity.js';
import { CaslAbilityFactory } from '../authorization/casl-ability.factory.js';
import { UsersService } from './users.service.js';

const admin = {
  id: 1,
  role: {
    name: RoleName.ADMIN,
    level: 80,
    permissions: [{ action: 'update', subject: 'User' }],
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
  };
  const service = new UsersService(
    users as any,
    {} as any,
    new CaslAbilityFactory(),
  );
  return { service, users };
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
