import { subject } from '@casl/ability';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ItemStatus } from '../../common/enums/item-status.enum.js';
import { MovementAction } from '../../common/enums/movement-action.enum.js';
import { PackageItemStatus } from '../../common/enums/package-item-status.enum.js';
import { PackageStatus } from '../../common/enums/package-status.enum.js';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum.js';
import { SiteType } from '../../common/enums/site-type.enum.js';
import { StockRequestAction } from '../../common/enums/stock-request-action.enum.js';
import { i18nMessage } from '../../common/i18n/i18n-message.js';
import {
  depthOne,
  depthOneWithout,
  findPageDepthOne,
} from '../../common/typeorm/depth-one.js';
import { Item } from '../../entities/item.entity.js';
import { PackageItem } from '../../entities/package-item.entity.js';
import { Package } from '../../entities/package.entity.js';
import { Shipment } from '../../entities/shipment.entity.js';
import { Site } from '../../entities/site.entity.js';
import { StockRequestLine } from '../../entities/stock-request-line.entity.js';
import { StockRequest } from '../../entities/stock-request.entity.js';
import { User } from '../../entities/user.entity.js';
import { AuditService } from '../audit/audit.service.js';
import {
  CaslAbilityFactory,
  readablePackagesWhere,
  type AppAbility,
} from '../authorization/casl-ability.factory.js';
import {
  DELIVERABLE,
  lineProgress,
  syncRequestStatus,
} from '../stock-requests/request-progress.js';
import {
  CreatePackageDto,
  PackItemsDto,
  ReceivePackageDto,
} from './dto/create-package.dto.js';
import {
  CloseShipmentDto,
  CreateShipmentDto,
  UpdateShipmentDto,
} from './dto/create-shipment.dto.js';
import {
  ListPackagesQueryDto,
  ListShipmentsQueryDto,
} from './dto/list-shipments-query.dto.js';
import { moveItems } from './move-items.js';

const ON_THE_ROAD = [
  PackageStatus.IN_TRANSIT,
  PackageStatus.PARTIALLY_RECEIVED,
];

type Content = Pick<PackageItem, 'id' | 'packageId' | 'requestLineId'> & {
  item: Pick<Item, 'id' | 'code'>;
};

// Every change to a shipment or its packages first locks the shipment row
// (FOR UPDATE), then the package, then requests in id order: packing, dispatch,
// receipt and close of one shipment queue up, and the fixed order never
// deadlocks. Locks come before any plain read, so those reads see the latest
// rows rather than an older snapshot.
@Injectable()
export class ShipmentsService {
  constructor(
    @InjectRepository(Shipment)
    private readonly shipments: Repository<Shipment>,
    @InjectRepository(Package) private readonly packages: Repository<Package>,
    @InjectRepository(PackageItem)
    private readonly packageItems: Repository<PackageItem>,
    private readonly dataSource: DataSource,
    private readonly abilityFactory: CaslAbilityFactory,
    private readonly audit: AuditService,
  ) {}

  async create(actor: User, dto: CreateShipmentDto) {
    const shipment = await this.shipments.save(
      this.shipments.create({
        status: ShipmentStatus.DRAFT,
        vehicleNumber: dto.vehicleNumber ?? null,
        driverName: dto.driverName ?? null,
        driverPhone: dto.driverPhone ?? null,
        note: dto.note ?? null,
        createdById: actor.id,
      }),
    );
    return this.findOne(shipment.id);
  }

