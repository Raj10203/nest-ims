import { Injectable } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  ObjectLiteral,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { isEntityNotAudited } from '../../common/audit/not-audited.decorator.js';
import { AuditLog } from '../../entities/audit-log.entity.js';
import { changes, snapshot } from './audit-values.js';
import { AuditService } from './audit.service.js';

// Records every insert, update and remove made through save() / remove(), in
// the same transaction as the change. Repository.update(criteria, values) and
// QueryBuilder updates are NOT seen (TypeORM does not say which row changed):
// use them only for technical state, or record an explicit AuditService entry.
@Injectable()
export class AuditSubscriber implements EntitySubscriberInterface {
  constructor(
    dataSource: DataSource,
    private readonly audit: AuditService,
  ) {
    dataSource.subscribers.push(this);
  }

  async afterInsert(event: InsertEvent<ObjectLiteral>): Promise<void> {
    if (this.skip(event.metadata.target) || !event.entity) return;
    await this.audit.record(
      {
        action: 'create',
        entityType: event.metadata.name,
        entityId: this.idOf(event.metadata, event.entity),
        newValues: snapshot(event.metadata, event.entity),
      },
      event.manager,
    );
  }

  async afterUpdate(event: UpdateEvent<ObjectLiteral>): Promise<void> {
    // No databaseEntity: a QueryBuilder update, which has no row identity.
    if (
      this.skip(event.metadata.target) ||
      !event.entity ||
      !event.databaseEntity
    ) {
      return;
    }
    const { oldValues, newValues } = changes(
      event.metadata,
      event.databaseEntity,
      event.entity,
      event.updatedColumns,
    );
    if (!newValues) return;
    await this.audit.record(
      {
        action: 'update',
        entityType: event.metadata.name,
        entityId: this.idOf(event.metadata, event.databaseEntity),
        oldValues,
        newValues,
      },
      event.manager,
    );
  }

  async afterRemove(event: RemoveEvent<ObjectLiteral>): Promise<void> {
    const before = event.databaseEntity ?? event.entity;
    if (this.skip(event.metadata.target) || !before) return;
    await this.audit.record(
      {
        action: 'delete',
        entityType: event.metadata.name,
        entityId:
          event.entityId !== undefined
            ? String(event.entityId)
            : this.idOf(event.metadata, before),
        oldValues: snapshot(event.metadata, before),
      },
      event.manager,
    );
  }

  private skip(target: unknown): boolean {
    return target === AuditLog || isEntityNotAudited(target);
  }

  private idOf(
    metadata: InsertEvent<ObjectLiteral>['metadata'],
    entity: ObjectLiteral,
  ): string {
    return Object.values(metadata.getEntityIdMap(entity) ?? {}).join(',');
  }
}
