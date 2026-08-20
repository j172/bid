import { describe, expect, it } from "vitest";
import {
  countByCategory,
  effectiveListingPrice,
  filterListings,
  inferCategoryFromListingType,
  listingsHref,
  parseSortKey,
  sortListings,
  type FilterableListing,
} from "./listingFilters";

const NOW = new Date("2026-08-10T00:00:00Z").getTime();
const hoursFromNow = (hours: number) => new Date(NOW + hours * 60 * 60 * 1000);

function listing(overrides: Partial<FilterableListing> & { id: number }): FilterableListing {
  return {
    title: "鴿子",
    description: "說明",
    listing_type: "auction",
    current_price: 1000,
    price: null,
    status: "open",
    ends_at: hoursFromNow(48),
    starts_at: null,
    ...overrides,
  };
}

describe("parseSortKey", () => {
  it("accepts the known sort keys", () => {
    expect(parseSortKey("price_asc")).toBe("price_asc");
    expect(parseSortKey("starts_soon")).toBe("starts_soon");
  });

  it("falls back to newest for anything else", () => {
    expect(parseSortKey(undefined)).toBe("newest");
    expect(parseSortKey("")).toBe("newest");
    expect(parseSortKey("; DROP TABLE listings")).toBe("newest");
  });
});

describe("effectiveListingPrice", () => {
  it("uses the live price for an auction and the unit price for fixed-price", () => {
    expect(effectiveListingPrice({ listing_type: "auction", current_price: 900, price: 5000 })).toBe(900);
    expect(effectiveListingPrice({ listing_type: "fixed_price", current_price: 900, price: 5000 })).toBe(5000);
  });

  it("falls back to current_price on a fixed-price row with no unit price", () => {
    expect(effectiveListingPrice({ listing_type: "fixed_price", current_price: 900, price: null })).toBe(900);
  });
});

describe("inferCategoryFromListingType", () => {
  it("maps listing types onto the two browse categories", () => {
    expect(inferCategoryFromListingType("auction")).toBe("auction");
    expect(inferCategoryFromListingType("fixed_price")).toBe("fixed_price");
  });
});

describe("filterListings", () => {
  const rows = [
    listing({ id: 1, title: "冠軍鴿", current_price: 500 }),
    listing({ id: 2, listing_type: "fixed_price", price: 2000, ends_at: null }),
    listing({ id: 3, current_price: 8000, status: "scheduled", starts_at: hoursFromNow(24) }),
  ];

  it("returns everything when only `nowMs` is given", () => {
    expect(filterListings(rows, { nowMs: NOW })).toHaveLength(3);
  });

  it("filters by category", () => {
    expect(filterListings(rows, { nowMs: NOW, category: "fixed_price" }).map((r) => r.id)).toEqual([2]);
  });

  it("filters by price range using the effective price", () => {
    expect(filterListings(rows, { nowMs: NOW, minPrice: 1000 }).map((r) => r.id)).toEqual([2, 3]);
    expect(filterListings(rows, { nowMs: NOW, maxPrice: 2000 }).map((r) => r.id)).toEqual([1, 2]);
    expect(filterListings(rows, { nowMs: NOW, minPrice: 1000, maxPrice: 5000 }).map((r) => r.id)).toEqual([2]);
  });

  it("searches title and description case-insensitively", () => {
    expect(filterListings(rows, { nowMs: NOW, searchQuery: "冠軍" }).map((r) => r.id)).toEqual([1]);
    const cased = [listing({ id: 9, title: "Champion Bird" })];
    expect(filterListings(cased, { nowMs: NOW, searchQuery: "champion" })).toHaveLength(1);
  });

  it("treats a blank or whitespace-only search as no search", () => {
    expect(filterListings(rows, { nowMs: NOW, searchQuery: "   " })).toHaveLength(3);
  });

  it("filters by status", () => {
    expect(filterListings(rows, { nowMs: NOW, status: "scheduled" }).map((r) => r.id)).toEqual([3]);
  });

  describe("withinHours", () => {
    it("keeps only open auctions ending inside the window", () => {
      const soon = listing({ id: 10, ends_at: hoursFromNow(12) });
      const later = listing({ id: 11, ends_at: hoursFromNow(200) });
      expect(filterListings([soon, later], { nowMs: NOW, withinHours: 72 }).map((r) => r.id)).toEqual([10]);
    });

    it("excludes fixed-price listings, which never end", () => {
      const fixed = listing({ id: 12, listing_type: "fixed_price", price: 100, ends_at: null });
      expect(filterListings([fixed], { nowMs: NOW, withinHours: 72 })).toEqual([]);
    });

    it("excludes scheduled auctions — they haven't started yet", () => {
      const scheduled = listing({ id: 13, status: "scheduled", ends_at: hoursFromNow(10) });
      expect(filterListings([scheduled], { nowMs: NOW, withinHours: 72 })).toEqual([]);
    });

    it("excludes an auction whose end time has already passed", () => {
      const overdue = listing({ id: 14, ends_at: hoursFromNow(-1) });
      expect(filterListings([overdue], { nowMs: NOW, withinHours: 72 })).toEqual([]);
    });
  });

  it("applies every criterion together", () => {
    const result = filterListings(rows, { nowMs: NOW, category: "auction", maxPrice: 1000, searchQuery: "冠軍" });
    expect(result.map((r) => r.id)).toEqual([1]);
  });
});

