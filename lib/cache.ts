// Lightweight in-memory TTL cache helper for read-heavy public database queries (issue #189).
// Keeps server response times (TTFB) in the double-digit ms range for PageSpeed Insights,
// while stale-if-error ensures transient DB hiccup doesn't crash the homepage.

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

/**
 * Executes `fetcher` and caches the result for `ttlSeconds`.
 * If an error occurs and a stale entry exists, returns the stale entry (stale-if-error).
 * If no stale entry exists, rethrows the error.
 */
export async function cachedQuery<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;

  if (cached && now < cached.expiresAt) {
    return cached.data;
  }

  try {
    const data = await fetcher();
    memoryCache.set(key, {
      data,
      expiresAt: now + ttlSeconds * 1000,
    });
    return data;
  } catch (error) {
    // Stale-if-error fallback: if we have a previous value, return it rather than failing
    if (cached) {
      console.warn(`[cachedQuery] fetcher failed for key "${key}", serving stale data:`, error);
      return cached.data;
    }
    throw error;
  }
}

/**
 * Clears the in-memory cache (primarily for testing).
 */
export function clearMemoryCache(): void {
  memoryCache.clear();
}
