// Regression coverage for scripts/cleanup-closed-listings.mjs's query logic
// and transaction/rollback behavior, using a mocked mysql2 connection stand-
// in — same "mock a minimal { query } object" approach as lib/db.test.ts,
// since this repo has no live test-database harness for scripts/ (see that
// file's own header comment). This script is destructive by nature, so it
// must NEVER be tested against a real database, including a local/dev one —
// everything here is pure query-building + control-flow verification against
// fakes.
import { describe, expect, it, vi } from "vitest";
import { CASCADE_TABLES, executeCleanup, planCleanup } from "./cleanup-closed-listings.mjs";

function fakeConn(queryImpl) {
  return {
    query: vi.fn(queryImpl),
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
  };
}

describe("CASCADE_TABLES", () => {
  it("is exactly the three tables that reference listings via listing_id", () => {
    // See the script's header comment for how this was verified against the
    // full db/init.sql schema: bids, purchases, listing_photos are the only
    // tables with a listing_id column anywhere in this codebase.
    expect(CASCADE_TABLES).toEqual(["bids", "purchases", "listing_photos"]);
  });
});

describe("planCleanup", () => {
  it("counts rows per cascade table plus listings, without writing anything", async () => {
    const calls = [];
    const conn = fakeConn((sql) => {
      calls.push(sql);
      if (sql.startsWith("SELECT COUNT(*) AS cnt FROM bids")) return [[{ cnt: 3 }]];
      if (sql.startsWith("SELECT COUNT(*) AS cnt FROM purchases")) return [[{ cnt: 2 }]];
      if (sql.startsWith("SELECT COUNT(*) AS cnt FROM listing_photos")) return [[{ cnt: 7 }]];
      if (sql.startsWith("SELECT COUNT(*) AS cnt FROM listings")) return [[{ cnt: 5 }]];
      throw new Error(`unexpected query: ${sql}`);
    });

    const counts = await planCleanup(conn);

    expect(counts).toEqual({ bids: 3, purchases: 2, listing_photos: 7, listings: 5 });
    // Every SELECT must scope to status='closed' listings, and never run a
    // DELETE/UPDATE — this function must be side-effect free.
    expect(calls).toHaveLength(4);
    for (const sql of calls) {
      expect(sql).toMatch(/^SELECT COUNT\(\*\)/);
      expect(sql).toContain("status = 'closed'");
    }
    expect(calls.some((sql) => /DELETE|UPDATE|INSERT/i.test(sql))).toBe(false);
    expect(conn.beginTransaction).not.toHaveBeenCalled();
  });

  it("reports zero across the board when there are no closed listings", async () => {
    const conn = fakeConn(() => [[{ cnt: 0 }]]);

    const counts = await planCleanup(conn);

    expect(counts).toEqual({ bids: 0, purchases: 0, listing_photos: 0, listings: 0 });
  });
});

describe("executeCleanup", () => {
  it("deletes cascade tables before listings, all inside one transaction, and commits", async () => {
    const calls = [];
    const conn = fakeConn((sql) => {
      calls.push(sql);
      if (sql.startsWith("DELETE FROM bids")) return [{ affectedRows: 3 }];
      if (sql.startsWith("DELETE FROM purchases")) return [{ affectedRows: 2 }];
      if (sql.startsWith("DELETE FROM listing_photos")) return [{ affectedRows: 7 }];
      if (sql.startsWith("DELETE FROM listings")) return [{ affectedRows: 5 }];
      throw new Error(`unexpected query: ${sql}`);
    });

    const counts = await executeCleanup(conn);

    expect(counts).toEqual({ bids: 3, purchases: 2, listing_photos: 7, listings: 5 });
    // Cascade tables (bids, purchases, listing_photos) must be deleted
    // before the listings row itself, and every DELETE must scope to
    // status='closed' listings (directly or via the shared subquery).
    expect(calls).toEqual([
      "DELETE FROM bids WHERE listing_id IN (SELECT id FROM listings WHERE status = 'closed')",
      "DELETE FROM purchases WHERE listing_id IN (SELECT id FROM listings WHERE status = 'closed')",
      "DELETE FROM listing_photos WHERE listing_id IN (SELECT id FROM listings WHERE status = 'closed')",
      "DELETE FROM listings WHERE status = 'closed'",
    ]);
    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
  });

  it("rolls back and never commits when a statement fails partway through", async () => {
    const conn = fakeConn((sql) => {
      if (sql.startsWith("DELETE FROM bids")) return [{ affectedRows: 3 }];
      if (sql.startsWith("DELETE FROM purchases")) {
        throw Object.assign(new Error("connection lost"), { code: "PROTOCOL_CONNECTION_LOST" });
      }
      throw new Error(`unexpected query: ${sql}`);
    });

    await expect(executeCleanup(conn)).rejects.toThrow("connection lost");

    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  it("rolls back if the final listings delete itself fails, after cascade deletes already ran", async () => {
    const conn = fakeConn((sql) => {
      if (sql.startsWith("DELETE FROM listings")) {
        throw new Error("deadlock found");
      }
      return [{ affectedRows: 1 }];
    });

    await expect(executeCleanup(conn)).rejects.toThrow("deadlock found");

    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
  });
});
