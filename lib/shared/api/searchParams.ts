// Next hands search params through as `string | string[] | undefined`
// (a param can legitimately repeat: ?tag=a&tag=b). Every page in this app
// wants the first value, and four of them had grown their own local `first`
// or inline `Array.isArray(...) ? ...[0] : ...` to get it (issue #139
// items 8 and 13).

export type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a possibly-repeated search param, or undefined. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** First value parsed as a finite number, or undefined when absent/unparseable. */
export function numberParam(value: string | string[] | undefined): number | undefined {
  const raw = firstParam(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Builds a query string from the given keys, carrying each one's current
 * value through unless `overrides` supplies a replacement. Empty values are
 * dropped so a bare path stays bare.
 *
 * Key order follows `keys`, which keeps generated URLs stable.
 */
export function buildQuery(
  params: SearchParams,
  keys: readonly string[],
  overrides: Record<string, string> = {},
): string {
  const query = new URLSearchParams();
  for (const key of keys) {
    const value = key in overrides ? overrides[key] : firstParam(params[key]);
    if (value) query.set(key, value);
  }
  return query.toString();
}
