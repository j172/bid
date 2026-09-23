// issue #344: submitToIndexNow() moved from the global fetch() to
// httpsRequest() (see lib/httpsRequest.ts for why), so the network layer
// under test here is @/lib/httpsRequest — mocked the same way
// lib/translate.test.ts mocks it, rather than spying on globalThis.fetch.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_INDEXNOW_KEY,
  getIndexNowKey,
  getIndexNowKeyLocation,
  submitToIndexNow,
} from "./indexnow";

const { httpsRequestMock } = vi.hoisted(() => ({ httpsRequestMock: vi.fn() }));

vi.mock("@/lib/httpsRequest", () => ({
  httpsRequest: httpsRequestMock,
}));

describe("lib/indexnow", () => {
  const originalEnv = process.env.INDEXNOW_KEY;

  beforeEach(() => {
    delete process.env.INDEXNOW_KEY;
    httpsRequestMock.mockReset();
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

  it("handles empty URL list gracefully without calling httpsRequest", async () => {
    const result = await submitToIndexNow([]);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
    expect(httpsRequestMock).not.toHaveBeenCalled();
  });

  it("sends valid IndexNow payload (with an 8s timeout) and handles 200/202 responses", async () => {
    httpsRequestMock.mockResolvedValueOnce({ status: 200, body: "OK" });

    const urls = [
      "https://xiangshuicn.cc/news/1",
      "https://xiangshuicn.cc/listings/10",
      "https://xiangshuicn.cc/news/1", // duplicate should be deduped
    ];

    const result = await submitToIndexNow(urls);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);

    expect(httpsRequestMock).toHaveBeenCalledTimes(1);
    const [calledUrl, options] = httpsRequestMock.mock.calls[0];
    expect(calledUrl).toBe("https://api.indexnow.org/indexnow");
    expect(options.method).toBe("POST");
    expect(options.timeoutMs).toBe(8000);

    const body = JSON.parse(options.body as string);
    expect(body.host).toBe("xiangshuicn.cc");
    expect(body.key).toBe(DEFAULT_INDEXNOW_KEY);
    expect(body.keyLocation).toBe(`https://xiangshuicn.cc/${DEFAULT_INDEXNOW_KEY}.txt`);
    expect(body.urlList).toEqual([
      "https://xiangshuicn.cc/news/1",
      "https://xiangshuicn.cc/listings/10",
    ]);
  });

  it("handles non-200 responses gracefully without throwing", async () => {
    httpsRequestMock.mockResolvedValueOnce({ status: 400, body: "Bad Request" });

    const result = await submitToIndexNow(["https://xiangshuicn.cc/news/1"]);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain("400");
  });

  it("handles network failure gracefully without throwing", async () => {
    httpsRequestMock.mockRejectedValueOnce(new Error("Network connection reset"));

    const result = await submitToIndexNow(["https://xiangshuicn.cc/news/1"]);
    expect(result.ok).toBe(false);
    expect(result.count).toBe(0);
    expect(result.error).toContain("Network connection reset");
  });
});
