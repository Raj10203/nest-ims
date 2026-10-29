import { ConflictException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ItemStatus } from '../../common/enums/item-status.enum.js';
import { MovementAction } from '../../common/enums/movement-action.enum.js';
import { i18nMessage } from '../../common/i18n/i18n-message.js';
import { ItemMovement } from '../../entities/item-movement.entity.js';
import { Item } from '../../entities/item.entity.js';
import { AuditService } from '../audit/audit.service.js';

export interface ItemMove {
  items: Pick<Item, 'id' | 'code'>[];
  from: ItemStatus;
  to: Pick<Item, 'status'> & Partial<Pick<Item, 'siteId' | 'shipmentId'>>;
  action: MovementAction;
  // The movement's site: HQ, or the package's destination.
  siteId: number;
  shipmentId: number;
  packageId: number;
  performedById: number;
}

// One conditional UPDATE, so an item another writer moved first is never
// moved twice; one audit entry per package instead of one per item, because
// item_movements is each item's own history.
export async function moveItems(
  manager: EntityManager,
  audit: AuditService,
  move: ItemMove,
): Promise<void> {
  if (!move.items.length) return;
  const ids = move.items.map((item) => item.id);
  const result = await manager
    .createQueryBuilder()
    .update(Item)
    .set(move.to)
    .where({ id: In(ids), status: move.from })
    .callListeners(false)
    .execute();
  if (result.affected !== ids.length) {
    throw new ConflictException(i18nMessage('errors.packages.itemsChanged'));
  }
  await manager.insert(
    ItemMovement,
    ids.map((itemId) => ({
      itemId,
      action: move.action,
      siteId: move.siteId,
      shipmentId: move.shipmentId,
      status: move.to.status,
      performedById: move.performedById,
    })),
  );
  await audit.record(
    {
      action: 'update',
      entityType: 'Item',
      entityId: `package:${move.packageId}`,
      oldValues: { status: move.from },
      newValues: { ...move.to, codes: move.items.map((item) => item.code) },
    },
    manager,
  );
}
