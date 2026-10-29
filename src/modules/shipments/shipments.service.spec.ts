import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { FeatureRoleName } from '../../common/enums/feature-role-name.enum.js';
import { ItemStatus } from '../../common/enums/item-status.enum.js';
import { PackageStatus } from '../../common/enums/package-status.enum.js';
import { RoleKind } from '../../common/enums/role-kind.enum.js';
import { ROLE_LEVELS, RoleName } from '../../common/enums/role-name.enum.js';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum.js';
import { SiteType } from '../../common/enums/site-type.enum.js';
import { StockRequestStatus } from '../../common/enums/stock-request-status.enum.js';
import {
  FEATURE_ROLE_PERMISSIONS,
  ROLE_PERMISSIONS,
} from '../../database/seeds/role-permissions.js';
import { ItemMovement } from '../../entities/item-movement.entity.js';
import { Item } from '../../entities/item.entity.js';
import { PackageItem } from '../../entities/package-item.entity.js';
import { Package } from '../../entities/package.entity.js';
import { Permission } from '../../entities/permission.entity.js';
import { Product } from '../../entities/product.entity.js';
import { Role } from '../../entities/role.entity.js';
import { Shipment } from '../../entities/shipment.entity.js';
import { Site } from '../../entities/site.entity.js';
import { StockRequestLine } from '../../entities/stock-request-line.entity.js';
import { StockRequest } from '../../entities/stock-request.entity.js';
import { User } from '../../entities/user.entity.js';
import { CaslAbilityFactory } from '../authorization/casl-ability.factory.js';
import { StockRequestsService } from '../stock-requests/stock-requests.service.js';
import { ShipmentsService } from './shipments.service.js';

type Row = Record<string, any>;

// Just enough of TypeORM, in memory, for the shipment flows: equality, In()
// and one level of relation in `where`, to-one relations attached on read,
// and the two grouped counts over package_items.
const RELATIONS: Record<string, [unknown, string]> = {
  shipment: [Shipment, 'shipmentId'],
  item: [Item, 'itemId'],
  product: [Product, 'productId'],
  site: [Site, 'siteId'],
  request: [StockRequest, 'requestId'],
};

class FakeDb {
  private readonly tables = new Map<unknown, Row[]>();
  private nextId = 1000;

  rows(entity: unknown): Row[] {
    if (!this.tables.has(entity)) this.tables.set(entity, []);
    return this.tables.get(entity)!;
  }

  add(entity: unknown, values: Row): Row {
    const row: Row = { id: this.nextId++, ...values };
    for (const key of Object.keys(RELATIONS)) {
      if (typeof row[key] === 'object') delete row[key];
    }
    this.rows(entity).push(row);
    return row;
  }

  get(entity: unknown, id: number): Row {
    return this.rows(entity).find((row) => row.id === id)!;
  }

  matches(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([key, want]) => {
      if (want instanceof FindOperator) {
        if (want.type !== 'in') throw new Error(`fake: ${want.type}`);
        return (want.value as unknown[]).includes(row[key]);
      }
      if (
        want !== null &&
        typeof want === 'object' &&
        !(want instanceof Date)
      ) {
        const [target, fk] = RELATIONS[key];
        const related = this.rows(target).find((r) => r.id === row[fk]);
        return !!related && this.matches(related, want);
      }
      return row[key] === want;
    });
  }

  view(row: Row): Row {
    const out = { ...row };
    for (const [key, [target, fk]] of Object.entries(RELATIONS)) {
      const related = this.rows(target).find((r) => r.id === row[fk]);
      if (related) out[key] = { ...related };
    }
    return out;
  }
}

