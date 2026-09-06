import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_INDEXNOW_KEY,
  getIndexNowKey,
  getIndexNowKeyLocation,
  submitToIndexNow,
} from "./indexnow";

describe("lib/indexnow", () => {
  const originalEnv = process.env.INDEXNOW_KEY;

  beforeEach(() => {
    delete process.env.INDEXNOW_KEY;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.INDEXNOW_KEY = originalEnv;
    } else {
      delete process.env.INDEXNOW_KEY;
    }
    vi.restoreAllMocks();
  });

  it("returns default key and overridable environment variable", () => {
    expect(getIndexNowKey()).toBe(DEFAULT_INDEXNOW_KEY);

    process.env.INDEXNOW_KEY = "custom_key_12345678";
    expect(getIndexNowKey()).toBe("custom_key_12345678");
  });

  it("constructs keyLocation correctly", () => {
    expect(getIndexNowKeyLocation("https://xiangshuicn.cc")).toBe(
      `https://xiangshuicn.cc/${DEFAULT_INDEXNOW_KEY}.txt`,
    );
  });

  it("handles empty URL list gracefully without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await submitToIndexNow([]);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends valid IndexNow payload and handles 200/202 responses", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => "OK",
    } as Response);

    const urls = [
      "https://xiangshuicn.cc/news/1",
      "https://xiangshuicn.cc/listings/10",
      "https://xiangshuicn.cc/news/1", // duplicate should be deduped
    ];

    const result = await submitToIndexNow(urls);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, options] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe("https://api.indexnow.org/indexnow");
    expect(options?.method).toBe("POST");

    const body = JSON.parse(options?.body as string);
    expect(body.host).toBe("xiangshuicn.cc");
    expect(body.key).toBe(DEFAULT_INDEXNOW_KEY);
    expect(body.keyLocation).toBe(`https://xiangshuicn.cc/${DEFAULT_INDEXNOW_KEY}.txt`);
    expect(body.urlList).toEqual([
      "https://xiangshuicn.cc/news/1",
      "https://xiangshuicn.cc/listings/10",
    ]);
  });

  it("handles non-200 responses gracefully without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 400,
      ok: false,
      text: async () => "Bad Request",
    } as Response);

    const result = await submitToIndexNow(["https://xiangshuicn.cc/news/1"]);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain("400");
  });

  it("handles network failure gracefully without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network connection reset"));

    const result = await submitToIndexNow(["https://xiangshuicn.cc/news/1"]);
    expect(result.ok).toBe(false);
    expect(result.count).toBe(0);
    expect(result.error).toContain("Network connection reset");
  });
});
