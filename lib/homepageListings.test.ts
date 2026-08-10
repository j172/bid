import { describe, expect, it } from "vitest";
import {
  QUICK_CLOSE_WINDOW_HOURS,
  filterByListingType,
  selectEndingSoonAuctions,
  selectMostActive,
  selectNewestFixedPrice,
  selectQuickCloseAuctions,
  selectTopAuctionsByBids,
  selectTopFixedByPurchases,
  selectTopPriceAuctions,
} from "./homepageListings";
import type { ListingType } from "./listings";

const NOW = new Date("2026-08-10T00:00:00Z").getTime();
const hoursFromNow = (hours: number) => new Date(NOW + hours * 60 * 60 * 1000);

interface Row {
  id: number;
  listing_type: ListingType;
  ends_at: Date | null;
  current_price: number;
  price: number | null;
  bidCount: number;
  purchaseCount: number;
  photos: string[];
  created_at: Date;
}

function row(overrides: Partial<Row> & { id: number }): Row {
  return {
    listing_type: "auction",
    ends_at: hoursFromNow(24),
    current_price: 1000,
    price: null,
    bidCount: 0,
    purchaseCount: 0,
    photos: ["a.webp"],
    created_at: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("selectEndingSoonAuctions", () => {
  it("orders by soonest ending", () => {
    const rows = [row({ id: 1, ends_at: hoursFromNow(50) }), row({ id: 2, ends_at: hoursFromNow(2) })];
    expect(selectEndingSoonAuctions(rows, 5).map((r) => r.id)).toEqual([2, 1]);
  });

  it("breaks ties on end time by the higher price", () => {
    const rows = [
      row({ id: 1, ends_at: hoursFromNow(5), current_price: 100 }),
      row({ id: 2, ends_at: hoursFromNow(5), current_price: 900 }),
    ];
    expect(selectEndingSoonAuctions(rows, 5).map((r) => r.id)).toEqual([2, 1]);
  });

  it("floats listings with a photo ahead of photoless ones", () => {
    const rows = [
      row({ id: 1, ends_at: hoursFromNow(1), photos: [] }),
      row({ id: 2, ends_at: hoursFromNow(9), photos: ["x.webp"] }),
    ];
    expect(selectEndingSoonAuctions(rows, 5).map((r) => r.id)).toEqual([2, 1]);
  });

  it("keeps the ordering rule within each photo group", () => {
    const rows = [
      row({ id: 1, ends_at: hoursFromNow(9), photos: ["x.webp"] }),
      row({ id: 2, ends_at: hoursFromNow(1), photos: [] }),
      row({ id: 3, ends_at: hoursFromNow(2), photos: ["y.webp"] }),
      row({ id: 4, ends_at: hoursFromNow(8), photos: [] }),
    ];
    expect(selectEndingSoonAuctions(rows, 5).map((r) => r.id)).toEqual([3, 1, 2, 4]);
  });

  it("excludes fixed-price listings and undated auctions", () => {
    const rows = [
      row({ id: 1, listing_type: "fixed_price", price: 500, ends_at: null }),
      row({ id: 2, ends_at: null }),
      row({ id: 3 }),
    ];
    expect(selectEndingSoonAuctions(rows, 5).map((r) => r.id)).toEqual([3]);
  });

  it("respects the limit", () => {
    const rows = [1, 2, 3, 4].map((id) => row({ id, ends_at: hoursFromNow(id) }));
    expect(selectEndingSoonAuctions(rows, 2).map((r) => r.id)).toEqual([1, 2]);
  });

  it("does not mutate the input", () => {
    const rows = [row({ id: 1, ends_at: hoursFromNow(50) }), row({ id: 2, ends_at: hoursFromNow(2) })];
    const before = rows.map((r) => r.id);
    selectEndingSoonAuctions(rows, 5);
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});

describe("selectTopPriceAuctions", () => {
  it("orders by highest price, breaking ties by ending soonest", () => {
    const rows = [
      row({ id: 1, current_price: 900, ends_at: hoursFromNow(40) }),
      row({ id: 2, current_price: 900, ends_at: hoursFromNow(4) }),
      row({ id: 3, current_price: 5000 }),
    ];
    expect(selectTopPriceAuctions(rows, 5).map((r) => r.id)).toEqual([3, 2, 1]);
  });

  it("ignores fixed-price listings", () => {
    const rows = [row({ id: 1, listing_type: "fixed_price", price: 99999, ends_at: null }), row({ id: 2 })];
    expect(selectTopPriceAuctions(rows, 5).map((r) => r.id)).toEqual([2]);
  });
});

describe("selectMostActive", () => {
  it("ranks by combined bid and purchase count across both types", () => {
    const rows = [
      row({ id: 1, bidCount: 2, purchaseCount: 0 }),
      row({ id: 2, listing_type: "fixed_price", price: 100, bidCount: 0, purchaseCount: 7 }),
      row({ id: 3, bidCount: 4 }),
    ];
    expect(selectMostActive(rows, 5).map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("breaks activity ties by price, reading the right field per type", () => {
    const rows = [
      row({ id: 1, bidCount: 3, current_price: 100 }),
      row({ id: 2, listing_type: "fixed_price", price: 8000, bidCount: 0, purchaseCount: 3 }),
    ];
    expect(selectMostActive(rows, 5).map((r) => r.id)).toEqual([2, 1]);
  });

  it("treats a fixed-price listing with no unit price as zero, not NaN", () => {
    const rows = [
      row({ id: 1, listing_type: "fixed_price", price: null, purchaseCount: 1 }),
      row({ id: 2, listing_type: "fixed_price", price: 10, purchaseCount: 1 }),
    ];
    expect(selectMostActive(rows, 5).map((r) => r.id)).toEqual([2, 1]);
  });
});

describe("selectTopAuctionsByBids", () => {
  it("ranks auctions by bid count, then price", () => {
    const rows = [
      row({ id: 1, bidCount: 3, current_price: 100 }),
      row({ id: 2, bidCount: 3, current_price: 900 }),
      row({ id: 3, bidCount: 9 }),
      row({ id: 4, listing_type: "fixed_price", price: 100, bidCount: 99 }),
    ];
    expect(selectTopAuctionsByBids(rows, 5).map((r) => r.id)).toEqual([3, 2, 1]);
  });
});

describe("selectTopFixedByPurchases", () => {
  it("ranks fixed-price listings by purchases, then price", () => {
    const rows = [
      row({ id: 1, listing_type: "fixed_price", price: 100, purchaseCount: 2 }),
      row({ id: 2, listing_type: "fixed_price", price: 900, purchaseCount: 2 }),
      row({ id: 3, purchaseCount: 99 }),
    ];
    expect(selectTopFixedByPurchases(rows, 5).map((r) => r.id)).toEqual([2, 1]);
  });
});

describe("selectNewestFixedPrice", () => {
  it("returns fixed-price listings newest first", () => {
    const rows = [
      row({ id: 1, listing_type: "fixed_price", price: 1, created_at: new Date("2026-01-01") }),
      row({ id: 2, listing_type: "fixed_price", price: 1, created_at: new Date("2026-06-01") }),
      row({ id: 3 }),
    ];
    expect(selectNewestFixedPrice(rows, 5).map((r) => r.id)).toEqual([2, 1]);
  });

  it("returns an empty list when there are none", () => {
    expect(selectNewestFixedPrice([row({ id: 1 })], 5)).toEqual([]);
  });
});

describe("selectQuickCloseAuctions", () => {
  it("keeps auctions ending inside the window", () => {
    const rows = [
      row({ id: 1, ends_at: hoursFromNow(1) }),
      row({ id: 2, ends_at: hoursFromNow(200) }),
      row({ id: 3, ends_at: null }),
    ];
    expect(selectQuickCloseAuctions(rows, NOW).map((r) => r.id)).toEqual([1]);
  });

  it("excludes auctions whose end time has already passed", () => {
    expect(selectQuickCloseAuctions([row({ id: 1, ends_at: hoursFromNow(-1) })], NOW)).toEqual([]);
  });

  it("includes the exact window boundary", () => {
    const boundary = row({ id: 1, ends_at: hoursFromNow(QUICK_CLOSE_WINDOW_HOURS) });
    expect(selectQuickCloseAuctions([boundary], NOW).map((r) => r.id)).toEqual([1]);
  });

  it("honours a custom window", () => {
    const rows = [row({ id: 1, ends_at: hoursFromNow(5) })];
    expect(selectQuickCloseAuctions(rows, NOW, 2)).toEqual([]);
    expect(selectQuickCloseAuctions(rows, NOW, 10).map((r) => r.id)).toEqual([1]);
  });

  it("ignores fixed-price listings", () => {
    const rows = [row({ id: 1, listing_type: "fixed_price", price: 1, ends_at: hoursFromNow(1) })];
    expect(selectQuickCloseAuctions(rows, NOW)).toEqual([]);
  });
});

describe("filterByListingType", () => {
  it("splits the two listing types", () => {
    const rows = [row({ id: 1 }), row({ id: 2, listing_type: "fixed_price", price: 1 })];
    expect(filterByListingType(rows, "auction").map((r) => r.id)).toEqual([1]);
    expect(filterByListingType(rows, "fixed_price").map((r) => r.id)).toEqual([2]);
  });
});
