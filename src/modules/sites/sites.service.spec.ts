import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RoleName } from '../../common/enums/role-name.enum.js';
import { User } from '../../entities/user.entity.js';
import { SitesService } from './sites.service.js';

const actor = { id: 1 } as User;
const dto = { name: 'Plant', code: 'PL1', isActive: true };

function setup(incharge: Partial<User> | Error) {
  const sites = {
    existsBy: vi.fn().mockResolvedValue(false),
    create: vi.fn((site) => site),
    save: vi.fn((site) => Promise.resolve({ id: 1, ...site })),
    findOne: vi.fn().mockResolvedValue({ id: 1 }),
    metadata: { columns: [], relations: [] },
  };
  const users = {
    findOneFor: vi.fn(() =>
      incharge instanceof Error
        ? Promise.reject(incharge)
        : Promise.resolve(incharge),
    ),
  };
  const service = new SitesService(sites as any, users as any);
  return { service, sites, users };
}

describe('SitesService in-charge', () => {
  it('saves a site whose in-charge has the site_incharge role', async () => {
    const { service, sites, users } = setup({
      id: 5,
      role: { name: RoleName.SITE_INCHARGE } as User['role'],
    });
    await service.create(actor, { ...dto, inchargeId: 5 });
    expect(users.findOneFor).toHaveBeenCalledWith(actor, 5);
    expect(sites.save).toHaveBeenCalledWith(
      expect.objectContaining({ inchargeId: 5 }),
    );
  });

  it('rejects an in-charge with another role', async () => {
    const { service, sites } = setup({
      id: 5,
      role: { name: RoleName.SITE_TECHNICIAN } as User['role'],
    });
    await expect(
      service.create(actor, { ...dto, inchargeId: 5 }),
    ).rejects.toThrow(BadRequestException);
    expect(sites.save).not.toHaveBeenCalled();
  });

  it('passes on the 404 for a user outside the actor scope', async () => {
    const { service } = setup(new NotFoundException('User 5 not found'));
    await expect(
      service.create(actor, { ...dto, inchargeId: 5 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('skips the user lookup when no in-charge is given', async () => {
    const { service, users } = setup({});
    await service.create(actor, dto);
    expect(users.findOneFor).not.toHaveBeenCalled();
  });
});
