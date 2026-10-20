const NOT_AUDITED = Symbol('notAudited');

// Leaves an entity column out of the audit log: technical state (OTP counters,
// token hashes) that would only add noise. Audited columns whose name looks
// like a secret (password, hash, token...) are masked, never stored.
export function NotAudited(): PropertyDecorator {
  return (target, property) => {
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