function fakeManager(db: FakeDb) {
  const find = (entity: unknown, options: Row = {}) => {
    const rows = db
      .rows(entity)
      .filter((row) => db.matches(row, options.where))
      .map((row) => db.view(row));
    if (options.order?.id === 'DESC') rows.reverse();
    return Promise.resolve(rows.slice(0, options.take ?? rows.length));
  };
  const save = (entity: unknown, value: Row): Promise<Row> => {
    const existing = value.id && db.get(entity, value.id);
    if (!existing) return Promise.resolve({ ...db.add(entity, value) });
    Object.assign(existing, value);
    return Promise.resolve({ ...existing });
  };
  const update = (entity: unknown, where: Row, values: Row) => {
    const hit = db.rows(entity).filter((row) => db.matches(row, where));
    for (const row of hit) Object.assign(row, values);
    return Promise.resolve({ affected: hit.length });
  };
  const drop = (entity: unknown, where: Row) => {
    const rows = db.rows(entity);
    for (const row of rows.filter((r) => db.matches(r, where))) {
      rows.splice(rows.indexOf(row), 1);
    }
    return Promise.resolve();
  };
  const queryBuilder = () => {
    let column = '';
    let ids: number[] = [];
    let set: Row = {};
    let where: Row = {};
    const qb: Row = {
      update: () => qb,
      set: (values: Row) => ((set = values), qb),
      callListeners: () => qb,
      execute: () => update(Item, where, set),
      select: (col: string) => ((column = col), qb),
      addSelect: () => qb,
      setParameters: () => qb,
      groupBy: () => qb,
      where: (condition: Row | string, params?: { ids: number[] }) => {
        if (typeof condition === 'string') ids = params!.ids;
        else where = condition;
        return qb;
      },
      getRawMany: () => {
        const byLine = column.endsWith('requestLineId');
        const key = byLine ? 'requestLineId' : 'packageId';
        const rows = db
          .rows(PackageItem)
          .filter((row) => ids.includes(row[key]));
        const count = (id: number, status?: string) =>
          String(
            rows.filter(
              (row) => row[key] === id && (!status || row.status === status),
            ).length,
          );
        return Promise.resolve(
          [...new Set(rows.map((row) => row[key] as number))].map((id) =>
            byLine
              ? {
                  lineId: id,
                  received: count(id, 'received'),
                  inFlight: count(id, 'packed'),
                }
              : {
                  packageId: id,
                  itemCount: count(id),
                  receivedCount: count(id, 'received'),
                  missingCount: count(id, 'missing'),
                },
          ),
        );
      },
    };
    return qb;
  };
  return {
    find,
    findOne: async (entity: unknown, options: Row) =>
      (await find(entity, options))[0] ?? null,
    exists: async (entity: unknown, options: Row) =>
      (await find(entity, options)).length > 0,
    existsBy: async (entity: unknown, where: Row) =>
      (await find(entity, { where })).length > 0,
    save,
    create: (_entity: unknown, value: Row) => ({ ...value }),
    insert: (entity: unknown, values: Row | Row[]) => {
      for (const value of [values].flat()) db.add(entity, value);
      return Promise.resolve();
    },
    update,
    delete: drop,
    remove: (entity: unknown, value: Row) => drop(entity, { id: value.id }),
    createQueryBuilder: queryBuilder,
  };
}

const repository = (
  manager: ReturnType<typeof fakeManager>,
  entity: unknown,
) => ({
  metadata: { columns: [], relations: [] },
  find: (options: Row) => manager.find(entity, options),
  findOne: (options: Row) => manager.findOne(entity, options),
  count: async (options: Row) => (await manager.find(entity, options)).length,
  save: (value: Row) => manager.save(entity, value),
  create: (value: Row) => value,
  createQueryBuilder: () => manager.createQueryBuilder(),
});

const permissions = (defs: readonly (readonly [string, string])[]) =>
  defs.map(([action, subject]) =>
    Object.assign(new Permission(), { action, subject }),
  );

function makeUser(
  id: number,
  roleName: RoleName,
  siteId: number,
  features: FeatureRoleName[] = [],
) {
  const role = Object.assign(new Role(), {
    name: roleName,
    kind: RoleKind.PRIMARY,
    level: ROLE_LEVELS[roleName],
    permissions: permissions(ROLE_PERMISSIONS[roleName]),
  });
  const featureRoles = features.map((name) => ({
    role: Object.assign(new Role(), {
      name,
      kind: RoleKind.FEATURE,
      level: 0,
      permissions: permissions(FEATURE_ROLE_PERMISSIONS[name]),
    }),
  }));
  return Object.assign(new User(), { id, siteId, role, featureRoles });
}

const HQ = 1;
const SITE = 5;
const REQUEST = 7;
// A site technician at HQ with the shipment manager role: reads every
// package, but may receive only at HQ.
const packer = makeUser(20, RoleName.SITE_TECHNICIAN, HQ, [
  FeatureRoleName.SHIPMENT_MANAGER,
]);
const receiver = makeUser(30, RoleName.SITE_TECHNICIAN, SITE);
const outsider = makeUser(40, RoleName.SITE_TECHNICIAN, 6);
const manager = makeUser(50, RoleName.MANAGER, HQ);

