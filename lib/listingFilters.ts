import type { ListingType } from "@/lib/listings";

// The public listings page's filtering, sorting and link-building, lifted
// out of the page component (issue #139 item 13).
//
// It lived inline as ~120 lines of business logic wedged between the awaited
// data and the JSX, which meant none of it could be exercised without
// rendering a page against a database. Everything here is pure: give it rows
// and criteria, get rows back.
//
// Deliberately a new file rather than an addition to lib/listings.ts — that
// module is the DB access layer, and none of this touches the database.

export type ListingCategory = "auction" | "fixed_price";

/**
 * ends_soon / starts_soon power the homepage "分類瀏覽" cards (see
 * app/[locale]/(with-loading)/page.tsx) — real, computable orderings rather
 * than the hardcoded links that used to live there.
 */
export type ListingSortKey = "newest" | "price_asc" | "price_desc" | "ends_soon" | "starts_soon";

const SORT_KEYS: readonly ListingSortKey[] = ["newest", "price_asc", "price_desc", "ends_soon", "starts_soon"];

/** Anything unrecognised (including absent) falls back to "newest". */
export function parseSortKey(raw: string | undefined): ListingSortKey {
  return SORT_KEYS.includes(raw as ListingSortKey) ? (raw as ListingSortKey) : "newest";
}

export function inferCategoryFromListingType(type: ListingType): ListingCategory {
  return type === "auction" ? "auction" : "fixed_price";
}

/** Shape of a listing row this module needs — a structural subset of ListingWithPhotos. */
export interface FilterableListing {
  id: number;
  title: string;
  description: string;
  listing_type: ListingType;
  current_price: number;
  price: number | null;
  status: string;
  ends_at: Date | null;
  starts_at: Date | null;
}

/**
 * The price a listing is filtered and sorted by: an auction's live price, a
 * fixed-price listing's unit price (falling back to current_price on the
 * legacy rows where `price` was never populated).
 */
export function effectiveListingPrice(listing: Pick<FilterableListing, "listing_type" | "current_price" | "price">): number {
  return listing.listing_type === "auction" ? listing.current_price : (listing.price ?? listing.current_price);
}

export interface ListingFilterCriteria {
  category?: ListingCategory;
  minPrice?: number;
  maxPrice?: number;
  /** Case-insensitive substring match over title + description; empty means no search. */
  searchQuery?: string;
  /** Only "scheduled" is supported today (powers the homepage's "即將開賣" card). */
  status?: string;
  /** Auction-only "ends within N hours" window, used by the "快速結標" card. */
  withinHours?: number;
  /** Passed in rather than read from the clock, so the result is reproducible. */
  nowMs: number;
}

export function filterListings<T extends FilterableListing>(
  listings: readonly T[],
  criteria: ListingFilterCriteria,
): T[] {
  const { category, minPrice, maxPrice, status, withinHours, nowMs } = criteria;
  const searchQuery = criteria.searchQuery?.trim() ?? "";
  const needle = searchQuery.toLowerCase();

  return listings.filter((listing) => {
    if (category && inferCategoryFromListingType(listing.listing_type) !== category) return false;

    const price = effectiveListingPrice(listing);
    if (minPrice !== undefined && price < minPrice) return false;
    if (maxPrice !== undefined && price > maxPrice) return false;

    if (needle.length > 0 && !`${listing.title} ${listing.description}`.toLowerCase().includes(needle)) {
      return false;
    }

    if (status && listing.status !== status) return false;

    if (withinHours !== undefined) {
      // Only an open auction can be "ending within N hours" at all.
      if (listing.listing_type !== "auction" || listing.status !== "open" || listing.ends_at === null) return false;
      const remaining = listing.ends_at.getTime() - nowMs;
      if (remaining < 0 || remaining > withinHours * 60 * 60 * 1000) return false;
    }

    return true;
  });
}

/** Returns a new array — never mutates the input. */
export function sortListings<T extends FilterableListing>(listings: readonly T[], sort: ListingSortKey): T[] {
  return [...listings].sort((a, b) => {
    if (sort === "price_asc") return effectiveListingPrice(a) - effectiveListingPrice(b);
    if (sort === "price_desc") return effectiveListingPrice(b) - effectiveListingPrice(a);
    // A listing with no end/start date sorts last rather than first.
    if (sort === "ends_soon") {
      return (a.ends_at?.getTime() ?? Infinity) - (b.ends_at?.getTime() ?? Infinity);
    }
    if (sort === "starts_soon") {
      return (a.starts_at?.getTime() ?? Infinity) - (b.starts_at?.getTime() ?? Infinity);
    }
    // "newest": ids are monotonic, so this avoids needing created_at here.
    return b.id - a.id;
  });
}

export function countByCategory(
  listings: readonly Pick<FilterableListing, "listing_type">[],
): Record<ListingCategory, number> {
  return listings.reduce(
    (acc, listing) => {
      acc[inferCategoryFromListingType(listing.listing_type)] += 1;
      return acc;
    },
    { auction: 0, fixed_price: 0 },
  );
}

/**
 * Single builder for every /listings link on the page — the type tabs, the
 * category/price facets and the sort buttons all used to assemble their own
 * URLSearchParams by hand.
 *
 * Empty values are dropped, so a fully-cleared filter set returns the bare
 * path. Key order follows the object's own insertion order, keeping URLs
 * stable per call site.
 */
export function listingsHref(query: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) sp.set(key, value);
  }
  const queryString = sp.toString();
  return queryString ? `/listings?${queryString}` : "/listings";
}
