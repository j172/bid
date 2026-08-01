// Pure domain logic for fixed-price ("一般商品") listings: no bidding, a
// fixed unit price, and multi-unit stock that any number of different
// buyers can purchase from concurrently — unlike auction listings, there is
// no single "winner". See lib/bidding/domain.ts for the auction equivalent.

import type { ErrorCode } from "@/lib/errorCodes";

export interface PurchaseState {
  status: string;
  stockRemaining: number;
}

export type PurchaseOutcome = { ok: true } | { ok: false; errorCode: ErrorCode };

export function resolvePurchase(state: PurchaseState, quantity: number): PurchaseOutcome {
  if (state.status !== "open") {
    return { ok: false, errorCode: "LISTING_NOT_OPEN" };
  }
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, errorCode: "INVALID_QUANTITY" };
  }
  if (quantity > state.stockRemaining) {
    return { ok: false, errorCode: "INSUFFICIENT_STOCK" };
  }
  return { ok: true };
}
