import type { EntityMetadata, ObjectLiteral } from 'typeorm';

type ColumnMetadata = EntityMetadata['columns'][number];
import { isNotAudited } from '../../common/audit/not-audited.decorator.js';

type Values = Record<string, unknown>;

function isAudited(metadata: EntityMetadata, column: ColumnMetadata): boolean {
  return (
    !column.isCreateDate &&
    !column.isUpdateDate &&
    !column.isVersion &&
    !isNotAudited(metadata.target, column.propertyName)
  );
}

function toJson(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function orNull(values: Values): Values | null {
  return Object.keys(values).length ? values : null;
}

// Every audited column that has a value (select:false columns are absent).
export function snapshot(
  metadata: EntityMetadata,
  entity: ObjectLiteral,
): Values | null {
  const values: Values = {};
  for (const column of metadata.columns) {
    const value = column.getEntityValue(entity);
    if (value !== undefined && isAudited(metadata, column)) {
      values[column.propertyName] = toJson(value);
    }
  }
  return orNull(values);
}

// Old and new values of the audited columns TypeORM reports as updated.
export function changes(
  metadata: EntityMetadata,
  before: ObjectLiteral,
  after: ObjectLiteral,
  updated: ColumnMetadata[],
): { oldValues: Values | null; newValues: Values | null } {
  const oldValues: Values = {};
  const newValues: Values = {};
  for (const column of updated) {
    if (!isAudited(metadata, column)) continue;
    const name = column.propertyName;
    oldValues[name] = toJson(column.getEntityValue(before) ?? null);
    newValues[name] = toJson(column.getEntityValue(after) ?? null);
  }
  return { oldValues: orNull(oldValues), newValues: orNull(newValues) };
}
