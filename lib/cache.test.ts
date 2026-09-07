import { beforeEach, describe, expect, it, vi } from "vitest";
import { cachedQuery, clearMemoryCache, invalidateCache } from "./cache";


describe("cachedQuery", () => {
  beforeEach(() => {
    clearMemoryCache();
    vi.restoreAllMocks();
  });

  it("calls fetcher on initial cache miss", async () => {
    const fetcher = vi.fn().mockResolvedValue(["listing1", "listing2"]);
    const result = await cachedQuery("test-key", 20, fetcher);

    expect(result).toEqual(["listing1", "listing2"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns cached data on cache hit without re-calling fetcher", async () => {
    const fetcher = vi.fn().mockResolvedValue("fresh-value");
    const result1 = await cachedQuery("test-key-2", 20, fetcher);
    const result2 = await cachedQuery("test-key-2", 20, fetcher);

    expect(result1).toBe("fresh-value");
    expect(result2).toBe("fresh-value");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetches when TTL expires", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");

      const res1 = await cachedQuery("exp-key", 10, fetcher);
      expect(res1).toBe("first");
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Advance time by 11 seconds (past 10s TTL)
      vi.advanceTimersByTime(11000);

      const res2 = await cachedQuery("exp-key", 10, fetcher);
      expect(res2).toBe("second");
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("serves stale data if fetcher throws after TTL expiration (stale-if-error)", async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce("good-data")
        .mockRejectedValueOnce(new Error("MySQL connection lost"));

      const res1 = await cachedQuery("stale-key", 10, fetcher);
      expect(res1).toBe("good-data");

      // Advance time past TTL
      vi.advanceTimersByTime(15000);

      // Subsequent call fails, should fallback to good-data
      const res2 = await cachedQuery("stale-key", 10, fetcher);
      expect(res2).toBe("good-data");
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rethrows error on cold miss when no stale data exists", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("Cold error"));
    await expect(cachedQuery("cold-error-key", 20, fetcher)).rejects.toThrow("Cold error");
  });

  it("clears cache when clearMemoryCache is called", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce("val1").mockResolvedValueOnce("val2");
    await cachedQuery("clear-key", 20, fetcher);
    clearMemoryCache();
    const res = await cachedQuery("clear-key", 20, fetcher);
    expect(res).toBe("val2");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("invalidates specific key when invalidateCache is called", async () => {
    const fetcher1 = vi.fn().mockResolvedValueOnce("val1").mockResolvedValueOnce("val2");
    const fetcher2 = vi.fn().mockResolvedValueOnce("other1");
    await cachedQuery("key-1", 20, fetcher1);
    await cachedQuery("key-2", 20, fetcher2);

    invalidateCache("key-1");

    const res1 = await cachedQuery("key-1", 20, fetcher1);
    const res2 = await cachedQuery("key-2", 20, fetcher2);

    expect(res1).toBe("val2");
    expect(fetcher1).toHaveBeenCalledTimes(2);
    expect(res2).toBe("other1");
    expect(fetcher2).toHaveBeenCalledTimes(1);
  });
});