  async findAll({ status, page, limit }: ListShipmentsQueryDto) {
    const [items, total] = await findPageDepthOne(this.shipments, {
      where: { ...(status && { status }) },
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const rows = items.length
      ? await this.packages
          .createQueryBuilder('package')
          .select('package.shipmentId', 'shipmentId')
          .addSelect('COUNT(*)', 'packageCount')
          .where('package.shipmentId IN (:...ids)', {
            ids: items.map((item) => item.id),
          })
          .groupBy('package.shipmentId')
          .getRawMany<{ shipmentId: number; packageCount: string }>()
      : [];
    return {
      items: items.map((item) =>
        Object.assign(item, {
          packageCount: Number(
            rows.find((row) => Number(row.shipmentId) === item.id)
              ?.packageCount ?? 0,
          ),
        }),
      ),
      total,
      page,
      limit,
    };
  }

  async findOne(id: number) {
    const shipment = await this.shipments.findOne({
      ...depthOne(this.shipments),
      where: { id },
    });
    if (!shipment) throw this.notFound(id);
    const packages = await this.packages.find({
      ...depthOneWithout(this.packages, 'shipment'),
      where: { shipmentId: id },
      order: { id: 'ASC' },
    });
    return Object.assign(shipment, {
      packages: await this.withItemCounts(packages),
    });
  }

  async update(id: number, dto: UpdateShipmentDto) {
    await this.dataSource.transaction(async (manager) => {
      const shipment = await this.lockShipment(manager, id);
      if (
        shipment.status !== ShipmentStatus.DRAFT &&
        shipment.status !== ShipmentStatus.DISPATCHED
      ) {
        throw new ConflictException(i18nMessage('errors.shipments.finished'));
      }
      await manager.save(Shipment, { id, ...dto });
    });
    return this.findOne(id);
  }

  async dispatch(actor: User, id: number) {
    await this.dataSource.transaction(async (manager) => {
      await this.lockDraft(manager, id);
      const packages = await manager.find(Package, {
        where: { shipmentId: id },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      const requests = await this.lockRequests(
        manager,
        packages.map((pkg) => pkg.requestId),
      );
      if (!packages.length) {
        throw new BadRequestException(
          i18nMessage('errors.shipments.noPackages'),
        );
      }
      const contents = await this.contents(
        manager,
        packages.map((pkg) => pkg.id),
        PackageItemStatus.PACKED,
      );
      const empty = packages.find(
        (pkg) => !contents.some((row) => row.packageId === pkg.id),
      );
      if (empty) {
        throw new BadRequestException(
          i18nMessage('errors.shipments.emptyPackage', { id: empty.id }),
        );
      }
      const hq = await this.headquarters(manager);
      for (const pkg of packages) {
        await moveItems(manager, this.audit, {
          items: contents
            .filter((row) => row.packageId === pkg.id)
            .map((row) => row.item),
          from: ItemStatus.PACKED,
          to: { status: ItemStatus.IN_TRANSIT, siteId: null, shipmentId: id },
          action: MovementAction.DISPATCHED,
          siteId: hq.id,
          shipmentId: id,
          packageId: pkg.id,
          performedById: actor.id,
        });
        await manager.save(Package, {
          id: pkg.id,
          status: PackageStatus.IN_TRANSIT,
        });
      }
      await manager.save(Shipment, {
        id,
        status: ShipmentStatus.DISPATCHED,
        dispatchedById: actor.id,
        dispatchedAt: new Date(),
      });
      await this.syncRequests(
        manager,
        actor,
        requests,
        id,
        StockRequestAction.DISPATCHED,
      );
    });
    return this.findOne(id);
  }

  // A draft only: nothing has left headquarters, so its packages go and their
  // items are available again.
  async cancel(actor: User, id: number) {
    await this.dataSource.transaction(async (manager) => {
      await this.lockDraft(manager, id);
      const packages = await manager.find(Package, {
        where: { shipmentId: id },
        loadEagerRelations: false,
      });
      for (const pkg of packages) {
        await this.dropPackage(manager, actor, pkg);
      }
      await manager.save(Shipment, {
        id,
        status: ShipmentStatus.CANCELLED,
        closedById: actor.id,
        closedAt: new Date(),
      });
    });
    return this.findOne(id);
  }

  // By hand, when some packages never arrive: what was not received is
  // missing. A shipment whose last package is received closes itself.
  async close(actor: User, id: number, dto: CloseShipmentDto) {
    await this.dataSource.transaction(async (manager) => {
      const shipment = await this.lockShipment(manager, id);
      if (shipment.status !== ShipmentStatus.DISPATCHED) {
        throw new ConflictException(
          i18nMessage('errors.shipments.notDispatched'),
        );
      }
      await this.finish(manager, actor, id, dto.note);
    });
    return this.findOne(id);
  }

  async createPackage(actor: User, shipmentId: number, dto: CreatePackageDto) {
    const id = await this.dataSource.transaction(async (manager) => {
      await this.lockDraft(manager, shipmentId);
      const [request] = await this.lockRequests(manager, [dto.requestId]);
      if (!request) {
        throw new BadRequestException(
          i18nMessage('errors.packages.requestNotFound', {
            id: dto.requestId,
          }),
        );
      }
      this.assertDeliverable(request);
      const lines = await manager.find(StockRequestLine, {
        where: { requestId: request.id },
        loadEagerRelations: false,
      });
      const progress = await lineProgress(manager, lines);
      if (![...progress.values()].some((line) => line.remaining > 0)) {
        throw new ConflictException(
          i18nMessage('errors.packages.nothingRemaining', { id: request.id }),
        );
      }
      const pkg = await manager.save(
        Package,
        manager.create(Package, {
          shipmentId,
          requestId: request.id,
          siteId: request.siteId,
          status: PackageStatus.PACKING,
          createdById: actor.id,
        }),
      );
      return pkg.id;
    });
    return this.findPackage(actor, id);
  }

  async findPackages(
    actor: User,
    {
      status,
      shipmentId,
      requestId,
      siteId,
      page,
      limit,
    }: ListPackagesQueryDto,
  ) {
    const scope = readablePackagesWhere(
      actor,
      this.abilityFactory.createForUser(actor),
    );
    // A site role's only site is its own.
    if (scope && siteId && siteId !== scope.siteId) {
      return { items: [], total: 0, page, limit };
    }
    const [items, total] = await findPageDepthOne(this.packages, {
      where: {
        ...(status && { status }),
        ...(shipmentId && { shipmentId }),
        ...(requestId && { requestId }),
        ...(siteId && { siteId }),
        ...scope,
      },
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: await this.withItemCounts(items), total, page, limit };
  }

  async findPackage(actor: User, id: number) {
    const ability = this.abilityFactory.createForUser(actor);
    const pkg = await this.findReadablePackage(ability, id);
    const items = await this.packageItems.find({
      ...depthOneWithout(this.packageItems, 'package'),
      where: { packageId: id },
      order: { id: 'ASC' },
    });
    return Object.assign(pkg, {
      items,
      allowed: {
        receive:
          ON_THE_ROAD.includes(pkg.status) &&
          ability.can('receive', subject('Package', pkg)),
      },
    });
  }

  async pack(actor: User, id: number, { codes }: PackItemsDto) {
    const shipmentId = await this.shipmentOf(id);
    await this.dataSource.transaction(async (manager) => {
      await this.lockDraft(manager, shipmentId);
      const pkg = await this.lockPackage(manager, id);
      const [request] = await this.lockRequests(manager, [pkg.requestId]);
      this.assertDeliverable(request);
      const hq = await this.headquarters(manager);
      const items = await manager.find(Item, {
        select: {
          id: true,
          code: true,
          productId: true,
          siteId: true,
          status: true,
        },
        where: { code: In(codes) },
        loadEagerRelations: false,
      });
      const lines = await manager.find(StockRequestLine, {
        where: { requestId: pkg.requestId },
        relations: { product: true },
        loadEagerRelations: false,
      });
      const progress = await lineProgress(manager, lines);
      const added = new Map<number, number>();
      const rows = codes.map((code) => {
        const item = items.find((candidate) => candidate.code === code);
        if (!item) {
          throw new BadRequestException(
            i18nMessage('errors.packages.itemNotFound', { code }),
          );
        }
        if (item.siteId !== hq.id || item.status !== ItemStatus.AVAILABLE) {
          throw new ConflictException(
            i18nMessage('errors.packages.itemNotAvailable', { code }),
          );
        }
        const line = lines.find(
          (candidate) => candidate.productId === item.productId,
        );
        if (!line || line.quantity === 0) {
          throw new BadRequestException(
            i18nMessage('errors.packages.productNotRequested', { code }),
          );
        }
        const count = (added.get(line.id) ?? 0) + 1;
        const { remaining } = progress.get(line.id)!;
        if (count > remaining) {
          throw new BadRequestException(
            i18nMessage('errors.packages.overRemaining', {
              remaining,
              product: line.product.name,
            }),
          );
        }
        added.set(line.id, count);
        return {
          packageId: id,
          itemId: item.id,
          requestLineId: line.id,
          status: PackageItemStatus.PACKED,
        };
      });
      await moveItems(manager, this.audit, {
        items,
        from: ItemStatus.AVAILABLE,
        to: { status: ItemStatus.PACKED },
        action: MovementAction.PACKED,
        siteId: hq.id,
        shipmentId,
        packageId: id,
        performedById: actor.id,
      });
      await manager.insert(PackageItem, rows);
    });
    return this.findPackage(actor, id);
  }

  async unpack(actor: User, id: number, itemId: number) {
    const shipmentId = await this.shipmentOf(id);
    await this.dataSource.transaction(async (manager) => {
      await this.lockDraft(manager, shipmentId);
      const row = await manager.findOne(PackageItem, {
        select: {
          id: true,
          packageId: true,
          requestLineId: true,
          item: { id: true, code: true },
        },
        where: { packageId: id, itemId },
        relations: { item: true },
        loadEagerRelations: false,
      });
      if (!row) {
        throw new NotFoundException(
          i18nMessage('errors.packages.itemNotInPackage', { itemId }),
        );
      }
      await this.release(manager, actor, shipmentId, id, [row]);
    });
    return this.findPackage(actor, id);
  }

  async removePackage(actor: User, id: number): Promise<void> {
    const shipmentId = await this.shipmentOf(id);
    await this.dataSource.transaction(async (manager) => {
      await this.lockDraft(manager, shipmentId);
      await this.dropPackage(
        manager,
        actor,
        await this.lockPackage(manager, id),
      );
    });
  }

  // Any employee of the destination site. Without codes the whole package;
  // with codes only those items, and the package stays partially received.
  async receive(actor: User, id: number, { codes }: ReceivePackageDto) {
    const ability = this.abilityFactory.createForUser(actor);
    const { shipmentId } = await this.findReadablePackage(ability, id);
    await this.dataSource.transaction(async (manager) => {
      await this.lockShipment(manager, shipmentId);
      const pkg = await this.lockPackage(manager, id);
      const requests = await this.lockRequests(manager, [pkg.requestId]);
      if (!ON_THE_ROAD.includes(pkg.status)) {
        throw new ConflictException(
          i18nMessage('errors.packages.notInTransit'),
        );
      }
      const waiting = await this.contents(
        manager,
        [id],
        PackageItemStatus.PACKED,
      );
      const chosen = codes
        ? codes.map((code) => {
            const row = waiting.find(
              (candidate) => candidate.item.code === code,
            );
            if (!row) {
              throw new BadRequestException(
                i18nMessage('errors.packages.codeNotInPackage', { code }),
              );
            }
            return row;
          })
        : waiting;
      await moveItems(manager, this.audit, {
        items: chosen.map((row) => row.item),
        from: ItemStatus.IN_TRANSIT,
        to: {
          status: ItemStatus.AVAILABLE,
          siteId: pkg.siteId,
          shipmentId: null,
        },
        action: MovementAction.RECEIVED,
        siteId: pkg.siteId,
        shipmentId,
        packageId: id,
        performedById: actor.id,
      });
      const now = new Date();
      if (chosen.length) {
        await manager.update(
          PackageItem,
          { id: In(chosen.map((row) => row.id)) },
          {
            status: PackageItemStatus.RECEIVED,
            receivedById: actor.id,
            receivedAt: now,
          },
        );
      }
      const complete = chosen.length === waiting.length;
      await manager.save(Package, {
        id,
        status: complete
          ? PackageStatus.RECEIVED
          : PackageStatus.PARTIALLY_RECEIVED,
        ...(complete && { receivedById: actor.id, receivedAt: now }),
      });
      await this.syncRequests(
        manager,
        actor,
        requests,
        shipmentId,
        StockRequestAction.RECEIVED,
      );
      const open = await manager.exists(Package, {
        where: { shipmentId, status: In(ON_THE_ROAD) },
      });
      if (!open) await this.finish(manager, actor, shipmentId, null);
    });
    return this.findPackage(actor, id);
  }

  // Closes a dispatched shipment: items still on the road become missing and
  // keep the shipment as their location; their requests can be packed again.
  private async finish(
    manager: EntityManager,
    actor: User,
    shipmentId: number,
    note: string | null,
  ) {
    const packages = await manager.find(Package, {
      where: { shipmentId, status: In(ON_THE_ROAD) },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
      loadEagerRelations: false,
    });
    const requests = await this.lockRequests(
      manager,
      packages.map((pkg) => pkg.requestId),
    );
    const lost = await this.contents(
      manager,
      packages.map((pkg) => pkg.id),
      PackageItemStatus.PACKED,
    );
    for (const pkg of packages) {
      await moveItems(manager, this.audit, {
        items: lost
          .filter((row) => row.packageId === pkg.id)
          .map((row) => row.item),
        from: ItemStatus.IN_TRANSIT,
        to: { status: ItemStatus.MISSING },
        action: MovementAction.MARKED_MISSING,
        siteId: pkg.siteId,
        shipmentId,
        packageId: pkg.id,
        performedById: actor.id,
      });
      if (pkg.status === PackageStatus.IN_TRANSIT) {
        await manager.save(Package, {
          id: pkg.id,
          status: PackageStatus.MISSING,
        });
      }
    }
    if (lost.length) {
      await manager.update(
        PackageItem,
        { id: In(lost.map((row) => row.id)) },
        { status: PackageItemStatus.MISSING },
      );
    }
    await manager.save(Shipment, {
      id: shipmentId,
      status: ShipmentStatus.CLOSED,
      closedById: actor.id,
      closedAt: new Date(),
    });
    await this.syncRequests(
      manager,
      actor,
      requests,
      shipmentId,
      StockRequestAction.ITEMS_MISSING,
      note,
    );
  }

  private async dropPackage(manager: EntityManager, actor: User, pkg: Package) {
    const rows = await this.contents(
      manager,
      [pkg.id],
      PackageItemStatus.PACKED,
    );
    await this.release(manager, actor, pkg.shipmentId, pkg.id, rows);
    await manager.remove(Package, pkg);
  }

  private async release(
    manager: EntityManager,
    actor: User,
    shipmentId: number,
    packageId: number,
    rows: Content[],
  ) {
    if (!rows.length) return;
    const hq = await this.headquarters(manager);
    await moveItems(manager, this.audit, {
      items: rows.map((row) => row.item),
      from: ItemStatus.PACKED,
      to: { status: ItemStatus.AVAILABLE },
      action: MovementAction.UNPACKED,
      siteId: hq.id,
      shipmentId,
      packageId,
      performedById: actor.id,
    });
    await manager.delete(PackageItem, { id: In(rows.map((row) => row.id)) });
  }

  // In id order, so two transactions locking the same requests never deadlock.
  private async lockRequests(
    manager: EntityManager,
    requestIds: number[],
  ): Promise<StockRequest[]> {
    const requests: StockRequest[] = [];
    for (const id of [...new Set(requestIds)].sort((a, b) => a - b)) {
      const request = await manager.findOne(StockRequest, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      if (request) requests.push(request);
    }
    return requests;
  }

  private async syncRequests(
    manager: EntityManager,
    actor: User,
    requests: StockRequest[],
    shipmentId: number,
    action: StockRequestAction,
    note: string | null = null,
  ) {
    for (const request of requests) {
      await syncRequestStatus(manager, request, actor.id, {
        action,
        shipmentId,
        note,
      });
    }
  }

  private async contents(
    manager: EntityManager,
    packageIds: number[],
    status: PackageItemStatus,
  ): Promise<Content[]> {
    if (!packageIds.length) return [];
    return manager.find(PackageItem, {
      select: {
        id: true,
        packageId: true,
        requestLineId: true,
        item: { id: true, code: true },
      },
      where: { packageId: In(packageIds), status },
      relations: { item: true },
      order: { id: 'ASC' },
      loadEagerRelations: false,
    });
  }

  private async withItemCounts(packages: Package[]) {
    if (!packages.length) return [];
    const rows = await this.packageItems
      .createQueryBuilder('packageItem')
      .select('packageItem.packageId', 'packageId')
      .addSelect('COUNT(*)', 'itemCount')
      .addSelect('SUM(packageItem.status = :received)', 'receivedCount')
      .addSelect('SUM(packageItem.status = :missing)', 'missingCount')
      .where('packageItem.packageId IN (:...ids)', {
        ids: packages.map((pkg) => pkg.id),
      })
      .setParameters({
        received: PackageItemStatus.RECEIVED,
        missing: PackageItemStatus.MISSING,
      })
      .groupBy('packageItem.packageId')
      .getRawMany<{
        packageId: number;
        itemCount: string;
        receivedCount: string;
        missingCount: string;
      }>();
    return packages.map((pkg) => {
      const row = rows.find(
        (candidate) => Number(candidate.packageId) === pkg.id,
      );
      return Object.assign(pkg, {
        itemCount: Number(row?.itemCount ?? 0),
        receivedCount: Number(row?.receivedCount ?? 0),
        missingCount: Number(row?.missingCount ?? 0),
      });
    });
  }

  private assertDeliverable(request: StockRequest) {
    if (!DELIVERABLE.includes(request.status)) {
      throw new ConflictException(
        i18nMessage('errors.packages.requestNotDeliverable', {
          id: request.id,
        }),
      );
    }
  }

  // Outside the transaction: a package never changes shipment, and reading
  // inside it before the lock would fix an older snapshot.
  private async shipmentOf(packageId: number): Promise<number> {
    const pkg = await this.packages.findOne({
      select: { id: true, shipmentId: true },
      where: { id: packageId },
      loadEagerRelations: false,
    });
    if (!pkg) throw this.packageNotFound(packageId);
    return pkg.shipmentId;
  }

  private async lockShipment(
    manager: EntityManager,
    id: number,
  ): Promise<Shipment> {
    const shipment = await manager.findOne(Shipment, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
      loadEagerRelations: false,
    });
    if (!shipment) throw this.notFound(id);
    return shipment;
  }

  private async lockDraft(manager: EntityManager, id: number) {
    const shipment = await this.lockShipment(manager, id);
    if (shipment.status !== ShipmentStatus.DRAFT) {
      throw new ConflictException(i18nMessage('errors.shipments.notDraft'));
    }
    return shipment;
  }

  private async lockPackage(
    manager: EntityManager,
    id: number,
  ): Promise<Package> {
    const pkg = await manager.findOne(Package, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
      loadEagerRelations: false,
    });
    if (!pkg) throw this.packageNotFound(id);
    return pkg;
  }

  // Another site's package reads as missing, so ids are not revealed.
  private async findReadablePackage(
    ability: AppAbility,
    id: number,
  ): Promise<Package> {
    const pkg = await this.packages.findOne({
      ...depthOne(this.packages),
      where: { id },
    });
    if (!pkg || !ability.can('read', subject('Package', pkg))) {
      throw this.packageNotFound(id);
    }
    return pkg;
  }

  private async headquarters(manager: EntityManager): Promise<Site> {
    const hq = await manager.findOne(Site, {
      where: { type: SiteType.HQ },
      loadEagerRelations: false,
    });
    if (!hq) throw new ConflictException(i18nMessage('errors.sites.hqMissing'));
    return hq;
  }

  private notFound(id: number) {
    return new NotFoundException(
      i18nMessage('errors.shipments.notFound', { id }),
    );
  }

  private packageNotFound(id: number) {
    return new NotFoundException(
      i18nMessage('errors.packages.notFound', { id }),
    );
  }
}
