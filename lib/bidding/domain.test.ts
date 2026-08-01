import { describe, expect, it } from "vitest";
import {
  ANTI_SNIPE_WINDOW_MS,
  extendEndTimeIfNeeded,
  getBidIncrement,
  getMinimumNextBid,
  resolveBuyNow,
  resolveProxyBid,
} from "./domain";

// A buy-it-now price high enough to be irrelevant to tests that aren't
// specifically about the buy-it-now threshold.
const NO_BIN = 999_999;

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
    expect(
      resolveProxyBid({ status: "open", currentPrice: 1000, leaderMaxAmount: null, buyItNowPrice: NO_BIN }, 1100),
    ).toEqual({
      ok: true,
      currentPrice: 1100,
      leaderMaxAmount: 1100,
      youAreLeading: true,
      closedViaBuyItNow: false,
    });
  });

  it("reveals the full max as the visible price when there's no one to shield behind", () => {
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1000, leaderMaxAmount: null, buyItNowPrice: NO_BIN },
      5000,
    );
    expect(result).toEqual({
      ok: true,
      currentPrice: 5000,
      leaderMaxAmount: 5000,
      youAreLeading: true,
      closedViaBuyItNow: false,
    });
  });

  it("rejects a max below the minimum, reporting the required minimum for the client to interpolate", () => {
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1000, leaderMaxAmount: null, buyItNowPrice: NO_BIN },
      1050,
    );
    expect(result).toEqual({ ok: false, errorCode: "BID_TOO_LOW", minimumNextBid: 1100 });
  });

  it("rejects any bid on a listing that isn't open", () => {
    const result = resolveProxyBid(
      { status: "closed", currentPrice: 1000, leaderMaxAmount: null, buyItNowPrice: NO_BIN },
      5000,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-finite or non-positive max amounts", () => {
    const base = { status: "open", currentPrice: 1000, leaderMaxAmount: null, buyItNowPrice: NO_BIN } as const;
    expect(resolveProxyBid(base, NaN).ok).toBe(false);
    expect(resolveProxyBid(base, -5).ok).toBe(false);
    expect(resolveProxyBid(base, 0).ok).toBe(false);
  });
});

describe("resolveProxyBid — challenger's max is higher than the current leader's", () => {
  it("makes the challenger the new leader, at one increment above the old leader's max (capped at the challenger's own max)", () => {
    // old leader's max 1100 (tier increment 100) -> new price should be 1200, capped at challenger's 5000
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1100, leaderMaxAmount: 1100, buyItNowPrice: NO_BIN },
      5000,
    );
    expect(result).toEqual({
      ok: true,
      currentPrice: 1200,
      leaderMaxAmount: 5000,
      youAreLeading: true,
      closedViaBuyItNow: false,
    });
  });

  it("caps the new visible price at the challenger's own max if one increment above the old leader would exceed it", () => {
    // old leader's max 5000 (revealed headroom from a prior round), increment(5000) is 250 -> 5250 would be
    // needed to fully reflect it, but the challenger's max is only 5100
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1200, leaderMaxAmount: 5000, buyItNowPrice: NO_BIN },
      5100,
    );
    expect(result).toEqual({
      ok: true,
      currentPrice: 5100,
      leaderMaxAmount: 5100,
      youAreLeading: true,
      closedViaBuyItNow: false,
    });
  });
});

