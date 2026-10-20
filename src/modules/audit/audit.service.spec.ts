import { RoleName } from '../../common/enums/role-name.enum.js';
import { User } from '../../entities/user.entity.js';
import { CaslAbilityFactory } from '../authorization/casl-ability.factory.js';
import { AuditService } from './audit.service.js';

function queryBuilder() {
  const qb: Record<string, any> = {};
  for (const name of [
    'orderBy',
    'skip',
    'take',
    'andWhere',
    'setParameters',
    'setFindOptions',
  ]) {
    qb[name] = vi.fn(() => qb);
  }
  qb.getQuery = vi.fn(() => 'SELECT scoped');
  qb.getParameters = vi.fn(() => ({ orm_param_0: 80 }));
  qb.getManyAndCount = vi.fn().mockResolvedValue([[], 0]);
  return qb;
}

function setup(store: Record<string, unknown> | null = null) {
  const insert = vi.fn().mockResolvedValue(undefined);
  const logQuery = queryBuilder();
  const userQuery = queryBuilder();
  const logs = { manager: { insert }, createQueryBuilder: () => logQuery };
  const users = { createQueryBuilder: () => userQuery };
  const cls = {
    isActive: () => store !== null,
    get: (key: string) => store?.[key],
    getId: () => 'req-1',
  };
  const service = new AuditService(
    logs as any,
    users as any,
    cls as any,
    new CaslAbilityFactory(),
  );
  return { service, insert, logQuery, userQuery };
}

const actor = (name: RoleName, level: number, permissions: object[]) =>
  ({ id: 2, role: { name, level, permissions } }) as unknown as User;

describe('AuditService.record', () => {
  it('stores the signed-in actor, request id and IP, and masks secrets', async () => {
    const { service, insert } = setup({
      actor: { id: 3, role: 'admin' },
      ip: '10.0.0.7',
    });
    await service.record({
      action: 'update',
      entityType: 'User',
      entityId: '9',
      oldValues: { password: null },
      newValues: { password: 'scrypt-hash', firstName: 'Jane' },
    });
    expect(insert.mock.calls[0][1]).toMatchObject({
      actorId: 3,
      actorRole: 'admin',
      requestId: 'req-1',
      ip: '10.0.0.7',
      oldValues: { password: '[REDACTED]' },
      newValues: { password: '[REDACTED]', firstName: 'Jane' },
    });
  });

  it('uses an explicit actor (role unknown) and writes through the given transaction', async () => {
    const { service, insert } = setup({ actor: { id: 3, role: 'admin' } });
    const manager = { insert: vi.fn().mockResolvedValue(undefined) };
    await service.record(
      { action: 'update', entityType: 'User', entityId: '9', actorId: 9 },
      manager as any,
    );
    expect(insert).not.toHaveBeenCalled();
    expect(manager.insert.mock.calls[0][1]).toMatchObject({
      actorId: 9,
      actorRole: null,
    });
  });

  it('records a change made outside a request with no actor', async () => {
    const { service, insert } = setup(null);
    await service.record({
      action: 'create',
      entityType: 'Site',
      entityId: '1',
    });
    expect(insert.mock.calls[0][1]).toMatchObject({
      actorId: null,
      requestId: null,
      ip: null,
    });
  });
});

describe('AuditService.findAll scope', () => {
  const query = { page: 1, limit: 20 };

  it('does not limit a manage-all role', async () => {
    const { service, userQuery } = setup();
    await service.findAll(
      actor(RoleName.SUPER_ADMIN, 100, [{ action: 'manage', subject: 'all' }]),
      query,
    );
    expect(userQuery.setFindOptions).not.toHaveBeenCalled();
  });

  it('limits User entries to the users the actor may read', async () => {
    const { service, logQuery, userQuery } = setup();
    await service.findAll(
      actor(RoleName.ADMIN, 80, [{ action: 'read', subject: 'User' }]),
      query,
    );
    expect(userQuery.setFindOptions).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true } }),
    );
    expect(logQuery.setParameters).toHaveBeenCalledWith({ orm_param_0: 80 });
  });
});
