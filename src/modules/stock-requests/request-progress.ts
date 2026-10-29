import { EntityManager, In } from 'typeorm';
import { PackageItemStatus } from '../../common/enums/package-item-status.enum.js';
import { PackageStatus } from '../../common/enums/package-status.enum.js';
import { StockRequestAction } from '../../common/enums/stock-request-action.enum.js';
import { StockRequestStatus } from '../../common/enums/stock-request-status.enum.js';
import { PackageItem } from '../../entities/package-item.entity.js';
import { Package } from '../../entities/package.entity.js';
import { StockRequestEvent } from '../../entities/stock-request-event.entity.js';
import { StockRequestLine } from '../../entities/stock-request-line.entity.js';
import { StockRequest } from '../../entities/stock-request.entity.js';

// Approved and not yet complete: HQ may still pack for it.
export const DELIVERABLE = [
  StockRequestStatus.APPROVED,
  StockRequestStatus.IN_TRANSIT,
  StockRequestStatus.PARTIALLY_FULFILLED,
];

export interface LineProgress {
  received: number;
  // Packed at HQ or on the road.
  inFlight: number;
  remaining: number;
}

// Counted from package_items, never stored. Missing items count for neither,
// so HQ can send them again.
export async function lineProgress(
  manager: EntityManager,
  lines: Pick<StockRequestLine, 'id' | 'quantity'>[],
): Promise<Map<number, LineProgress>> {
  const rows = lines.length
    ? await manager
        .createQueryBuilder(PackageItem, 'packageItem')
        .select('packageItem.requestLineId', 'lineId')
        .addSelect('SUM(packageItem.status = :received)', 'received')
        .addSelect('SUM(packageItem.status = :packed)', 'inFlight')
        .where('packageItem.requestLineId IN (:...ids)', {
          ids: lines.map((line) => line.id),
        })
        .setParameters({
          received: PackageItemStatus.RECEIVED,
          packed: PackageItemStatus.PACKED,
        })
        .groupBy('packageItem.requestLineId')
        .getRawMany<{ lineId: number; received: string; inFlight: string }>()
    : [];
  return new Map(
    lines.map((line) => {
      const row = rows.find(
        (candidate) => Number(candidate.lineId) === line.id,
      );
      const received = Number(row?.received ?? 0);
      const inFlight = Number(row?.inFlight ?? 0);
      return [
        line.id,
        {
          received,
          inFlight,
          remaining: Math.max(0, line.quantity - received - inFlight),
        },
      ];
    }),
  );
}

export function deliveryStatus(
  lines: Pick<StockRequestLine, 'id' | 'quantity'>[],
  progress: Map<number, LineProgress>,
  onRoad: boolean,
): StockRequestStatus {
  const received = (line: Pick<StockRequestLine, 'id'>) =>
    progress.get(line.id)?.received ?? 0;
  if (lines.every((line) => received(line) >= line.quantity)) {
    return StockRequestStatus.FULFILLED;
  }
  if (lines.some((line) => received(line) > 0)) {
    return StockRequestStatus.PARTIALLY_FULFILLED;
  }
  return onRoad ? StockRequestStatus.IN_TRANSIT : StockRequestStatus.APPROVED;
}

// Sets a deliverable request's status from what was received and records the
// delivery event. The caller holds the request's row lock.
export async function syncRequestStatus(
  manager: EntityManager,
  request: StockRequest,
  actorId: number,
  event: {
    action: StockRequestAction;
    shipmentId?: number | null;
    note?: string | null;
  },
): Promise<StockRequestStatus> {
  const lines = await manager.find(StockRequestLine, {
    where: { requestId: request.id },
    loadEagerRelations: false,
  });
  const onRoad = await manager.exists(Package, {
    where: {
      requestId: request.id,
      status: In([PackageStatus.IN_TRANSIT, PackageStatus.PARTIALLY_RECEIVED]),
    },
  });
  const status = deliveryStatus(
    lines,
    await lineProgress(manager, lines),
    onRoad,
  );
  if (status !== request.status) {
    await manager.save(StockRequest, {
      id: request.id,
      status,
      ...(status === StockRequestStatus.FULFILLED && {
        closedById: actorId,
        closedAt: new Date(),
      }),
    });
    request.status = status;
  }
  await manager.insert(StockRequestEvent, {
    requestId: request.id,
    action: event.action,
    status,
    shipmentId: event.shipmentId ?? null,
    note: event.note ?? null,
    performedById: actorId,
  });
  return status;
}
