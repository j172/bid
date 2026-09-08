// lib/listings.ts is raw-SQL data access (no ORM, see lib/db.ts), so like
// lib/news.test.ts / lib/pigeonShowcase.test.ts this mocks @/lib/db's
// getDb() and asserts on the SQL each function sends.
//
// The focus here is the GMV definition (issue #139): getOverviewStats used
// to sum current_price over every status = 'closed' listing, which counted
// auctions that expired without a single bid — those close with
// leader_user_id still NULL and current_price still equal to starting_price,
// so each 流標 silently inflated the admin overview's 總成交金額 by its own
// starting price and made that card disagree with every GMV chart on the
// dashboard, which had always filtered them out.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOverviewStats,
  isListingsPageSize,
  LISTINGS_PAGE_SIZES,
  listOpenListings,
  listOpenListingsPaginated,
  placeBid,
  buyNow,
} from "./listings";
import { getGmvSplitByType } from "./dashboard";
import { AUCTION_GMV_SUBQUERY, FIXED_PRICE_GMV_SUBQUERY } from "./sqlFragments";

const { queryMock, connectionQueryMock, beginTransactionMock, commitMock, rollbackMock } = vi.hoisted(() => {
  const queryMock = vi.fn();
  const connectionQueryMock = vi.fn();
  const beginTransactionMock = vi.fn();
  const commitMock = vi.fn();
  const rollbackMock = vi.fn();
  return { queryMock, connectionQueryMock, beginTransactionMock, commitMock, rollbackMock };
});

vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    query: queryMock,
    getConnection: async () => ({
      query: connectionQueryMock,
      beginTransaction: beginTransactionMock,
      commit: commitMock,
      rollback: rollbackMock,
      release: vi.fn(),
    }),
  }),
}));

// syncListingLifecycle fires notifyWinner for anything it closes; the sweeps
// below never return rows, but the module is mocked so no email/DB work can
// leak out of these tests either way.
vi.mock("@/lib/notifications", () => ({
  notifyAuctionEnded: vi.fn(),
  notifyOutbid: vi.fn(),
  notifyPurchaseConfirmed: vi.fn(),
  notifyWinner: vi.fn(),
}));

beforeEach(() => {
  queryMock.mockReset();
  // Every read path starts with syncListingLifecycle()'s two sweeps; an
  // empty result set is the "nothing to open/close" case.
  queryMock.mockResolvedValue([[]]);
});

/** The one query of the run that projects the named column. */
function sqlSelecting(column: string): string {
  const call = queryMock.mock.calls.find((c) => String(c[0]).includes(column));
  if (!call) throw new Error(`no query selected ${column}`);
  return String(call[0]);
}

describe("getOverviewStats", () => {
  it("excludes zero-bid expired auctions from totalGmv", async () => {
    await getOverviewStats();

    const sql = sqlSelecting("totalGmv");
    // The 流標 guard itself: a closed auction only counts once it has a
    // winner. Without this, an auction that ended with no bids contributes
    // its untouched starting_price to revenue.
    expect(sql).toContain("leader_user_id IS NOT NULL");
    expect(sql).not.toMatch(/SUM\(current_price\), 0\) FROM listings WHERE status = 'closed'\)/);
  });

  it("builds totalGmv from the two shared GMV fragments", async () => {
    await getOverviewStats();

    const sql = sqlSelecting("totalGmv");
    expect(sql).toContain(`${AUCTION_GMV_SUBQUERY} + ${FIXED_PRICE_GMV_SUBQUERY} AS totalGmv`);
  });

  it("still counts every closed listing in closedCount", async () => {
    await getOverviewStats();

    // closedCount is a listing count, not revenue — a 流標 is genuinely a
    // closed listing, so unlike totalGmv it deliberately keeps counting one.
    expect(sqlSelecting("closedCount")).toContain("(SELECT COUNT(*) FROM listings WHERE status = 'closed') AS closedCount");
  });

  it("maps the single result row straight through", async () => {
    const stats = { openCount: 3, closedCount: 7, userCount: 42, totalGmv: 123_000 };
    queryMock.mockImplementation(async (sql: string) =>
      String(sql).includes("totalGmv") ? [[stats]] : [[]],
    );

    await expect(getOverviewStats()).resolves.toEqual(stats);
  });
});

describe("GMV definition shared with lib/dashboard.ts", () => {
  it("sums the same auction and fixed-price halves the dashboard splits by type", async () => {
    await getOverviewStats();
    const overviewSql = sqlSelecting("totalGmv");

    queryMock.mockReset();
    queryMock.mockResolvedValue([[{ auctionGmv: 0, fixedPriceGmv: 0 }]]);
    await getGmvSplitByType();
    const splitSql = sqlSelecting("auctionGmv");

    // totalGmv must be exactly auctionGmv + fixedPriceGmv. Asserting both
    // queries embed the identical fragments is what stops the two views
    // drifting apart again the way they had (issue #139).
    for (const fragment of [AUCTION_GMV_SUBQUERY, FIXED_PRICE_GMV_SUBQUERY]) {
      expect(overviewSql).toContain(fragment);
      expect(splitSql).toContain(fragment);
    }
  });
});