function setup() {
  const db = new FakeDb();
  db.add(Site, { id: HQ, type: SiteType.HQ });
  db.add(Site, { id: SITE, type: SiteType.SITE });
  db.add(Product, { id: 3, name: 'Drill' });
  db.add(Product, { id: 4, name: 'Bolts' });
  for (const [code, productId] of [
    ['D-1', 3],
    ['D-2', 3],
    ['D-3', 3],
    ['B-1', 4],
  ] as const) {
    db.add(Item, {
      code,
      productId,
      siteId: HQ,
      shipmentId: null,
      status: ItemStatus.AVAILABLE,
    });
  }
  db.add(StockRequest, {
    id: REQUEST,
    siteId: SITE,
    fromSiteId: HQ,
    status: StockRequestStatus.APPROVED,
  });
  db.add(StockRequestLine, {
    id: 71,
    requestId: REQUEST,
    productId: 3,
    quantity: 2,
  });
  db.add(StockRequestLine, {
    id: 72,
    requestId: REQUEST,
    productId: 4,
    quantity: 1,
  });

  const em = fakeManager(db);
  const dataSource = { transaction: (work: any) => work(em), manager: em };
  const abilities = new CaslAbilityFactory();
  const shipments = new ShipmentsService(
    repository(em, Shipment) as any,
    repository(em, Package) as any,
    repository(em, PackageItem) as any,
    dataSource as any,
    abilities,
    { record: vi.fn() } as any,
  );
  const requests = new StockRequestsService(
    repository(em, StockRequest) as any,
    repository(em, StockRequestLine) as any,
    repository(em, StockRequest) as any,
    repository(em, StockRequest) as any,
    dataSource as any,
    abilities,
    {} as any,
  );

  // Two drills and the bolts, everything the request asks for, in one package.
  const packed = async () => {
    const shipment = await shipments.create(packer, {});
    const pkg = await shipments.createPackage(packer, shipment.id, {
      requestId: REQUEST,
    });
    await shipments.pack(packer, pkg.id, { codes: ['D-1', 'D-2', 'B-1'] });
    return { shipmentId: shipment.id, packageId: pkg.id };
  };
  const dispatched = async () => {
    const ids = await packed();
    await shipments.dispatch(packer, ids.shipmentId);
    return ids;
  };
  const item = (code: string) =>
    db.rows(Item).find((row) => row.code === code)!;
  const status = (entity: unknown, id: number) => db.get(entity, id).status;
  return { db, shipments, requests, packed, dispatched, item, status };
}

