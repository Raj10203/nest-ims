import type {
  EntityMetadata,
  FindOptionsRelations,
  FindOptionsSelect,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { User } from '../../entities/user.entity.js';

export interface DepthOneOptions<T> {
  select: FindOptionsSelect<T>;
  relations: FindOptionsRelations<T>;
  loadEagerRelations: false;
}

// A related user (createdBy, incharge, ...) is shown as a summary: the email and
// account status stay behind the users read scope, which returns 404 outside it.
const SUMMARY_COLUMNS = new Map<unknown, readonly string[]>([
  [User, ['id', 'firstName', 'middleName', 'lastName']],
]);

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
