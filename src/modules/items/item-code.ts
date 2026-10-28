// products.lastItemNumber is INT UNSIGNED.
export const MAX_AUTO_NUMBER = 4_294_967_295;

export const itemCode = (prefix: string, suffix: string) =>
  `${prefix}-${suffix}`;

export const autoSuffix = (n: number) => String(n).padStart(6, '0');

// The counter value whose automatic code equals this typed suffix, or null
// when automatic codes can never produce it ('OLD17', '50', '0000050').
export function autoNumberOf(suffix: string): number | null {
  if (!/^[0-9]+$/.test(suffix)) return null;
  const n = Number(suffix);
  return n >= 1 && n <= MAX_AUTO_NUMBER && autoSuffix(n) === suffix ? n : null;
}
