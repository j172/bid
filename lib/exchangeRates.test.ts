// parseTaifexCsv is pure (see its own header comment) and tested directly.
// Everything else touches @/lib/db (mocked, same vi.hoisted pattern as
// lib/homepageSections.test.ts) and/or global fetch (mocked per test), since
// this module is raw-SQL + HTTP rather than pure logic.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchLatestTaifexRow,
  getAllLatestStoredRates,
  getLatestStoredRate,
  parseTaifexCsv,
  SyncExchangeRatesError,
  syncExchangeRates,
} from "./exchangeRates";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
  vi.stubGlobal("fetch", vi.fn());
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// fetchLatestTaifexRow (issue #55, retry count/delay increased by #81)
// retries up to TAIFEX_FETCH_MAX_ATTEMPTS (5) times with a real delay
// (TAIFEX_FETCH_RETRY_DELAY_MS, 5s) between attempts. Not imported directly
// since they're internal to lib/exchangeRates.ts — kept in sync with that
// module's constants by hand, same as before #81 bumped them.
// vi.advanceTimersByTimeAsync flushes the microtasks in between each timer
// tick, so this lets tests exercise the retry path without actually waiting
// on wall-clock time.
async function advanceThroughRetries(delays = 4): Promise<void> {
  for (let i = 0; i < delays; i++) {
    await vi.advanceTimersByTimeAsync(5000);
  }
}

const SAMPLE_CSV = [
  "﻿日期,美元_新台幣(匯率),人民幣_新台幣(匯率),歐元_美元(匯率)",
  "20260701,31.874,4.687295,1.14005",
  "20260702,31.91,4.699896,1.14165",
  "20260803,32.438,4.80303,1.1527",
].join("\n");

describe("parseTaifexCsv", () => {
  it("parses YYYYMMDD dates into YYYY-MM-DD and pulls the USD/CNY TWD columns", () => {
    const rows = parseTaifexCsv(SAMPLE_CSV);
    expect(rows).toEqual([
      { date: "2026-07-01", usdTwd: 31.874, cnyTwd: 4.687295 },
      { date: "2026-07-02", usdTwd: 31.91, cnyTwd: 4.699896 },
      { date: "2026-08-03", usdTwd: 32.438, cnyTwd: 4.80303 },
    ]);
  });

  it("skips malformed rows instead of throwing", () => {
    const csv = ["日期,美元_新台幣(匯率),人民幣_新台幣(匯率)", "not-a-date,31.874,4.687295", "20260701,,4.687295"].join(
      "\n",
    );
    expect(parseTaifexCsv(csv)).toEqual([]);
  });

  it("ignores blank trailing lines", () => {
    const csv = `日期,美元_新台幣(匯率),人民幣_新台幣(匯率)\n20260701,31.874,4.687295\n\n`;
    expect(parseTaifexCsv(csv)).toHaveLength(1);
  });
});