describe('ShipmentsService flows', () => {
  it('ships a site-to-site request from its sending site only', async () => {
    const { db, shipments, item } = setup();
    // HQ routed 1 drill from SITE to another site; SITE holds one.
    db.add(Site, { id: 6, type: SiteType.SITE, isActive: true });
    db.get(Site, SITE).isActive = true;
    db.add(Item, {
      code: 'S-1',
      productId: 3,
      siteId: SITE,
      shipmentId: null,
      status: ItemStatus.AVAILABLE,
    });
    db.add(StockRequest, {
      id: 8,
      siteId: 6,
      fromSiteId: SITE,
      status: StockRequestStatus.APPROVED,
    });
    db.add(StockRequestLine, {
      id: 81,
      requestId: 8,
      productId: 3,
      quantity: 1,
    });

    const shipment = await shipments.create(packer, { fromSiteId: SITE });
    expect(shipment).toMatchObject({ fromSiteId: SITE });
    // A request leaving from HQ cannot go on a truck from SITE.
    await expect(
      shipments.createPackage(packer, shipment.id, { requestId: REQUEST }),
    ).rejects.toThrow('errors.packages.otherSource');
    const pkg = await shipments.createPackage(packer, shipment.id, {
      requestId: 8,
    });
    // HQ's drills are not at SITE.
    await expect(
      shipments.pack(packer, pkg.id, { codes: ['D-1'] }),
    ).rejects.toThrow('errors.packages.itemNotAvailable');
    await shipments.pack(packer, pkg.id, { codes: ['S-1'] });
    await shipments.dispatch(packer, shipment.id);
    expect(item('S-1')).toMatchObject({ status: ItemStatus.IN_TRANSIT });
    const movements = db
      .rows(ItemMovement)
      .filter((row) => row.itemId === item('S-1').id);
    expect(movements.map((row) => row.siteId)).toEqual([SITE, SITE]);
  });

  it('delivers a request in two receipts, then closes the shipment itself', async () => {
    const { shipments, dispatched, item, status } = setup();
    const { shipmentId, packageId } = await dispatched();
    expect(status(StockRequest, REQUEST)).toBe(StockRequestStatus.IN_TRANSIT);
    expect(item('D-1')).toMatchObject({
      status: ItemStatus.IN_TRANSIT,
      siteId: null,
      shipmentId,
    });

    await shipments.receive(receiver, packageId, { codes: ['D-1'] });
    expect(status(Package, packageId)).toBe(PackageStatus.PARTIALLY_RECEIVED);
    expect(status(StockRequest, REQUEST)).toBe(
      StockRequestStatus.PARTIALLY_FULFILLED,
    );
    expect(item('D-1')).toMatchObject({
      status: ItemStatus.AVAILABLE,
      siteId: SITE,
      shipmentId: null,
    });

    await shipments.receive(receiver, packageId, {});
    expect(status(Package, packageId)).toBe(PackageStatus.RECEIVED);
    expect(status(Shipment, shipmentId)).toBe(ShipmentStatus.CLOSED);
    expect(status(StockRequest, REQUEST)).toBe(StockRequestStatus.FULFILLED);
    expect(item('B-1')).toMatchObject({ siteId: SITE, shipmentId: null });
  });

  it('never packs more than a line still needs', async () => {
    const { shipments } = setup();
    const shipment = await shipments.create(packer, {});
    const pkg = await shipments.createPackage(packer, shipment.id, {
      requestId: REQUEST,
    });
    await expect(
      shipments.pack(packer, pkg.id, { codes: ['D-1', 'D-2', 'D-3'] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows one package per request in a shipment', async () => {
    const { shipments } = setup();
    const shipment = await shipments.create(packer, {});
    // Still empty, so everything is remaining: only the duplicate is refused.
    await shipments.createPackage(packer, shipment.id, { requestId: REQUEST });
    await expect(
      shipments.createPackage(packer, shipment.id, { requestId: REQUEST }),
    ).rejects.toThrow(ConflictException);
  });

  it('closing by hand marks what is on the road missing, and the request can be packed again', async () => {
    const { shipments, requests, dispatched, item, status } = setup();
    const { shipmentId, packageId } = await dispatched();
    await shipments.close(packer, shipmentId, { note: 'Truck lost' });
    expect(status(Package, packageId)).toBe(PackageStatus.MISSING);
    expect(item('D-2')).toMatchObject({
      status: ItemStatus.MISSING,
      shipmentId,
    });
    expect(status(StockRequest, REQUEST)).toBe(StockRequestStatus.APPROVED);
    const detail = await requests.findOne(manager, REQUEST);
    expect(detail.lines.map((line: any) => line.remaining)).toEqual([2, 1]);
  });

  it('receives nothing more once the shipment is closed', async () => {
    const { shipments, dispatched, status } = setup();
    const { shipmentId, packageId } = await dispatched();
    await shipments.receive(receiver, packageId, { codes: ['D-1'] });
    await shipments.close(packer, shipmentId, { note: 'Rest lost' });
    expect(status(Package, packageId)).toBe(PackageStatus.PARTIALLY_RECEIVED);
    expect(status(StockRequest, REQUEST)).toBe(
      StockRequestStatus.PARTIALLY_FULFILLED,
    );
    const pkg = await shipments.findPackage(receiver, packageId);
    expect(pkg.allowed.receive).toBe(false);
    await expect(shipments.receive(receiver, packageId, {})).rejects.toThrow(
      ConflictException,
    );
  });

  it('lets only the destination site receive', async () => {
    const { shipments, dispatched } = setup();
    const { packageId } = await dispatched();
    // Reads the package, so the answer is 403, not 404.
    await expect(shipments.receive(packer, packageId, {})).rejects.toThrow(
      ForbiddenException,
    );
    await expect(shipments.receive(outsider, packageId, {})).rejects.toThrow(
      NotFoundException,
    );
    expect(
      (await shipments.findPackage(packer, packageId)).allowed.receive,
    ).toBe(false);
  });
});

describe('StockRequestsService close with shipments', () => {
  it('waits for an open shipment, then lowers each line to what arrived', async () => {
    const { db, shipments, requests, dispatched, status } = setup();
    const { shipmentId, packageId } = await dispatched();
    await expect(
      requests.close(manager, REQUEST, { note: 'Enough for now' }),
    ).rejects.toThrow(ConflictException);

    await shipments.receive(receiver, packageId, { codes: ['D-1'] });
    await shipments.close(packer, shipmentId, { note: 'Rest lost' });
    await requests.close(manager, REQUEST, { note: 'Enough for now' });
    expect(db.get(StockRequestLine, 71).quantity).toBe(1);
    expect(db.get(StockRequestLine, 72).quantity).toBe(0);
    expect(status(StockRequest, REQUEST)).toBe(StockRequestStatus.FULFILLED);
  });
});
