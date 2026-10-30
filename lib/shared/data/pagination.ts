// Shared offset-pagination arithmetic. Every paginated list query in lib/
// (listings, orders, closed listings, users, news, pigeon showcase) had
// re-typed the same two lines — clamp the requested page to at least 1, then
// turn it into a LIMIT/OFFSET pair — which is exactly the kind of thing that
// only has to be wrong in one copy to produce an off-by-one page (issue
// #139).
//
// No pure unit-testable value in the modules themselves (they're all raw
// SQL against a live pool), so the clamping lives here where it *is*
// testable — see pagination.test.ts.

export interface Page {
  /** The requested page, clamped to >= 1. */
  page: number;
  /** Rows to skip for that page. */
  offset: number;
  /** Rows per page, echoed back so callers can interpolate one object. */
  limit: number;
}

/**
 * Clamps `page` (1-based; undefined/0/negative/fractional input all
 * normalize) and derives the matching SQL OFFSET.
 *
 * Both returned numbers are safe to interpolate directly into SQL — they're
 * integers by construction, never caller strings, which is what lets the
 * call sites keep using `LIMIT ${limit} OFFSET ${offset}` (mysql2 can't
 * placeholder those in a prepared statement).
 */
export function paginate(page: number | undefined, pageSize: number): Page {
  const safePage = Math.max(1, Math.floor(page ?? 1) || 1);
  return { page: safePage, offset: (safePage - 1) * pageSize, limit: pageSize };
}
