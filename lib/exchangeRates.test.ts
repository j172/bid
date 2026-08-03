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
  syncExchangeRates,
} from "./exchangeRates";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("returns null on a non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    expect(await fetchLatestTaifexRow()).toBeNull();
  });

  it("returns null when fetch throws (network error)", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    expect(await fetchLatestTaifexRow()).toBeNull();
  });

  it("returns null when the feed has no parseable rows", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, text: async () => "日期,美元_新台幣(匯率)\n" } as Response);
    expect(await fetchLatestTaifexRow()).toBeNull();
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

    await syncExchangeRates();

    expect(queryMock).toHaveBeenCalledTimes(2);
    const [usdSql, usdParams] = queryMock.mock.calls[0];
    expect(usdSql).toContain("ON DUPLICATE KEY UPDATE");
    expect(usdParams[0]).toBe("USD");
    expect(usdParams[2]).toBe("2026-08-03"); // source_date from the feed's latest row
    expect(usdParams[3]).toBe(32.438);
    expect(queryMock.mock.calls[1][1][0]).toBe("CNY");
  });

  it("falls back to the most recent stored rate (keeping its original source_date) when the fetch fails", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    // USD fallback lookup
    queryMock.mockResolvedValueOnce([[{ currency: "USD", rate: "31.9", rate_date: "2026-08-01", source_date: "2026-07-31" }]]);
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]); // USD upsert
    // CNY fallback lookup — nothing stored at all
    queryMock.mockResolvedValueOnce([[]]);

    await syncExchangeRates();

    // USD: fallback found -> upserted with the fallback's source_date (not today)
    const usdUpsertParams = queryMock.mock.calls[1][1];
    expect(usdUpsertParams).toEqual(["USD", expect.any(String), "2026-07-31", 31.9]);
    // CNY: no fallback available -> no upsert attempted (only 3 calls total)
    expect(queryMock).toHaveBeenCalledTimes(3);
  });
});
