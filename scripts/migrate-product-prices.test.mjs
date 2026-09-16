// Regression coverage for scripts/migrate-product-prices.mjs's
// classification logic and transaction/rollback behavior, using a mocked
// mysql2 connection stand-in — same "mock a minimal { query } object"
// approach as scripts/cleanup-closed-listings.test.mjs, since this repo has
// no live test-database harness for scripts/. This script writes
// (non-destructively — it never deletes rows) rather than deletes, but the
// same "never run this against a real database, including a local/dev one"
// rule applies: everything here is pure query-building + control-flow
// verification against fakes.
import { describe, expect, it, vi } from "vitest";
import { classifyPriceText, executeMigration, planMigration } from "./migrate-product-prices.mjs";

function fakeConn(rows) {
  return {
    query: vi.fn(async (sql) => {
      if (sql.startsWith("SELECT id, title, price_text FROM products")) {
        return [rows];
      }
      if (sql.startsWith("UPDATE products SET price = ?")) {
        return [{ affectedRows: 1 }];
      }
      throw new Error(`unexpected query: ${sql}`);
    }),
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
  };
}

describe("classifyPriceText", () => {
  it("converts a pure-digit string to its numeric price", () => {
    expect(classifyPriceText("12000")).toEqual({ price: 12000 });
    expect(classifyPriceText("1")).toEqual({ price: 1 });
  });

  it("trims surrounding whitespace before checking", () => {
    expect(classifyPriceText("  12000  ")).toEqual({ price: 12000 });
  });

  it("treats anything not purely digits as call-for-price (price: null)", () => {
    expect(classifyPriceText("電洽")).toEqual({ price: null });
    expect(classifyPriceText("面議")).toEqual({ price: null });
    expect(classifyPriceText("NT$12,000")).toEqual({ price: null }); // has a $ and a comma
    expect(classifyPriceText("12,000")).toEqual({ price: null }); // comma disqualifies it
    expect(classifyPriceText("12000.5")).toEqual({ price: null }); // decimal disqualifies it
    expect(classifyPriceText("-100")).toEqual({ price: null }); // sign disqualifies it
    expect(classifyPriceText("1e3")).toEqual({ price: null });
  });

  it("treats empty/whitespace-only text as call-for-price", () => {
    expect(classifyPriceText("")).toEqual({ price: null });
    expect(classifyPriceText("   ")).toEqual({ price: null });
    expect(classifyPriceText(null)).toEqual({ price: null });
    expect(classifyPriceText(undefined)).toEqual({ price: null });
  });

  it("rejects a zero price (never a meaningful sale price)", () => {
    expect(classifyPriceText("0")).toEqual({ price: null });
    expect(classifyPriceText("00")).toEqual({ price: null });
  });
});

describe("planMigration", () => {
  it("classifies every row without writing anything", async () => {
    const conn = fakeConn([
      { id: 1, title: "限量特惠鴿", price_text: "12000" },
      { id: 2, title: "電洽商品", price_text: "電洽" },
      { id: 3, title: "面議商品", price_text: "面議" },
    ]);

    const result = await planMigration(conn);

    expect(result.total).toBe(3);
    expect(result.numeric).toEqual([{ id: 1, title: "限量特惠鴿", price_text: "12000", price: 12000 }]);
    expect(result.callForPrice.map((row) => row.id)).toEqual([2, 3]);
    // No UPDATE and no transaction — this must be side-effect free.
    expect(conn.beginTransaction).not.toHaveBeenCalled();
    const calls = conn.query.mock.calls.map(([sql]) => sql);
    expect(calls.some((sql) => /UPDATE/i.test(sql))).toBe(false);
  });

  it("reports zero across the board when there are no products", async () => {
    const conn = fakeConn([]);
    const result = await planMigration(conn);
    expect(result).toEqual({ total: 0, numeric: [], callForPrice: [] });
  });
});

describe("executeMigration", () => {
  it("writes each row's derived price inside one transaction and commits", async () => {
    const rows = [
      { id: 1, title: "限量特惠鴿", price_text: "12000" },
      { id: 2, title: "電洽商品", price_text: "電洽" },
    ];
    const conn = fakeConn(rows);

    const result = await executeMigration(conn);

    expect(result.total).toBe(2);
    expect(result.numeric).toHaveLength(1);
    expect(result.callForPrice).toHaveLength(1);
    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();

    const updateCalls = conn.query.mock.calls.filter(([sql]) => sql.startsWith("UPDATE products SET price = ?"));
    expect(updateCalls).toEqual([
      ["UPDATE products SET price = ? WHERE id = ?", [12000, 1]],
      ["UPDATE products SET price = ? WHERE id = ?", [null, 2]],
    ]);
  });

  it("rolls back and never commits when a write fails partway through", async () => {
    const rows = [
      { id: 1, title: "a", price_text: "100" },
      { id: 2, title: "b", price_text: "200" },
    ];
    let updateCount = 0;
    const conn = {
      query: vi.fn(async (sql) => {
        if (sql.startsWith("SELECT id, title, price_text FROM products")) return [rows];
        if (sql.startsWith("UPDATE products SET price = ?")) {
          updateCount += 1;
          if (updateCount === 2) throw new Error("connection lost");
          return [{ affectedRows: 1 }];
        }
        throw new Error(`unexpected query: ${sql}`);
      }),
      beginTransaction: vi.fn(async () => {}),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
    };

    await expect(executeMigration(conn)).rejects.toThrow("connection lost");

    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  it("handles zero products (nothing to write, still commits an empty transaction)", async () => {
    const conn = fakeConn([]);
    const result = await executeMigration(conn);
    expect(result).toEqual({ total: 0, numeric: [], callForPrice: [] });
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });
});
