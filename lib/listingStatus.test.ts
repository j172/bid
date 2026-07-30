import { describe, expect, it } from "vitest";
import { isPollableStatus, parseListingStatusResponse } from "./listingStatus";

describe("parseListingStatusResponse", () => {
  it("accepts a well-formed payload", () => {
    const result = parseListingStatusResponse({
      ok: true,
      currentPrice: 1100,
      endsAt: "2026-08-01T00:00:00.000Z",
      status: "open",
    });
    expect(result).toEqual({ currentPrice: 1100, endsAt: "2026-08-01T00:00:00.000Z", status: "open" });
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
    expect(parseListingStatusResponse({ ok: true, currentPrice: 1100, endsAt: "2026-08-01T00:00:00.000Z", status: "" })).toBeNull();
    expect(parseListingStatusResponse({ ok: true, currentPrice: 1100, endsAt: "2026-08-01T00:00:00.000Z" })).toBeNull();
  });
});

describe("isPollableStatus", () => {
  it("is true only for open listings", () => {
    expect(isPollableStatus("open")).toBe(true);
  });

  it("is false for closed or any other terminal status", () => {
    expect(isPollableStatus("closed")).toBe(false);
    expect(isPollableStatus("sold")).toBe(false);
    expect(isPollableStatus("")).toBe(false);
  });
});
