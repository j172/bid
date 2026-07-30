import { describe, expect, it } from "vitest";
import { getBidIncrement, getMinimumNextBid, validateBid } from "./domain";

describe("getBidIncrement", () => {
  it("returns the smallest tier's increment for low prices", () => {
    expect(getBidIncrement(50)).toBe(10);
  });

  it("returns increasingly larger increments as price rises", () => {
    expect(getBidIncrement(200)).toBe(25);
    expect(getBidIncrement(2000)).toBe(100);
    expect(getBidIncrement(20000)).toBe(500);
  });

  it("returns the top tier's increment for very high prices", () => {
    expect(getBidIncrement(1_000_000)).toBe(1000);
  });

  it("treats each tier's upper bound as exclusive, falling into the next tier", () => {
    expect(getBidIncrement(100)).toBe(25);
    expect(getBidIncrement(99.99)).toBe(10);
  });
});

describe("getMinimumNextBid", () => {
  it("adds the tier increment to the current price", () => {
    expect(getMinimumNextBid(90)).toBe(100);
    expect(getMinimumNextBid(1000)).toBe(1100);
  });
});

describe("validateBid", () => {
  it("accepts a bid that meets the minimum exactly", () => {
    expect(validateBid({ status: "open", currentPrice: 1000, bidAmount: 1100 })).toEqual({
      ok: true,
      newPrice: 1100,
    });
  });

  it("accepts a bid above the minimum", () => {
    const result = validateBid({ status: "open", currentPrice: 1000, bidAmount: 2000 });
    expect(result).toEqual({ ok: true, newPrice: 2000 });
  });

  it("rejects a bid below the minimum with a message naming the required minimum", () => {
    const result = validateBid({ status: "open", currentPrice: 1000, bidAmount: 1050 });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("1100");
  });

  it("rejects any bid on a listing that isn't open", () => {
    const result = validateBid({ status: "closed", currentPrice: 1000, bidAmount: 5000 });
    expect(result.ok).toBe(false);
  });

  it("rejects non-finite or non-positive bid amounts", () => {
    expect(validateBid({ status: "open", currentPrice: 1000, bidAmount: NaN }).ok).toBe(false);
    expect(validateBid({ status: "open", currentPrice: 1000, bidAmount: -5 }).ok).toBe(false);
    expect(validateBid({ status: "open", currentPrice: 1000, bidAmount: 0 }).ok).toBe(false);
  });
});
