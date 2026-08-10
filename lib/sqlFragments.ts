// Raw-SQL fragments shared by more than one query module. This project
// deliberately has no ORM/query builder (see lib/db.ts), so the same
// business definitions kept getting re-typed into each module's SQL — and
// drifted apart when only some copies were updated (issue #139: totalGmv in
// lib/listings.ts silently counted zero-bid expired auctions that every
// lib/dashboard.ts GMV query already excluded). These constants exist so
// each definition has exactly one home; anything interpolated here is
// module-level SQL text, never caller input.

// Auction listings only count towards GMV once they closed *with a winner*.
// A listing that expires without a single bid still ends up status =
// 'closed' with current_price left at starting_price (see
// closeExpiredListings' comment in lib/listings.ts) — counting those would
// invent revenue that was never earned, so leader_user_id IS NOT NULL is
// what separates a real sale from a 流標.
export const SOLD_AUCTION_CONDITION = "listing_type = 'auction' AND status = 'closed' AND leader_user_id IS NOT NULL";

// All-time auction-side GMV. Correlates with nothing outside `listings`, so
// it works as a scalar subquery anywhere in a SELECT list.
export const AUCTION_GMV_SUBQUERY = `(SELECT COALESCE(SUM(current_price), 0) FROM listings WHERE ${SOLD_AUCTION_CONDITION})`;

// All-time fixed_price-side GMV. Every purchases row is a completed sale
// (purchaseListing only inserts after resolvePurchase succeeds), so unlike
// the auction side there is nothing to filter out here — fixed_price
// listings never transition to 'closed' themselves, which is exactly why
// their revenue has to come from this table rather than from `listings`.
export const FIXED_PRICE_GMV_SUBQUERY = "(SELECT COALESCE(SUM(total_amount), 0) FROM purchases)";

// Shown in place of the address of an account that has since been deleted —
// admin views still need the historical row (a deleted buyer's order is
// still a real order), but must not surface the email of someone who asked
// to be forgotten.
export const DELETED_ACCOUNT_LABEL = "（帳號已刪除）";

/**
 * `CASE` expression masking a deleted user's email, for admin list queries
 * that join `users`.
 *
 * @param userAlias the alias `users` is joined under (e.g. "u").
 * @param options.nullWhen an extra leading branch yielding NULL — used where
 *   the join is a LEFT JOIN that legitimately matches no user at all (a
 *   closed auction with no winner), which is a different thing from a
 *   winner who later deleted their account.
 */
export function deletedAccountEmail(userAlias: string, options?: { nullWhen?: string }): string {
  const nullBranch = options?.nullWhen ? `WHEN ${options.nullWhen} THEN NULL ` : "";
  return `CASE ${nullBranch}WHEN ${userAlias}.deleted_at IS NOT NULL THEN '${DELETED_ACCOUNT_LABEL}' ELSE ${userAlias}.email END`;
}