describe("resolveProxyBid — challenger's max is lower than or equal to the current leader's", () => {
  it("keeps the existing leader in the lead, raising the visible price to just beat the challenger", () => {
    // leader's max 5000; challenger's max 1300 (>= the 1200 minimum, tier increment 100) -> visible rises to
    // 1400, capped at leader's 5000
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1100, leaderMaxAmount: 5000, buyItNowPrice: NO_BIN },
      1300,
    );
    expect(result).toEqual({
      ok: true,
      currentPrice: 1400,
      leaderMaxAmount: 5000,
      youAreLeading: false,
      closedViaBuyItNow: false,
    });
  });

  it("caps the visible price at the leader's own max even if that's less than a full increment above the challenger", () => {
    // leader's max only 980 (headroom from a prior round); challenger's max 950 clears the 950 minimum for a
    // currentPrice of 900 (tier increment 50) -> 950+50=1000 would be needed, but leader can't exceed 980
    const result = resolveProxyBid(
      { status: "open", currentPrice: 900, leaderMaxAmount: 980, buyItNowPrice: NO_BIN },
      950,
    );
    expect(result).toEqual({
      ok: true,
      currentPrice: 980,
      leaderMaxAmount: 980,
      youAreLeading: false,
      closedViaBuyItNow: false,
    });
  });

  it("resolves a tie (equal maxes) in favor of the existing leader, at their shared max", () => {
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1100, leaderMaxAmount: 5000, buyItNowPrice: NO_BIN },
      5000,
    );
    expect(result).toEqual({
      ok: true,
      currentPrice: 5000,
      leaderMaxAmount: 5000,
      youAreLeading: false,
      closedViaBuyItNow: false,
    });
  });

  it("never reveals the challenger's max as the visible price", () => {
    // challenger's max 3000 (tier increment 100) -> visible rises to 3100, not the full 3000 they were willing to pay
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1100, leaderMaxAmount: 5000, buyItNowPrice: NO_BIN },
      3000,
    );
    expect(result).toEqual({
      ok: true,
      currentPrice: 3100,
      leaderMaxAmount: 5000,
      youAreLeading: false,
      closedViaBuyItNow: false,
    });
  });
});

describe("resolveProxyBid — validation still applies once a leader exists", () => {
  it("rejects a challenger's max below the minimum next bid over the current visible price", () => {
    // currentPrice 1100 -> minimum next bid is 1200; 1150 falls short regardless of the leader's max
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1100, leaderMaxAmount: 5000, buyItNowPrice: NO_BIN },
      1150,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a bid on a closed listing even with an existing leader", () => {
    const result = resolveProxyBid(
      { status: "closed", currentPrice: 1100, leaderMaxAmount: 5000, buyItNowPrice: NO_BIN },
      6000,
    );
    expect(result.ok).toBe(false);
  });
});

describe("resolveProxyBid — auto-triggered buyout when the resolved price reaches the buy-it-now price", () => {
  it("caps the price at buyItNowPrice and flags closedViaBuyItNow when a new leader's resolved price would reach it", () => {
    // no existing leader; first bid's max (6000) itself reaches/exceeds the BIN price (5000)
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1000, leaderMaxAmount: null, buyItNowPrice: 5000 },
      6000,
    );
    expect(result).toEqual({
      ok: true,
      currentPrice: 5000,
      leaderMaxAmount: 6000,
      youAreLeading: true,
      closedViaBuyItNow: true,
    });
  });

  it("caps at buyItNowPrice when a challenger overtakes the leader and the resolved price would reach it", () => {
    // old leader's max 5000, increment 250 -> would resolve to 5250, but BIN is 5100 -> capped there, closed
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1200, leaderMaxAmount: 5000, buyItNowPrice: 5100 },
      6000,
    );
    expect(result).toEqual({
      ok: true,
      currentPrice: 5100,
      leaderMaxAmount: 6000,
      youAreLeading: true,
      closedViaBuyItNow: true,
    });
  });

  it("caps at buyItNowPrice even when the existing leader (not the challenger) is the one who ends up winning", () => {
    // leader's own max (6000) comfortably exceeds BIN (5100); a challenger at 5000 (still <= leader's max, so the
    // leader stays in front) pushes the visible price to min(6000, 5000+250)=5250, which reaches/exceeds BIN ->
    // closes with the EXISTING leader winning at 5100, not the challenger
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1100, leaderMaxAmount: 6000, buyItNowPrice: 5100 },
      5000,
    );
    expect(result).toEqual({
      ok: true,
      currentPrice: 5100,
      leaderMaxAmount: 6000,
      youAreLeading: false,
      closedViaBuyItNow: true,
    });
  });

  it("triggers off the winner's actual cap, not the increment-suppressed visible price, when a weak prior leader lets a huge new max win cheaply", () => {
    // prior leader's max is tiny (5); a new bidder's max (5000) trounces it, but the increment formula only
    // raises the visible price to 5+10=15 -- far below BIN (1000). The new leader's real cap (5000) still
    // reaches/exceeds BIN, so this must close at 1000, not stay open at a visible price of 15.
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1, leaderMaxAmount: 5, buyItNowPrice: 1000 },
      5000,
    );
    expect(result).toEqual({
      ok: true,
      currentPrice: 1000,
      leaderMaxAmount: 5000,
      youAreLeading: true,
      closedViaBuyItNow: true,
    });
  });

  it("does not trigger when the resolved price stays below the buy-it-now price", () => {
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1000, leaderMaxAmount: null, buyItNowPrice: 5000 },
      1200,
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.closedViaBuyItNow).toBe(false);
  });

  it("triggers exactly at the buy-it-now price, not only when strictly exceeding it", () => {
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1000, leaderMaxAmount: null, buyItNowPrice: 5000 },
      5000,
    );
    expect(result).toEqual({
      ok: true,
      currentPrice: 5000,
      leaderMaxAmount: 5000,
      youAreLeading: true,
      closedViaBuyItNow: true,
    });
  });
});

