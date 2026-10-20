import { DataSource } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity.js';
import { Permission } from '../../entities/permission.entity.js';
import { Role } from '../../entities/role.entity.js';
import { Site } from '../../entities/site.entity.js';
import { User } from '../../entities/user.entity.js';
import { AuditSubscriber } from './audit.subscriber.js';

describe('AuditSubscriber', () => {
  const dataSource = new DataSource({
    type: 'mysql',
    database: 'unused',
    entities: [User, Role, Permission, Site, AuditLog],
  });
  beforeAll(() => (dataSource as any).buildMetadatas());

  function setup() {
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const subscriber = new AuditSubscriber(dataSource, audit as any);
    return { subscriber, audit, manager: { tx: true } };
  }

  it('registers itself with the data source', () => {
    const { subscriber } = setup();
    expect(dataSource.subscribers).toContain(subscriber);
  });

  it('records a create with the new record, in the same transaction', async () => {
    const { subscriber, audit, manager } = setup();
    await subscriber.afterInsert({
      metadata: dataSource.getMetadata(Site),
      manager,
      entity: { id: 3, name: 'Plant', code: 'PL1' },
    } as any);
    expect(audit.record).toHaveBeenCalledWith(
      {
        action: 'create',
        entityType: 'Site',
        entityId: '3',
        newValues: { id: 3, name: 'Plant', code: 'PL1' },
      },
      manager,
    );
  });

  it('records a save() update with before and after', async () => {
    const { subscriber, audit, manager } = setup();
    const metadata = dataSource.getMetadata(Site);
    await subscriber.afterUpdate({
      metadata,
      manager,
      entity: { id: 4, name: 'New' },
      databaseEntity: { id: 4, name: 'Old' },
      updatedColumns: metadata.columns.filter((c) => c.propertyName === 'name'),
    } as any);
    expect(audit.record).toHaveBeenCalledWith(
      {
        action: 'update',
        entityType: 'Site',
        entityId: '4',
        oldValues: { name: 'Old' },
        newValues: { name: 'New' },
      },
      manager,
    );
  });

  it('skips an update in which no audited column changed', async () => {
    const { subscriber, audit } = setup();
    const metadata = dataSource.getMetadata(User);
    await subscriber.afterUpdate({
      metadata,
      entity: { id: 4, emailOtpAttempts: 1 },
      databaseEntity: { id: 4 },
      updatedColumns: metadata.columns.filter(
        (c) => c.propertyName === 'emailOtpAttempts',
      ),
    } as any);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('skips QueryBuilder updates, which do not identify the row', async () => {
    const { subscriber, audit } = setup();
    await subscriber.afterUpdate({
      metadata: dataSource.getMetadata(User),
      entity: { firstName: 'X' },
      databaseEntity: undefined,
      updatedColumns: [],
    } as any);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('never audits its own audit rows', async () => {
    const { subscriber, audit } = setup();
    await subscriber.afterInsert({
      metadata: dataSource.getMetadata(AuditLog),
      entity: { id: '1' },
    } as any);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('records a delete with the removed record and its id', async () => {
    const { subscriber, audit } = setup();
    await subscriber.afterRemove({
      metadata: dataSource.getMetadata(Site),
      entityId: 4,
      // After remove() TypeORM clears the id on the entity itself.
      entity: { id: undefined, name: 'Plant' },
      databaseEntity: { id: 4, name: 'Plant', code: 'PL1' },
    } as any);
    expect(audit.record.mock.calls[0][0]).toMatchObject({
      action: 'delete',
      entityId: '4',
      oldValues: { id: 4, name: 'Plant', code: 'PL1' },
    });
  });
});