describe("listOpenListings statusScope and loftId", () => {
  it("defaults statusScope to open/scheduled", async () => {
    await listOpenListings();
    const call = queryMock.mock.calls.find((c) => String(c[0]).includes("FROM listings l"));
    expect(String(call?.[0])).toContain("l.status IN ('open', 'scheduled')");
    expect(String(call?.[0])).toContain("ORDER BY l.ends_at IS NULL, l.ends_at ASC");
  });

  it("filters to closed listings when statusScope is closed", async () => {
    await listOpenListings(undefined, { statusScope: "closed" });
    const call = queryMock.mock.calls.find((c) => String(c[0]).includes("FROM listings l"));
    expect(String(call?.[0])).toContain("l.status = 'closed'");
    expect(String(call?.[0])).toContain("ORDER BY l.ends_at DESC, l.id DESC");
  });

  it("includes all statuses when statusScope is all", async () => {
    await listOpenListings(undefined, { statusScope: "all" });
    const call = queryMock.mock.calls.find((c) => String(c[0]).includes("FROM listings l"));
    expect(String(call?.[0])).toContain("l.status IN ('open', 'scheduled', 'closed')");
    expect(String(call?.[0])).toContain("CASE WHEN l.status IN ('open', 'scheduled') THEN 0 ELSE 1 END ASC");
  });

  it("adds loft_id filter when loftId is provided", async () => {
    await listOpenListings(undefined, { loftId: 42 });
    const call = queryMock.mock.calls.find((c) => String(c[0]).includes("FROM listings l"));
    expect(String(call?.[0])).toContain("l.loft_id = ?");
    expect(call?.[1]).toContain(42);
  });
});

describe("listOpenListingsPaginated", () => {
  it("validates page size constants and type guard", () => {
    expect(LISTINGS_PAGE_SIZES).toEqual([30, 50, 100]);
    expect(isListingsPageSize(30)).toBe(true);
    expect(isListingsPageSize(50)).toBe(true);
    expect(isListingsPageSize(100)).toBe(true);
    expect(isListingsPageSize(20)).toBe(false);
  });

  it("queries count and paginated rows with limit and offset", async () => {
    queryMock.mockImplementation(async (sql: string) => {
      if (String(sql).includes("COUNT(*)")) {
        return [[{ cnt: 45 }]];
      }
      return [[]];
    });

    const result = await listOpenListingsPaginated(undefined, {
      loftId: 7,
      statusScope: "all",
      page: 2,
      pageSize: 30,
      orderByMode: "loft_newest",
    });

    expect(result.total).toBe(45);
    const countCall = queryMock.mock.calls.find((c) => String(c[0]).includes("SELECT COUNT(*) AS cnt FROM listings l"));
    expect(String(countCall?.[0])).toContain("l.loft_id = ?");
    expect(countCall?.[1]).toContain(7);

    const selectCall = queryMock.mock.calls.find((c) => String(c[0]).includes("FROM listings l") && String(c[0]).includes("LIMIT"));
    expect(String(selectCall?.[0])).toContain("LIMIT 30 OFFSET 30");
    expect(String(selectCall?.[0])).toContain("CASE WHEN l.status IN ('open', 'scheduled') THEN 0 ELSE 1 END ASC, l.created_at DESC, l.id DESC");
  });
});

describe("bidding profile guard", () => {
  it("rejects placeBid with PROFILE_INCOMPLETE when bidder has no phone or address", async () => {
    connectionQueryMock
      .mockResolvedValueOnce([
        [
          {
            current_price: 1000,
            status: "open",
            leader_max_amount: null,
            leader_user_id: null,
            ends_at: new Date(Date.now() + 60000),
            buy_it_now_price: null,
            created_by: 99,
          },
        ],
      ])
      .mockResolvedValueOnce([[{ phone: null, address: null }]]);

    const result = await placeBid(1, 10, 1500);
    expect(result).toEqual({ ok: false, errorCode: "PROFILE_INCOMPLETE" });
    expect(rollbackMock).toHaveBeenCalled();
  });

  it("rejects buyNow with PROFILE_INCOMPLETE when buyer has empty phone or address", async () => {
    connectionQueryMock
      .mockResolvedValueOnce([
        [
          {
            status: "open",
            buy_it_now_price: 5000,
            created_by: 99,
          },
        ],
      ])
      .mockResolvedValueOnce([[{ phone: "0912345678", address: "   " }]]);

    const result = await buyNow(1, 10);
    expect(result).toEqual({ ok: false, errorCode: "PROFILE_INCOMPLETE" });
    expect(rollbackMock).toHaveBeenCalled();
  });
});


