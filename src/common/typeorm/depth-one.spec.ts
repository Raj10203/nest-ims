import { DataSource } from 'typeorm';
import { Permission } from '../../entities/permission.entity.js';
import { Role } from '../../entities/role.entity.js';
import { Site } from '../../entities/site.entity.js';
import { User } from '../../entities/user.entity.js';
import { depthOne } from './depth-one.js';

const userSummary = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
};

describe('depthOne', () => {
  // Metadata only: no connection is opened.
  const dataSource = new DataSource({
    type: 'mysql',
    database: 'unused',
    entities: [User, Role, Permission, Site],
  });
  beforeAll(() => (dataSource as any).buildMetadatas());

  it('loads to-one relations with eager loading off, not the role permissions', () => {
    const options = depthOne(dataSource.getRepository(User));
    expect(options.relations).toEqual({ role: true, createdBy: true });
    expect(options.loadEagerRelations).toBe(false);
    expect(options.select).toMatchObject({
      role: { id: true, name: true, level: true },
      createdBy: userSummary,
    });
    expect(options.select).not.toHaveProperty('role.permissions');
  });

  it('never selects secret columns', () => {
    const { select } = depthOne(dataSource.getRepository(User));
    for (const secret of ['password', 'refreshTokenHash', 'emailOtpHash']) {
      expect(select).not.toHaveProperty(secret);
    }
    expect(select).toMatchObject({ email: true, roleId: true });
  });

  it('shows related users as a summary only', () => {
    const { select } = depthOne(dataSource.getRepository(Site));
    expect(select).toMatchObject({
      name: true,
      createdBy: userSummary,
      incharge: userSummary,
    });
    expect((select as any).incharge).not.toHaveProperty('email');
  });
});
