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
import { getOverviewStats } from "./listings";
import { getGmvSplitByType } from "./dashboard";
import { AUCTION_GMV_SUBQUERY, FIXED_PRICE_GMV_SUBQUERY } from "./sqlFragments";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
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
