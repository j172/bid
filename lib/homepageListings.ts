import type { ListingType } from "@/lib/listings";

// The homepage's curated sections, lifted out of the page component
// (issue #139 item 3).
//
// app/[locale]/(with-loading)/page.tsx computed roughly fifteen derived
// lists inline — sorts, filters and slices interleaved with 750 lines of
// JSX — so none of the "which pigeons show up in 今日精選?" rules could be
// checked without rendering the page against a database. Each rule is a
// named pure function here instead.
//
// Every function takes a generic `T extends <minimal shape>` and returns
// `T[]`, so callers keep their full row type (photos, loft name, ...) while
// tests can pass small literals.

/** Hours from now within which an auction counts as "快速結標". */
export const QUICK_CLOSE_WINDOW_HOURS = 72;

interface TypedListing {
  listing_type: ListingType;
}

interface DatedAuction extends TypedListing {
  ends_at: Date | null;
  current_price: number;
}

/**
 * "即將結標" hero carousel: soonest-ending open auctions first, ties broken
 * by the higher price.
 *
 * Listings that have a photo are floated ahead of those that don't — this is
 * the site's most prominent surface and a photoless card reads as broken
 * there. Within each group the ordering rule above still holds.
 */
export function selectEndingSoonAuctions<T extends DatedAuction & { photos: string[] }>(
  listings: readonly T[],
  limit: number,
): T[] {
  const byEndingSoon = listings
    .filter((item) => item.listing_type === "auction" && item.ends_at)
    .sort((a, b) => a.ends_at!.getTime() - b.ends_at!.getTime() || b.current_price - a.current_price);

  const withPhoto = byEndingSoon.filter((item) => Boolean(item.photos[0]));
  const withoutPhoto = byEndingSoon.filter((item) => !item.photos[0]);
  return [...withPhoto, ...withoutPhoto].slice(0, limit);
}

/** "頂標" hero side cards: dearest open auctions, ties broken by ending soonest. */
export function selectTopPriceAuctions<T extends DatedAuction>(listings: readonly T[], limit: number): T[] {
  return listings
    .filter((item) => item.listing_type === "auction" && item.ends_at)
    .sort((a, b) => b.current_price - a.current_price || a.ends_at!.getTime() - b.ends_at!.getTime())
    .slice(0, limit);
}

interface ActivityRankedListing extends TypedListing {
  bidCount: number;
  purchaseCount: number;
  current_price: number;
  price: number | null;
}

/** "買家最愛": most total activity (bids + purchases) across both listing types, ties broken by price. */
export function selectMostActive<T extends ActivityRankedListing>(listings: readonly T[], limit: number): T[] {
  const priceOf = (item: ActivityRankedListing) =>
    item.listing_type === "auction" ? item.current_price : (item.price ?? 0);

  return [...listings]
    .sort(
      (a, b) =>
        b.bidCount + b.purchaseCount - (a.bidCount + a.purchaseCount) || priceOf(b) - priceOf(a),
    )
    .slice(0, limit);
}

/** "熱門競標" list: auctions with the most bids, ties broken by price. */
export function selectTopAuctionsByBids<T extends TypedListing & { bidCount: number; current_price: number }>(
  listings: readonly T[],
  limit: number,
): T[] {
  return listings
    .filter((item) => item.listing_type === "auction")
    .sort((a, b) => b.bidCount - a.bidCount || b.current_price - a.current_price)
    .slice(0, limit);
}

/** "熱門定價" list: fixed-price listings with the most purchases, ties broken by price. */
export function selectTopFixedByPurchases<T extends TypedListing & { purchaseCount: number; price: number | null }>(
  listings: readonly T[],
  limit: number,
): T[] {
  return listings
    .filter((item) => item.listing_type === "fixed_price")
    .sort((a, b) => b.purchaseCount - a.purchaseCount || (b.price ?? 0) - (a.price ?? 0))
    .slice(0, limit);
}

/**
 * Independent "定價種鴿" section (issue #36) — real fixed-price listings,
 * newest first so recently listed pigeons surface. Renders nothing when
 * there are none.
 */
export function selectNewestFixedPrice<T extends TypedListing & { created_at: Date }>(
  listings: readonly T[],
  limit: number,
): T[] {
  return listings
    .filter((item) => item.listing_type === "fixed_price")
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, limit);
}

/**
 * "快速結標" browse card: open auctions ending inside the window — not every
 * auction, or the count would just duplicate the "拍賣商品" card's.
 */
export function selectQuickCloseAuctions<T extends TypedListing & { ends_at: Date | null }>(
  listings: readonly T[],
  nowMs: number,
  windowHours: number = QUICK_CLOSE_WINDOW_HOURS,
): T[] {
  const windowMs = windowHours * 60 * 60 * 1000;
  return listings.filter((item) => {
    if (item.listing_type !== "auction" || !item.ends_at) return false;
    const remaining = item.ends_at.getTime() - nowMs;
    return remaining >= 0 && remaining <= windowMs;
  });
}

export function filterByListingType<T extends TypedListing>(listings: readonly T[], type: ListingType): T[] {
  return listings.filter((item) => item.listing_type === type);
}
