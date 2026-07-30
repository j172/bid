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

export interface BidValidationInput {
  /** The listing's current status, e.g. "open" or "closed". */
  status: string;
  currentPrice: number;
  bidAmount: number;
}

export type BidValidationResult = { ok: true; newPrice: number } | { ok: false; error: string };

export function validateBid(input: BidValidationInput): BidValidationResult {
  if (input.status !== "open") {
    return { ok: false, error: "這個商品已經結標，無法出價" };
  }
  if (!Number.isFinite(input.bidAmount) || input.bidAmount <= 0) {
    return { ok: false, error: "出價金額不正確" };
  }

  const minimumNextBid = getMinimumNextBid(input.currentPrice);
  if (input.bidAmount < minimumNextBid) {
    return { ok: false, error: `出價必須至少為 ${minimumNextBid}` };
  }

  return { ok: true, newPrice: input.bidAmount };
}
