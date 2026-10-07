const camelKey = (key: string): string =>
  key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());

export const camelize = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(camelize) as T;
  if (value instanceof Date || value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      camelKey(key),
      camelize(nested),
    ]),
  ) as T;
};