describe("resolveProxyBid — no buy-it-now price (buyItNowPrice: null)", () => {
  it("never auto-triggers closedViaBuyItNow, even at a very high resolved price", () => {
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1000, leaderMaxAmount: null, buyItNowPrice: null },
      1_000_000,
    );
    expect(result).toEqual({
      ok: true,
      currentPrice: 1_000_000,
      leaderMaxAmount: 1_000_000,
      youAreLeading: true,
      closedViaBuyItNow: false,
    });
  });

  it("never auto-triggers even when a challenger overtakes an existing leader at a huge max", () => {
    const result = resolveProxyBid(
      { status: "open", currentPrice: 1100, leaderMaxAmount: 5000, buyItNowPrice: null },
      1_000_000,
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.closedViaBuyItNow).toBe(false);
  });
});

describe("resolveBuyNow", () => {
  it("succeeds on an open listing regardless of any prior bids, selling at the buy-it-now price", () => {
    expect(resolveBuyNow({ status: "open", buyItNowPrice: 5000 })).toEqual({ ok: true, finalPrice: 5000 });
  });

  it("rejects a listing that isn't open", () => {
    const result = resolveBuyNow({ status: "closed", buyItNowPrice: 5000 });
    expect(result.ok).toBe(false);
  });

  it("rejects a listing that has no buy-it-now price", () => {
    const result = resolveBuyNow({ status: "open", buyItNowPrice: null });
    expect(result.ok).toBe(false);
  });
});

describe("extendEndTimeIfNeeded", () => {
  const endsAt = new Date("2026-01-01T12:00:00Z");

  it("extends the end time when the bid lands inside the trailing window", () => {
    const bidTime = new Date(endsAt.getTime() - 60_000); // 1 minute before the deadline
    const result = extendEndTimeIfNeeded(endsAt, bidTime);
    expect(result.getTime()).toBe(bidTime.getTime() + ANTI_SNIPE_WINDOW_MS);
  });

  it("extends when the bid lands exactly at the start of the trailing window", () => {
    const bidTime = new Date(endsAt.getTime() - ANTI_SNIPE_WINDOW_MS);
    const result = extendEndTimeIfNeeded(endsAt, bidTime);
    expect(result.getTime()).toBe(bidTime.getTime() + ANTI_SNIPE_WINDOW_MS);
  });

  it("does not change the end time for a bid well outside the trailing window", () => {
    const bidTime = new Date(endsAt.getTime() - ANTI_SNIPE_WINDOW_MS - 60_000); // one minute earlier than the window
    const result = extendEndTimeIfNeeded(endsAt, bidTime);
    expect(result.getTime()).toBe(endsAt.getTime());
  });

  it("does not extend for a bid at or after the end time (already past the deadline)", () => {
    expect(extendEndTimeIfNeeded(endsAt, endsAt).getTime()).toBe(endsAt.getTime());
    expect(extendEndTimeIfNeeded(endsAt, new Date(endsAt.getTime() + 1000)).getTime()).toBe(endsAt.getTime());
  });

  it("chains: a second late bid extends again from the already-extended end time", () => {
    const firstBidTime = new Date(endsAt.getTime() - 60_000);
    const extendedOnce = extendEndTimeIfNeeded(endsAt, firstBidTime);

    const secondBidTime = new Date(extendedOnce.getTime() - 30_000); // still inside the window relative to the new deadline
    const extendedTwice = extendEndTimeIfNeeded(extendedOnce, secondBidTime);

    expect(extendedTwice.getTime()).toBe(secondBidTime.getTime() + ANTI_SNIPE_WINDOW_MS);
    expect(extendedTwice.getTime()).toBeGreaterThan(extendedOnce.getTime());
  });
});
