// Settlement (撥款) — the admin's offline "money moved, goods sent" record,
// for both of the two things that can be settled: a won auction (a row in
// `listings`) and a fixed_price order (a row in `purchases`).
//
// Both halves live here: validateSettlement below is pure form validation
// (no HTTP/DB, directly unit-testable — see settlement.test.ts), and the
// data access under it is parameterized over which table is being settled.
// Those two tables carry an identical settled_at/settlement_account/
// settlement_amount trio and had two near-identical copies of every query in
// lib/listings.ts (issue #139); the copies drifting is how one path ends up
// forgetting a guard the other has. lib/listings.ts re-exports the six
// public functions so existing `@/lib/listings` imports keep working.

import { getDb } from "@/lib/db";

export interface SettlementInput {
  account: string;
  amount: number;
}

export type SettlementValidationResult = { ok: true } | { ok: false; error: string };

const ACCOUNT_MIN = 4;
const ACCOUNT_MAX = 30;

export function validateSettlement(input: SettlementInput): SettlementValidationResult {
  const account = input.account.trim();
  if (account.length === 0) {
    return { ok: false, error: "請輸入匯款帳號" };
  }
  if (!/^[A-Za-z0-9-]+$/.test(account)) {
    return { ok: false, error: "匯款帳號只能包含英數字與橫線" };
  }
  if (account.length < ACCOUNT_MIN || account.length > ACCOUNT_MAX) {
    return { ok: false, error: `匯款帳號長度需介於 ${ACCOUNT_MIN} 到 ${ACCOUNT_MAX} 位之間` };
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0 || !Number.isInteger(input.amount)) {
    return { ok: false, error: "金額必須是正整數" };
  }

  return { ok: true };
}

// What distinguishes settling a won auction from settling an order. Every
// field is module-level SQL text, never caller input — the row id is always
// a bind param.
interface SettlementTarget {
  /** Table holding the settled_at / settlement_account / settlement_amount trio. */
  table: string;
  /**
   * Extra guard AND'd onto the row lookup. A listing is only settleable once
   * it has actually closed; a purchases row is a completed sale the moment it
   * exists, so it needs no equivalent.
   */
  guard: string;
  /** Column pointing at the counterparty in `users` — the winner, or the buyer. */
  counterpartyColumn: string;
}

const LISTING_SETTLEMENT: SettlementTarget = {
  table: "listings",
  guard: " AND status = 'closed'",
  counterpartyColumn: "leader_user_id",
};

const ORDER_SETTLEMENT: SettlementTarget = {
  table: "purchases",
  guard: "",
  counterpartyColumn: "buyer_id",
};

// Idempotent: settling twice just overwrites the previously recorded values.
async function markSettled(target: SettlementTarget, id: number, account: string, amount: number): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE ${target.table}
     SET settled_at = NOW(), settlement_account = ?, settlement_amount = ?
     WHERE id = ?${target.guard}`,
    [account, amount, id],
  );
}

// Deliberately leaves settlement_account/settlement_amount in place (not
// cleared) so the settle form can pre-fill the last-entered values when an
// admin unsettles to fix a typo and immediately re-settles.
async function unsettle(target: SettlementTarget, id: number): Promise<void> {
  const db = await getDb();
  await db.query(`UPDATE ${target.table} SET settled_at = NULL WHERE id = ?${target.guard}`, [id]);
}

/** The contact details an admin needs to actually complete the offline handover. */
export interface WinnerProfile {
  displayName: string | null;
  phone: string | null;
  address: string | null;
}

async function getCounterpartyProfile(target: SettlementTarget, id: number): Promise<WinnerProfile | null> {
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT u.display_name AS displayName, u.phone AS phone, u.address AS address
     FROM ${target.table} t
     JOIN users u ON u.id = t.${target.counterpartyColumn}
     WHERE t.id = ?
     LIMIT 1`,
    [id],
  );
  return (rows as WinnerProfile[])[0] ?? null;
}

// Admin confirms the offline payment/delivery is done — releases the winner
// from deleteAccount's "unsettled win" block (see findBlockingObligation in
// lib/listings.ts). Records the remittance account/amount the admin entered
// (validated by validateSettlement above before this is called).
export async function markListingSettled(listingId: number, account: string, amount: number): Promise<void> {
  await markSettled(LISTING_SETTLEMENT, listingId, account, amount);
}

// Reverses markListingSettled — lets an admin correct an accidental
// "settled" click, putting the winner back under deleteAccount's
// unsettled-win block until it's confirmed again.
export async function unsettleListing(listingId: number): Promise<void> {
  await unsettle(LISTING_SETTLEMENT, listingId);
}

// Powers the closed-listings page's expandable "得標者資料" section.
export async function getWinnerProfileForListing(listingId: number): Promise<WinnerProfile | null> {
  return getCounterpartyProfile(LISTING_SETTLEMENT, listingId);
}

// The three above, but per-purchase rather than per-listing — a single
// fixed_price listing can be bought by many different buyers, so settlement
// is tracked on each purchase instead of on the listing.
export async function markOrderSettled(orderId: number, account: string, amount: number): Promise<void> {
  await markSettled(ORDER_SETTLEMENT, orderId, account, amount);
}

export async function unsettleOrder(orderId: number): Promise<void> {
  await unsettle(ORDER_SETTLEMENT, orderId);
}

// Powers the orders page's expandable "買家資料" section.
export async function getBuyerProfileForOrder(orderId: number): Promise<WinnerProfile | null> {
  return getCounterpartyProfile(ORDER_SETTLEMENT, orderId);
}
