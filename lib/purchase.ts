// Pure domain logic for fixed-price ("一般商品") listings: no bidding, a
// fixed unit price, and multi-unit stock that any number of different
// buyers can purchase from concurrently — unlike auction listings, there is
// no single "winner". See lib/bidding/domain.ts for the auction equivalent.

export interface PurchaseState {
  status: string;
  stockRemaining: number;
}

export type PurchaseOutcome = { ok: true } | { ok: false; error: string };

export function resolvePurchase(state: PurchaseState, quantity: number): PurchaseOutcome {
  if (state.status !== "open") {
    return { ok: false, error: "這個商品已經下架" };
  }
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, error: "購買數量必須是正整數" };
  }
  if (quantity > state.stockRemaining) {
    return { ok: false, error: "庫存不足" };
  }
  return { ok: true };
}
