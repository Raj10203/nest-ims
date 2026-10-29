import type {
  EntityMetadata,
  FindManyOptions,
  FindOptionsRelations,
  FindOptionsSelect,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { Category } from '../../entities/category.entity.js';
import { Item } from '../../entities/item.entity.js';
import { Package } from '../../entities/package.entity.js';
import { Product } from '../../entities/product.entity.js';
import { Role } from '../../entities/role.entity.js';
import { Shipment } from '../../entities/shipment.entity.js';
import { Site } from '../../entities/site.entity.js';
import { StockRequestLine } from '../../entities/stock-request-line.entity.js';
import { StockRequest } from '../../entities/stock-request.entity.js';
import { User } from '../../entities/user.entity.js';

export interface DepthOneOptions<T> {
  select: FindOptionsSelect<T>;
  relations: FindOptionsRelations<T>;
  loadEagerRelations: false;
}

// A related record is a summary: what a screen shows for the link (a name, a
// code, a status); its full record is one request away. A related user's
// email and account status also stay behind the users read scope, which
// returns 404 outside it. An entity missing here comes with all its columns.
const SUMMARY_COLUMNS = new Map<unknown, readonly string[]>([
  [User, ['id', 'firstName', 'middleName', 'lastName', 'avatarUrl']],
  [Role, ['id', 'name', 'kind', 'level']],
  [Site, ['id', 'name', 'code', 'type']],
  [Category, ['id', 'name']],
  [
    Product,
    ['id', 'name', 'prefix', 'type', 'measureType', 'packSize', 'packUnit'],
  ],
  [Item, ['id', 'code', 'productId', 'status']],
  [StockRequest, ['id', 'siteId', 'status']],
  [StockRequestLine, ['id', 'productId']],
  [Shipment, ['id', 'status']],
  [Package, ['id', 'shipmentId', 'status']],
]);

// The select for a relation loaded by hand, shown as depthOne would show it.
export const summaryOf = (entity: unknown) =>
  Object.fromEntries(
    (SUMMARY_COLUMNS.get(entity) ?? []).map((name) => [name, true]),
  ) as Record<string, true>;

const selectable = (metadata: EntityMetadata) =>
  metadata.columns
    .filter((column) => column.isSelect)
    .map((column) => column.propertyName);

const selectOf = (names: readonly string[]) =>
  Object.fromEntries(names.map((name) => [name, true]));

// API responses stop at depth 1 (a user's role, not the role's permissions).
// Eager loading is off because an eager relation would reach depth 2; to-many
// relations are unbounded in a list, so load those explicitly.
export function depthOne<T extends ObjectLiteral>(
  repository: Repository<T>,
): DepthOneOptions<T> {
  const { metadata } = repository;
  const select: Record<string, unknown> = selectOf(selectable(metadata));
  const relations: Record<string, boolean> = {};
  for (const relation of metadata.relations) {
    if (!relation.isManyToOne && !relation.isOneToOne) continue;
    const target = relation.inverseEntityMetadata;
    relations[relation.propertyName] = true;
    select[relation.propertyName] = selectOf(
      SUMMARY_COLUMNS.get(target.target) ?? selectable(target),
    );
  }
  return {
    select: select as FindOptionsSelect<T>,
    relations: relations as FindOptionsRelations<T>,
    loadEagerRelations: false,
  };
}

// findAndCount with depthOne, but counted without `select`: TypeORM 1.1 counts
// a find that has one with COUNT(DISTINCT <every selected column>), and MySQL
// leaves out each row where any of those columns is NULL.
export function findPageDepthOne<T extends ObjectLiteral>(
  repository: Repository<T>,
  options: Omit<FindManyOptions<T>, keyof DepthOneOptions<T>>,
): Promise<[T[], number]> {
  return Promise.all([
    repository.find({ ...depthOne(repository), ...options }),
    repository.count({ where: options.where }),
  ]);
}

// depthOne without some relations, such as the parent a child row is listed
// under (a request's lines need not repeat the request).
export function depthOneWithout<T extends ObjectLiteral>(
  repository: Repository<T>,
  ...names: string[]
): DepthOneOptions<T> {
  const options = depthOne(repository);
  const select: Record<string, unknown> = { ...options.select };
  const relations: Record<string, unknown> = { ...options.relations };
  for (const name of names) {
    delete select[name];
    delete relations[name];
  }
  return {
    ...options,
    select: select as FindOptionsSelect<T>,
    relations: relations as FindOptionsRelations<T>,
  };
}