describe("sortListings", () => {
  const a = listing({ id: 1, current_price: 500, ends_at: hoursFromNow(50), starts_at: hoursFromNow(5) });
  const b = listing({ id: 2, current_price: 900, ends_at: hoursFromNow(10), starts_at: hoursFromNow(1) });
  const c = listing({ id: 3, current_price: 100, ends_at: null, starts_at: null });
  const rows = [a, b, c];

  it("sorts by price in both directions", () => {
    expect(sortListings(rows, "price_asc").map((r) => r.id)).toEqual([3, 1, 2]);
    expect(sortListings(rows, "price_desc").map((r) => r.id)).toEqual([2, 1, 3]);
  });

  it("sorts undated listings last for ends_soon and starts_soon", () => {
    expect(sortListings(rows, "ends_soon").map((r) => r.id)).toEqual([2, 1, 3]);
    expect(sortListings(rows, "starts_soon").map((r) => r.id)).toEqual([2, 1, 3]);
  });

  it("sorts newest by descending id", () => {
    expect(sortListings(rows, "newest").map((r) => r.id)).toEqual([3, 2, 1]);
  });

  it("never mutates the input array", () => {
    const original = [...rows];
    sortListings(rows, "price_desc");
    expect(rows).toEqual(original);
  });
});

describe("countByCategory", () => {
  it("counts both categories, including zeroes", () => {
    expect(countByCategory([{ listing_type: "auction" }, { listing_type: "auction" }])).toEqual({
      auction: 2,
      fixed_price: 0,
    });
  });

  it("counts an empty list as all zeroes", () => {
    expect(countByCategory([])).toEqual({ auction: 0, fixed_price: 0 });
  });
});

describe("listingsHref", () => {
  it("returns the bare path when nothing is set", () => {
    expect(listingsHref({})).toBe("/listings");
    expect(listingsHref({ type: undefined, sort: undefined })).toBe("/listings");
  });

  it("drops empty values", () => {
    expect(listingsHref({ type: "", q: "abc" })).toBe("/listings?q=abc");
  });

  it("keeps the object's key order", () => {
    expect(listingsHref({ type: "auction", sort: "price_asc" })).toBe("/listings?type=auction&sort=price_asc");
  });

  it("encodes values", () => {
    expect(listingsHref({ q: "冠軍 鴿" })).toBe("/listings?q=%E5%86%A0%E8%BB%8D+%E9%B4%BF");
  });

  // Issue #178: the /listings filter card's type/category/loft dropdowns all
  // build their option hrefs through the same helper, so switching one must
  // carry the other two forward — asserted here on the underlying primitive
  // they share.
  it("keeps type, category and loft together so switching one preserves the others", () => {
    expect(listingsHref({ type: "auction", category: "auction", loft: "5" })).toBe(
      "/listings?type=auction&category=auction&loft=5",
    );
  });
});
