const NOT_AUDITED = Symbol('notAudited');
const NOT_AUDITED_ENTITY = Symbol('notAuditedEntity');

// On a column: leaves it out of the audit log (technical state such as OTP
// counters and token hashes, which would only add noise). On an entity class:
// leaves the whole entity out (one that is a history table itself).
// Audited columns whose name looks like a secret are masked, never stored.
export function NotAudited(): ClassDecorator & PropertyDecorator {
  return (target: object, property?: string | symbol) => {
    if (property === undefined) {
      Reflect.defineMetadata(NOT_AUDITED_ENTITY, true, target);
      return;
    }
    const inherited: (string | symbol)[] =
      Reflect.getMetadata(NOT_AUDITED, target.constructor) ?? [];
    Reflect.defineMetadata(
      NOT_AUDITED,
      [...inherited, property],
      target.constructor,
    );
  };
}

export function isNotAudited(entity: unknown, property: string): boolean {
  if (typeof entity !== 'function') return false;
  const excluded: (string | symbol)[] =
    Reflect.getMetadata(NOT_AUDITED, entity) ?? [];
  return excluded.includes(property);
}

export function isEntityNotAudited(entity: unknown): boolean {
  return (
    typeof entity === 'function' &&
    Reflect.getMetadata(NOT_AUDITED_ENTITY, entity) === true
  );
}
