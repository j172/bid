import { describe, expect, it } from "vitest";
import { isPollableStatus, parseListingStatusResponse } from "./listingStatus";

describe("parseListingStatusResponse", () => {
  it("accepts a well-formed payload", () => {
    const result = parseListingStatusResponse({
      ok: true,
      currentPrice: 1100,
      endsAt: "2026-08-01T00:00:00.000Z",
      startsAt: null,
      status: "open",
    });
    expect(result).toEqual({
      currentPrice: 1100,
      endsAt: "2026-08-01T00:00:00.000Z",
      startsAt: null,
      status: "open",
    });
  });

  it("accepts a well-formed payload with a scheduled startsAt", () => {
    const result = parseListingStatusResponse({
      ok: true,
      currentPrice: 1100,
      endsAt: "2026-08-01T00:00:00.000Z",
      startsAt: "2026-07-01T00:00:00.000Z",
      status: "scheduled",
    });
    expect(result).toEqual({
      currentPrice: 1100,
      endsAt: "2026-08-01T00:00:00.000Z",
      startsAt: "2026-07-01T00:00:00.000Z",
      status: "scheduled",
    });
  });

  it("rejects an unparseable startsAt", () => {
    expect(
      parseListingStatusResponse({
        ok: true,
        currentPrice: 1100,
        endsAt: "2026-08-01T00:00:00.000Z",
        startsAt: "not-a-date",
        status: "scheduled",
      }),
    ).toBeNull();
  });

  it("rejects a response with ok: false", () => {
    expect(parseListingStatusResponse({ ok: false, error: "找不到這個商品" })).toBeNull();
  });

  it("rejects non-object bodies", () => {
    expect(parseListingStatusResponse(null)).toBeNull();
    expect(parseListingStatusResponse(undefined)).toBeNull();
    expect(parseListingStatusResponse("oops")).toBeNull();
    expect(parseListingStatusResponse(42)).toBeNull();
  });

  it("rejects a non-finite or missing currentPrice", () => {
    expect(
      parseListingStatusResponse({ ok: true, currentPrice: NaN, endsAt: "2026-08-01T00:00:00.000Z", status: "open" }),
    ).toBeNull();
    expect(
      parseListingStatusResponse({ ok: true, currentPrice: "1100", endsAt: "2026-08-01T00:00:00.000Z", status: "open" }),
    ).toBeNull();
  });

  it("rejects an unparseable endsAt", () => {
    expect(parseListingStatusResponse({ ok: true, currentPrice: 1100, endsAt: "not-a-date", status: "open" })).toBeNull();
  });

  it("rejects a missing or empty status", () => {
    expect(
      parseListingStatusResponse({ ok: true, currentPrice: 1100, endsAt: "2026-08-01T00:00:00.000Z", startsAt: null, status: "" }),
    ).toBeNull();
    expect(
      parseListingStatusResponse({ ok: true, currentPrice: 1100, endsAt: "2026-08-01T00:00:00.000Z", startsAt: null }),
    ).toBeNull();
  });
});

describe("isPollableStatus", () => {
  it("is true for open and scheduled listings", () => {
    expect(isPollableStatus("open")).toBe(true);
    expect(isPollableStatus("scheduled")).toBe(true);
  });

  it("is false for closed or any other terminal status", () => {
    expect(isPollableStatus("closed")).toBe(false);
    expect(isPollableStatus("sold")).toBe(false);
    expect(isPollableStatus("")).toBe(false);
  });
});
