import type { FindOptionsRelations, ObjectLiteral, Repository } from 'typeorm';

export interface DepthOneOptions<T> {
  relations: FindOptionsRelations<T>;
  loadEagerRelations: false;
}

// API responses stop at depth 1 (a user's role, not the role's permissions).
// Eager loading is off because an eager relation would reach depth 2; to-many
// relations are unbounded in a list, so load those explicitly.
export function depthOne<T extends ObjectLiteral>(
  repository: Repository<T>,
): DepthOneOptions<T> {
  const relations = Object.fromEntries(
    repository.metadata.relations
      .filter((relation) => relation.isManyToOne || relation.isOneToOne)
      .map((relation) => [relation.propertyName, true]),
  ) as FindOptionsRelations<T>;
  return { relations, loadEagerRelations: false };
}
