const SECRET_KEY =
  /pass(word)?|secret|token|otp|hash|authorization|cookie|api[-_]?key/i;
const MASK = '[REDACTED]';
const MAX_DEPTH = 8;
const MAX_STRING = 10_000;

export function maskSecrets(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}...[truncated]`
      : value;
  }
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[MaxDepth]';
  if (Array.isArray(value)) {
    return value.map((item) => maskSecrets(item, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEY.test(key) ? MASK : maskSecrets(item, depth + 1),
    ]),
  );
}