describe("fetchLatestTaifexRow", () => {
  it("returns the last row of the feed (the feed is oldest-first)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_CSV } as Response);
    const row = await fetchLatestTaifexRow();
    expect(row).toEqual({ date: "2026-08-03", usdTwd: 32.438, cnyTwd: 4.80303 });
  });

  it("returns null after exhausting retries on a non-ok response, logging each attempt", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" } as Response);

    const promise = fetchLatestTaifexRow();
    await advanceThroughRetries();
    const row = await promise;

    expect(row).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(errorSpy).toHaveBeenCalledTimes(5);
    expect(errorSpy.mock.calls[0][0]).toContain("attempt 1/5");
    expect(errorSpy.mock.calls[4][0]).toContain("HTTP 500");
    errorSpy.mockRestore();
  });

  it("returns null after exhausting retries when fetch throws (network error), logging the real error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const networkError = new Error("network down");
    vi.mocked(fetch).mockRejectedValue(networkError);

    const promise = fetchLatestTaifexRow();
    await advanceThroughRetries();
    const row = await promise;

    expect(row).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(errorSpy).toHaveBeenCalledTimes(5);
    // Each log call must carry the real error object (message/name/cause all inspectable).
    expect(errorSpy.mock.calls[0][1]).toBe(networkError);
    expect(errorSpy.mock.calls[0][0]).toContain("network down");
    errorSpy.mockRestore();
  });

  // issue #81: production logs only ever showed the generic outer
  // "TypeError: fetch failed" — undici wraps the real DNS/connect/timeout
  // error under `.cause`, and any errno/code live as non-standard
  // properties on that cause. The log line itself must surface all of that
  // (not just the object passed as console.error's 2nd arg, which pm2's log
  // capture doesn't reliably render in full) so a stuck sync is diagnosable
  // straight from `pm2 logs` without SSHing in to reproduce it by hand.
  it("surfaces error.cause / error.name / errno / code in the log line when fetch throws a wrapped network error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const dnsFailure = Object.assign(new Error("getaddrinfo ENOTFOUND www.taifex.com.tw"), {
      name: "Error",
      code: "ENOTFOUND",
      errno: -3008,
    });
    // This is exactly the shape undici's fetch() produces for a lower-level
    // network failure: a generic TypeError whose .cause is the real error.
    const fetchFailedError = new TypeError("fetch failed", { cause: dnsFailure });
    vi.mocked(fetch).mockRejectedValue(fetchFailedError);

    const promise = fetchLatestTaifexRow();
    await advanceThroughRetries();
    await promise;

    const [logLine] = errorSpy.mock.calls[0];
    expect(logLine).toContain("TypeError");
    expect(logLine).toContain("fetch failed");
    expect(logLine).toContain("ENOTFOUND");
    expect(logLine).toContain("-3008");
    expect(logLine).toContain("getaddrinfo ENOTFOUND www.taifex.com.tw");
    errorSpy.mockRestore();
  });

  it("succeeds on a later attempt after earlier attempts fail (retry recovers)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("first attempt down"))
      .mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_CSV } as Response);

    const promise = fetchLatestTaifexRow();
    await advanceThroughRetries(1);
    const row = await promise;

    expect(row).toEqual({ date: "2026-08-03", usdTwd: 32.438, cnyTwd: 4.80303 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("returns null immediately (no retry) when the feed has no parseable rows", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, text: async () => "日期,美元_新台幣(匯率)\n" } as Response);
    expect(await fetchLatestTaifexRow()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("getLatestStoredRate", () => {
  it("returns null when no row exists for the currency", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    expect(await getLatestStoredRate("USD")).toBeNull();
  });

  it("maps the most recent row, ordering by rate_date desc", async () => {
    queryMock.mockResolvedValueOnce([
      [{ currency: "USD", rate: "32.438", rate_date: "2026-08-03", source_date: "2026-08-03" }],
    ]);
    const rate = await getLatestStoredRate("USD");
    expect(queryMock.mock.calls[0][0]).toContain("ORDER BY rate_date DESC");
    expect(rate).toEqual({ currency: "USD", rate: 32.438, rateDate: "2026-08-03", sourceDate: "2026-08-03" });
  });
});

describe("getAllLatestStoredRates", () => {
  it("returns both currencies keyed by code", async () => {
    queryMock.mockResolvedValueOnce([[{ currency: "USD", rate: "32", rate_date: "2026-08-03", source_date: "2026-08-03" }]]);
    queryMock.mockResolvedValueOnce([[]]);

    const rates = await getAllLatestStoredRates();

    expect(rates.USD).toEqual({ currency: "USD", rate: 32, rateDate: "2026-08-03", sourceDate: "2026-08-03" });
    expect(rates.CNY).toBeNull();
  });
});

describe("syncExchangeRates", () => {
  it("upserts today's row for both currencies from a fresh TAIFEX fetch", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_CSV } as Response);
    queryMock.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await syncExchangeRates();

    expect(queryMock).toHaveBeenCalledTimes(2);
    const [usdSql, usdParams] = queryMock.mock.calls[0];
    expect(usdSql).toContain("ON DUPLICATE KEY UPDATE");
    expect(usdParams[0]).toBe("USD");
    expect(usdParams[2]).toBe("2026-08-03"); // source_date from the feed's latest row
    expect(usdParams[3]).toBe(32.438);
    expect(queryMock.mock.calls[1][1][0]).toBe("CNY");

    expect(result).toEqual({
      fetchedFresh: true,
      updated: [
        { currency: "USD", rate: 32.438, sourceDate: "2026-08-03", usedFallback: false },
        { currency: "CNY", rate: 4.80303, sourceDate: "2026-08-03", usedFallback: false },
      ],
      failed: [],
    });
  });

  it("falls back to the most recent stored rate (keeping its original source_date) when the fetch fails, and resolves when a fallback exists for every currency", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    // USD fallback lookup
    queryMock.mockResolvedValueOnce([[{ currency: "USD", rate: "31.9", rate_date: "2026-08-01", source_date: "2026-07-31" }]]);
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]); // USD upsert
    // CNY fallback lookup — also has a stored value
    queryMock.mockResolvedValueOnce([[{ currency: "CNY", rate: "4.7", rate_date: "2026-08-01", source_date: "2026-07-31" }]]);
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]); // CNY upsert

    const promise = syncExchangeRates();
    await advanceThroughRetries();
    const result = await promise;
    errorSpy.mockRestore();

    // USD: fallback found -> upserted with the fallback's source_date (not today)
    const usdUpsertParams = queryMock.mock.calls[1][1];
    expect(usdUpsertParams).toEqual(["USD", expect.any(String), "2026-07-31", 31.9]);
    expect(queryMock).toHaveBeenCalledTimes(4);
    expect(result.fetchedFresh).toBe(false);
    expect(result.failed).toEqual([]);
    expect(result.updated).toEqual([
      { currency: "USD", rate: 31.9, sourceDate: "2026-07-31", usedFallback: true },
      { currency: "CNY", rate: 4.7, sourceDate: "2026-07-31", usedFallback: true },
    ]);
  });

  // issue #55: previously a currency with neither a fresh row nor a stored
  // fallback was silently skipped, so scheduler.ts's catch (and any caller)
  // never learned the sync had actually failed. It must now throw so that
  // log line — and the admin manual-sync button — can surface the failure.
  it("throws SyncExchangeRatesError when a currency has neither a fresh row nor any fallback", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    // USD fallback lookup
    queryMock.mockResolvedValueOnce([[{ currency: "USD", rate: "31.9", rate_date: "2026-08-01", source_date: "2026-07-31" }]]);
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]); // USD upsert
    // CNY fallback lookup — nothing stored at all
    queryMock.mockResolvedValueOnce([[]]);

    const promise = syncExchangeRates();
    promise.catch(() => {}); // avoid a Vitest "unhandled rejection" false-positive before the awaits below
    await advanceThroughRetries();
    await expect(promise).rejects.toThrow(SyncExchangeRatesError);
    errorSpy.mockRestore();

    // USD still got written even though CNY ultimately failed.
    const usdUpsertParams = queryMock.mock.calls[1][1];
    expect(usdUpsertParams).toEqual(["USD", expect.any(String), "2026-07-31", 31.9]);
    expect(queryMock).toHaveBeenCalledTimes(3);
  });

  it("SyncExchangeRatesError carries the partial result (which currencies failed)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    queryMock.mockResolvedValueOnce([[]]); // USD: no fallback either
    queryMock.mockResolvedValueOnce([[]]); // CNY: no fallback either

    const promise = syncExchangeRates();
    promise.catch(() => {}); // avoid a Vitest "unhandled rejection" false-positive before the awaits below
    await advanceThroughRetries();

    try {
      await promise;
      expect.unreachable("expected syncExchangeRates to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SyncExchangeRatesError);
      expect((error as SyncExchangeRatesError).result).toEqual({
        fetchedFresh: false,
        updated: [],
        failed: ["USD", "CNY"],
      });
    }
    errorSpy.mockRestore();
  });
});
