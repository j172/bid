// Pure bidding domain logic: no HTTP, no database. Callable and testable as
// plain functions/state transitions (see domain.test.ts).

export interface IncrementTier {
  /** Exclusive upper bound of current price for this tier; Infinity for the last tier. */
  upTo: number;
  increment: number;
}

// Global, listing-independent schedule: the minimum increment grows in
// steps as the current price rises. Not configurable per-listing in this
// scope (see the spec's Implementation Decisions).
export const BID_INCREMENT_TIERS: readonly IncrementTier[] = [
  { upTo: 100, increment: 10 },
  { upTo: 500, increment: 25 },
  { upTo: 1_000, increment: 50 },
  { upTo: 5_000, increment: 100 },
  { upTo: 10_000, increment: 250 },
  { upTo: 50_000, increment: 500 },
  { upTo: Infinity, increment: 1_000 },
];

export function getBidIncrement(currentPrice: number): number {
  const tier = BID_INCREMENT_TIERS.find((t) => currentPrice < t.upTo);
  return (tier ?? BID_INCREMENT_TIERS[BID_INCREMENT_TIERS.length - 1]).increment;
}

export function getMinimumNextBid(currentPrice: number): number {
  return currentPrice + getBidIncrement(currentPrice);
}

export interface ProxyBidState {
  /** The listing's current status, e.g. "open" or "closed". */
  status: string;
  currentPrice: number;
  /** The existing leader's private max, or null if no one has bid yet. */
  leaderMaxAmount: number | null;
}

export interface ProxyBidResult {
  ok: true;
  /** The new visible price, shown to everyone. */
  currentPrice: number;
  /** The new leader's private max — never shown to anyone but them. */
  leaderMaxAmount: number;
  /** Whether the bidder who just submitted this max is now the leader. */
  youAreLeading: boolean;
}

export type ProxyBidOutcome = ProxyBidResult | { ok: false; error: string };

// Standard proxy ("eBay-style") auction resolution. Every bid is a private
// max; only the resulting visible price is ever shown. A lone/first bid
// reveals its own max as the visible price (no competing max to shield
// behind). Once a leader exists, resolving a new max against it always
// nets a visible price strictly between the two maxes (or exactly at the
// lower one, on a tie) — never the challenger's full max when they lose,
// and never less than what's needed to have beaten the prior state.
export function resolveProxyBid(state: ProxyBidState, maxAmount: number): ProxyBidOutcome {
  if (state.status !== "open") {
    return { ok: false, error: "這個商品已經結標，無法出價" };
  }
  if (!Number.isFinite(maxAmount) || maxAmount <= 0) {
    return { ok: false, error: "出價金額不正確" };
  }

  const minimumNextBid = getMinimumNextBid(state.currentPrice);
  if (maxAmount < minimumNextBid) {
    return { ok: false, error: `出價必須至少為 ${minimumNextBid}` };
  }

  if (state.leaderMaxAmount === null) {
    return { ok: true, currentPrice: maxAmount, leaderMaxAmount: maxAmount, youAreLeading: true };
  }

  if (maxAmount > state.leaderMaxAmount) {
    const newPrice = Math.min(maxAmount, state.leaderMaxAmount + getBidIncrement(state.leaderMaxAmount));
    return { ok: true, currentPrice: newPrice, leaderMaxAmount: maxAmount, youAreLeading: true };
  }

  const newPrice = Math.min(state.leaderMaxAmount, maxAmount + getBidIncrement(maxAmount));
  return { ok: true, currentPrice: newPrice, leaderMaxAmount: state.leaderMaxAmount, youAreLeading: false };
}

// Anti-sniping: a bid landing inside this trailing window before the
// current end time pushes the end time back by the same window. Applying
// it repeatedly (each call re-reads the listing's latest end_time) is what
// makes it chain on repeated late bids.
export const ANTI_SNIPE_WINDOW_MS = 5 * 60 * 1000;

export function extendEndTimeIfNeeded(endsAt: Date, bidTime: Date): Date {
  const remainingMs = endsAt.getTime() - bidTime.getTime();
  if (remainingMs > 0 && remainingMs <= ANTI_SNIPE_WINDOW_MS) {
    return new Date(bidTime.getTime() + ANTI_SNIPE_WINDOW_MS);
  }
  return endsAt;
}
