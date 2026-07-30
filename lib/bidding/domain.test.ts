import { describe, expect, it } from "vitest";
import { getBidIncrement, getMinimumNextBid, resolveProxyBid } from "./domain";

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

describe("resolveProxyBid — no existing leader (first bid on a listing)", () => {
  it("accepts a max that meets the minimum exactly, becoming leader at that price", () => {
    expect(resolveProxyBid({ status: "open", currentPrice: 1000, leaderMaxAmount: null }, 1100)).toEqual({
      ok: true,
      currentPrice: 1100,
      leaderMaxAmount: 1100,
      youAreLeading: true,
    });
  });

  it("reveals the full max as the visible price when there's no one to shield behind", () => {
    const result = resolveProxyBid({ status: "open", currentPrice: 1000, leaderMaxAmount: null }, 5000);
    expect(result).toEqual({ ok: true, currentPrice: 5000, leaderMaxAmount: 5000, youAreLeading: true });
  });

  it("rejects a max below the minimum with a message naming the required minimum", () => {
    const result = resolveProxyBid({ status: "open", currentPrice: 1000, leaderMaxAmount: null }, 1050);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("1100");
  });

  it("rejects any bid on a listing that isn't open", () => {
    const result = resolveProxyBid({ status: "closed", currentPrice: 1000, leaderMaxAmount: null }, 5000);
    expect(result.ok).toBe(false);
  });

  it("rejects non-finite or non-positive max amounts", () => {
    expect(resolveProxyBid({ status: "open", currentPrice: 1000, leaderMaxAmount: null }, NaN).ok).toBe(false);
    expect(resolveProxyBid({ status: "open", currentPrice: 1000, leaderMaxAmount: null }, -5).ok).toBe(false);
    expect(resolveProxyBid({ status: "open", currentPrice: 1000, leaderMaxAmount: null }, 0).ok).toBe(false);
  });
});

describe("resolveProxyBid — challenger's max is higher than the current leader's", () => {
  it("makes the challenger the new leader, at one increment above the old leader's max (capped at the challenger's own max)", () => {
    // old leader's max 1100 (tier increment 100) -> new price should be 1200, capped at challenger's 5000
    const result = resolveProxyBid({ status: "open", currentPrice: 1100, leaderMaxAmount: 1100 }, 5000);
    expect(result).toEqual({ ok: true, currentPrice: 1200, leaderMaxAmount: 5000, youAreLeading: true });
  });

  it("caps the new visible price at the challenger's own max if one increment above the old leader would exceed it", () => {
    // old leader's max 5000 (revealed headroom from a prior round), increment(5000) is 250 -> 5250 would be
    // needed to fully reflect it, but the challenger's max is only 5100
    const result = resolveProxyBid({ status: "open", currentPrice: 1200, leaderMaxAmount: 5000 }, 5100);
    expect(result).toEqual({ ok: true, currentPrice: 5100, leaderMaxAmount: 5100, youAreLeading: true });
  });
});

describe("resolveProxyBid — challenger's max is lower than or equal to the current leader's", () => {
  it("keeps the existing leader in the lead, raising the visible price to just beat the challenger", () => {
    // leader's max 5000; challenger's max 1300 (>= the 1200 minimum, tier increment 100) -> visible rises to
    // 1400, capped at leader's 5000
    const result = resolveProxyBid({ status: "open", currentPrice: 1100, leaderMaxAmount: 5000 }, 1300);
    expect(result).toEqual({ ok: true, currentPrice: 1400, leaderMaxAmount: 5000, youAreLeading: false });
  });

  it("caps the visible price at the leader's own max even if that's less than a full increment above the challenger", () => {
    // leader's max only 980 (headroom from a prior round); challenger's max 950 clears the 950 minimum for a
    // currentPrice of 900 (tier increment 50) -> 950+50=1000 would be needed, but leader can't exceed 980
    const result = resolveProxyBid({ status: "open", currentPrice: 900, leaderMaxAmount: 980 }, 950);
    expect(result).toEqual({ ok: true, currentPrice: 980, leaderMaxAmount: 980, youAreLeading: false });
  });

  it("resolves a tie (equal maxes) in favor of the existing leader, at their shared max", () => {
    const result = resolveProxyBid({ status: "open", currentPrice: 1100, leaderMaxAmount: 5000 }, 5000);
    expect(result).toEqual({ ok: true, currentPrice: 5000, leaderMaxAmount: 5000, youAreLeading: false });
  });

  it("never reveals the challenger's max as the visible price", () => {
    // challenger's max 3000 (tier increment 100) -> visible rises to 3100, not the full 3000 they were willing to pay
    const result = resolveProxyBid({ status: "open", currentPrice: 1100, leaderMaxAmount: 5000 }, 3000);
    expect(result).toEqual({ ok: true, currentPrice: 3100, leaderMaxAmount: 5000, youAreLeading: false });
  });
});

describe("resolveProxyBid — validation still applies once a leader exists", () => {
  it("rejects a challenger's max below the minimum next bid over the current visible price", () => {
    // currentPrice 1100 -> minimum next bid is 1200; 1150 falls short regardless of the leader's max
    const result = resolveProxyBid({ status: "open", currentPrice: 1100, leaderMaxAmount: 5000 }, 1150);
    expect(result.ok).toBe(false);
  });

  it("rejects a bid on a closed listing even with an existing leader", () => {
    const result = resolveProxyBid({ status: "closed", currentPrice: 1100, leaderMaxAmount: 5000 }, 6000);
    expect(result.ok).toBe(false);
  });
});
